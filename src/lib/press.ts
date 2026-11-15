// The pressure head's physics, from the hardware repository's own sizing notes
// (hardware/docs/ENGINEERING_NOTES.md, WIRING_AND_CALIBRATION.md and
// validation/flexure_sizing.json). These are ideal estimates used to animate
// the page. No force accuracy follows from them.

/** Assumed elastic modulus of the printed beams, MPa (the notes' illustrative value). */
export const E_MPA = 2500
/** Beam height (b) and span (L), mm. */
export const BEAM_H = 2.4
export const BEAM_L = 24
/** Compression stop, mm. Past it, force bypasses the spring into the housing. */
export const STOP_MM = 2.0
/** Magnet face to Hall package face at rest, mm. */
export const GAP_MM = 5.0

const N_PER_GF = 0.00980665

/** Stiffness of two ideal fixed-guided beams, N/mm: k = 2 E b t³ / L³. */
export function stiffness(t: number): number {
  return (2 * E_MPA * BEAM_H * t ** 3) / BEAM_L ** 3
}

export function forceGf(deltaMm: number, t: number): number {
  return (stiffness(t) * deltaMm) / N_PER_GF
}

export function deltaForGf(gf: number, t: number): number {
  return (gf * N_PER_GF) / stiffness(t)
}

/**
 * On-axis field of a stack of two Ø3 × 2 mm discs at the sensor face, mT.
 * Cylinder formula with Br = 1.2 T (N35 assumed): about 17 mT at rest and
 * 50 mT at the stop, matching validation/electronics_checks.json.
 */
export function fieldMt(deltaMm: number): number {
  const z = GAP_MM - deltaMm
  const R = 1.5
  const len = 4
  return 600 * ((z + len) / Math.hypot(z + len, R) - z / Math.hypot(z, R))
}

/** 49E output at 3.3 V: about half supply plus roughly 9 mV per mT. */
export function hallMv(mt: number): number {
  return 1650 + 9 * mt
}
