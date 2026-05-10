export interface FaktureringEtapp {
  pct: number
  beskrivning: string
  forfall_date?: string | null
  netto: number
  rot: number
  moms: number
  att_betala: number
}

export interface FaktureringSnapshot {
  id: string
  projekt_id: string
  forslag_id: string
  forslag_nummer: string
  forslag_titel: string
  total_arbete: number
  total_material: number
  total_ue: number
  total_netto: number
  rot_eligible: number
  rot_avdrag: number
  moms_totalt: number
  att_betala_totalt: number
  etapper: FaktureringEtapp[]
  skapad_at: string
}
