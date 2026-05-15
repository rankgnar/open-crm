export type DokumentTyp = 'forslag' | 'order' | 'fritt' | 'ata'

export interface AndringEntry {
  at:     string
  reason: string
  ip?:    string | null
  ua?:    string | null
}

export interface SignaturLank {
  id:            string
  token:         string
  dokument_typ:  DokumentTyp
  dokument_id:   string
  kund_id:       string | null
  kund_email:    string
  dokument_hash: string
  meddelande:    string | null
  skapad_av:     string | null
  skapad_at:     string
  gar_ut_at:     string
  oppnad_at:     string | null
  view_count:    number
  last_oppnad_at: string | null
  signerad_at:   string | null
  signerad_namn: string | null
  signerad_ip:   string | null
  signerad_ua:   string | null
  signatur_data:    string | null
  revoked_at:       string | null
  document_pdf_url: string | null
  signed_pdf_url:   string | null
  andring_begard_at:   string | null
  andring_historik:    AndringEntry[]
  revisioner_historik: { at: string }[]
}

export interface EpostMall { id: string; namn: string; kategori: string; system_kod: string | null; meddelande_standard: string | null }

export type LankStatus = 'väntar' | 'öppnad' | 'ändring begärd' | 'signerad' | 'utgången' | 'återkallad'

export function lankStatus(l: SignaturLank): LankStatus {
  if (l.revoked_at)         return 'återkallad'
  if (l.signerad_at)        return 'signerad'
  if (new Date(l.gar_ut_at).getTime() < Date.now()) return 'utgången'
  if (l.andring_begard_at)  return 'ändring begärd'
  if (l.oppnad_at)          return 'öppnad'
  return 'väntar'
}
