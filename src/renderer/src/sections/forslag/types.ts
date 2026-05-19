export type ForslagStatus = string

export interface SignaturSummary {
  skapad_at: string
  oppnad_at: string | null
  last_oppnad_at: string | null
  signerad_at: string | null
  signerad_namn: string | null
  revoked_at: string | null
  view_count: number
  paminnelse_historik: { at: string }[]
}

export interface ForslagStatusar {
  id: string
  namn: string
  farg: 'emerald' | 'amber' | 'red' | 'blue' | 'muted'
  sortering: number
  skapad_at: string
  inbyggd: boolean
}

export const FARG_DOT: Record<ForslagStatusar['farg'], string> = {
  emerald: 'bg-emerald-400', blue: 'bg-blue-400', amber: 'bg-amber-400', red: 'bg-red-400', muted: 'bg-muted',
}

export const FARG_TEXT: Record<ForslagStatusar['farg'], string> = {
  emerald: 'text-emerald-400', blue: 'text-blue-400', amber: 'text-amber-400', red: 'text-red-400', muted: 'text-muted',
}

export interface Forslag {
  id: string
  forslag_nummer: string
  projekt_id: string
  titel: string
  status: ForslagStatus
  giltig_till: string | null
  moms_procent: number
  sammanfattning: string | null
  ai_analys: string | null
  godkand_av: string | null
  godkand_datum: string | null
  signatur_data: string | null
  skapad_at: string
  uppdaterad_at: string
}

export interface ForslagWithProjekt extends Forslag {
  projekt: {
    kund_id: string
    namn: string
    projekt_nummer: string
    beskrivning: string | null
    status: string
    startdatum: string | null
    slutdatum: string | null
    arbetsplats_adress: string | null
    arbetsplats_postnummer: string | null
    arbetsplats_stad: string | null
    rot_avdrag: boolean
    rot_procent: number
    rot_inkludera_medsokande: boolean
    villkor: string | null
    betalningsvillkor: string | null
    kunder: {
      namn: string
      kundnummer: string
      email: string | null
      telefon: string | null
      telefon_2: string | null
      adress: string | null
      adress_2: string | null
      postnummer: string | null
      stad: string | null
      org_nummer: string | null
      personnummer: string | null
      fastighetsbeteckning: string | null
      login_anteckning: string | null
    }
  }
}

export interface ForslagFas {
  id: string
  forslag_id: string
  namn: string
  beskrivning: string | null
  sortering: number
  start_datum: string | null
  slut_datum: string | null
  notat: string | null
  aktiv: boolean
  skapad_at: string
}

export interface ForslagSubfas {
  id: string
  fas_id: string
  namn: string
  beskrivning: string | null
  sortering: number
  skapad_at: string
}

export interface ForslagArbete {
  id: string
  subfas_id: string
  beskrivning: string
  yrkesroll: string
  antal_timmar: number
  timpris: number
  rot_berattigad: boolean
  skapad_at: string
}

export interface ForslagMaterial {
  id: string
  subfas_id: string
  beskrivning: string
  enhet: string
  antal: number
  a_pris: number
  leverantor: string
  skapad_at: string
}

export interface ForslagUnderentreprenor {
  id: string
  subfas_id: string
  namn: string
  beskrivning: string
  inkl_material: boolean
  kostnad: number
  skapad_at: string
}

export interface CreateForslagInput {
  forslag_nummer?: string
  projekt_id: string
  titel: string
  status?: ForslagStatus
  giltig_till?: string
  moms_procent?: number
  sammanfattning?: string
}

export type UpdateForslagInput = Partial<Omit<CreateForslagInput, 'projekt_id'>> & {
  ai_analys?: string
}

export interface BulkTimprisEntry {
  yrkesroll: string
  forslagTimpris: number
  katalogTimpris: number | null
}

export interface ForslagEpostRef {
  id: string
  forslag_id: string
  message_id: string
  folder_id: string
  provider: string
  amne: string
  fran_adress: string
  fran_namn: string
  snippet: string
  datum: string
  skapad_at: string
}

export interface SmsMall {
  id: string
  namn: string
  meddelande: string
  aktiv: boolean
  sortering: number
  skapad_at: string
  uppdaterad_at: string
}

export interface ForslagSmsLog {
  id: string
  forslag_id: string
  mall_namn: string
  meddelande: string
  skapad_at: string
}
