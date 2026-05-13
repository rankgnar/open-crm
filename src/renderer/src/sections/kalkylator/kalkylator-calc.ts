import type { KalkylatorInput, KalkylatorResult } from './types'

// Dimensions stored in mm — divide by 1_000_000 to get m²
function baseAreaM2(shape: 'rectangle' | 'triangle' | 'triangle-right', widthMm: number, heightMm: number): number {
  const factor = shape === 'rectangle' ? 1 : 0.5
  return factor * widthMm * heightMm / 1_000_000
}

export function computeKalkylator(input: KalkylatorInput): KalkylatorResult {
  const surfaceArea = input.surfaces.reduce((s, r) => {
    return s + baseAreaM2(r.shape, r.width, r.height) * r.slopeFactor
  }, 0)

  const deductionArea = input.deductions.reduce((s, d) => {
    return s + baseAreaM2(d.shape, d.width, d.height) * d.quantity
  }, 0)

  const netArea = Math.max(0, surfaceArea - deductionArea)

  const totalMaterialCost = input.materials.reduce((s, m) => {
    return s + netArea * m.coveragePerM2 * m.unitPrice
  }, 0)

  const laborHours = netArea * input.laborHoursPerM2
  const laborCost = laborHours * input.laborRate
  const subtotal = totalMaterialCost + laborCost
  const moms = subtotal * 0.25
  const totalInklMoms = subtotal + moms

  return { netArea, totalMaterialCost, laborHours, laborCost, subtotal, moms, totalInklMoms }
}
