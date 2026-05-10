// Centralised förslag totals calculation.
//
// Why this exists: ROT and moms have to follow Skatteverket's rules,
// which are easy to get wrong. Every place that displays totals (UI
// panel, PDF cover summary, PDF cost-spec table) was duplicating the
// same math — and an earlier version got it wrong (applied ROT to
// arbete exkl moms and reduced moms accordingly, which underbills VAT).
//
// Skatteverket rule:
//   ROT-avdrag = 30% × arbete INKL moms, capped at the per-year limit.
//   The full moms must still be charged on labour and material; ROT
//   reduces the amount the customer pays but NOT the VAT obligation.
//
// Final price formula:
//   moms          = (arbete + material + UE) × moms_procent
//   total_inkl    = (arbete + material + UE) × (1 + moms_procent)
//   rot           = arbete_rot_eligible × (1 + moms_procent) × rot_procent (capped)
//   att_betala    = total_inkl − rot

export interface ArbeteRow {
  antal_timmar: number
  timpris: number
  rot_berattigad: boolean
}

export interface MaterialRow {
  antal: number
  a_pris: number
}

export interface UeRow {
  kostnad: number
}

export interface ForslagAggregate {
  totalArbete: number       // exkl moms — all arbete rows
  totalArbeteRot: number    // exkl moms — only ROT-eligible arbete rows
  totalMaterial: number     // exkl moms
  totalUE: number           // exkl moms
}

export interface ForslagTotalsInput extends ForslagAggregate {
  momsProcent: number
  rotAvdrag: boolean
  rotProcent: number
  rotInkluderaMedsokande: boolean
  rotCapEnkel: number
  rotCapDubbel: number
}

export interface ForslagTotals extends ForslagAggregate {
  subtotal: number          // arbete + material + UE, exkl moms
  moms: number              // moms_procent × subtotal
  totalInklMoms: number     // subtotal + moms
  rotBelopp: number         // 30% × arbete_rot_eligible × (1 + moms_procent), capped
  totalAttBetala: number    // total_inkl_moms − rotBelopp
}

export function aggregateForslag(
  arbete: ArbeteRow[],
  material: MaterialRow[],
  ue: UeRow[],
): ForslagAggregate {
  const totalArbete = arbete.reduce((s, r) => s + r.antal_timmar * r.timpris, 0)
  const totalArbeteRot = arbete.reduce(
    (s, r) => s + (r.rot_berattigad ? r.antal_timmar * r.timpris : 0),
    0,
  )
  const totalMaterial = material.reduce((s, r) => s + r.antal * r.a_pris, 0)
  const totalUE = ue.reduce((s, r) => s + r.kostnad, 0)
  return { totalArbete, totalArbeteRot, totalMaterial, totalUE }
}

export function computeForslagTotals(input: ForslagTotalsInput): ForslagTotals {
  const { totalArbete, totalArbeteRot, totalMaterial, totalUE } = input
  const momsFactor = input.momsProcent / 100
  const rotFactor = input.rotProcent / 100

  const subtotal = totalArbete + totalMaterial + totalUE
  const moms = subtotal * momsFactor
  const totalInklMoms = subtotal + moms

  const rotCap = input.rotInkluderaMedsokande ? input.rotCapDubbel : input.rotCapEnkel
  const rotBelopp = input.rotAvdrag
    ? Math.min(totalArbeteRot * (1 + momsFactor) * rotFactor, rotCap)
    : 0

  const totalAttBetala = totalInklMoms - rotBelopp

  return {
    totalArbete,
    totalArbeteRot,
    totalMaterial,
    totalUE,
    subtotal,
    moms,
    totalInklMoms,
    rotBelopp,
    totalAttBetala,
  }
}
