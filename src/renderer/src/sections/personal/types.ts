export type PersonalStatus = string

export interface PersonalStatusar {
  id: string
  namn: string
  farg: 'emerald' | 'blue' | 'amber' | 'red' | 'muted'
  sortering: number
  skapad_at: string
}

export const FARG_DOT: Record<PersonalStatusar['farg'], string> = {
  emerald: 'bg-emerald-400', blue: 'bg-blue-400', amber: 'bg-amber-400', red: 'bg-red-400', muted: 'bg-muted',
}

export const FARG_TEXT: Record<PersonalStatusar['farg'], string> = {
  emerald: 'text-emerald-400', blue: 'text-blue-400', amber: 'text-amber-400', red: 'text-red-400', muted: 'text-muted',
}

export type PersonalTyp = 'TJM' | 'ARB'
export type Loneform = 'MAN' | 'TIM'
export type LedighetTyp = 'semester' | 'ledig' | 'sjuk' | 'VAB' | 'föräldraledighet' | 'tjanstledighet'
export type TidrapportTyp = 'normal' | 'övertid' | 'jour'
export type TidrapportStatus = 'inskickad' | 'godkänd' | 'nekad'
export type LedighetStatus = 'inskickad' | 'godkänd' | 'nekad'
export type LonepostTyp = 'förskott' | 'tillägg' | 'avdrag' | 'traktamente' | 'utlägg'

export type AnteckningFarg = 'emerald' | 'amber' | 'red' | 'blue' | 'muted'

export const ANTECKNING_FARG_DOT: Record<AnteckningFarg, string> = {
  emerald: 'bg-emerald-400 border-emerald-400',
  amber: 'bg-amber-400 border-amber-400',
  red: 'bg-red-400 border-red-400',
  blue: 'bg-blue-400 border-blue-400',
  muted: 'bg-subtle border-subtle',
}

export interface Personal {
  id: string
  personal_nummer: string
  fortnox_id: string | null
  namn: string
  personnummer: string | null
  roll: string | null
  personaltyp: PersonalTyp | null
  loneform: Loneform | null
  anstallningsform: string | null
  email: string | null
  telefon: string | null
  postadress: string | null
  postnummer: string | null
  ort: string | null
  anstallningsdatum: string | null
  slutdatum: string | null
  manadslön: number | null
  timlön: number | null
  sysselsattningsgrad: number | null
  clearingnummer: string | null
  kontonummer: string | null
  bank: string | null
  status: PersonalStatus
  supabase_user_id: string | null
  skapad_at: string
  uppdaterad_at: string
}

export interface CreatePersonalInput {
  personal_nummer?: string
  fortnox_id?: string
  namn: string
  personnummer?: string
  roll?: string
  personaltyp?: PersonalTyp
  loneform?: Loneform
  anstallningsform?: string
  email?: string
  telefon?: string
  postadress?: string
  postnummer?: string
  ort?: string
  anstallningsdatum?: string
  slutdatum?: string
  manadslön?: number
  timlön?: number
  sysselsattningsgrad?: number
  clearingnummer?: string
  kontonummer?: string
  bank?: string
  status?: PersonalStatus
}

export interface UpdatePersonalInput {
  personal_nummer?: string | null
  fortnox_id?: string | null
  namn?: string
  personnummer?: string | null
  roll?: string | null
  personaltyp?: PersonalTyp | null
  loneform?: Loneform | null
  anstallningsform?: string | null
  email?: string | null
  telefon?: string | null
  postadress?: string | null
  postnummer?: string | null
  ort?: string | null
  anstallningsdatum?: string | null
  slutdatum?: string | null
  manadslön?: number | null
  timlön?: number | null
  sysselsattningsgrad?: number | null
  clearingnummer?: string | null
  kontonummer?: string | null
  bank?: string | null
  status?: PersonalStatus
}

export interface PersonalAnteckning {
  id: string
  personal_id: string
  titel: string
  innehall: string
  farg: AnteckningFarg
  skapad_at: string
}

export type DokumentKategori = 'lonespec' | 'dokument'

export interface PersonalDokument {
  id: string
  personal_id: string
  kategori: DokumentKategori
  filnamn: string
  mime_type: string
  storlek: number
  storage_path: string
  skapad_at: string
}

export interface PersonalLedighet {
  id: string
  personal_id: string
  typ: LedighetTyp
  startdatum: string
  slutdatum: string
  godkand: boolean
  kommentar: string | null
  status: LedighetStatus
  skapad_at: string
}

export interface LedighetGlobal extends PersonalLedighet {
  personal: { namn: string; personal_nummer: string } | null
}

export interface PersonalLonepost {
  id: string
  personal_id: string
  typ: LonepostTyp
  belopp: number
  beskrivning: string
  datum: string
  manad: string
  skapad_at: string
}

export type TransportMedel = 'kollektivtrafik' | 'firmabil' | null

export interface PersonalTidrapport {
  id: string
  personal_id: string
  projekt_id: string | null
  datum: string
  timmar: number
  incheckning: string | null
  utcheckning: string | null
  paustid_minuter: number
  transportmedel: TransportMedel
  typ: TidrapportTyp
  beskrivning: string | null
  beskrivning_oversatt: string | null
  beskrivning_sprak: string | null
  beskrivning_oversatt_at: string | null
  status: TidrapportStatus
  godkand_at: string | null
  skapad_at: string
}

export interface TidrapportGlobal extends PersonalTidrapport {
  personal: { namn: string; personal_nummer: string; timlön: number | null; manadslön: number | null; loneform: string | null } | null
  projekt: { namn: string; projekt_nummer: string } | null
  bilder_antal: number
}

export interface TidrapportBild {
  id: string
  filnamn: string
  mime_type: string
  storage_path: string
  skapad_at: string
  signed_url: string | null
}

export interface FileDialogResult {
  filePath: string
  fileName: string
  mimeType: string
  size: number
}

export interface CsvImportResult {
  importados: number
  omitidos: number
  errores: string[]
}

export const LEDIGHET_TYPER: { value: LedighetTyp; label: string }[] = [
  { value: 'semester', label: 'Semester' },
  { value: 'ledig', label: 'Ledig' },
  { value: 'sjuk', label: 'Sjuk' },
  { value: 'VAB', label: 'VAB' },
  { value: 'föräldraledighet', label: 'Föräldraledighet' },
  { value: 'tjanstledighet', label: 'Tjänstledighet' },
]

export const TIDRAPPORT_TYPER: { value: TidrapportTyp; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'övertid', label: 'Övertid' },
  { value: 'jour', label: 'Jour' },
]

export interface ProjektPersonal {
  id: string
  projekt_id: string
  projekt: { id: string; projekt_nummer: string; namn: string } | null
}

export interface ProjektItem {
  id: string
  projekt_nummer: string
  namn: string
}

export const LONEPOST_TYPER: { value: LonepostTyp; label: string; sign: 1 | -1 }[] = [
  { value: 'tillägg', label: 'Tillägg', sign: 1 },
  { value: 'traktamente', label: 'Traktamente', sign: 1 },
  { value: 'utlägg', label: 'Utlägg', sign: 1 },
  { value: 'avdrag', label: 'Avdrag', sign: -1 },
  { value: 'förskott', label: 'Förskott', sign: -1 },
]
