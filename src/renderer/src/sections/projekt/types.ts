export type ProjektStatus = string

export interface ProjektStatusar {
  id: string
  namn: string
  farg: 'emerald' | 'blue' | 'amber' | 'red' | 'muted' | 'violet' | 'pink' | 'cyan' | 'orange' | 'rose' | 'indigo'
  sortering: number
  skapad_at: string
  inbyggd: boolean
}

export const FARG_DOT: Record<ProjektStatusar['farg'], string> = {
  emerald: 'bg-emerald-400', blue: 'bg-blue-400', amber: 'bg-amber-400', red: 'bg-red-400', muted: 'bg-muted',
  violet: 'bg-violet-400', pink: 'bg-pink-400', cyan: 'bg-cyan-400', orange: 'bg-orange-400', rose: 'bg-rose-400', indigo: 'bg-indigo-400',
}

export const FARG_TEXT: Record<ProjektStatusar['farg'], string> = {
  emerald: 'text-emerald-400', blue: 'text-blue-400', amber: 'text-amber-400', red: 'text-red-400', muted: 'text-muted',
  violet: 'text-violet-400', pink: 'text-pink-400', cyan: 'text-cyan-400', orange: 'text-orange-400', rose: 'text-rose-400', indigo: 'text-indigo-400',
}

export interface Projekt {
  id: string
  projekt_nummer: string
  kund_id: string
  namn: string
  beskrivning: string | null
  status: ProjektStatus
  startdatum: string | null
  slutdatum: string | null
  budget_total: number
  arbetsplats_adress: string | null
  arbetsplats_postnummer: string | null
  arbetsplats_stad: string | null
  rot_avdrag: boolean
  rot_procent: number
  rot_inkludera_medsokande: boolean
  betalningsvillkor: string | null
  villkor: string | null
  skapad_at: string
  uppdaterad_at: string
}

export interface ProjektWithKund extends Projekt {
  kunder: {
    namn: string
    kundnummer: string
  }
}

export interface CreateProjektInput {
  projekt_nummer?: string
  kund_id: string
  namn: string
  beskrivning?: string
  status?: ProjektStatus
  startdatum?: string
  slutdatum?: string
  budget_total?: number
  arbetsplats_adress?: string
  arbetsplats_postnummer?: string
  arbetsplats_stad?: string
  rot_avdrag?: boolean
  rot_procent?: number
  rot_inkludera_medsokande?: boolean
  betalningsvillkor?: string
  villkor?: string
}

export type AnteckningFarg = 'emerald' | 'amber' | 'red' | 'blue' | 'muted'

export const ANTECKNING_FARG_DOT: Record<AnteckningFarg, string> = {
  emerald: 'bg-emerald-400 border-emerald-400',
  amber: 'bg-amber-400 border-amber-400',
  red: 'bg-red-400 border-red-400',
  blue: 'bg-blue-400 border-blue-400',
  muted: 'bg-subtle border-subtle',
}

export interface ProjektAnteckning {
  id: string
  projekt_id: string
  titel: string
  innehall: string
  farg: AnteckningFarg
  skapad_at: string
}

export type UpdateProjektInput = Partial<Omit<CreateProjektInput, 'kund_id'>>

export interface ProjektAktivitet {
  id: string
  projekt_id: string
  text: string
  skapad_at: string
}

export type DokumentKategori = 'dokument' | 'faktura' | 'order' | 'ata'

export interface ProjektDokument {
  id: string
  projekt_id: string
  filnamn: string
  mime_type: string
  storlek: number
  storage_path: string
  synlig_for_kund: boolean
  kategori: DokumentKategori
  carpeta: string | null
  skapad_at: string
}

export interface FileDialogResult {
  filePath: string
  fileName: string
  mimeType: string
  size: number
}

export type FragaTyp = 'text' | 'textarea' | 'number' | 'select' | 'date' | 'boolean'

export interface FragaFalt {
  id: string
  label: string
  type: FragaTyp
  required: boolean
  options: string[] | null
}

export interface Frageblankett {
  id: string
  projekt_id: string
  token: string
  titel: string
  questions_json: FragaFalt[]
  answers_json: Record<string, string> | null
  status: 'utkast' | 'skickat' | 'besvarat'
  skickat_at: string | null
  besvarat_at: string | null
  skapad_at: string
}

export interface FrageblanktEpostDraft {
  till: string
  amne: string
  kropp_html: string
  alias_id: string | null
  kund_namn: string
  projekt_id: string
  kund_id: string
}
