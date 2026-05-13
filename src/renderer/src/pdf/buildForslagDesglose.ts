import type { ForslagFas, ForslagSubfas, ForslagArbete, ForslagMaterial, ForslagUnderentreprenor } from '@/sections/forslag/types'
import { computeForslagTotals } from '@/utils/forslag-totals'

function fmt(n: number): string {
  return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))
}

function fmtAntal(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
  }).format(rounded)
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const TD = (content: string, width: string, opts: { bold?: boolean; align?: string; color?: string; small?: boolean } = {}): string =>
  `<td style="width:${width};padding:3px 5px;font-size:${opts.small ? '7px' : '8px'};${opts.bold ? 'font-weight:700;' : ''}${opts.align ? `text-align:${opts.align};` : ''}${opts.color ? `color:${opts.color};` : ''}border-bottom:0.5px solid #e0e0e0;">${content}</td>`

export function buildForslagDesglose(
  faser: ForslagFas[],
  subfaserByFas: Record<string, ForslagSubfas[]>,
  arbeteBySubfas: Record<string, ForslagArbete[]>,
  materialBySubfas: Record<string, ForslagMaterial[]>,
  ueBySubfas: Record<string, ForslagUnderentreprenor[]>,
  opts: {
    momsProcent: number
    rotAvdrag: boolean
    rotProcent: number
    rotInkluderaMedsokande: boolean
    rotCapEnkel: number
    rotCapDubbel: number
    accentFarg: string
    visaLeverantor?: boolean
    visaFasNotat?: boolean
  }
): string {
  const ac = opts.accentFarg
  const showLeverantor = opts.visaLeverantor !== false
  const showFasNotat = opts.visaFasNotat !== false
  const acBg = hexToRgba(ac, 0.08)
  const acBgMid = hexToRgba(ac, 0.12)
  const acBorder = hexToRgba(ac, 0.35)

  const MINI_HEADER = (label: string): string =>
    `<tr style="background:${acBg};">
      <td colspan="6" style="padding:3px 5px;font-size:7px;font-weight:700;color:${ac};text-transform:uppercase;letter-spacing:0.3px;border-bottom:0.5px solid ${acBorder};">${label}</td>
    </tr>`

  let html = `<table style="width:100%;border-collapse:collapse;font-family:-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif;">`

  let grandArbete = 0
  let grandMaterial = 0
  let grandUE = 0
  let grandRotEligible = 0

  for (const fas of faser) {
    const subfaser = subfaserByFas[fas.id] ?? []

    // Skip phase entirely if no subfas has any content
    const fasHasContent = subfaser.some((sf) =>
      (arbeteBySubfas[sf.id]?.length ?? 0) > 0 ||
      (materialBySubfas[sf.id]?.length ?? 0) > 0 ||
      (ueBySubfas[sf.id]?.length ?? 0) > 0
    )
    if (!fasHasContent) continue

    let fasTotal = 0

    const dateRange = fas.start_datum && fas.slut_datum
      ? `<span style="font-size:7px;color:${ac};opacity:0.7;font-weight:400;">${fas.start_datum} – ${fas.slut_datum}</span>`
      : ''
    html += `<tr>
      <td colspan="6" style="background:${acBg};border-left:2px solid ${ac};border-bottom:0.5px solid ${acBorder};padding:4px 6px;">
        <span style="font-size:8px;font-weight:700;color:${ac};text-transform:uppercase;letter-spacing:0.3px;">${fas.namn}</span>
        ${dateRange ? `&nbsp;&nbsp;${dateRange}` : ''}
      </td>
    </tr>`

    for (const subfas of subfaser) {
      const arbete = arbeteBySubfas[subfas.id] ?? []
      const material = materialBySubfas[subfas.id] ?? []
      const ue = ueBySubfas[subfas.id] ?? []
      const hasMultiple = (arbete.length > 0 ? 1 : 0) + (material.length > 0 ? 1 : 0) + (ue.length > 0 ? 1 : 0) > 1

      if (arbete.length === 0 && material.length === 0 && ue.length === 0) continue

      // Subphase header
      html += `<tr>
        <td colspan="6" style="background:${hexToRgba(ac, 0.04)};border-left:1.5px solid ${acBorder};padding:3px 6px 3px 10px;">
          <span style="font-size:7.5px;font-weight:700;color:${ac};opacity:0.85;">${subfas.namn}</span>
        </td>
      </tr>`

      let subfasTotal = 0

      // Arbete rows
      if (arbete.length > 0) {
        html += MINI_HEADER('Arbete')
        html += `<tr style="background:${acBg};">
          ${TD('Beskrivning', '43%', { bold: true, small: true, color: ac })}
          ${TD('Yrkesroll', '20%', { bold: true, small: true, color: ac })}
          ${TD('Tim.', '9%', { bold: true, small: true, color: ac, align: 'right' })}
          ${TD('Á-pris', '10%', { bold: true, small: true, color: ac, align: 'right' })}
          ${TD('ROT', '6%', { bold: true, small: true, color: ac, align: 'center' })}
          ${TD('Summa', '12%', { bold: true, small: true, color: ac, align: 'right' })}
        </tr>`
        arbete.forEach((r, i) => {
          const sum = r.antal_timmar * r.timpris
          subfasTotal += sum
          fasTotal += sum
          grandArbete += sum
          if (r.rot_berattigad) grandRotEligible += sum
          const bg = i % 2 === 1 ? 'background:#fafafa;' : ''
          html += `<tr style="${bg}">
            ${TD(r.beskrivning || '—', '43%')}
            ${TD(r.yrkesroll || '—', '20%')}
            ${TD(fmtAntal(r.antal_timmar), '9%', { align: 'right' })}
            ${TD(fmt(r.timpris), '10%', { align: 'right' })}
            ${TD(r.rot_berattigad ? '✓' : '', '6%', { align: 'center', color: '#16a34a', bold: true })}
            ${TD(fmt(sum), '12%', { align: 'right', bold: true })}
          </tr>`
        })
      }

      // Material rows
      if (material.length > 0) {
        html += MINI_HEADER('Material')
        const beskWidth = showLeverantor ? '37%' : '52%'
        html += `<tr style="background:${acBg};">
          ${showLeverantor ? TD('Leverantör', '15%', { bold: true, small: true, color: ac }) : ''}
          ${TD('Beskrivning', beskWidth, { bold: true, small: true, color: ac })}
          ${TD('Enh.', '8%', { bold: true, small: true, color: ac, align: 'center' })}
          ${TD('Antal', '8%', { bold: true, small: true, color: ac, align: 'right' })}
          ${TD('Á-pris', '13%', { bold: true, small: true, color: ac, align: 'right' })}
          ${TD('Summa', '19%', { bold: true, small: true, color: ac, align: 'right' })}
        </tr>`
        material.forEach((r, i) => {
          const sum = r.antal * r.a_pris
          subfasTotal += sum
          fasTotal += sum
          grandMaterial += sum
          const bg = i % 2 === 1 ? 'background:#fafafa;' : ''
          html += `<tr style="${bg}">
            ${showLeverantor ? TD(r.leverantor || '—', '15%', { small: true }) : ''}
            ${TD(r.beskrivning || '—', beskWidth)}
            ${TD(r.enhet, '8%', { align: 'center' })}
            ${TD(fmtAntal(r.antal), '8%', { align: 'right' })}
            ${TD(fmt(r.a_pris), '13%', { align: 'right' })}
            ${TD(fmt(sum), '19%', { align: 'right', bold: true })}
          </tr>`
        })
      }

      // UE rows
      if (ue.length > 0) {
        html += MINI_HEADER('Underentreprenörer')
        html += `<tr style="background:${acBg};">
          ${TD('Namn', '28%', { bold: true, small: true, color: ac })}
          ${TD('Beskrivning', '47%', { bold: true, small: true, color: ac })}
          ${TD('Inkl. mat.', '10%', { bold: true, small: true, color: ac, align: 'center' })}
          ${TD('Kostnad', '15%', { bold: true, small: true, color: ac, align: 'right' })}
          <td style="width:0"></td>
          <td style="width:0"></td>
        </tr>`
        ue.forEach((r, i) => {
          subfasTotal += r.kostnad
          fasTotal += r.kostnad
          grandUE += r.kostnad
          const bg = i % 2 === 1 ? 'background:#fafafa;' : ''
          html += `<tr style="${bg}">
            ${TD(r.namn || '—', '28%')}
            ${TD(r.beskrivning || '—', '47%')}
            ${TD(r.inkl_material ? '✓' : '—', '10%', { align: 'center', color: r.inkl_material ? '#16a34a' : undefined, bold: r.inkl_material })}
            ${TD(fmt(r.kostnad), '15%', { align: 'right', bold: true })}
            <td style="width:0"></td>
            <td style="width:0"></td>
          </tr>`
        })
      }

      // Subfas subtotal (only if multiple categories)
      if (hasMultiple) {
        html += `<tr style="background:#f8f8f8;">
          <td colspan="5" style="padding:3px 5px;font-size:7.5px;font-weight:700;color:#374151;text-align:right;border-bottom:0.5px solid #d0d0d0;">Delsumma ${subfas.namn}</td>
          <td style="padding:3px 5px;font-size:7.5px;font-weight:700;color:#0f172b;text-align:right;border-bottom:0.5px solid #d0d0d0;white-space:nowrap;">${fmt(subfasTotal)} kr</td>
        </tr>`
      }
    }

    // Phase subtotal
    html += `<tr style="background:${acBgMid};">
      <td colspan="5" style="padding:4px 5px;font-size:8px;font-weight:700;color:${ac};text-align:right;border-bottom:0.5px solid ${acBorder};border-top:0.5px solid ${acBorder};">Summa ${fas.namn}</td>
      <td style="padding:4px 5px;font-size:8px;font-weight:700;color:${ac};text-align:right;border-bottom:0.5px solid ${acBorder};border-top:0.5px solid ${acBorder};white-space:nowrap;">${fmt(fasTotal)} kr</td>
    </tr>`
    if (fas.notat && showFasNotat) {
      html += `<tr>
        <td colspan="6" style="padding:1px 5px 4px;font-size:7.5px;font-style:italic;color:#374151;">* Anm: ${fas.notat}</td>
      </tr>`
    }
    html += `<tr><td colspan="6" style="height:6px;"></td></tr>`
  }

  html += `</table>`

  // Totals — Skatteverket convention: full moms on labour + material,
  // ROT-avdrag (30% × arbete inkl moms) applied last as a tax credit.
  const totals = computeForslagTotals({
    totalArbete: grandArbete,
    totalArbeteRot: grandRotEligible,
    totalMaterial: grandMaterial,
    totalUE: grandUE,
    momsProcent: opts.momsProcent,
    rotAvdrag: opts.rotAvdrag,
    rotProcent: opts.rotProcent,
    rotInkluderaMedsokande: opts.rotInkluderaMedsokande,
    rotCapEnkel: opts.rotCapEnkel,
    rotCapDubbel: opts.rotCapDubbel,
  })
  const { subtotal, moms, totalInklMoms, rotBelopp, totalAttBetala } = totals

  const AMT = 'font-size:8px;color:#0f172b;font-weight:700;text-align:right;padding:3px 0;white-space:nowrap;'
  const LBL = 'font-size:8px;color:#374151;padding:3px 0;'

  html += `
  <div style="margin-top:16px;border-top:1px solid #e0e0e0;padding-top:12px;">
    <table style="width:100%;border-collapse:collapse;font-family:-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <tr>
        <td style="${LBL}">Arbetskostnad (exkl. moms)</td>
        <td style="${AMT}">${fmt(grandArbete)} kr</td>
      </tr>
      <tr>
        <td style="${LBL}">Materialkostnad (exkl. moms)</td>
        <td style="${AMT}">${fmt(grandMaterial)} kr</td>
      </tr>
      ${grandUE > 0 ? `<tr>
        <td style="${LBL}">Underentreprenörer</td>
        <td style="${AMT}">${fmt(grandUE)} kr</td>
      </tr>` : ''}
      <tr><td colspan="2" style="border-top:0.5px solid ${acBorder};padding-top:4px;"></td></tr>
      <tr>
        <td style="${LBL}">Netto (exkl. moms)</td>
        <td style="${AMT}">${fmt(subtotal)} kr</td>
      </tr>
      <tr>
        <td style="${LBL}">Moms ${opts.momsProcent}%</td>
        <td style="${AMT}">${fmt(moms)} kr</td>
      </tr>
      <tr>
        <td style="${LBL}">Totalt pris (inkl. moms)</td>
        <td style="${AMT}">${fmt(totalInklMoms)} kr</td>
      </tr>
      ${rotBelopp > 0 ? `<tr>
        <td style="${LBL}">ROT-avdrag (${opts.rotProcent}% av arbete inkl. moms)</td>
        <td style="font-size:8px;color:#16a34a;font-weight:700;text-align:right;padding:3px 0;white-space:nowrap;">- ${fmt(rotBelopp)} kr</td>
      </tr>` : ''}
      <tr><td colspan="2" style="border-top:1.5px solid ${ac};padding-top:6px;"></td></tr>
      <tr>
        <td style="font-size:11px;font-weight:800;color:${ac};text-transform:uppercase;letter-spacing:0.3px;padding:2px 0;">Att betala</td>
        <td style="font-size:13px;font-weight:800;color:${ac};text-align:right;padding:2px 0;white-space:nowrap;">${fmt(totalAttBetala)} kr</td>
      </tr>
    </table>
  </div>`

  return html
}
