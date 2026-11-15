import { gsap } from 'gsap'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'
import { FOOT_SIZES, FOOT_WINDOWS } from '../data/foot'

gsap.registerPlugin(MorphSVGPlugin)

const NS = 'http://www.w3.org/2000/svg'
const BOX_W = 140 // largest canvas (F300), mm
const BOX_H = 324

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  parent?.appendChild(e)
  return e
}

/** Shift an "M x,y L x,y … Z" outline so every size shares the heel line and centre. */
function placed(outline: string, dx: number, dy: number): string {
  return outline.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, (_, a, b) => `${(+a + dx).toFixed(1)},${(+b + dy).toFixed(1)}`)
}

export function mountGuide(svg: SVGSVGElement, list: HTMLOListElement, sizes: HTMLElement, dims: HTMLElement) {
  const ref = FOOT_SIZES.find((s) => s.id === 'F260')!
  const offset = (s: (typeof FOOT_SIZES)[number]) => [(BOX_W - s.view[0]) / 2, BOX_H - s.view[1]] as const

  const defs = el('defs', {}, svg)
  const grad = el('linearGradient', { id: 'acrylic', x1: 0, y1: 0, x2: 1, y2: 1 }, defs)
  el('stop', { offset: 0, 'stop-color': '#bff7ec', 'stop-opacity': 0.14 }, grad)
  el('stop', { offset: 0.5, 'stop-color': '#3ce8cf', 'stop-opacity': 0.04 }, grad)
  el('stop', { offset: 1, 'stop-color': '#bff7ec', 'stop-opacity': 0.1 }, grad)

  // Faint outlines of every size, heel-aligned, for scale.
  const ghosts = el('g', { opacity: 0.22 }, svg)
  for (const s of FOOT_SIZES) {
    const [dx, dy] = offset(s)
    el('path', { d: placed(s.outline, dx, dy), fill: 'none', stroke: 'rgba(170,245,230,.6)', 'stroke-width': 0.3, 'stroke-dasharray': '1.2 1.6' }, ghosts)
  }

  const [rx, ry] = offset(ref)
  const glow = el('path', { class: 'foot-glow', d: placed(ref.outline, rx, ry) }, svg)
  const glass = el('path', { class: 'foot-glass', d: placed(ref.outline, rx, ry), fill: 'url(#acrylic)' }, svg)

  // 50 mm engraved ruler on the outer midfoot, heel mark and axis.
  const marks = el('g', {}, svg)
  const ruler = el('g', { class: 'foot-ruler' }, marks)
  el('line', { x1: 0, y1: 0, x2: 0, y2: 50 }, ruler)
  for (let i = 0; i <= 10; i++) el('line', { x1: 0, y1: i * 5, x2: i % 2 ? 1.6 : 3, y2: i * 5 }, ruler)
  const rulerText = el('text', { class: 'engrave', x: 4, y: 27 }, marks)
  rulerText.textContent = '50 MM'
  const axis = el('line', { class: 'foot-ruler', 'stroke-dasharray': '2 2' }, marks)
  const heel = el('g', { class: 'foot-ruler' }, marks)
  el('line', { x1: -5, y1: 0, x2: 5, y2: 0 }, heel)
  el('line', { x1: 0, y1: -3, x2: 0, y2: 3 }, heel)
  const tag = el('text', { class: 'engrave', 'text-anchor': 'middle' }, marks)
  const tag2 = el('text', { class: 'engrave', 'text-anchor': 'middle' }, marks)

  const winEls = FOOT_WINDOWS.map((w) => {
    const g = el('g', { class: 'win', tabindex: 0, role: 'button', 'aria-label': `Window ${w.id}: ${w.name}` }, svg)
    const pulse = el('rect', { class: 'pulse', rx: 5, ry: 5 }, g)
    const rect = el('rect', { class: 'w', rx: 5, ry: 5 }, g)
    const txt = el('text', {}, g)
    txt.textContent = w.id
    return { w, g, rect, pulse, txt }
  })

  list.innerHTML = FOOT_WINDOWS.map((w) => `<li data-win="${w.id}"><b>${w.id}</b><span>${w.name}<small>${w.plain}</small></span><em class="mono">${w.w}×${w.h}</em></li>`).join('')
  const items = Array.from(list.children) as HTMLElement[]

  const setActive = (id: string | null) => {
    winEls.forEach((x) => x.g.classList.toggle('is-on', x.w.id === id))
    items.forEach((li) => li.classList.toggle('is-on', li.dataset.win === id))
  }
  winEls.forEach((x) => {
    x.g.addEventListener('pointerenter', () => setActive(x.w.id))
    x.g.addEventListener('focus', () => setActive(x.w.id))
    x.g.addEventListener('pointerleave', () => setActive(null))
    x.g.addEventListener('blur', () => setActive(null))
  })
  items.forEach((li) => {
    li.addEventListener('pointerenter', () => setActive(li.dataset.win!))
    li.addEventListener('pointerleave', () => setActive(null))
  })

  // Lay out windows and marks for a size. Window centres scale with the plate,
  // as the generator's fractional positions do; openings stay 18 × 18 mm
  // (14 × 16 mm for the F140 big toe).
  function layout(id: string, animate: boolean) {
    const s = FOOT_SIZES.find((x) => x.id === id)!
    const [dx, dy] = offset(s)
    const kx = s.plate[0] / ref.plate[0]
    const ky = s.plate[1] / ref.plate[1]
    const d = animate ? 0.9 : 0
    const ease = 'expo.inOut'
    gsap.to([glass, glow], { morphSVG: placed(s.outline, dx, dy), duration: d, ease })
    winEls.forEach(({ w, rect, pulse, txt }) => {
      const small = id === 'F140' && w.id === '1'
      const ww = small ? 14 : w.w
      const hh = small ? 16 : w.h
      const cx = 4 + (w.x + w.w / 2 - 4) * kx + dx
      const cy = 4 + (w.y + w.h / 2 - 4) * ky + dy
      const attrs = { x: cx - ww / 2, y: cy - hh / 2, width: ww, height: hh }
      gsap.to(rect, { attr: attrs, duration: d, ease })
      gsap.set(pulse, { attr: attrs })
      gsap.to(txt, { attr: { x: cx - ww / 2 + 2.2, y: cy - hh / 2 + 6.4 }, duration: d, ease })
    })
    const midY = dy + 4 + s.plate[1] * 0.52
    const outerX = dx + 4 + s.plate[0] * 0.1
    gsap.to(ruler, { attr: { transform: `translate(${outerX} ${midY - 25})` }, duration: d, ease })
    gsap.to(rulerText, { attr: { x: outerX + 4, y: midY + 1 }, duration: d, ease })
    const cx = dx + 4 + s.plate[0] * 0.5
    const heelY = dy + 4 + 4 + s.foot[0]
    gsap.to(heel, { attr: { transform: `translate(${cx} ${Math.min(heelY, dy + s.view[1] - 10)})` }, duration: d, ease })
    gsap.to(axis, { attr: { x1: cx, x2: cx, y1: dy + 4 + s.plate[1] * 0.44, y2: dy + 4 + s.plate[1] * 0.82 }, duration: d, ease })
    gsap.to(tag, { attr: { x: dx + 4 + s.plate[0] * 0.56, y: dy + 4 + s.plate[1] * 0.66 }, duration: d, ease })
    gsap.to(tag2, { attr: { x: dx + 4 + s.plate[0] * 0.56, y: dy + 4 + s.plate[1] * 0.66 + 6 }, duration: d, ease })
    tag.textContent = `${s.id} / R`
    tag2.textContent = 'FIT ONLY'
    dims.innerHTML = `FOOT ${s.foot[0]} × ${s.foot[1]} MM<br>PLATE ${s.plate[0]} × ${s.plate[1]} MM`
    sizes.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.size === id)))
  }

  sizes.innerHTML = FOOT_SIZES.map((s) => `<button type="button" role="radio" data-size="${s.id}" aria-checked="${s.id === 'F260'}">${s.id}</button>`).join('')
  sizes.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (b?.dataset.size) layout(b.dataset.size, true)
  })
  layout('F260', false)

  // Pulse the windows in turn.
  winEls.forEach(({ pulse }, i) => {
    gsap.fromTo(pulse, { opacity: 0.9, scale: 1, transformOrigin: '50% 50%' }, { opacity: 0, scale: 1.7, duration: 1.8, repeat: -1, delay: i * 0.45, ease: 'power2.out', repeatDelay: 1.2 })
  })

  return {
    /** Draw the outline on as the chapter enters. */
    intro() {
      const len = glass.getTotalLength()
      gsap.fromTo(glass, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut', onComplete: () => { glass.style.strokeDasharray = 'none' } })
      gsap.from(winEls.map((x) => x.g), { opacity: 0, y: 6, duration: 0.6, stagger: 0.15, delay: 1.1 })
    },
  }
}
