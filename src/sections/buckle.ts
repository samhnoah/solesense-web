// Side view of a 10 g monofilament pressed into skin, scrubbed by scroll, with
// its force–travel curve. The shape is a simple Euler-buckling illustration:
// force rises until the filament bows, then stays near its buckling load.

const FB = 10 // buckling load of "our" filament, g
const OTHERS = [8.1, 9.2, 11.1, 12.4] // other filaments, same label
const XB = 0.32 // travel fraction at which it buckles
const STEPS = ['The filament touches the skin.', 'Pushing harder bends the skin and raises the force.', 'The filament bows. From here on, the force stays near 10 g however far the hand moves.', 'Each filament buckles at its own force, and that force drifts with wear, temperature and humidity.']

export function mountBuckle(canvas: HTMLCanvasElement, gfEl: HTMLElement, noteEl: HTMLElement, stepsEl: HTMLElement) {
  const ctx = canvas.getContext('2d')!
  let p = 0
  let shown = -1
  let dpr = 1
  let W = 0
  let H = 0

  const steps = Array.from(stepsEl.children) as HTMLElement[]

  function resize() {
    const r = canvas.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio, 2)
    canvas.width = Math.round(r.width * dpr)
    canvas.height = Math.round(r.height * dpr)
    W = canvas.width
    H = canvas.height
    draw()
  }

  // Phases: 0–.12 approach, .12–.42 load, .42–.72 buckle, .72–1 variance.
  const travelAt = (q: number) => Math.max(0, (q - 0.12) / 0.6) // 0..1 after contact
  const forceAt = (x: number, fb = FB) => (x <= XB * (fb / FB) ? (x / XB) * FB : fb * (1 - 0.04 * (x - XB)))

  function draw() {
    const c = ctx
    c.clearRect(0, 0, W, H)
    const u = W / 1000 // design units: 1000 × 625
    const q = p
    const x = Math.min(1, travelAt(q))
    const f = q < 0.12 ? 0 : forceAt(x)
    const variance = Math.max(0, Math.min(1, (q - 0.72) / 0.18))

    // ── left: the scene ─────────────────────────
    const sx = 270 * u
    const skinY = 430 * u
    const L = 210 * u // filament free length
    const approach = Math.max(0, 1 - q / 0.12) * 70 * u
    const shorten = x > XB ? (x - XB) * 120 * u : 0
    const dimple = (f / 15) * 26 * u
    const tipY = skinY + dimple * 0.95
    const baseY = tipY - L + shorten - approach

    // skin layers
    const skin = c.createLinearGradient(0, skinY - 10 * u, 0, H)
    skin.addColorStop(0, 'rgba(255,190,160,.22)')
    skin.addColorStop(0.15, 'rgba(255,140,110,.10)')
    skin.addColorStop(1, 'rgba(40,20,20,0)')
    c.fillStyle = skin
    c.beginPath()
    c.moveTo(0, H)
    c.lineTo(0, skinY)
    for (let i = 0; i <= 60; i++) {
      const xx = (i / 60) * 560 * u
      const d = Math.exp(-(((xx - sx) / (46 * u)) ** 2)) * dimple
      c.lineTo(xx, skinY + d)
    }
    c.lineTo(560 * u, H)
    c.closePath()
    c.fill()
    c.strokeStyle = 'rgba(255,200,170,.6)'
    c.lineWidth = 1.5 * u
    c.beginPath()
    for (let i = 0; i <= 60; i++) {
      const xx = (i / 60) * 560 * u
      const d = Math.exp(-(((xx - sx) / (46 * u)) ** 2)) * dimple
      if (i === 0) c.moveTo(xx, skinY + d)
      else c.lineTo(xx, skinY + d)
    }
    c.stroke()
    // pressure ripples under the tip
    if (f > 0.5) {
      for (let i = 1; i <= 3; i++) {
        c.strokeStyle = `rgba(255,181,71,${(0.22 * f) / 15 / i * 3})`
        c.beginPath()
        c.ellipse(sx, tipY + 6 * u, 26 * u * i * (0.6 + f / 25), 8 * u * i, 0, 0, Math.PI)
        c.stroke()
      }
    }

    // holder
    c.fillStyle = 'rgba(230,236,233,.92)'
    const hw = 54 * u
    const hh = 120 * u
    c.beginPath()
    c.roundRect(sx - hw / 2, baseY - hh, hw, hh, 10 * u)
    c.fill()
    c.fillStyle = '#12a493'
    c.fillRect(sx - hw / 2, baseY - 16 * u, hw, 8 * u)

    // filament: straight, then a half-sine bow conserving length
    const amp = x > XB ? (2 / Math.PI) * Math.sqrt(shorten * L) : 0
    c.strokeStyle = '#ffb547'
    c.lineWidth = 3 * u
    c.shadowColor = 'rgba(255,170,60,.8)'
    c.shadowBlur = 12 * u
    c.beginPath()
    for (let i = 0; i <= 40; i++) {
      const s = i / 40
      const yy = baseY + (tipY - baseY) * s
      const xx = sx + amp * Math.sin(Math.PI * s)
      if (i === 0) c.moveTo(xx, yy)
      else c.lineTo(xx, yy)
    }
    c.stroke()
    c.shadowBlur = 0

    // label at the tip
    c.font = `${12 * u}px ui-monospace, Menlo, monospace`
    c.fillStyle = 'rgba(182,198,194,.85)'
    c.fillText(q < 0.12 ? 'APPROACH' : x <= XB ? 'COMPRESSING' : 'BUCKLED', sx + 40 * u, tipY - 60 * u)

    // ── right: force vs travel ───────────────────
    const gx = 600 * u
    const gy = 90 * u
    const gw = 360 * u
    const gh = 400 * u
    const yOf = (g: number) => gy + gh - (g / 15) * gh
    const xOf = (t: number) => gx + t * gw
    c.strokeStyle = 'rgba(150,235,215,.22)'
    c.lineWidth = 1 * u
    c.beginPath()
    c.moveTo(gx, gy); c.lineTo(gx, gy + gh); c.lineTo(gx + gw, gy + gh)
    c.stroke()
    c.fillStyle = 'rgba(134,154,151,.9)'
    c.font = `${11 * u}px ui-monospace, Menlo, monospace`
    for (const g of [0, 5, 10, 15]) {
      c.fillText(String(g), gx - 26 * u, yOf(g) + 4 * u)
      c.strokeStyle = 'rgba(150,235,215,.07)'
      c.beginPath(); c.moveTo(gx, yOf(g)); c.lineTo(gx + gw, yOf(g)); c.stroke()
    }
    c.fillText('FORCE, G', gx, gy - 18 * u)
    c.fillText('TRAVEL OF THE HAND →', gx + gw - 170 * u, gy + gh + 26 * u)
    // 10 g line
    c.setLineDash([5 * u, 6 * u])
    c.strokeStyle = 'rgba(60,232,207,.6)'
    c.beginPath(); c.moveTo(gx, yOf(10)); c.lineTo(gx + gw, yOf(10)); c.stroke()
    c.setLineDash([])
    c.fillStyle = 'rgba(60,232,207,.9)'
    c.fillText('10 G', gx + gw + 8 * u, yOf(10) + 4 * u)

    // variance band and other filaments
    if (variance > 0) {
      c.fillStyle = `rgba(255,90,60,${0.1 * variance})`
      c.fillRect(gx, yOf(12.6), gw, yOf(7.9) - yOf(12.6))
      OTHERS.forEach((fb, i) => {
        c.strokeStyle = `rgba(255,140,110,${0.55 * variance})`
        c.lineWidth = 1.2 * u
        c.beginPath()
        const n = Math.round(60 * Math.min(1, variance * 1.4 - i * 0.1))
        for (let k = 0; k <= n; k++) {
          const t = k / 60
          const yy = yOf(forceAt(t, fb))
          if (k === 0) c.moveTo(xOf(t), yy)
          else c.lineTo(xOf(t), yy)
        }
        c.stroke()
      })
      c.fillStyle = `rgba(255,140,110,${variance})`
      c.fillText('SAME LABEL, OTHER FILAMENTS', gx + 12 * u, yOf(12.6) - 10 * u)
    }

    // our curve up to now
    if (q >= 0.12) {
      c.strokeStyle = '#ffb547'
      c.lineWidth = 2.5 * u
      c.beginPath()
      const n = Math.round(x * 120)
      for (let k = 0; k <= n; k++) {
        const t = k / 120
        if (k === 0) c.moveTo(xOf(t), yOf(forceAt(t)))
        else c.lineTo(xOf(t), yOf(forceAt(t)))
      }
      c.stroke()
      c.fillStyle = '#ffb547'
      c.beginPath(); c.arc(xOf(x), yOf(f), 5 * u, 0, 6.283); c.fill()
      c.strokeStyle = 'rgba(255,181,71,.35)'
      c.beginPath(); c.arc(xOf(x), yOf(f), 11 * u, 0, 6.283); c.stroke()
    }

    // readouts
    gfEl.textContent = f.toFixed(1)
    const phase = q < 0.12 ? 0 : x <= XB ? 1 : q < 0.72 ? 2 : 3
    if (phase !== shown) {
      shown = phase
      noteEl.textContent = STEPS[phase]
      steps.forEach((li, i) => li.classList.toggle('is-on', i <= phase))
    }
  }

  new ResizeObserver(resize).observe(canvas)
  resize()
  return { setProgress(v: number) { p = Math.max(0, Math.min(1, v)); draw() } }
}
