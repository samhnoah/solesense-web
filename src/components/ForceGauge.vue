<script setup lang="ts">
import { computed } from 'vue'
import Filament from './Filament.vue'
import { GAUGE_MAX_GF, TARGET_GF, TOLERANCE_GF } from '../lib/device'
import { t } from '../lib/i18n'

const props = defineProps<{ force: number; hold: number }>()
const pct = (gf: number) => `${(Math.min(GAUGE_MAX_GF, Math.max(0, gf)) / GAUGE_MAX_GF) * 100}%`
const inBand = computed(() => Math.abs(props.force - TARGET_GF) <= TOLERANCE_GF)
</script>

<template>
  <div class="gauge" :class="{ 'in-band': inBand }">
    <div class="thread"><Filament :bend="force / TARGET_GF" /></div>
    <div class="read">
      <div class="label muted">{{ t('demo.test.gaugeLabel') }}</div>
      <div class="value num" dir="ltr" aria-live="off">{{ force.toFixed(1) }}<span class="unit">gf</span></div>
      <div class="track" role="meter" :aria-label="t('demo.test.gaugeLabel')" aria-valuemin="0" :aria-valuemax="GAUGE_MAX_GF" :aria-valuenow="Number(force.toFixed(1))">
        <div class="band" :style="{ insetInlineStart: pct(TARGET_GF - TOLERANCE_GF), inlineSize: pct(TOLERANCE_GF * 2) }"></div>
        <div class="fill" :style="{ inlineSize: pct(force) }"></div>
      </div>
      <div class="scale muted num"><span>0</span><span class="target" :style="{ insetInlineStart: pct(TARGET_GF) }">{{ t('demo.test.target') }} 10</span><span>{{ GAUGE_MAX_GF }}</span></div>
      <div class="hold"><div :style="{ inlineSize: `${Math.min(1, hold) * 100}%` }"></div></div>
    </div>
  </div>
</template>

<style scoped>
.gauge { display: grid; grid-template-columns: 56px 1fr; gap: 1rem; align-items: stretch; }
.thread { height: 150px; display: flex; justify-content: center; }
.label { font-size: var(--step--1); }
.value { font-family: var(--serif); font-size: clamp(3rem, 2rem + 5vw, 4.6rem); line-height: 1; letter-spacing: -0.02em; text-align: start; }
:dir(rtl) .value { text-align: end; }
.unit { font-family: var(--sans); font-size: 1.1rem; color: var(--ink-2); margin-inline-start: 0.35em; letter-spacing: 0; }
.track { position: relative; height: 12px; background: var(--sunken); border: 1px solid var(--line); border-radius: 999px; margin-top: 0.8rem; overflow: hidden; }
.band { position: absolute; inset-block: 0; background: var(--blue-wash); border-inline: 1px solid var(--blue); }
.fill { position: absolute; inset-block: 0; inset-inline-start: 0; background: var(--ink-2); border-radius: 999px; transition: background-color 0.2s; }
.in-band .fill { background: var(--blue); }
.scale { position: relative; display: flex; justify-content: space-between; font-size: var(--step--1); margin-top: 0.25rem; }
.target { position: absolute; transform: translateX(-50%); color: var(--blue); font-weight: 600; white-space: nowrap; }
:dir(rtl) .target { transform: translateX(50%); }
.hold { height: 3px; margin-top: 0.7rem; background: transparent; border-radius: 3px; overflow: hidden; }
.hold div { height: 100%; background: var(--blue); }
@media (max-width: 760px) { .thread { height: 104px; } .gauge { grid-template-columns: 40px 1fr; } .value { font-size: 2.6rem; } .track { margin-top: 0.4rem; } .hold { margin-top: 0.4rem; } }
</style>
