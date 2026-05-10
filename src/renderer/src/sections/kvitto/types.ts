export type KvittoStatus = 'att_hantera' | 'hanterade'

export type KvittoKategori =
  | 'drivmedel'
  | 'material'
  | 'verktyg'
  | 'kontorsmateriel'
  | 'representation'
  | 'ovrigt'

export const KVITTO_KATEGORIER: { value: KvittoKategori; label: string }[] = [
  { value: 'drivmedel',       label: 'Drivmedel' },
  { value: 'material',        label: 'Material' },
  { value: 'verktyg',         label: 'Verktyg' },
  { value: 'kontorsmateriel', label: 'Kontorsmateriel' },
  { value: 'representation',  label: 'Representation' },
  { value: 'ovrigt',          label: 'Övrigt' },
]

export interface Kvitto {
  id: string
  datum: string
  leverantor: string | null
  belopp: number | null
  moms: number | null
  kategori: KvittoKategori | null
  beskrivning: string | null
  projekt_id: string | null
  status: KvittoStatus
  fil_storage_path: string
  fil_namn: string
  mime_type: string
  storlek: number
  fortnox_voucher_id: string | null
  skapad_av_user_id: string | null
  skapad_at: string
  uppdaterad_at: string
}

export interface KvittoListItem extends Kvitto {
  projekt_nummer: string | null
  projekt_titel: string | null
}

export interface CreateKvittoInput {
  datum?: string
  leverantor?: string | null
  belopp?: number | null
  moms?: number | null
  kategori?: KvittoKategori | null
  beskrivning?: string | null
  projekt_id?: string | null
  fil_storage_path: string
  fil_namn: string
  mime_type: string
  storlek: number
}

export interface UpdateKvittoInput {
  datum?: string
  leverantor?: string | null
  belopp?: number | null
  moms?: number | null
  kategori?: KvittoKategori | null
  beskrivning?: string | null
  projekt_id?: string | null
  status?: KvittoStatus
}
