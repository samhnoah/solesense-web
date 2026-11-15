<script setup lang="ts">
// The nylon filament: straight at rest, bowing as the press reaches its force.
import { computed } from 'vue'
const props = defineProps<{ bend: number }>()
const b = computed(() => Math.min(1, Math.max(0, props.bend)))
const top = computed(() => 14 + b.value * 16)
const d = computed(() => `M30 ${top.value} Q${30 + b.value * 30} ${(top.value + 150) / 2} 30 150`)
</script>

<template>
  <svg class="filament" viewBox="0 0 60 160" aria-hidden="true">
    <rect x="19" :y="top - 14" width="22" height="14" rx="3" class="nose" />
    <path :d="d" class="thread" />
    <path d="M4 152 Q30 157 56 152" class="skin" />
  </svg>
</template>

<style scoped>
.filament { display: block; height: 100%; width: auto; overflow: visible; }
.nose { fill: var(--ink-2); }
.thread { fill: none; stroke: var(--filament); stroke-width: 1.7; stroke-linecap: round; }
.skin { fill: none; stroke: var(--ink-2); stroke-width: 1.6; stroke-linecap: round; }
</style>
