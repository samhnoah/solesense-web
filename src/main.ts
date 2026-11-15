import './styles/main.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'
import { HERO, HERO_M, HERO_OUT, HERO_OUT_M, STEPS, mix, type Pose } from './scene/poses'
import { mountField } from './sections/field'
import { mountBuckle } from './sections/buckle'
import { mountGuide } from './sections/guide'
import { mountPress } from './sections/press'
import { mountTest } from './test/app'

gsap.registerPlugin(ScrollTrigger, SplitText)
document.documentElement.classList.add('js')

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector(s) as T
const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(document.querySelectorAll(s)) as T[]
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t) }
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
if (reduced) document.documentElement.classList.add('reduced')

// ── Smooth scroll ─────────────────────────────────────────────
const lenis = reduced ? null : new Lenis({ lerp: 0.1, smoothWheel: true })
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((t) => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
  lenis.stop()
}
const scrollTo = (y: number | HTMLElement) => {
  if (lenis) lenis.scrollTo(y, { duration: 1.6 })
  else window.scrollTo({ top: typeof y === 'number' ? y : y.getBoundingClientRect().top + scrollY })
}

// ── Cursor ────────────────────────────────────────────────────
const cursor = $('#cursor')
const cursorRead = $('#cursor-read')
let readLock = ''
{
  const pos = { x: innerWidth / 2, y: innerHeight / 2 }
  const at = { ...pos }
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return
    pos.x = e.clientX; pos.y = e.clientY
    cursor.classList.add('is-on')
    const hot = (e.target as HTMLElement).closest('a, button, [role="button"], label, canvas#field-canvas')
    cursor.classList.toggle('is-hot', !!hot || !!readLock)
  }, { passive: true })
  document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'))
  gsap.ticker.add(() => {
    at.x += (pos.x - at.x) * 0.22; at.y += (pos.y - at.y) * 0.22
    cursor.style.transform = `translate(${at.x}px, ${at.y}px)`
  })
}
const setCursorRead = (s: string) => { readLock = s; cursorRead.textContent = s; cursor.classList.toggle('is-hot', !!s) }

// ── Nav: hide on the way down, show on the way up; mark the chapter ─────
{
  const nav = $('#nav')
  let lastY = 0
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (st) => {
      const y = st.scroll()
      nav.classList.toggle('is-hidden', y > 160 && y > lastY)
      lastY = y
    },
  })
  const links = $$<HTMLAnchorElement>('.nav__links a:not(.nav__cta)')
  for (const a of links) {
    const id = a.getAttribute('href')!.slice(1)
    const target = document.getElementById(id)
    if (!target || a.hasAttribute('data-press-link')) continue
    ScrollTrigger.create({ trigger: target, start: 'top 55%', end: 'bottom 55%', onToggle: (st) => a.classList.toggle('is-active', st.isActive) })
  }
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
    if (!a) return
    const id = a.getAttribute('href')!.slice(1)
    e.preventDefault()
    if (id === 'press') {
      const inside = $('#inside')
      const top = inside.getBoundingClientRect().top + scrollY
      scrollTo(top + (inside.offsetHeight - innerHeight) * 0.9)
      return
    }
    const t = document.getElementById(id)
    if (t) scrollTo(id === 'hero' ? 0 : t)
  })
}

// ── Gauge: scroll as applied load, 0 → 75 gf on a log scale ─────────────
const gaugeMark = $('#gauge-mark')
const gaugeGf = $('#gauge-gf')
let pressGf = -1
function setGauge(gf: number) {
  const p = Math.log10(1 + gf) / Math.log10(76)
  const y = `${(clamp(p) * 100).toFixed(2)}%`
  gaugeMark.style.top = y
  gaugeGf.textContent = `${gf < 10 ? '0' : ''}${gf.toFixed(1)} gf`
}
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate: (st) => {
    if (pressGf < 0) setGauge(75 * st.progress ** 1.6)
    $('#gauge').classList.toggle('is-hidden', st.scroll() < innerHeight * 0.7)
  },
})
$('#gauge').classList.add('is-hidden')

// ── Text reveals ──────────────────────────────────────────────
function setupReveals() {
  for (const el of $$('[data-split]')) {
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' })
    if (reduced) continue
    gsap.from(split.lines, { yPercent: 105, duration: 1.2, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: el, start: 'top 82%' } })
  }
  for (const el of $$('.ch__head .display:not([data-split])')) {
    if (reduced) continue
    gsap.from(el, { y: 50, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%' } })
  }
  if (!reduced) {
    ScrollTrigger.batch('.reveal', {
      start: 'top 88%',
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
    })
  }
  for (const el of $$('[data-count]')) {
    const end = +el.dataset.count!
    const decimals = +(el.dataset.decimals || 0)
    const obj = { v: 0 }
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(obj, { v: end, duration: reduced ? 0 : 1.8, ease: 'expo.out', onUpdate: () => { el.textContent = obj.v.toFixed(decimals) } }),
    })
  }
}

// ── Sections ──────────────────────────────────────────────────
const field = mountField($<HTMLCanvasElement>('#field-canvas'), $('#field-pct'), setCursorRead)
ScrollTrigger.create({ trigger: '#field', start: 'top 70%', end: 'bottom 15%', scrub: true, onUpdate: (st) => field.setProgress(st.progress) })

const buckle = mountBuckle($<HTMLCanvasElement>('#buckle-canvas'), $('#buckle-gf'), $('#buckle-note'), $('#buckle-steps'))
ScrollTrigger.create({ trigger: '#buckle', start: 'top top', end: 'bottom bottom', onUpdate: (st) => buckle.setProgress(st.progress) })

const guide = mountGuide($<SVGSVGElement>('#guide-svg'), $<HTMLOListElement>('#guide-sites'), $('#guide-sizes'), $('#guide-dims'))
ScrollTrigger.create({ trigger: '#guide-plate', start: 'top 75%', once: true, onEnter: () => guide.intro() })

mountTest($('#try-stage'))

// Film modal
{
  const dlg = $<HTMLDialogElement>('#film-modal')
  const video = $<HTMLVideoElement>('#film-video')
  $('#film-open').addEventListener('click', () => { dlg.showModal(); lenis?.stop(); void video.play().catch(() => {}) })
  const close = () => { video.pause(); dlg.close() }
  $('#film-close').addEventListener('click', close)
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close() })
  dlg.addEventListener('close', () => { video.pause(); lenis?.start() })
}

// ── 3D device ─────────────────────────────────────────────────
const canvas = $<HTMLCanvasElement>('#scene')
const cards = $$('.card')
const insideBar = $('#inside-bar')
const inside = $('#inside')
let pinFloat = 0
let pinTarget = 0
let activeCard = -1
let device: { setTravel: (mm: number, gf: number) => void } | null = null

const press = mountPress({
  button: $<HTMLButtonElement>('#press-hold'),
  beams: $('#press-beam'),
  hud: $('#press-hud'),
  onChange: (s) => {
    device?.setTravel(s.travel, s.gf)
    if (s.active) { pressGf = s.gf; setGauge(s.gf) }
  },
})

function setCard(i: number) {
  if (i === activeCard) return
  activeCard = i
  cards.forEach((c, k) => c.classList.toggle('is-on', k === i))
}

/** The pinned chapter's progress as a step number with a dwell on each step. */
function pinProgress(): { p: number; vis: number } {
  const r = inside.getBoundingClientRect()
  const span = r.height - innerHeight
  const p = clamp(-r.top / span)
  const vis = Math.min(smooth(innerHeight * 0.95, innerHeight * 0.15, r.top), smooth(0, innerHeight * 0.55, r.bottom))
  return { p, vis }
}
function stepFloat(p: number): number {
  const n = STEPS.length
  const seg = p * n
  const i = Math.floor(seg)
  if (i >= n - 1) return n - 1
  return i + smooth(0.58, 1, seg - i)
}

async function startScene(onProgress: (f: number) => void): Promise<boolean> {
  const { Device, webglAvailable } = await import('./scene/device')
  if (!webglAvailable()) return false
  const d = new Device({ canvas, hud: $('#scene-hud'), lines: $<SVGSVGElement>('#scene-lines'), onProgress })
  try {
    await d.load(new URL('./models/solesense.glb', document.baseURI).href)
  } catch {
    return false
  }
  d.resize()
  addEventListener('resize', () => d.resize())
  device = { setTravel: (mm, gf) => { d.travel = mm; d.oledGf = gf } }

  let lastOpacity = -1
  gsap.ticker.add(() => {
    const hp = clamp(scrollY / innerHeight)
    const heroVis = 1 - smooth(0.5, 0.95, hp)
    const { p, vis } = pinProgress()
    pinTarget = stepFloat(p)
    // Ease between steps, but snap after a long jump (nav link, deep link).
    pinFloat += (pinTarget - pinFloat) * (reduced || Math.abs(pinTarget - pinFloat) > 1.2 || vis < 0.05 ? 1 : 0.085)
    if (Math.abs(pinTarget - pinFloat) < 0.0005) pinFloat = pinTarget
    insideBar.style.transform = `scaleX(${p})`

    const opacity = Math.max(heroVis, vis)
    if (Math.abs(opacity - lastOpacity) > 0.002) {
      canvas.style.opacity = opacity.toFixed(3)
      lastOpacity = opacity
    }

    let pose: Pose
    if (vis >= heroVis) {
      const i = Math.floor(pinFloat)
      const f = pinFloat - i
      pose = f > 0 && i + 1 < STEPS.length ? mix(STEPS[i], STEPS[i + 1], f) : STEPS[Math.min(i, STEPS.length - 1)]
      const card = Math.round(pinFloat)
      setCard(vis > 0.35 ? card : -1)
      d.activeStep = card
      d.calloutsOn = vis > 0.9 && Math.abs(pinFloat - card) < 0.1
      const pressOn = vis > 0.9 && card === STEPS.length - 1
      press.setActive(pressOn)
      if (!pressOn && pressGf >= 0) pressGf = -1
    } else {
      const narrow = innerWidth / innerHeight < 1.15
      pose = mix(narrow ? HERO_M : HERO, narrow ? HERO_OUT_M : HERO_OUT, smooth(0, 1, hp))
      d.calloutsOn = false
      setCard(-1)
      press.setActive(false)
    }
    if (reduced) pose = { ...pose, idle: 0 }
    d.setPose(pose)
    if (opacity > 0.005) d.render()
    else d.hideCallouts()
  })
  return true
}

function fallbackScene() {
  canvas.style.display = 'none'
  $('.hero__fallback').hidden = false
  $('.inside__fallback').hidden = false
  $('.hero__hint').hidden = true
  gsap.ticker.add(() => {
    const { p, vis } = pinProgress()
    insideBar.style.transform = `scaleX(${p})`
    const card = Math.round(stepFloat(p))
    setCard(vis > 0.35 ? card : -1)
    press.setActive(vis > 0.9 && card === STEPS.length - 1)
  })
}

// ── Preloader: tare to 10 g, then open ───────────────────────────────────
async function boot() {
  const bar = $('#preloader-bar')
  const gf = $('#preloader-gf')
  const state = $('#preloader-state')
  const shown = { v: 0 }
  let loaded = 0
  const tween = gsap.to(shown, { v: 0.9, duration: 1.4, ease: 'power2.out' })
  const paint = () => {
    const v = Math.min(shown.v, 0.15 + loaded * 0.85)
    bar.style.width = `${(v * 100).toFixed(1)}%`
    gf.textContent = (v * 10).toFixed(1).padStart(4, '0')
  }
  gsap.ticker.add(paint)

  const [ok] = await Promise.all([
    startScene((f) => { loaded = f }),
    document.fonts.ready,
  ])
  if (!ok) fallbackScene()
  loaded = 1
  tween.kill()
  await gsap.to(shown, { v: 1, duration: 0.45, ease: 'power2.inOut' })
  paint()
  gsap.ticker.remove(paint)
  state.textContent = 'READY · 10 G'
  setupReveals()
  ScrollTrigger.refresh()

  const tl = gsap.timeline({ delay: 0.25 })
  tl.to('#preloader', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' })
    .add(() => { document.body.classList.remove('is-loading'); lenis?.start() }, 0.5)
    .from('#hero-title .l > span', { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.09 }, 0.55)
    .from('.hero__intro', { opacity: 0, y: 20, duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.85)
    .add(() => $('#preloader').remove())

  // Deep link into the pinned chapter, e.g. ?at=3 for step 4 or ?at=press.
  const at = new URLSearchParams(location.search).get('at')
  if (at !== null) {
    tl.progress(1)
    const top = inside.getBoundingClientRect().top + scrollY
    const span = inside.offsetHeight - innerHeight
    const step = at === 'press' ? STEPS.length - 1 : +at
    const y = Number.isFinite(step) ? top + span * ((step + 0.3) / STEPS.length) : 0
    lenis ? lenis.scrollTo(y, { immediate: true }) : scrollTo(y)
    pinFloat = stepFloat(clamp((y - top) / span))
  }
}

void boot()
