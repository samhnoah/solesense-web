import { FOOT_SIZES } from '../data/foot'
import { MAPS, type Answer, type Foot, type MapId, type Site, type SiteId } from './sites'
import { ForceSource, GAUGE_MAX_GF, HOLD_MS, TARGET_GF, TOLERANCE_GF, bleSupported } from './source'

type Stage = 'setup' | 'test' | 'results'
type Phase = 'ready' | 'pressing' | 'ask'
interface Step { foot: Foot; site: Site }

const IDLE_RESET_S = 120 // an abandoned test returns to the start
const RESULTS_RESET_S = 60 // results clear themselves; nothing is stored

const F260 = FOOT_SIZES.find((s) => s.id === 'F260')!
const VIEW_W = F260.view[0]
const VIEW_H = F260.view[1]

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** Point on the dial's semicircle for a force in gf. */
function dialPt(v: number, r: number): [number, number] {
  const a = Math.PI * (1 - Math.min(Math.max(v, 0), GAUGE_MAX_GF) / GAUGE_MAX_GF)
  return [100 + r * Math.cos(a), 100 - r * Math.sin(a)]
}
function arc(from: number, to: number, r: number): string {
  const [x1, y1] = dialPt(from, r)
  const [x2, y2] = dialPt(to, r)
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)}`
}

export interface TestOptions { kiosk?: boolean; onActive?: (active: boolean) => void }

export function mountTest(root: HTMLElement, opts: TestOptions = {}): void {
  const src = new ForceSource()
  let stage: Stage = 'setup'
  let mapId: MapId = 'three'
  let feet: 'both' | Foot = 'right'
  let idx = 0
  let phase: Phase = 'ready'
  let hold = 0
  let applied = 0
  let inBandSince = 0
  let answers: Record<Foot, Partial<Record<SiteId, Answer>>> = { left: {}, right: {} }
  let lastActivity = Date.now()
  let qrSvg = ''

  const testedFeet = (): Foot[] => (feet === 'both' ? ['right', 'left'] : [feet])
  const steps = (): Step[] => testedFeet().flatMap((foot) => MAPS[mapId].map((site) => ({ foot, site })))
  const step = () => steps()[idx]
  const footLabel = (f: Foot) => (f === 'left' ? 'Left foot' : 'Right foot')

  root.innerHTML = `<div class="t"><div class="t__map" data-map></div><div class="t__panel" data-panel></div><div class="t__live" aria-live="polite" data-live></div></div>`
  const mapEl = root.querySelector<HTMLElement>('[data-map]')!
  const panel = root.querySelector<HTMLElement>('[data-panel]')!
  const live = root.querySelector<HTMLElement>('[data-live]')!
  const say = (s: string) => { live.textContent = s }

  // ── Foot map ──────────────────────────────────────────────
  function footSvg(foot: Foot): string {
    const mirror = foot === 'left' ? ` transform="translate(${VIEW_W} 0) scale(-1 1)"` : ''
    const shown = MAPS[mapId]
    const current = stage === 'test' ? step() : undefined
    const sites = shown.map((s) => {
      const a = answers[foot][s.id]
      const now = current && current.foot === foot && current.site.id === s.id
      const cls = ['fm-site', s.dorsal ? 'is-dorsal' : '', now ? 'is-now' : '', a === 'felt' ? 'is-felt' : '', a === 'notFelt' ? 'is-miss' : ''].join(' ')
      return `<g class="${cls}"><circle class="r" cx="${s.x}" cy="${s.y}" r="4"/><circle class="r" cx="${s.x}" cy="${s.y}" r="4"/><circle class="b" cx="${s.x}" cy="${s.y}" r="5.2"/></g>`
    }).join('')
    return `<div class="t__foot"><svg viewBox="-8 -8 ${VIEW_W + 16} ${VIEW_H + 16}" role="img" aria-label="${footLabel(foot)}, sole seen from below, with the test spots marked"><g${mirror}><path class="fm-outline" d="${F260.outline}"/>${sites}</g></svg><span class="mono">${footLabel(foot).toUpperCase()}</span></div>`
  }

  function renderMap(): void {
    const shownFeet: Foot[] = stage === 'test' ? [step().foot] : testedFeet().slice().reverse()
    const hud = stage === 'test'
      ? `<span>SOLE SEEN FROM BELOW</span><span>${footLabel(step().foot).toUpperCase()}</span>`
      : `<span>SOLE SEEN FROM BELOW</span><span>${MAPS[mapId].length} SPOTS PER FOOT</span>`
    mapEl.innerHTML = `<div class="t__maphud mono">${hud}</div><div class="t__feet">${shownFeet.map(footSvg).join('')}</div>`
  }

  // ── Panels ────────────────────────────────────────────────
  function renderSetup(): void {
    const dev = src.mode === 'ble'
      ? `<p class="t__note">Connected to <b>${esc(src.name)}</b>. Readings come from the device.</p><div class="t__row"><button type="button" class="btn btn--ghost" data-act="disconnect"><span>Disconnect</span><i>✕</i></button></div>`
      : `<div class="t__row"><button type="button" class="btn btn--ghost" data-act="connect" ${src.connecting ? 'disabled' : ''}><span>${src.connecting ? 'Looking for a device' : 'Connect a SoleSense'}</span><i>⌁</i></button></div>
         ${src.error === 'unsupported' || !bleSupported ? '<p class="t__note">This browser can’t connect over Bluetooth. Chrome or Edge on Android or a computer can. The simulated device works everywhere.</p>' : ''}
         ${src.error === 'failed' ? '<p class="t__note t__note--bad">No device was connected. The simulated device is still ready.</p>' : ''}`
    panel.innerHTML = `
      <span class="t__banner mono">DEMONSTRATION WITH A PROTOTYPE · NOT A MEDICAL TEST</span>
      <h3>Set up <em>the test.</em></h3>
      <p>One light press at each marked spot. After each press, say whether it was felt.</p>
      <fieldset class="t__fs"><legend class="mono">Spots</legend><div class="t__opts">
        <label class="opt"><input type="radio" name="map" value="three" ${mapId === 'three' ? 'checked' : ''}><span><b>Three spots</b><small>Big toe and two points on the ball of the foot. The quick screening map.</small></span></label>
        <label class="opt"><input type="radio" name="map" value="ten" ${mapId === 'ten' ? 'checked' : ''}><span><b>Ten spots</b><small>Toes, ball, arch, heel and the top of the foot. The classic full map.</small></span></label>
      </div></fieldset>
      <fieldset class="t__fs"><legend class="mono">Feet</legend><div class="t__opts t__opts--3">
        <label class="opt"><input type="radio" name="feet" value="right" ${feet === 'right' ? 'checked' : ''}><span><b>Right</b></span></label>
        <label class="opt"><input type="radio" name="feet" value="left" ${feet === 'left' ? 'checked' : ''}><span><b>Left</b></span></label>
        <label class="opt"><input type="radio" name="feet" value="both" ${feet === 'both' ? 'checked' : ''}><span><b>Both</b></span></label>
      </div></fieldset>
      <fieldset class="t__fs"><legend class="mono">Device · ${src.mode === 'ble' ? 'SoleSense over Bluetooth' : 'simulated on this screen'}</legend>${dev}</fieldset>
      <div class="t__row"><button type="button" class="btn btn--solid" data-act="start"><span>Start the test</span><i>→</i></button></div>
      ${opts.kiosk && qrSvg ? `<div class="t__qr"><div>${qrSvg}</div><p><b>Try it on your phone.</b><br>Scan to open this test.</p></div>` : ''}`
  }

  function renderTest(): void {
    const s = step()
    const all = steps()
    const dots = all.map((st, i) => {
      const a = answers[st.foot][st.site.id]
      return `<i class="${i === idx ? 'is-now' : a === 'felt' ? 'is-done' : a === 'notFelt' ? 'is-miss' : ''}"></i>`
    }).join('')
    const ble = src.mode === 'ble'
    panel.innerHTML = `
      <span class="t__banner mono">DEMONSTRATION · NOT A MEDICAL TEST</span>
      <div class="t__prog mono"><span>SPOT <b>${idx + 1}</b> OF ${all.length}</span><span>${footLabel(s.foot).toUpperCase()}</span></div>
      <div class="t__dots">${dots}</div>
      <div class="t__site"><small>${s.site.dorsal ? 'Top of the foot' : 'Sole of the foot'}</small>${esc(s.site.name)}</div>
      <div class="dial" aria-hidden="true">
        <svg viewBox="0 -8 200 116">
          <path class="dial__track" d="${arc(0, GAUGE_MAX_GF, 80)}"/>
          <path class="dial__band" d="${arc(TARGET_GF - TOLERANCE_GF, TARGET_GF + TOLERANCE_GF, 80)}"/>
          <path class="dial__val" data-val d=""/>
          <path class="dial__hold" data-hold d=""/>
          <text x="${dialPt(0, 96)[0] - 2}" y="${dialPt(0, 96)[1] + 4}" text-anchor="end">0</text>
          <text x="${dialPt(TARGET_GF, 98)[0]}" y="${dialPt(TARGET_GF, 98)[1]}" text-anchor="middle">10 g</text>
          <text x="${dialPt(GAUGE_MAX_GF, 96)[0] + 2}" y="${dialPt(GAUGE_MAX_GF, 96)[1] + 4}">15</text>
        </svg>
        <div class="dial__read"><b data-gf>0.0</b><span class="mono" data-dialnote>TARGET 10 ± 1.5 GF</span></div>
      </div>
      <div data-phase></div>
      <div class="t__minor"><button type="button" data-act="back" ${idx === 0 ? 'disabled' : ''}>← Back one spot</button><button type="button" data-act="quit">Stop the test</button></div>`
    renderPhase(ble)
    updateDial()
  }

  function renderPhase(ble = src.mode === 'ble'): void {
    const box = panel.querySelector<HTMLElement>('[data-phase]')
    if (!box) return
    if (phase === 'ask') {
      box.innerHTML = `<p style="margin-bottom:12px">Ten grams applied. <b>Was the touch felt?</b></p>
        <div class="t__ask"><button type="button" class="btn btn--solid" data-act="felt"><span>Felt it</span><i>✓</i></button><button type="button" class="btn btn--coral" data-act="notFelt"><span>Didn’t feel it</span><i>✕</i></button></div>`
      box.querySelector<HTMLButtonElement>('[data-act="felt"]')?.focus()
    } else if (ble) {
      box.innerHTML = `<p>Press the device against the highlighted spot until the reading reaches 10 grams, and hold it there for a second.</p>`
    } else {
      box.innerHTML = `<p style="margin-bottom:14px">Hold the button. Keep holding until the outer ring closes.</p>
        <button type="button" class="hold" data-hold-btn><span class="hold__ring"></span><span class="hold__label">Hold to press</span><kbd class="mono">SPACE</kbd></button>`
      const btn = box.querySelector<HTMLButtonElement>('[data-hold-btn]')!
      const down = (e: Event) => { e.preventDefault(); btn.classList.add('is-down'); src.hold(true); if (phase === 'ready') phase = 'pressing' }
      const up = () => { btn.classList.remove('is-down'); src.hold(false) }
      btn.addEventListener('pointerdown', down)
      btn.addEventListener('pointerup', up)
      btn.addEventListener('pointerleave', up)
      btn.addEventListener('pointercancel', up)
      btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e) })
      btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') up() })
      btn.addEventListener('contextmenu', (e) => e.preventDefault())
    }
  }

  function updateDial(): void {
    const valEl = panel.querySelector<SVGPathElement>('[data-val]')
    if (!valEl) return
    const f = phase === 'ask' ? applied : src.force
    valEl.setAttribute('d', f > 0.02 ? arc(0, f, 80) : '')
    panel.querySelector<SVGPathElement>('[data-hold]')!.setAttribute('d', hold > 0.01 ? arc(0, hold * GAUGE_MAX_GF, 92) : '')
    panel.querySelector('[data-gf]')!.textContent = f.toFixed(1)
    const note = panel.querySelector('[data-dialnote]')!
    note.textContent = phase === 'ask' ? '10 G APPLIED' : hold > 0 ? `HOLDING · ${(hold * HOLD_MS / 1000).toFixed(1)} S` : 'TARGET 10 ± 1.5 GF'
  }

  function renderResults(): void {
    const total = steps().length
    const felt = testedFeet().reduce((n, f) => n + Object.values(answers[f]).filter((a) => a === 'felt').length, 0)
    const missed = total - felt
    panel.innerHTML = `
      <span class="t__banner mono">DEMONSTRATION · NOT A MEDICAL RESULT</span>
      <h3>What was <em>recorded.</em></h3>
      <div class="t__summary"><b class="${missed ? 'is-miss' : ''}">${felt}<u>/${total} felt</u></b></div>
      <p>${missed === 0 ? `All ${total} spots were felt. In a real screening, that means protective sensation is present at the places tested.` : `${missed} of the ${total} spots ${missed === 1 ? 'was' : 'were'} not felt. In a real screening, a spot that isn’t felt is a reason to have the feet checked by a clinician.`}</p>
      <div class="t__legend mono"><span><i class="f"></i>Felt</span><span><i class="n"></i>Not felt</span></div>
      <p class="t__note">The prototype hasn’t been calibrated yet, so this is not a medical result or a diagnosis.</p>
      <div class="t__row"><button type="button" class="btn btn--solid" data-act="again"><span>Start a new test</span><i>↻</i></button>
      ${opts.kiosk ? '<a class="btn btn--ghost" href="./index.html"><span>About SoleSense</span><i>→</i></a>' : ''}</div>
      ${opts.kiosk ? `<p class="t__note mono" data-countdown>THIS SCREEN CLEARS IN ${RESULTS_RESET_S} S · NOTHING IS SAVED</p>` : ''}`
    say(`Test finished. ${felt} of ${total} spots felt.`)
  }

  function render(): void {
    renderMap()
    if (stage === 'setup') renderSetup()
    else if (stage === 'test') renderTest()
    else renderResults()
  }

  // ── Actions ───────────────────────────────────────────────
  function start(): void {
    answers = { left: {}, right: {} }
    idx = 0; phase = 'ready'; hold = 0; inBandSince = 0
    stage = 'test'
    src.reset()
    render()
    say(`Spot 1: ${step().site.name}, ${footLabel(step().foot)}.`)
    opts.onActive?.(true)
  }

  function reset(): void {
    src.reset()
    answers = { left: {}, right: {} }
    stage = 'setup'; phase = 'ready'; hold = 0; inBandSince = 0
    render()
    opts.onActive?.(false)
  }

  function answer(a: Answer): void {
    const s = step()
    if (!s) return
    answers[s.foot][s.site.id] = a
    src.reset()
    hold = 0; inBandSince = 0; phase = 'ready'
    if (idx + 1 >= steps().length) { stage = 'results'; render(); opts.onActive?.(false); return }
    idx++
    render()
    say(`${a === 'felt' ? 'Felt' : 'Not felt'}. Spot ${idx + 1}: ${step().site.name}, ${footLabel(step().foot)}.`)
  }

  function back(): void {
    if (idx === 0) return
    src.reset()
    idx--
    delete answers[step().foot][step().site.id]
    phase = 'ready'; hold = 0; inBandSince = 0
    render()
  }

  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')
    if (!t || (t as HTMLButtonElement).disabled) return
    const act = t.dataset.act
    if (act === 'start') start()
    else if (act === 'connect') void src.connect().then(render)
    else if (act === 'disconnect') { src.disconnect(); render() }
    else if (act === 'felt' || act === 'notFelt') answer(act)
    else if (act === 'back') back()
    else if (act === 'quit') reset()
    else if (act === 'again') reset()
  })
  root.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement
    if (input.name === 'map') { mapId = input.value as MapId; renderMap() }
    if (input.name === 'feet') { feet = input.value as 'both' | Foot; renderMap() }
  })

  // Space bar presses the simulated device while the test is on screen.
  const inView = () => { const r = root.getBoundingClientRect(); return r.top < innerHeight * 0.7 && r.bottom > innerHeight * 0.3 }
  window.addEventListener('keydown', (e) => {
    if (e.key !== ' ' || e.repeat || stage !== 'test' || phase === 'ask' || src.mode !== 'sim' || !inView()) return
    if (e.target instanceof Element && e.target.closest('button, input, a')) return
    e.preventDefault()
    panel.querySelector('[data-hold-btn]')?.classList.add('is-down')
    src.hold(true)
  })
  window.addEventListener('keyup', (e) => {
    if (e.key !== ' ') return
    panel.querySelector('[data-hold-btn]')?.classList.remove('is-down')
    src.hold(false)
  })

  // A press counts once the force has stayed inside the target band for HOLD_MS.
  // The same rule applies to simulated and real readings.
  src.on(() => {
    if (stage !== 'test') return
    if (phase !== 'ask') {
      const now = performance.now()
      if (Math.abs(src.force - TARGET_GF) <= TOLERANCE_GF) {
        if (!inBandSince) inBandSince = now
        hold = Math.min(1, (now - inBandSince) / HOLD_MS)
        if (hold >= 1) {
          phase = 'ask'; inBandSince = 0; applied = src.force
          src.hold(false)
          panel.querySelector('[data-hold-btn]')?.classList.remove('is-down')
          renderPhase()
          say('Ten grams applied. Was the touch felt?')
        }
      } else {
        inBandSince = 0
        hold = 0
      }
    }
    updateDial()
  })

  // Kiosk behaviour: clear the screen when nobody is using it.
  const touch = () => { lastActivity = Date.now() }
  window.addEventListener('pointerdown', touch)
  window.addEventListener('keydown', touch)
  if (opts.kiosk) {
    setInterval(() => {
      const idle = (Date.now() - lastActivity) / 1000
      if (stage === 'results') {
        const left = Math.max(0, Math.ceil(RESULTS_RESET_S - idle))
        const el = panel.querySelector('[data-countdown]')
        if (el) el.textContent = `THIS SCREEN CLEARS IN ${left} S · NOTHING IS SAVED`
        if (left === 0) reset()
      } else if (stage === 'test' && idle > IDLE_RESET_S && src.force < 0.5) {
        reset()
      }
    }, 1000)
    void import('qrcode').then(async (QR) => {
      try {
        qrSvg = await QR.toString(location.href, { type: 'svg', margin: 0, color: { dark: '#040807', light: '#ffffff' } })
        if (stage === 'setup') renderSetup()
      } catch { /* QR is optional */ }
    })
  }

  render()
}
