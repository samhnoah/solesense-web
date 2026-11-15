import { FOOT_SIZES } from '../data/foot'

// A sole drawn as a field of points. Scroll moves a "loss front" from the toes
// toward the heel; points behind it go dark. Hovering probes the foot: live
// points answer, dark ones don't. Illustrative only.

interface Dot { x: number; y: number; jitter: number; phase: number; hot: number }

export function mountField(canvas: HTMLCanvasElement, pctEl: HTMLElement, cursorRead: (s: string) => void) {
  const foot = FOOT_SIZES.find((s) => s.id === 'F260')!
  const [VW, VH] = foot.view
  const path = new Path2D(foot.outline)
  const ctx = canvas.getContext('2d')!
  const dots: Dot[] = []
  const probe = { x: -999, y: -999, on: false }
  let progress = 0
  let eased = 0
  let visible = false
  let raf = 0
  let scale = 1
  let ox = 0
  let oy = 0
  let dpr = 1

  // Hex grid of points inside the outline (mm).
  {
    const off = document.createElement('canvas').getContext('2d')!
    const step = 4.6
    for (let row = 0, y = 4; y < VH - 2; row++, y += step * 0.866) {
      for (let x = (row % 2) * step * 0.5 + 2; x < VW - 2; x += step) {
        if (off.isPointInPath(path, x, y)) dots.push({ x, y, jitter: Math.random(), phase: Math.random() * 6.28, hot: 0 })
      }
    }
  }

  function resize() {
    const r = canvas.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio, 2)
    canvas.width = Math.round(r.width * dpr)
    canvas.height = Math.round(r.height * dpr)
    const pad = 34 * dpr
    scale = Math.min((canvas.width - pad * 0.4) / VW, (canvas.height - pad * 2) / VH)
    ox = (canvas.width - VW * scale) / 2
    oy = (canvas.height - VH * scale) / 2
  }

  // Loss front in mm from the toe end; slight wobble so it reads as tissue, not a ruler.
  const front = () => eased * (VH * 0.78)
  const lost = (d: Dot) => d.y < front() - 6 + d.jitter * 12 + Math.sin(d.x * 0.15) * 4

  function draw(now: number) {
    raf = 0
    if (!visible) return
    eased += (progress - eased) * 0.08
    const t = now / 1000
    const c = ctx
    c.clearRect(0, 0, canvas.width, canvas.height)
    c.save()
    c.translate(ox, oy)
    c.scale(scale, scale)

    c.lineWidth = 0.6
    c.strokeStyle = 'rgba(170,245,230,.38)'
    c.stroke(path)

    let alive = 0
    const f = front()
    for (const d of dots) {
      const dead = lost(d)
      const near = probe.on ? Math.hypot(d.x - probe.x, d.y - probe.y) : 999
      const target = near < 14 ? 1 - near / 14 : 0
      d.hot += (target - d.hot) * 0.18
      if (!dead) alive++
      const edge = Math.max(0, 1 - Math.abs(d.y - f) / 10) * eased
      if (dead) {
        const flick = edge > 0.1 ? 0.25 + 0.25 * Math.sin(t * 9 + d.phase) : 0
        c.fillStyle = edge > 0.1 ? `rgba(255,90,60,${0.18 + flick})` : `rgba(90,112,108,${0.22 + d.hot * 0.15})`
        c.beginPath(); c.arc(d.x, d.y, 0.7, 0, 6.283); c.fill()
      } else {
        const tw = 0.55 + 0.45 * Math.sin(t * 1.6 + d.phase)
        const a = 0.35 + 0.4 * tw + d.hot * 0.6
        const r = 0.85 + d.hot * 1.1
        if (d.hot > 0.05) {
          c.fillStyle = `rgba(60,232,207,${d.hot * 0.18})`
          c.beginPath(); c.arc(d.x, d.y, r * 3.2, 0, 6.283); c.fill()
        }
        c.fillStyle = `rgba(${Math.round(60 + 180 * d.hot)},232,${Math.round(207 + 40 * d.hot)},${Math.min(1, a)})`
        c.beginPath(); c.arc(d.x, d.y, r, 0, 6.283); c.fill()
      }
    }

    // The loss front itself
    if (eased > 0.02) {
      c.save()
      c.clip(path)
      const g = c.createLinearGradient(0, f - 26, 0, f + 4)
      g.addColorStop(0, 'rgba(255,90,60,0)')
      g.addColorStop(0.85, 'rgba(255,90,60,.12)')
      g.addColorStop(1, 'rgba(255,90,60,0)')
      c.fillStyle = g
      c.fillRect(0, f - 26, VW, 30)
      c.restore()
    }

    if (probe.on) {
      c.strokeStyle = 'rgba(255,181,71,.8)'
      c.lineWidth = 0.5
      c.beginPath(); c.arc(probe.x, probe.y, 5 + Math.sin(t * 5) * 0.6, 0, 6.283); c.stroke()
    }
    c.restore()

    const pct = Math.round((alive / dots.length) * 100)
    pctEl.textContent = `FEELING ${pct}%`
    if (probe.on) {
      const d = dots.reduce((best, x) => (Math.hypot(x.x - probe.x, x.y - probe.y) < Math.hypot(best.x - probe.x, best.y - probe.y) ? x : best), dots[0])
      cursorRead(lost(d) ? 'NOT FELT' : 'FELT')
    }
    raf = requestAnimationFrame(draw)
  }

  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(draw) }

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect()
    const x = ((e.clientX - r.left) * dpr - ox) / scale
    const y = ((e.clientY - r.top) * dpr - oy) / scale
    const ctxCheck = ctx.isPointInPath(path, x, y)
    probe.x = x; probe.y = y; probe.on = ctxCheck
    if (!ctxCheck) cursorRead('')
  })
  canvas.addEventListener('pointerleave', () => { probe.on = false; cursorRead('') })

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick() }).observe(canvas)
  new ResizeObserver(() => { resize(); kick() }).observe(canvas)
  resize()

  return {
    setProgress(p: number) { progress = Math.max(0, Math.min(1, p)); kick() },
  }
}
