import { TRIGGER_SECTIONS } from '@/nav-sections'

export const SECCIONES = TRIGGER_SECTIONS.map(s => ({ value: s.id, label: s.label }))

export const SECCION_COLORS: Record<string, string> = {
  kunder:   'text-emerald-400',
  projekt:  'text-blue-400',
  forslag:  'text-violet-400',
  tidplan:  'text-cyan-400',
  ekonomi:  'text-rose-400',
  epost:    'text-yellow-400',
  kalender: 'text-orange-400',
  kontext:  'text-indigo-400',
  revisor:  'text-teal-400',
  fortnox:  'text-green-400',
  fakturor: 'text-amber-400',
}

export type RequiredInput = 'projekt_id' | 'kund_id' | 'forslag_id'

export const SECCION_REQUIRED_INPUTS: Record<string, RequiredInput[]> = {
  projekt:            ['projekt_id'],
  'projekt:dokument': ['projekt_id'],
  forslag:            ['forslag_id'],
  signera:            ['projekt_id'],
  kalender:           ['projekt_id'],
  tidplan:            ['projekt_id'],
  order:              ['projekt_id'],
  ata:                ['projekt_id'],
  ekonomi:            ['projekt_id'],
  fakturering:        ['projekt_id'],
  kvitto:             ['projekt_id'],
  kunder:             ['kund_id'],
}

export function requiredInputsFor(seccion: string): RequiredInput[] {
  return SECCION_REQUIRED_INPUTS[seccion] ?? []
}
