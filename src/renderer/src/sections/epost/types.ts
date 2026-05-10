export type EpostMapp = 'inkorg' | 'skickat' | 'utkast' | 'utkorg' | 'papperskorg'

export type EpostKoStatus = 'väntar' | 'skickar' | 'skickat' | 'misslyckades'

export interface EpostKoMeddelande {
  id: string
  alias_id: string | null
  mall_id: string | null
  till: string
  cc: string
  amne: string
  kropp_html: string
  bilagor: EpostBilagaRef[]
  kund_id: string | null
  projekt_id: string | null
  forslag_id: string | null
  faktura_id: string | null
  schemalagd_till: string
  status: EpostKoStatus
  forsok: number
  fel_meddelande: string
  skapad_at: string
  uppdaterad_at: string
  skickad_at: string | null
}

export type EpostProvider = 'gmail' | 'zoho'

export interface EpostMeddelande {
  id: string
  provider: EpostProvider
  provider_message_id: string
  folder_id: string
  kund_id: string | null
  fran_adress: string
  fran_namn: string
  till: string[]
  cc: string[]
  amne: string
  snippet: string
  kropp_html: string
  kropp_text: string
  olast: boolean
  har_bilaga: boolean
  mapp: EpostMapp
  datum: string
}

export interface EpostAlias {
  id: string
  etikett: string
  fran_namn: string
  fran_adress: string
  signatur_html: string
  provider: EpostProvider
  zoho_send_mail_id: string | null
  standard: boolean
  aktiv: boolean
  sortering: number
  skapad_at: string
  uppdaterad_at: string
}

export interface EpostMall {
  id: string
  namn: string
  amne: string
  kropp_html: string
  kategori: string
  system_kod: string | null
  alias_id: string | null
  aktiv: boolean
  sortering: number
  skapad_at: string
  uppdaterad_at: string
}

export interface EpostBilagaRef {
  storeName: string
  attachmentName: string
  attachmentPath: string
  storlek?: number
  kalla?: 'fil' | 'offert_pdf' | 'faktura_pdf'
}

export interface NyttMeddelandeForm {
  alias_id: string | null
  till: string
  cc: string
  amne: string
  kropp: string
  mall_id: string | null
  kund_id: string | null
  projekt_id: string | null
  forslag_id: string | null
  faktura_id: string | null
  bilagor: EpostBilagaRef[]
}
