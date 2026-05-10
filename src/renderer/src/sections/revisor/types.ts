export type DeadlineTyp = 'mote' | 'deklaration' | 'inlamning' | 'bokslut' | 'ovrig'
export type DeadlineStatus = 'kommande' | 'slutford' | 'forsenad'
export type AnteckningFarg = 'muted' | 'emerald' | 'amber' | 'red' | 'blue'

export interface RevisorDeadline {
  id: string
  titel: string
  datum: string
  typ: DeadlineTyp
  status: DeadlineStatus
  notat: string | null
  skapad_at: string
  uppdaterad_at: string
}

export interface CreateDeadlineInput {
  titel: string
  datum: string
  typ: DeadlineTyp
  notat?: string
}

export interface RevisorAnteckning {
  id: string
  titel: string
  innehall: string
  farg: AnteckningFarg
  skapad_at: string
  uppdaterad_at: string
}

export interface RevisorDokument {
  id: string
  filnamn: string
  storage_path: string
  mime_type: string
  storlek: number
  skapad_at: string
}

export const ANTECKNING_FARG_DOT: Record<AnteckningFarg, string> = {
  muted:   'bg-subtle border-subtle',
  emerald: 'bg-emerald-400 border-emerald-400',
  amber:   'bg-amber-400 border-amber-400',
  red:     'bg-red-400 border-red-400',
  blue:    'bg-blue-400 border-blue-400',
}
