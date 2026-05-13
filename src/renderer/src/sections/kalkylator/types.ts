export type KalkylatorType = 'fasad' | 'tak' | 'golv' | 'vagg'
export type SurfaceShape = 'rectangle' | 'triangle' | 'triangle-right'
export type DeductionIconType =
  | 'window-single'
  | 'window-double'
  | 'door'
  | 'door-double'
  | 'garage'
  | 'triangle'
  | 'triangle-right'
  | 'rectangle'

export interface SurfaceRow {
  id: string
  description: string
  shape: SurfaceShape
  width: number
  height: number
  slopeFactor: number
}

export interface DeductionRow {
  id: string
  description: string
  icon: DeductionIconType
  shape: SurfaceShape
  width: number
  height: number
  quantity: number
}

export interface MaterialLine {
  id: string
  name: string
  unit: string
  coveragePerM2: number
  unitPrice: number
}

export interface KalkylatorInput {
  type: KalkylatorType
  surfaces: SurfaceRow[]
  deductions: DeductionRow[]
  materials: MaterialLine[]
  laborHoursPerM2: number
  laborRate: number
}

export interface KalkylatorResult {
  netArea: number
  totalMaterialCost: number
  laborHours: number
  laborCost: number
  subtotal: number
  moms: number
  totalInklMoms: number
}

export interface VentanaPreset {
  id: string
  name: string
  icon: DeductionIconType
  defaultWidth: number
  defaultHeight: number
}

export interface TakType {
  id: string
  name: string
  angleDeg: number
  slopeFactor: number
}

export const DEFAULT_VENTANA_PRESETS: VentanaPreset[] = [
  { id: 'v1', name: 'Fönster', icon: 'window-single', defaultWidth: 800, defaultHeight: 1200 },
  { id: 'v2', name: 'Dubbelfönster', icon: 'window-double', defaultWidth: 1600, defaultHeight: 1200 },
  { id: 'v3', name: 'Dörr', icon: 'door', defaultWidth: 900, defaultHeight: 2100 },
  { id: 'v4', name: 'Dubbeldörr', icon: 'door-double', defaultWidth: 1600, defaultHeight: 2100 },
  { id: 'v5', name: 'Garage', icon: 'garage', defaultWidth: 2500, defaultHeight: 2200 },
]

export const DEFAULT_TAK_AVDRAG: VentanaPreset[] = [
  { id: 'ta1', name: 'Taklucka', icon: 'rectangle', defaultWidth: 780, defaultHeight: 1140 },
  { id: 'ta2', name: 'Takfönster', icon: 'window-single', defaultWidth: 780, defaultHeight: 1400 },
  { id: 'ta3', name: 'Röklucka', icon: 'rectangle', defaultWidth: 600, defaultHeight: 600 },
  { id: 'ta4', name: 'Skorsten', icon: 'rectangle', defaultWidth: 400, defaultHeight: 400 },
]

export const DEFAULT_GOLV_AVDRAG: VentanaPreset[] = [
  { id: 'ga1', name: 'Trappa', icon: 'rectangle', defaultWidth: 1000, defaultHeight: 2500 },
  { id: 'ga2', name: 'Pelare', icon: 'rectangle', defaultWidth: 300, defaultHeight: 300 },
  { id: 'ga3', name: 'Dörrparti', icon: 'door', defaultWidth: 900, defaultHeight: 100 },
]

export const DEFAULT_VAGG_AVDRAG: VentanaPreset[] = [
  { id: 'wa1', name: 'Fönster', icon: 'window-single', defaultWidth: 800, defaultHeight: 1200 },
  { id: 'wa2', name: 'Dubbelfönster', icon: 'window-double', defaultWidth: 1600, defaultHeight: 1200 },
  { id: 'wa3', name: 'Dörr', icon: 'door', defaultWidth: 900, defaultHeight: 2100 },
  { id: 'wa4', name: 'Dubbeldörr', icon: 'door-double', defaultWidth: 1600, defaultHeight: 2100 },
]

export const DEFAULT_TAK_TYPER: TakType[] = [
  { id: 't0', name: 'Ingen lutning', angleDeg: 0, slopeFactor: 1.0 },
  { id: 't1', name: 'Låg (18°)', angleDeg: 18, slopeFactor: 1.05 },
  { id: 't2', name: 'Normal (27°)', angleDeg: 27, slopeFactor: 1.12 },
  { id: 't3', name: 'Medel (35°)', angleDeg: 35, slopeFactor: 1.22 },
  { id: 't4', name: 'Brant (45°)', angleDeg: 45, slopeFactor: 1.41 },
]
