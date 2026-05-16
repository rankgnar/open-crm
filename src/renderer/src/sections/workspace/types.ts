export interface StatusCount { status: string; count: number }
export interface DayBucket { datum: string; count: number }
export interface MonthBucket { manad: string; belopp: number }

export interface WorkspaceOverview {
  kunder: { total: number; nya_senaste_vecka: number; sparkline_30d: DayBucket[] }
  projekt: { total: number; per_status: StatusCount[] }
  forslag: { total: number; per_status: StatusCount[] }
  ordrar: { total: number; per_status: StatusCount[]; belopp_aktiva: number }
  ata: { total: number; per_status: StatusCount[]; belopp_utestaende: number }
  signatur: { vantande: number; signerade_30d: number }
  tidplan: { per_dag_denna_vecka: DayBucket[]; idag: number; imorgon: number }
  kostnader: { denna_manad: number; foregaende_manad: number; sparkline_12m: MonthBucket[] }
  epost: {
    olasta: number
    inkorg_status: 'ok' | 'ej_ansluten' | 'fel'
    i_kon: number
    misslyckade: number
  }
  kalender: { idag: number; nasta_handelser: { id: string; titel: string; start: string }[] }
  personal: {
    aktiva: number
    total: number
    tidrapporter_inskickade: number
    ledighet_inskickade: number
    lediga_idag: number
  }
  fortnox: { senaste_synk: string | null; status: 'ok' | 'aldrig' }
  fakturering: {
    antal_planer: number
    total_planerat: number
    nasta_forfall: { datum: string; belopp: number; beskrivning: string } | null
  }
  ai: {
    leverantorer: { slug: string; namn: string; status: 'ok' | 'no_key' | 'inaktiv' }[]
    assistenter_aktiva: number
    workflows_aktiva: number
    kontext_count: number
    noder_count: number
  }
}

export type WorkspaceTarget =
  | 'kunder' | 'projekt' | 'forslag' | 'order' | 'ata' | 'signera'
  | 'tidplan' | 'ekonomi' | 'epost' | 'kalender'
  | 'personal' | 'fortnox' | 'fakturering' | 'avancerat'
