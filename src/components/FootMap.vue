<script setup lang="ts">
import { FOOT_PATH_RIGHT, FOOT_VIEWBOX } from '../lib/footPath'
import type { Answer, Foot, Site, SiteId } from '../lib/sites'

const props = defineProps<{
  foot: Foot
  sites: Site[]
  label: string
  activeId?: SiteId | null
  answers?: Partial<Record<SiteId, Answer>>
  pressing?: boolean
}>()

const W = FOOT_VIEWBOX.w
const sx = (s: Site) => (props.foot === 'right' ? s.x : W - s.x)
const state = (s: Site) => props.answers?.[s.id] ?? (props.activeId === s.id ? 'active' : 'pending')
</script>

<template>
  <svg class="foot" :viewBox="`-6 -6 ${W + 12} ${FOOT_VIEWBOX.h + 12}`" role="img" :aria-label="label">
    <path class="outline" :d="FOOT_PATH_RIGHT" :transform="foot === 'left' ? `translate(${W} 0) scale(-1 1)` : undefined" />
    <g v-for="s in sites" :key="s.id" :class="['site', state(s), { dorsal: s.dorsal, pressing: pressing && state(s) === 'active' }]"
      :transform="`translate(${sx(s)} ${s.y})`">
      <circle v-if="state(s) === 'active'" class="pulse" r="9" />
      <circle class="dot" :r="state(s) === 'pending' ? 4.2 : 7" />
      <path v-if="state(s) === 'felt'" class="glyph" d="M-3.2 0.2 L-0.9 2.6 L3.4 -2.4" />
      <path v-if="state(s) === 'notFelt'" class="glyph" d="M-2.6 -2.6 L2.6 2.6 M2.6 -2.6 L-2.6 2.6" />
    </g>
  </svg>
</template>

<style scoped>
.foot { display: block; width: 100%; height: 100%; }
.outline { fill: var(--blue-wash); stroke: var(--blue); stroke-width: 1.1; stroke-linejoin: round; }
.dot { transition: r 0.25s, fill 0.25s; }
.pending .dot { fill: var(--surface); stroke: var(--ink-2); stroke-width: 1.1; }
.pending.dorsal .dot, .active.dorsal .dot { stroke-dasharray: 2 1.6; }
.active .dot { fill: var(--surface); stroke: var(--blue); stroke-width: 2.4; }
.active.pressing .dot { fill: var(--blue); }
.pulse { fill: none; stroke: var(--blue); stroke-width: 1.2; transform-box: fill-box; transform-origin: center; animation: pulse 1.6s ease-out infinite; }
.felt .dot { fill: var(--blue); }
.notFelt .dot { fill: var(--surface); stroke: var(--alert); stroke-width: 2.2; }
.glyph { fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.felt .glyph { stroke: var(--on-blue); }
.notFelt .glyph { stroke: var(--alert); }
@keyframes pulse { from { transform: scale(0.8); opacity: 0.9; } to { transform: scale(1.9); opacity: 0; } }
</style>
