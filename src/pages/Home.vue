<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Filament from '../components/Filament.vue'
import FootMap from '../components/FootMap.vue'
import { t, tm } from '../lib/i18n'
import { vReveal } from '../lib/reveal'
import { MAPS } from '../lib/sites'

interface TimelineItem { year: string; text: string }
interface Figure { img: string; alt: string; title: string; text: string }
interface ForceItem { value: string; text: string }

const img = (name: string) => `${import.meta.env.BASE_URL}img/${name}.webp`

// The one piece of load motion: the filament presses down and bows, once.
const bend = ref(0)
let raf = 0
onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { bend.value = 0.75; return }
  const start = performance.now() + 500
  const tick = (now: number) => {
    const s = (now - start) / 1000
    if (s < 0) { raf = requestAnimationFrame(tick); return }
    if (s < 0.9) bend.value = 1 - Math.pow(1 - s / 0.9, 3)
    else if (s < 1.7) bend.value = 1 - 0.25 * ((s - 0.9) / 0.8)
    else { bend.value = 0.75; return }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <main>
    <section class="hero wrap">
      <div class="hero-text">
        <h1>{{ t('home.hero.title') }}</h1>
        <p class="lede">{{ t('home.hero.lede') }}</p>
        <div class="actions">
          <RouterLink to="/app" class="btn btn-primary">{{ t('home.hero.primary') }}</RouterLink>
          <a href="#how" class="btn btn-quiet" @click.prevent="($event.target as HTMLElement).ownerDocument.getElementById('how')?.scrollIntoView()">{{ t('home.hero.secondary') }}</a>
        </div>
      </div>
      <div class="hero-thread"><Filament :bend="bend" /></div>
    </section>

    <figure class="plate">
      <img :src="img('device')" :alt="t('home.hero.imageAlt')" width="1500" height="560" />
      <figcaption class="muted">{{ t('home.hero.caption') }}</figcaption>
    </figure>

    <section class="why wrap" v-reveal>
      <h2>{{ t('home.why.title') }}</h2>
      <div class="prose">
        <p>{{ t('home.why.p1') }}</p>
        <p>{{ t('home.why.p2') }}</p>
        <p>{{ t('home.why.p3') }}</p>
      </div>
    </section>

    <section class="history wrap" v-reveal>
      <h2>{{ t('home.history.title') }}</h2>
      <ol>
        <li v-for="item in tm<TimelineItem[]>('home.history.items')" :key="item.year">
          <span class="year display num">{{ item.year }}</span>
          <p>{{ item.text }}</p>
        </li>
      </ol>
    </section>

    <section id="how" class="how wrap">
      <header v-reveal>
        <h2>{{ t('home.how.title') }}</h2>
        <p class="lede">{{ t('home.how.intro') }}</p>
      </header>
      <figure v-for="f in tm<Figure[]>('home.how.figures')" :key="f.img" v-reveal>
        <img :src="img(f.img)" :alt="f.alt" width="1400" height="726" />
        <figcaption>
          <h3>{{ f.title }}</h3>
          <p class="muted">{{ f.text }}</p>
        </figcaption>
      </figure>
      <p class="note muted">{{ t('home.how.note') }}</p>
    </section>

    <section class="forces wrap" v-reveal>
      <h2>{{ t('home.forces.title') }}</h2>
      <ul>
        <li v-for="f in tm<ForceItem[]>('home.forces.items')" :key="f.value">
          <span class="force display num" dir="ltr">{{ f.value }}<abbr :title="t('home.forces.unitLong')">{{ t('home.forces.unit') }}</abbr></span>
          <p>{{ f.text }}</p>
        </li>
      </ul>
      <p class="note muted">{{ t('home.forces.note') }}</p>
    </section>

    <section class="status wrap" v-reveal>
      <div>
        <h2>{{ t('home.status.title') }}</h2>
        <p class="lede">{{ t('home.status.intro') }}</p>
      </div>
      <div class="lists">
        <div>
          <h3>{{ t('home.status.doneTitle') }}</h3>
          <ul class="done"><li v-for="x in tm<string[]>('home.status.done')" :key="x">{{ x }}</li></ul>
        </div>
        <div>
          <h3>{{ t('home.status.todoTitle') }}</h3>
          <ul class="todo"><li v-for="x in tm<string[]>('home.status.todo')" :key="x">{{ x }}</li></ul>
        </div>
      </div>
    </section>

    <section class="cta" v-reveal>
      <div class="cta-text">
        <h2>{{ t('home.cta.title') }}</h2>
        <p>{{ t('home.cta.text') }}</p>
        <RouterLink to="/app" class="btn">{{ t('home.cta.button') }}</RouterLink>
      </div>
      <div class="cta-foot" dir="ltr" aria-hidden="true">
        <FootMap foot="right" :sites="MAPS.three" label="" active-id="mth1" :answers="{ hallux: 'felt' }" />
      </div>
    </section>

    <footer class="wrap">
      <p>{{ t('home.footer.open') }} <a href="https://github.com/mustafamoe/sole-sense" rel="noopener">{{ t('home.footer.repo') }}</a></p>
      <p class="muted">{{ t('home.footer.disclaimer') }}</p>
    </footer>
  </main>
</template>

<style scoped>
section { padding-block: clamp(3.5rem, 9vw, 8rem); }
h2 { font-size: var(--step-3); max-width: 18ch; }
.lede { font-size: var(--step-1); line-height: 1.45; color: var(--ink-2); max-width: 46ch; }
:lang(ar) .lede { line-height: 1.8; }
.note { font-size: var(--step--1); margin-top: 2rem; }

.hero { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2rem; align-items: end; padding-block: clamp(2rem, 6vw, 5rem) clamp(2rem, 5vw, 4rem); }
.hero h1 { font-size: var(--step-4); max-width: 13ch; }
.hero .lede { margin-top: clamp(1.25rem, 3vw, 2.25rem); color: var(--ink); }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: clamp(1.5rem, 3vw, 2.5rem); }
.hero-thread { height: clamp(260px, 42vw, 520px); padding-inline-end: clamp(0rem, 6vw, 6rem); }
@media (max-width: 720px) { .hero { grid-template-columns: 1fr; } .hero-thread { display: none; } }

.plate { margin-inline-start: var(--gutter); }
.plate img { width: 100%; height: auto; border-start-start-radius: var(--radius); border-end-start-radius: var(--radius); background: var(--plate); min-height: 220px; object-fit: cover; }
.plate figcaption { font-size: var(--step--1); padding: 0.75rem var(--gutter) 0 0; }
:dir(rtl) .plate figcaption { padding: 0.75rem 0 0 var(--gutter); }

.why { display: grid; gap: clamp(2rem, 5vw, 5rem); grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); }
.prose { display: grid; gap: 1.2rem; align-content: start; font-size: var(--step-1); line-height: 1.5; }
:lang(ar) .prose { line-height: 1.85; }
.prose p:last-child { color: var(--blue); }

.history { background: var(--surface); border-block: 1px solid var(--line); }
.history ol { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0; margin-top: clamp(2rem, 5vw, 4rem); }
.history li { border-inline-start: 1px solid var(--line); padding: 0.25rem 1.25rem 1.5rem; }
.year { display: block; font-size: var(--step-2); color: var(--blue); margin-bottom: 0.6rem; }
.history p { font-size: var(--step-0); }

.how { display: grid; gap: clamp(2.5rem, 6vw, 5rem); }
.how header { display: grid; gap: 1.25rem; }
.how figure { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 4fr); gap: clamp(1.25rem, 4vw, 3.5rem); align-items: center; }
.how figure:nth-of-type(even) { grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); }
.how figure:nth-of-type(even) img { order: 2; }
.how figure img { width: 100%; height: auto; border-radius: var(--radius); background: var(--plate); }
.how figcaption { display: grid; gap: 0.6rem; }
.how .note { margin-top: 0; }
@media (max-width: 760px) { .how figure, .how figure:nth-of-type(even) { grid-template-columns: 1fr; } .how figure:nth-of-type(even) img { order: 0; } }

.forces { background: var(--sunken); }
.forces ul { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: clamp(1.5rem, 4vw, 4rem); margin-top: clamp(2rem, 5vw, 4rem); }
.force { display: block; font-size: clamp(4rem, 2.5rem + 8vw, 8.5rem); line-height: 0.95; }
:dir(rtl) .force { text-align: end; }
.force abbr { font-family: var(--sans); font-size: 0.16em; letter-spacing: 0; color: var(--ink-2); margin-inline-start: 0.5em; text-decoration: none; }
.forces li p { margin-top: 0.75rem; max-width: 26ch; }

.status { display: grid; gap: clamp(2rem, 5vw, 5rem); grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); }
.status .lede { margin-top: 1.25rem; }
.lists { display: grid; gap: 2rem; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); align-content: start; }
.lists h3 { margin-bottom: 0.8rem; }
.lists li { position: relative; padding: 0.55rem 0; padding-inline-start: 1.7rem; border-top: 1px solid var(--line); }
.lists li::before { content: ''; position: absolute; inset-inline-start: 0.15rem; top: 1.05em; width: 0.7rem; height: 0.7rem; border-radius: 50%; }
.done li::before { background: var(--blue); }
.todo li::before { border: 1.5px solid var(--ink-2); }

.cta { background: var(--blue); color: var(--on-blue); display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2rem; align-items: center; padding-inline: var(--gutter); overflow: hidden; padding-block: clamp(3rem, 7vw, 6rem); }
.cta-text { display: grid; gap: 1.25rem; justify-items: start; }
.cta p { font-size: var(--step-1); line-height: 1.45; max-width: 40ch; }
.cta .btn { background: var(--on-blue); color: var(--blue); }
:root[data-theme='dark'] .cta .btn { color: var(--ink); }
.cta-foot { height: clamp(220px, 30vw, 360px); aspect-ratio: 128 / 284; margin-block: -1rem; margin-inline-end: clamp(0rem, 8vw, 8rem); --blue: #FFFFFF; --on-blue: #1B56C4; --blue-wash: rgba(255, 255, 255, 0.12); --surface: #1B56C4; --ink-2: #FFFFFF; }
:root[data-theme='dark'] .cta-foot { --blue: #06142B; --on-blue: #6FA5FF; --blue-wash: rgba(6, 20, 43, 0.1); --surface: #6FA5FF; --ink-2: #06142B; }
@media (max-width: 620px) { .cta { grid-template-columns: 1fr; } .cta-foot { display: none; } }

footer { padding-block: 2.5rem 3.5rem; display: grid; gap: 0.5rem; font-size: var(--step--1); }
footer p { max-width: none; }
footer a { color: var(--blue); }
</style>
