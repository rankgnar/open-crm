export interface EpostRef {
  message_id: string
  folder_id: string
  provider: 'zoho' | 'gmail'
  amne: string
  fran_adress: string
  fran_namn: string
  snippet: string
  datum: string
}

export interface KalenderEvent {
  id: string
  farg: string
  titel: string
  beskrivning: string
  plats: string
  url: string
  start: string
  slut: string
  hel_dag: boolean
  aterkommer: boolean
  slutford: boolean
  kund_id: string | null
  projekt_id: string | null
  fas_id: string | null
  kalender_id: string | null
  personal_id: string | null
  personal_ids: string[]
  epost_ref: EpostRef | null
}

export interface NyttEventForm {
  titel: string
  beskrivning: string
  plats: string
  url: string
  start: string
  slut: string
  hel_dag: boolean
  kund_id: string
  projekt_id: string
  kalender_id: string
  personal_id: string
  personal_ids: string[]
}

export interface Kalender {
  id: string
  namn: string
  farg: string
  sortering: number
}

export interface KalenderDokument {
  id: string
  event_id: string
  filnamn: string
  mime_type: string
  storlek: number
  storage_path: string
  skapad_at: string
}

export type KalenderVy = 'manad' | 'vecka' | 'dag' | '2vecka' | '3vecka' | '3manad' | '6manad'
