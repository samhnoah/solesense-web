// Test sites on the sole, in millimetres on the F260 right-foot outline
// (viewBox 128 x 284, toes at the top, great toe on the right).
// Left-foot positions are the mirror image.
//
// The positions are for display. They follow the regions named in the
// published site maps; they are not validated anatomical coordinates.

export type SiteId =
  | 'hallux' | 'toe3' | 'toe5'
  | 'mth1' | 'mth3' | 'mth5'
  | 'midMedial' | 'midLateral' | 'heel' | 'dorsum'

export interface Site { id: SiteId; x: number; y: number; dorsal?: boolean }

const ALL: Record<SiteId, Site> = {
  hallux:     { id: 'hallux',     x: 101, y: 28 },
  toe3:       { id: 'toe3',       x: 49,  y: 36 },
  toe5:       { id: 'toe5',       x: 14,  y: 68 },
  mth1:       { id: 'mth1',       x: 100, y: 88 },
  mth3:       { id: 'mth3',       x: 62,  y: 86 },
  mth5:       { id: 'mth5',       x: 27,  y: 106 },
  midMedial:  { id: 'midMedial',  x: 74,  y: 160 },
  midLateral: { id: 'midLateral', x: 36,  y: 160 },
  heel:       { id: 'heel',       x: 61,  y: 246 },
  dorsum:     { id: 'dorsum',     x: 84,  y: 58, dorsal: true },
}

export type MapId = 'three' | 'ten'
export type Foot = 'left' | 'right'

export const MAPS: Record<MapId, Site[]> = {
  // International Working Group on the Diabetic Foot (IWGDF) three-site map
  three: [ALL.hallux, ALL.mth1, ALL.mth5],
  // Classic ten-site Semmes-Weinstein map
  ten: [
    ALL.hallux, ALL.toe3, ALL.toe5,
    ALL.mth1, ALL.mth3, ALL.mth5,
    ALL.midMedial, ALL.midLateral, ALL.heel, ALL.dorsum,
  ],
}

export type Answer = 'felt' | 'notFelt'
export interface Step { foot: Foot; site: Site }
