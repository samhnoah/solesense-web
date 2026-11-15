// Test sites on the sole, in millimetres on the F260 right-foot guide outline
// (viewBox 128 × 284, toes at the top, great toe on the right). Left-foot
// positions are the mirror image.
//
// The positions are for display. They follow the regions named in published
// site maps; they are not validated anatomical coordinates.

export type SiteId =
  | 'hallux' | 'toe3' | 'toe5'
  | 'mth1' | 'mth3' | 'mth5'
  | 'midMedial' | 'midLateral' | 'heel' | 'dorsum'

export interface Site { id: SiteId; x: number; y: number; name: string; dorsal?: boolean }

const ALL: Record<SiteId, Site> = {
  hallux: { id: 'hallux', x: 101, y: 28, name: 'Big toe' },
  toe3: { id: 'toe3', x: 49, y: 36, name: 'Third toe' },
  toe5: { id: 'toe5', x: 14, y: 68, name: 'Little toe' },
  mth1: { id: 'mth1', x: 100, y: 88, name: 'Ball of the foot, under the big toe' },
  mth3: { id: 'mth3', x: 62, y: 86, name: 'Ball of the foot, middle' },
  mth5: { id: 'mth5', x: 27, y: 106, name: 'Ball of the foot, under the little toe' },
  midMedial: { id: 'midMedial', x: 74, y: 160, name: 'Arch, inner side' },
  midLateral: { id: 'midLateral', x: 36, y: 160, name: 'Arch, outer side' },
  heel: { id: 'heel', x: 61, y: 246, name: 'Heel' },
  dorsum: { id: 'dorsum', x: 84, y: 58, name: 'Top of the foot, between the first two toes', dorsal: true },
}

export type MapId = 'three' | 'ten'
export type Foot = 'left' | 'right'
export type Answer = 'felt' | 'notFelt'

export const MAPS: Record<MapId, Site[]> = {
  // Three-site map used in IWGDF guidance: hallux, first and fifth metatarsal heads
  three: [ALL.hallux, ALL.mth1, ALL.mth5],
  // Classic ten-site Semmes-Weinstein map
  ten: [
    ALL.hallux, ALL.toe3, ALL.toe5,
    ALL.mth1, ALL.mth3, ALL.mth5,
    ALL.midMedial, ALL.midLateral, ALL.heel, ALL.dorsum,
  ],
}
