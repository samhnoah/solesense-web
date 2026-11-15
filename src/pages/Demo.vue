<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import QRCode from 'qrcode'
import FootMap from '../components/FootMap.vue'
import ForceGauge from '../components/ForceGauge.vue'
import { t } from '../lib/i18n'
import {
  HOLD_MS, TARGET_GF, TOLERANCE_GF, bleSupported, cancelSim, connectBle, device, disconnectBle, simulatePress,
} from '../lib/device'
import { MAPS, type Answer, type Foot, type MapId, type SiteId, type Step } from '../lib/sites'

type Stage = 'setup' | 'test' | 'results'
type Phase = 'ready' | 'pressing' | 'ask'
type Answers = Record<Foot, Partial<Record<SiteId, Answer>>>

const IDLE_RESET_S = 120   // an abandoned test returns to the start
const RESULTS_RESET_S = 60 // results clear themselves; nothing is stored

const stage = ref<Stage>('setup')
const mapId = ref<MapId>('three')
const feet = ref<'both' | Foot>('both')
const idx = ref(0)
const phase = ref<Phase>('ready')
const hold = ref(0)
const answers = reactive<Answers>({ left: {}, right: {} })
const countdown = ref(RESULTS_RESET_S)
const qr = ref('')

const sites = computed(() => MAPS[mapId.value])
const testedFeet = computed<Foot[]>(() => (feet.value === 'both' ? ['right', 'left'] : [feet.value]))
const steps = computed<Step[]>(() => testedFeet.value.flatMap((foot) => sites.value.map((site) => ({ foot, site }))))
const step = computed(() => steps.value[idx.value])
const total = computed(() => steps.value.length)
const feltCount = computed(() => testedFeet.value.reduce((n, f) => n + Object.values(answers[f]).filter((a) => a === 'felt').length, 0))
const footLabel = (f: Foot) => t(f === 'left' ? 'demo.test.footLeft' : 'demo.test.footRight')

function clearAnswers() { answers.left = {}; answers.right = {} }

function start() {
  clearAnswers()
  idx.value = 0
  phase.value = 'ready'
  hold.value = 0
  stage.value = 'test'
}

function reset() {
  cancelSim()
  clearAnswers()
  stage.value = 'setup'
  phase.value = 'ready'
  hold.value = 0
}

function press() {
  if (phase.value !== 'ready') return
  phase.value = 'pressing'
  simulatePress().then(() => { if (phase.value === 'pressing') phase.value = 'ready' })
}

function answer(a: Answer) {
  if (!step.value) return
  answers[step.value.foot][step.value.site.id] = a
  cancelSim()
  hold.value = 0
  phase.value = 'ready'
  if (idx.value + 1 >= total.value) stage.value = 'results'
  else idx.value++
}

function back() {
  if (idx.value === 0) return
  cancelSim()
  idx.value--
  delete answers[step.value.foot][step.value.site.id]
  phase.value = 'ready'
  hold.value = 0
}

// A press counts once the force has stayed inside the target band for HOLD_MS.
// The same rule applies to simulated and real readings.
let inBandSince = 0
watch(() => device.force, (f) => {
  if (stage.value !== 'test' || phase.value === 'ask') return
  const now = performance.now()
  if (Math.abs(f - TARGET_GF) <= TOLERANCE_GF) {
    if (!inBandSince) inBandSince = now
    hold.value = (now - inBandSince) / HOLD_MS
    if (hold.value >= 1) { phase.value = 'ask'; inBandSince = 0 }
  } else {
    inBandSince = 0
    hold.value = 0
  }
  if (device.mode === 'ble' && phase.value !== 'ask') phase.value = f > 0.5 ? 'pressing' : 'ready'
})

// Kiosk behaviour: clear the screen when nobody is using it.
let lastActivity = Date.now()
const touch = () => { lastActivity = Date.now() }
let timer = 0
function tick() {
  const idle = (Date.now() - lastActivity) / 1000
  if (stage.value === 'results') {
    countdown.value = Math.max(0, Math.ceil(RESULTS_RESET_S - idle))
    if (countdown.value === 0) reset()
  } else if (stage.value === 'test' && idle > IDLE_RESET_S && device.force < 0.5) {
    reset()
  }
}
watch(stage, () => { touch(); countdown.value = RESULTS_RESET_S; window.scrollTo({ top: 0 }) })

onMounted(async () => {
  window.addEventListener('pointerdown', touch)
  window.addEventListener('keydown', touch)
  timer = window.setInterval(tick, 1000)
  try {
    qr.value = await QRCode.toString(location.href, { type: 'svg', margin: 0, color: { dark: '#0C2036', light: '#FFFFFF' } })
  } catch { qr.value = '' }
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', touch)
  window.removeEventListener('keydown', touch)
  clearInterval(timer)
  cancelSim()
})
</script>

<template>
  <main class="demo wrap">
    <p class="banner">{{ t('demo.banner') }}</p>

    <!-- Setup -->
    <section v-if="stage === 'setup'" class="setup">
      <div class="intro">
        <h1>{{ t('demo.title') }}</h1>
        <p class="lede">{{ t('demo.setup.lede') }}</p>
      </div>

      <form class="choices" @submit.prevent="start">
        <fieldset>
          <legend>{{ t('demo.setup.mapLabel') }}</legend>
          <div class="cards">
            <label class="card" :class="{ on: mapId === 'three' }">
              <input v-model="mapId" type="radio" name="map" value="three" />
              <span class="mini" dir="ltr" aria-hidden="true"><FootMap foot="right" :sites="MAPS.three" label="" /></span>
              <span><strong>{{ t('demo.setup.three') }}</strong><small>{{ t('demo.setup.threeHint') }}</small></span>
            </label>
            <label class="card" :class="{ on: mapId === 'ten' }">
              <input v-model="mapId" type="radio" name="map" value="ten" />
              <span class="mini" dir="ltr" aria-hidden="true"><FootMap foot="right" :sites="MAPS.ten" label="" /></span>
              <span><strong>{{ t('demo.setup.ten') }}</strong><small>{{ t('demo.setup.tenHint') }}</small></span>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>{{ t('demo.setup.feetLabel') }}</legend>
          <div class="segment">
            <label v-for="f in (['both', 'left', 'right'] as const)" :key="f" :class="{ on: feet === f }">
              <input v-model="feet" type="radio" name="feet" :value="f" />{{ t('demo.setup.' + f) }}
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>{{ t('demo.setup.deviceLabel') }}</legend>
          <div class="device">
            <template v-if="device.mode === 'ble'">
              <p><strong>{{ t('demo.setup.connected', { name: device.name }) }}</strong></p>
              <button type="button" class="btn btn-quiet" @click="disconnectBle">{{ t('demo.setup.disconnect') }}</button>
            </template>
            <template v-else>
              <p><strong>{{ t('demo.setup.simulated') }}</strong><br /><span class="muted">{{ t('demo.setup.simulatedHint') }}</span></p>
              <button v-if="bleSupported" type="button" class="btn btn-quiet" :disabled="device.connecting" @click="connectBle">
                {{ device.connecting ? t('demo.setup.connecting') : t('demo.setup.connect') }}
              </button>
            </template>
          </div>
          <p v-if="device.error === 'failed'" class="hint" role="status">{{ t('demo.setup.bleFailed') }}</p>
          <p v-else-if="!bleSupported" class="hint muted">{{ t('demo.setup.bleUnsupported') }}</p>
        </fieldset>

        <button type="submit" class="btn btn-primary big">{{ t('demo.setup.start') }}</button>
      </form>

      <aside v-if="qr" class="phone">
        <div class="qr" v-html="qr"></div>
        <p><strong>{{ t('demo.setup.phone') }}</strong><br /><span class="muted">{{ t('demo.setup.phoneHint') }}</span></p>
      </aside>
    </section>

    <!-- Test -->
    <section v-else-if="stage === 'test' && step" class="test">
      <div class="map">
        <div class="map-foot" dir="ltr">
          <FootMap :foot="step.foot" :sites="sites" :active-id="step.site.id" :answers="answers[step.foot]"
            :pressing="phase !== 'ready'" :label="footLabel(step.foot) + '. ' + t('demo.test.soleView')" />
        </div>
        <p class="muted small">{{ t('demo.test.soleView') }}</p>
      </div>

      <div class="panel">
        <p class="progress num">{{ t('demo.test.progress', { n: idx + 1, total }) }}</p>
        <div class="bar" aria-hidden="true"><div :style="{ inlineSize: `${(idx / total) * 100}%` }"></div></div>
        <h1 class="where"><span class="foot-name">{{ footLabel(step.foot) }}</span>{{ t('demo.sites.' + step.site.id) }}</h1>

        <ForceGauge :force="device.force" :hold="phase === 'ask' ? 1 : hold" />

        <div class="action" aria-live="polite">
          <template v-if="phase === 'ask'">
            <p class="ask">{{ t('demo.test.ask') }}</p>
            <div class="answers">
              <button class="btn btn-primary big" @click="answer('felt')">{{ t('demo.test.felt') }}</button>
              <button class="btn btn-quiet big" @click="answer('notFelt')">{{ t('demo.test.notFelt') }}</button>
            </div>
          </template>
          <template v-else-if="device.mode === 'sim'">
            <p>{{ t('demo.test.instructionSim') }}</p>
            <button class="btn btn-primary big" :disabled="phase === 'pressing'" @click="press">
              {{ phase === 'pressing' ? (hold > 0 ? t('demo.test.hold') : t('demo.test.pressing')) : t('demo.test.press') }}
            </button>
          </template>
          <template v-else>
            <p>{{ t('demo.test.instructionBle') }}</p>
            <p class="ask">{{ hold > 0 ? t('demo.test.hold') : '' }}</p>
          </template>
        </div>

        <div class="minor">
          <button v-if="idx > 0" class="text-btn" @click="back">{{ t('demo.test.back') }}</button>
          <button class="text-btn" @click="reset">{{ t('demo.test.quit') }}</button>
        </div>
      </div>
    </section>

    <!-- Results -->
    <section v-else class="results">
      <div class="summary">
        <h1>{{ t('demo.results.heading') }}</h1>
        <p class="headline display num">
          {{ feltCount === total
            ? t('demo.results.allFelt', { total })
            : t('demo.results.someNotFelt', { felt: feltCount, total, missed: total - feltCount }) }}
        </p>
        <p>{{ feltCount === total ? t('demo.results.explainAll') : t('demo.results.explainSome') }}</p>
        <p class="notice">{{ t('demo.results.notice') }}</p>
        <div class="answers">
          <button class="btn btn-primary big" @click="reset">{{ t('demo.results.again') }}</button>
          <RouterLink to="/" class="btn btn-quiet big">{{ t('demo.results.home') }}</RouterLink>
        </div>
        <p class="muted small num" role="timer">{{ t('demo.results.reset', { s: countdown }) }}</p>
      </div>

      <div class="result-maps">
        <div class="pair" dir="ltr">
          <figure v-for="f in testedFeet" :key="f">
            <div class="result-foot"><FootMap :foot="f" :sites="sites" :answers="answers[f]" :label="footLabel(f)" /></div>
            <figcaption>{{ footLabel(f) }}</figcaption>
          </figure>
        </div>
        <ul class="legend">
          <li><span class="key felt"></span>{{ t('demo.results.legendFelt') }}</li>
          <li><span class="key not"></span>{{ t('demo.results.legendNotFelt') }}</li>
        </ul>
      </div>
    </section>
  </main>
</template>

<style scoped>
.demo { padding-bottom: 4rem; min-height: calc(100dvh - 5rem); }
.banner { max-width: none; font-size: var(--step--1); color: var(--ink-2); border-block: 1px solid var(--line); padding-block: 0.5rem; margin-bottom: clamp(1.25rem, 4vw, 3rem); }
h1 { font-size: var(--step-3); }
.lede { font-size: var(--step-1); line-height: 1.45; color: var(--ink-2); margin-top: 1rem; max-width: 34ch; }
:lang(ar) .lede { line-height: 1.8; }
.small { font-size: var(--step--1); }
.big { min-height: 60px; font-size: var(--step-1); padding-inline: 1.6em; }

/* Setup */
.setup { display: grid; gap: clamp(2rem, 5vw, 4rem); grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); align-items: start; }
.choices { display: grid; gap: 1.75rem; }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
legend { font-weight: 600; padding: 0; margin-bottom: 0.6rem; }
input[type='radio'] { position: absolute; opacity: 0; pointer-events: none; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 0.75rem; }
.card { display: grid; grid-template-columns: 54px 1fr; gap: 1rem; align-items: center; padding: 1rem; background: var(--surface); border: 1.5px solid var(--line); border-radius: var(--radius); cursor: pointer; }
.card.on { border-color: var(--blue); box-shadow: inset 0 0 0 1px var(--blue); }
.card:has(:focus-visible), .segment label:has(:focus-visible) { outline: 3px solid var(--blue); outline-offset: 3px; }
.card strong { display: block; }
.card small { display: block; color: var(--ink-2); font-size: var(--step--1); line-height: 1.4; margin-top: 0.2rem; }
.mini { height: 110px; }
.segment { display: inline-flex; flex-wrap: wrap; background: var(--sunken); border: 1px solid var(--line); border-radius: 999px; padding: 4px; }
.segment label { padding: 0.55em 1.1em; min-height: 44px; display: inline-flex; align-items: center; border-radius: 999px; cursor: pointer; font-weight: 500; }
.segment label.on { background: var(--surface); color: var(--blue); box-shadow: 0 0 0 1.5px var(--blue); }
.device { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; background: var(--surface); border: 1.5px solid var(--line); border-radius: var(--radius); padding: 1rem; }
.hint { font-size: var(--step--1); margin-top: 0.5rem; }
.choices > .btn { justify-self: start; }
.phone { grid-column: 1; display: flex; gap: 1rem; align-items: center; }
.qr { width: 112px; height: 112px; padding: 8px; background: #fff; border-radius: 8px; flex: none; }
.qr :deep(svg) { display: block; width: 100%; height: 100%; }
@media (min-width: 861px) { .choices { grid-column: 2; grid-row: 1 / span 2; } }
@media (max-width: 860px) { .setup { grid-template-columns: 1fr; } .phone { display: none; } }

/* Test */
.test { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 5fr); gap: clamp(1.5rem, 5vw, 5rem); align-items: start; }
.map { text-align: center; }
.map-foot { height: min(66dvh, 620px); display: flex; justify-content: center; }
.map-foot :deep(svg) { width: auto; }
.panel { display: grid; gap: 1.25rem; max-width: 34rem; }
.progress { color: var(--ink-2); max-width: none; }
.bar { height: 4px; background: var(--sunken); border-radius: 4px; overflow: hidden; margin-top: -0.75rem; }
.bar div { height: 100%; background: var(--blue); transition: inline-size 0.3s; }
.where { font-size: var(--step-2); line-height: 1.12; }
:lang(ar) .where { line-height: 1.5; }
.foot-name { display: block; font-family: var(--sans); font-size: var(--step-0); font-weight: 600; letter-spacing: 0; color: var(--blue); margin-bottom: 0.3rem; }
.action { display: grid; gap: 1rem; min-height: 9.5rem; align-content: start; }
.ask { font-size: var(--step-1); font-weight: 600; }
.answers { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.answers .btn { flex: 1 1 12rem; }
.minor { display: flex; gap: 1.5rem; border-top: 1px solid var(--line); padding-top: 0.75rem; }
.text-btn { font: inherit; background: none; border: 0; padding: 0.5rem 0; min-height: 44px; color: var(--ink-2); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.text-btn:hover { color: var(--ink); }
@media (max-width: 760px) {
  .test { grid-template-columns: 1fr; gap: 1rem; }
  .map-foot { height: 26dvh; min-height: 170px; }
  .map p { display: none; }
  .panel { gap: 0.8rem; }
  .bar { margin-top: -0.4rem; }
  .action { min-height: 8rem; gap: 0.7rem; }
  .banner { margin-bottom: 0.75rem; }
  .test .answers { flex-wrap: nowrap; }
  .test .answers .btn { flex: 1 1 0; min-width: 0; padding-inline: 0.5em; font-size: var(--step-0); }
}

/* Results */
.results { display: grid; grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); gap: clamp(2rem, 5vw, 5rem); align-items: start; }
.summary { display: grid; gap: 1.25rem; }
.summary h1 { font-family: var(--sans); font-size: var(--step-0); font-weight: 600; letter-spacing: 0; color: var(--blue); }
.headline { font-size: var(--step-3); max-width: 16ch; }
.notice { background: var(--alert-wash); color: var(--alert); border-radius: var(--radius); padding: 0.9rem 1.1rem; }
.pair { display: flex; justify-content: center; gap: clamp(1rem, 4vw, 3rem); }
.pair figure { text-align: center; }
.result-foot { height: min(56dvh, 520px); aspect-ratio: 140 / 296; }
.pair figcaption { font-weight: 600; margin-top: 0.5rem; }
.legend { display: flex; justify-content: center; gap: 1.5rem; margin-top: 1rem; font-size: var(--step--1); }
.legend li { display: inline-flex; align-items: center; gap: 0.45rem; }
.key { width: 14px; height: 14px; border-radius: 50%; }
.key.felt { background: var(--blue); }
.key.not { border: 2px solid var(--alert); }
@media (max-width: 760px) {
  .results { grid-template-columns: 1fr; }
  .result-foot { height: 40dvh; }
}
</style>
