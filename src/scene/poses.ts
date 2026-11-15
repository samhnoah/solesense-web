// Camera and explode keyframes for the 3D device. World units: 1 = 100 mm.
// With no pivot rotation, CAD (x, y, z) mm sits at world
// ((x - 140) / 100, z / 100, -y / 100): the device lies along +X with its
// tip at x ≈ 1.43, its top facing +Y and its right side facing the camera.

export type GroupKey =
  | 'handle_lower' | 'handle_upper' | 'internals' | 'collar' | 'head' | 'lid' | 'lid_screws'
  | 'cassette' | 'cassette_fixed' | 'moving' | 'magnet' | 'filament' | 'sensor' | 'vibration'

export const GROUPS: GroupKey[] = [
  'handle_lower', 'handle_upper', 'internals', 'collar', 'head', 'lid', 'lid_screws',
  'cassette', 'cassette_fixed', 'moving', 'magnet', 'filament', 'sensor', 'vibration',
]

export type V3 = [number, number, number]

export interface Pose {
  cam: V3
  target: V3
  fov: number
  /** Pivot rotation about the device centre (radians, XYZ). */
  rot: V3
  /** Explode amounts, 0–1. */
  headOut: number
  vib: number
  lid: number
  carriage: number
  upper: number
  /** How strongly unfocused parts darken, 0–1. */
  dim: number
  /** Field glow between magnet and sensor, 0–1. */
  field: number
  /** Idle float and pointer parallax, 0–1. */
  idle: number
  /** Moves the subject across the screen, as a fraction of the viewport (x right, y down). */
  shift: [number, number]
  /** Highlight weight per group, 0–1. */
  focus: Partial<Record<GroupKey, number>>
  /** X-ray: how see-through each group is, 0–1. */
  ghost: Partial<Record<GroupKey, number>>
  /** Optional framing: fit a sphere (centre, radius) seen from a direction; overrides cam/target. */
  frame?: { c: V3; r: number; dir: V3 }
}

const base: Pose = {
  cam: [0, 0, 5], target: [0, 0, 0], fov: 30, rot: [0, 0, 0],
  headOut: 0, vib: 0, lid: 0, carriage: 0, upper: 0, dim: 0, field: 0, idle: 0, shift: [0.2, 0], focus: {}, ghost: {},
}

const pose = (p: Partial<Pose>): Pose => ({ ...base, ...p, focus: { ...(p.focus || {}) }, ghost: { ...(p.ghost || {}) } })

export const HERO = pose({
  cam: [0, 0.3, 7.9], target: [-0.6, -0.1, 0], fov: 28,
  rot: [0.5, -0.3, -0.42], idle: 1, shift: [0.13, -0.04],
})

/** Phones: the device fills the width above the title. */
export const HERO_M = pose({
  ...HERO, frame: { c: [0.02, -0.04, 0], r: 1.3, dir: [0, 0.08, 1] }, rot: [0.5, -0.28, -0.72],
})

/** Where the hero drifts as it scrolls away. */
export const HERO_OUT = pose({
  cam: [0, 1.2, 6.2], target: [-0.5, 0.75, 0], fov: 28,
  rot: [0.75, -0.6, -0.5], idle: 1, shift: [0.1, -0.03],
})

export const HERO_OUT_M = pose({
  ...HERO_OUT, frame: { c: [0.02, 0.5, 0], r: 1.3, dir: [0, 0.3, 1] }, rot: [0.75, -0.5, -0.8],
})

/** Steps of the pinned "Inside" chapter, in order. The last one is the press lab. */
export const STEPS: Pose[] = [
  // 0 · One handle, two heads
  pose({
    frame: { c: [0.16, 0.02, 0.48], r: 1.5, dir: [0.22, 0.62, 1] },
    rot: [0, -0.12, 0], headOut: 1, vib: 1,
    focus: { vibration: 0.25, collar: 0.4 },
  }),
  // 1 · Lift the lid
  pose({
    frame: { c: [0.66, 0.08, 0.02], r: 0.82, dir: [0.55, 0.72, 0.85] },
    lid: 1, dim: 0.35, focus: { cassette: 0.4, moving: 0.4, magnet: 0.4, sensor: 0.4, filament: 1 },
  }),
  // 2 · The printed spring (seen from the device's left so the far wall can't hide the fixed rail)
  pose({
    frame: { c: [0.645, 0.04, 0.05], r: 0.46, dir: [0.3, 0.85, 0.75] },
    lid: 3, carriage: 1, dim: 0.85, focus: { cassette: 1, cassette_fixed: 0.6 }, ghost: { head: 0.82, lid: 1, lid_screws: 1, collar: 0.5 },
  }),
  // 3 · Magnet and sensor
  pose({
    frame: { c: [0.35, 0.0, -0.07], r: 0.24, dir: [0.3, 1, 0.3] },
    lid: 3, dim: 0.8, field: 1, focus: { magnet: 1, sensor: 1, moving: 0.3 }, ghost: { head: 1, lid: 1, lid_screws: 1, collar: 1, handle_lower: 0.6, handle_upper: 0.6 },
  }),
  // 4 · The handle
  pose({
    frame: { c: [-0.66, 0.22, 0], r: 0.95, dir: [0.25, 0.95, 0.85] },
    upper: 1, dim: 0.6, focus: { internals: 1, handle_upper: 0.35 },
  }),
  // 5 · Press lab
  pose({
    frame: { c: [0.62, -0.02, -0.01], r: 0.6, dir: [0.42, 0.9, 0.62] },
    lid: 3, dim: 0.3, field: 0.6, shift: [0.14, 0.06], ghost: { head: 0.6, lid: 1, lid_screws: 1 }, focus: { cassette: 0.6, magnet: 0.6, sensor: 0.4, filament: 1 },
  }),
]

/**
 * Resolve a pose for the viewport. Framed poses fit their subject into the
 * free part of the screen: the right half beside the text on wide screens,
 * the top half above it on narrow ones.
 */
export function forViewport(p: Pose, aspect: number): Pose {
  const wide = aspect >= 1.15
  let out = p
  if (p.frame) {
    const { c, r, dir } = p.frame
    const len = Math.hypot(dir[0], dir[1], dir[2])
    const tanV = Math.tan((p.fov * Math.PI) / 360)
    const availW = wide ? 0.5 : 0.92
    const availH = wide ? 0.8 : 0.46
    const d = Math.max(r / (availH * tanV), r / (availW * aspect * tanV))
    out = { ...p, target: c, cam: [c[0] + (dir[0] / len) * d, c[1] + (dir[1] / len) * d, c[2] + (dir[2] / len) * d] }
  } else if (!wide) {
    const k = Math.min(1.9, 1.15 / aspect) ** 0.85
    out = { ...p, cam: [p.target[0] + (p.cam[0] - p.target[0]) * k, p.target[1] + (p.cam[1] - p.target[1]) * k, p.target[2] + (p.cam[2] - p.target[2]) * k] }
  }
  if (!wide) out = { ...out, shift: [0, p.idle > 0.5 ? -0.16 : -0.21] }
  return out
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

export function mix(a: Pose, b: Pose, t: number): Pose {
  const focus: Partial<Record<GroupKey, number>> = {}
  const ghost: Partial<Record<GroupKey, number>> = {}
  for (const g of GROUPS) {
    const v = lerp(a.focus[g] ?? 0, b.focus[g] ?? 0, t)
    if (v) focus[g] = v
    const h = lerp(a.ghost[g] ?? 0, b.ghost[g] ?? 0, t)
    if (h) ghost[g] = h
  }
  const frame = a.frame && b.frame ? { c: lerp3(a.frame.c, b.frame.c, t), r: lerp(a.frame.r, b.frame.r, t), dir: lerp3(a.frame.dir, b.frame.dir, t) } : undefined
  return {
    frame,
    cam: lerp3(a.cam, b.cam, t), target: lerp3(a.target, b.target, t), fov: lerp(a.fov, b.fov, t),
    rot: lerp3(a.rot, b.rot, t),
    headOut: lerp(a.headOut, b.headOut, t), vib: lerp(a.vib, b.vib, t), lid: lerp(a.lid, b.lid, t),
    carriage: lerp(a.carriage, b.carriage, t), upper: lerp(a.upper, b.upper, t),
    dim: lerp(a.dim, b.dim, t), field: lerp(a.field, b.field, t), idle: lerp(a.idle, b.idle, t),
    shift: [lerp(a.shift[0], b.shift[0], t), lerp(a.shift[1], b.shift[1], t)], focus, ghost,
  }
}

export interface Callout {
  step: number
  anchor: V3
  group: GroupKey
  label: string
  sub: string
  /** Label offset from the anchor in CSS px; mirrored on narrow screens. */
  off: [number, number]
}

export const CALLOUTS: Callout[] = [
  { step: 0, anchor: [214, 0, 25], group: 'lid', label: 'Pressure head', sub: 'Printed spring · magnet · Hall sensor', off: [70, -110] },
  { step: 0, anchor: [176, 0, 27], group: 'vibration', label: 'Vibration head', sub: '10 mm coin motor', off: [90, 70] },
  { step: 0, anchor: [150, -20, 26], group: 'collar', label: 'Twist-lock collar', sub: '30° turn · safety slider', off: [-40, -120] },
  { step: 1, anchor: [205, 0, 25], group: 'lid', label: 'Cover 43', sub: '4 × M3 × 35 from below', off: [-60, -90] },
  { step: 1, anchor: [244, 0, 6], group: 'moving', label: 'Filament cartridge', sub: 'Twist · lock · replace', off: [80, 60] },
  { step: 2, anchor: [217.4, -10, -9], group: 'cassette', label: 'Printed flexure 57', sub: 'Two 0.8 mm beams, 27 mm apart', off: [90, 80] },
  { step: 2, anchor: [205, -21.5, -8.6], group: 'cassette', label: 'Fixed rail', sub: 'Screwed to the chassis', off: [-150, 70] },
  { step: 2, anchor: [214, 8, 14], group: 'moving', label: 'Carriage 44', sub: 'Lifted to show the spring', off: [80, -90] },
  { step: 3, anchor: [178, 7, 1.5], group: 'magnet', label: 'Magnet stack', sub: '2 × Ø3 × 2 mm discs', off: [70, -100] },
  { step: 3, anchor: [170.6, 7, -1.2], group: 'sensor', label: '49E Hall sensor', sub: 'Fixed · 5.0 mm gap', off: [-170, 90] },
  { step: 4, anchor: [37, 0, 9], group: 'internals', label: 'ESP32', sub: 'Reads, logs, talks', off: [-70, 120] },
  { step: 4, anchor: [40, 0, 27.3], group: 'handle_upper', label: '0.96 in OLED', sub: 'Live reading', off: [-90, -80] },
  { step: 4, anchor: [70, 0, -10], group: 'internals', label: '18650 cell', sub: 'USB-C charging', off: [60, 110] },
  { step: 4, anchor: [103, 5, 7.2], group: 'internals', label: 'microSD logger', sub: 'Every sample on record', off: [90, -60] },
  { step: 5, anchor: [178, 7, 1.5], group: 'magnet', label: 'Magnet', sub: 'Moves with the tip', off: [-60, -110] },
  { step: 5, anchor: [217.4, -10, -9], group: 'cassette', label: 'Beams bend', sub: 'Fixed-guided, S-shaped', off: [70, 90] },
]
