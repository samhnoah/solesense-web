import { STOP_MM, fieldMt, forceGf, hallMv } from '../lib/press'

// Hold-to-press lab: travel grows while the button (or Space) is held, slowly
// at first so 1 g and 10 g can be watched, then faster up to the stop.

export interface PressState { travel: number; gf: number; active: boolean }

export function mountPress(opts: {
  button: HTMLButtonElement
  beams: HTMLElement
  hud: HTMLElement
  onChange: (s: PressState) => void
}) {
  const $ = (id: string) => document.getElementById(id)!
  const els = {
    gf: $('ph-gf'), mm: $('ph-mm'), mt: $('ph-mt'), mv: $('ph-mv'), gap: $('ph-gap'),
    fill: $('ph-fill'), state: $('ph-state'), bar: $('ph-bar'),
  }
  const ticks = Array.from(els.bar.querySelectorAll<HTMLElement>('.tick'))
  let t = 0.8
  let travel = 0
  let speed = 0
  let holding = false
  let active = false
  let raf = 0
  let last = 0
  let shownState = ''

  const fMax = () => forceGf(STOP_MM, t)
  const pos = (gf: number) => Math.log10(1 + gf) / Math.log10(1 + fMax())

  function placeTicks() {
    ticks.forEach((el) => { el.style.left = `${(pos(+el.dataset.gf!) * 100).toFixed(2)}%` })
  }

  function update() {
    const gf = forceGf(travel, t)
    const mt = fieldMt(travel)
    const mv = hallMv(mt)
    els.gf.textContent = gf < 10 ? gf.toFixed(2) : gf.toFixed(1)
    els.mm.textContent = travel.toFixed(3)
    els.mt.textContent = mt.toFixed(1)
    els.mv.textContent = mv.toFixed(0)
    els.gap.textContent = (5 - travel).toFixed(2)
    els.fill.style.width = `${(pos(gf) * 100).toFixed(2)}%`
    const dmv = mv - hallMv(fieldMt(0))
    let s: string
    let cls = ''
    if (travel >= STOP_MM - 1e-4) { s = 'TRAVEL STOP · EXTRA FORCE GOES INTO THE HOUSING · READING NO LONGER VALID'; cls = 'is-bad' }
    else if (travel < 0.002) s = 'AT REST · MAGNET 5.00 MM FROM THE SENSOR'
    else if (gf < 1) { s = `LIGHT TOUCH · ${dmv.toFixed(1)} MV ABOVE REST · NEAR THE ESP32 NOISE FLOOR`; cls = 'is-warn' }
    else if (gf < 10) { s = `PAST 1 GF · THE LIGHT-TOUCH TARGET · ${dmv.toFixed(1)} MV`; cls = gf < 3 ? 'is-warn' : '' }
    else if (gf < 75) s = 'PAST 10 GF · THE SCREENING FORCE'
    else s = 'PAST 75 GF · THE FIRM-PRESS TARGET'
    if (s + cls !== shownState) {
      shownState = s + cls
      els.state.textContent = s
      els.state.className = `press-hud__state ${cls}`
    }
    opts.onChange({ travel, gf, active })
  }

  function tick(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (holding) {
      speed = Math.min(1.25, speed + 0.62 * dt)
      travel = Math.min(STOP_MM, travel + speed * dt)
    } else {
      travel *= Math.exp(-dt * 6.5)
      if (travel < 0.0004) travel = 0
    }
    update()
    raf = holding || travel > 0 ? requestAnimationFrame(tick) : 0
  }

  function setHolding(on: boolean) {
    if (on && !active) return
    if (on === holding) return
    holding = on
    opts.button.classList.toggle('is-down', on)
    if (on) speed = 0.12
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick) }
  }

  const b = opts.button
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    try { b.setPointerCapture(e.pointerId) } catch { /* synthetic pointer */ }
    setHolding(true)
  })
  b.addEventListener('pointerup', () => setHolding(false))
  b.addEventListener('pointercancel', () => setHolding(false))
  b.addEventListener('lostpointercapture', () => setHolding(false))
  b.addEventListener('contextmenu', (e) => e.preventDefault())
  b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); setHolding(true) } })
  b.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') setHolding(false) })
  window.addEventListener('keydown', (e) => {
    if (e.key !== ' ' || e.repeat || !active) return
    if (e.target instanceof Element && e.target.closest('input, textarea, select, a, button:not(#press-hold)')) return
    e.preventDefault()
    setHolding(true)
  })
  window.addEventListener('keyup', (e) => { if (e.key === ' ') setHolding(false) })

  opts.beams.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!btn?.dataset.t) return
    t = +btn.dataset.t
    opts.beams.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === btn)))
    placeTicks()
    update()
  })

  placeTicks()
  update()

  return {
    setActive(on: boolean) {
      if (on === active) return
      active = on
      opts.hud.classList.toggle('is-on', on)
      if (!on) setHolding(false)
    },
  }
}
