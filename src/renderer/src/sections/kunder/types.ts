export type KundStatus = string

export interface KundStatusar {
  id: string
  namn: string
  farg: 'emerald' | 'amber' | 'red' | 'blue' | 'muted'
  sortering: number
  skapad_at: string
  inbyggd: boolean
}

export const FARG_DOT: Record<KundStatusar['farg'], string> = {
  emerald: 'bg-emerald-400', blue: 'bg-blue-400', amber: 'bg-amber-400', red: 'bg-red-400', muted: 'bg-muted',
}

export const FARG_TEXT: Record<KundStatusar['farg'], string> = {
  emerald: 'text-emerald-400', blue: 'text-blue-400', amber: 'text-amber-400', red: 'text-red-400', muted: 'text-muted',
}

export interface Kund {
  id: string
  kundnummer: string
  namn: string
  email: string | null
  telefon: string | null
  telefon_2: string | null
  fax: string | null
  webbadress: string | null
  adress: string | null
  adress_2: string | null
  postnummer: string | null
  stad: string | null
  land: string | null
  landskod: string | null
  org_nummer: string | null
  personnummer: string | null
  fastighetsbeteckning: string | null
  brf_org_nummer: string | null
  medsokande_namn: string | null
  medsokande_personnummer: string | null
  order_std_villkor: string
  ata_std_villkor: string
  login_anteckning: string | null
  status: KundStatus
  skapad_at: string
  uppdaterad_at: string
}

export interface CreateKundInput {
  kundnummer?: string
  namn: string
  email?: string | null
  telefon?: string | null
  telefon_2?: string | null
  fax?: string | null
  webbadress?: string | null
  adress?: string | null
  adress_2?: string | null
  postnummer?: string | null
  stad?: string | null
  land?: string | null
  landskod?: string | null
  org_nummer?: string | null
  personnummer?: string | null
  fastighetsbeteckning?: string | null
  brf_org_nummer?: string | null
  medsokande_namn?: string | null
  medsokande_personnummer?: string | null
  order_std_villkor?: string
  ata_std_villkor?: string
  login_anteckning?: string | null
  status?: KundStatus
}

export type UpdateKundInput = Partial<CreateKundInput>

export type KundProjektCounts = Record<string, number>
export type KundForslagCounts = Record<string, Record<string, number>>

export interface KundAvslutsfeedback {
  id: string
  kund_id: string
  projekt_namn: string
  token: string
  questions_json: Array<{ id: string; label: string; type: string; required: boolean; options: string[] | null }>
  answers_json: Record<string, string> | null
  status: 'skickat' | 'besvarat'
  skickat_at: string
  besvarat_at: string | null
  skapad_at: string
}

export type FragaTyp = 'text' | 'textarea' | 'number' | 'select' | 'date' | 'boolean'

export interface AvslutFragaFalt {
  id: string
  label: string
  type: FragaTyp
  required: boolean
  options: string[] | null
}
