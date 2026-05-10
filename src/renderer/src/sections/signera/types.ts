import type { SignaturLank } from '../signatur/types'

export interface SignaturFrittaDokument {
  id:                    string
  projekt_id:            string
  titel:                 string
  filnamn:               string
  mime_type:             string
  storlek:               number
  storage_path:          string
  arkiverad_dokument_id: string | null
  arkiverad_at:          string | null
  skapad_at:             string
}

export interface SigneraRow {
  lank:    SignaturLank
  dokument: SignaturFrittaDokument
  projekt: { id: string; namn: string; projekt_nummer: string }
  kund:    { id: string; namn: string } | null
}

export interface CreateSigneraInput {
  projekt_id:              string
  titel:                   string
  filnamn:                 string
  mime_type:               string
  filePath:                string
  storlek:                 number
  kund_email:              string
  giltig_dagar:            number
  meddelande?:             string
  mall_id?:                string | null
  auto_invite_kund_portal?: boolean
}
