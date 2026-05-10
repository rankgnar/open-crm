export type UtfallKategori = 'arbete' | 'material' | 'ue' | 'övrigt'

export interface EkonomiUtfall {
  id: string
  projekt_id: string
  kategori: UtfallKategori
  beskrivning: string
  belopp: number
  datum: string
  skapad_at: string
}

export interface CreateUtfallInput {
  projekt_id: string
  kategori: UtfallKategori
  beskrivning: string
  belopp: number
  datum: string
}
