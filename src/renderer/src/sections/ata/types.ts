export type ATAStatus = 'Utkast' | 'Skickad' | 'Godkänd' | 'Avvisad'

export interface FasTreeNode {
  id: string
  namn: string
  forslag_id: string
  forslag_titel: string
  forslag_nummer: string
  subfaser: { id: string; namn: string }[]
}

export interface ATARad {
  id: string
  ata_id: string
  beskrivning: string
  antal: number
  enhet: string
  a_pris: number
  belopp: number
  sortering: number
  skapad_at: string
}

export interface ATA {
  id: string
  ata_nummer: string
  projekt_id: string
  kund_id: string
  kund_namn: string
  kund_org_nr: string | null
  titel: string
  beskrivning: string
  villkor: string | null
  status: ATAStatus
  belopp_netto: number
  belopp_moms: number
  belopp_total: number
  godkand_av: string | null
  godkand_datum: string | null
  signatur_data: string | null
  fas_id: string | null
  subfas_id: string | null
  skapad_at: string
  uppdaterad_at: string
  projekt?: {
    id: string
    projekt_nummer: string
    namn: string
  }
  fas?: { id: string; namn: string } | null
  subfas?: { id: string; namn: string } | null
  kund?: { email: string | null } | null
}

export interface ATAWithRader extends ATA {
  rader: ATARad[]
}

export interface CreateATARadInput {
  beskrivning: string
  antal?: number
  enhet?: string
  a_pris?: number
  sortering?: number
}

export interface CreateATAInput {
  projekt_id: string
  titel: string
  beskrivning?: string
  villkor?: string
  fas_id?: string | null
  subfas_id?: string | null
  rader?: CreateATARadInput[]
}

export interface UpdateATAInput {
  titel?: string
  beskrivning?: string
  villkor?: string | null
  fas_id?: string | null
  subfas_id?: string | null
}

export const STATUS_FARG: Record<ATAStatus, { dot: string; text: string }> = {
  Utkast:   { dot: 'bg-muted',         text: 'text-muted'         },
  Skickad:  { dot: 'bg-blue-400',      text: 'text-blue-400'      },
  'Godkänd':{ dot: 'bg-emerald-400',   text: 'text-emerald-400'   },
  Avvisad:  { dot: 'bg-red-400',       text: 'text-red-400'       },
}
