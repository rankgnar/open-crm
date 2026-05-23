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
}

export type UpdateKundInput = Partial<CreateKundInput>

export type KundLastProjekt = Record<string, { id: string; projekt_nummer: string; namn: string }>
export type KundLastForslag = Record<string, { id: string; forslag_nummer: string; titel: string; status: string }>

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

export type { FragaTyp, AvslutFragaFalt } from '@/types/fraga'
