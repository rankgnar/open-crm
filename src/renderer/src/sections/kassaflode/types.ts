export interface BankTransaktion {
  id: string
  datum: string
  beskrivning: string
  belopp: number
  saldo: number | null
  referens: string | null
  importerat_at: string
}

export interface BankTransaktionInput {
  datum: string
  beskrivning: string
  belopp: number
  saldo?: number | null
  referens?: string | null
}

export type KassaflodeTab = 'oversikt' | 'fordringar' | 'banktransaktioner'

export interface MonthRow {
  month: string
  fakturerat: number
  inkasserat: number
  levKostnader: number
  betalttillLev: number
  bankNetto: number
  netto: number
}

export interface ColumnMapping {
  datum: string
  beskrivning: string
  belopp: string
  saldo: string
  referens: string
}
