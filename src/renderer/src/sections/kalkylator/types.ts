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

export const DEFAULT_TAK_TYPER: TakType[] = [
  { id: 't0', name: 'Ingen lutning', angleDeg: 0, slopeFactor: 1.0 },
  { id: 't1', name: 'Låg (18°)', angleDeg: 18, slopeFactor: 1.05 },
  { id: 't2', name: 'Normal (27°)', angleDeg: 27, slopeFactor: 1.12 },
  { id: 't3', name: 'Medel (35°)', angleDeg: 35, slopeFactor: 1.22 },
  { id: 't4', name: 'Brant (45°)', angleDeg: 45, slopeFactor: 1.41 },
]
