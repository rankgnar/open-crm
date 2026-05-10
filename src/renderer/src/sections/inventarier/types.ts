export type InventarieSkick = 'Bra' | 'OK' | 'Dålig' | 'Trasig'

export const SKICK_OPTIONS: InventarieSkick[] = ['Bra', 'OK', 'Dålig', 'Trasig']

export const KATEGORI_OPTIONS = [
  'Elverktyg',
  'Handverktyg',
  'Mätinstrument',
  'Skyddsutrustning',
  'Maskiner',
  'Fordon',
  'IT-utrustning',
  'Kontorsmaterial',
  'Övrigt',
] as const

export const PLACERING_OPTIONS = ['Lager', 'Bilen', 'Kontor'] as const

export interface Inventarie {
  id: string
  lopnr: number
  kategori: string
  benamning: string
  tillverkare_modell: string
  serienr: string
  antal: number
  skick: string
  placering: string
  updated_by_user_id: string | null
  updated_at: string | null
  created_at: string
}

export interface CreateInventarieInput {
  kategori: string
  benamning: string
  tillverkare_modell: string
  serienr: string
  antal: number
  skick: string
  placering: string
}

export type UpdateInventarieInput = Partial<CreateInventarieInput>
