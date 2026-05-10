import type { ForslagWithProjekt, ForslagFas } from '@/sections/forslag/types'
import type { PdfMall, AppInstallningar } from '@/sections/installningar/types'

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('sv-SE')
}

function durationLabel(start: string, end: string): string {
  const days = daysBetween(new Date(start), new Date(end)) + 1
  const w = Math.ceil(days / 7)
  return `${w} ${w === 1 ? 'vecka' : 'veckor'}`
}

export function buildTidplanHtml(
  forslag: ForslagWithProjekt,
  faser: ForslagFas[],
  mall: Partial<PdfMall> | null,
  config: Partial<AppInstallningar> | null
): string {
  const accent = mall?.accent_farg ?? '#1B3A6B'
  const foretag = config?.foretag_namn ?? ''
  const org = config?.foretag_org_nummer ?? ''
  const tel = config?.foretag_telefon ?? ''
  const email = config?.foretag_email ?? ''
  const webb = config?.foretag_webbadress ?? ''

  const logoHtml = config?.foretag_logo_url
    ? `<img src="${config.foretag_logo_url}" style="max-height:36px;max-width:130px;object-fit:contain;" />`
    : `<span style="font-size:16px;font-weight:800;color:${accent};letter-spacing:3px;text-transform:uppercase;">${foretag}</span>`

  const today = new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })

  const scheduledFaser = faser.filter(f => f.start_datum && f.slut_datum)

  // ── Gantt chart ────────────────────────────────────────────
  let ganttHtml = ''
  if (scheduledFaser.length > 0) {
    const allMs = scheduledFaser.flatMap(f => [new Date(f.start_datum!).getTime(), new Date(f.slut_datum!).getTime()])
    let minDate = addDays(new Date(Math.min(...allMs)), -7)
    let maxDate = addDays(new Date(Math.max(...allMs)), 7)

    // Align to week boundaries
    minDate.setDate(minDate.getDate() - ((minDate.getDay() + 6) % 7))
    const edow = maxDate.getDay()
    if (edow !== 0) maxDate.setDate(maxDate.getDate() + (7 - edow))

    const totalDays = daysBetween(minDate, maxDate) + 1

    // Month header cells (proportional flex)
    let monthCells = ''
    let cur = new Date(minDate)
    while (cur <= maxDate) {
      const year = cur.getFullYear()
      const month = cur.getMonth()
      const lastOfMonth = new Date(year, month + 1, 0)
      const endInRange = lastOfMonth < maxDate ? lastOfMonth : maxDate
      const daysInRange = daysBetween(cur, endInRange) + 1
      const label = cur.toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' }).replace('.', '')
      monthCells += `<div style="flex:${daysInRange};text-align:center;font-size:7px;color:#888;overflow:hidden;white-space:nowrap;border-right:0.5px solid #e8e8e8;padding:2px 2px;">${label}</div>`
      cur = new Date(year, month + 1, 1)
    }

    // Phase rows
    const LABEL_W = 160
    const phaseRows = scheduledFaser.map((fas, i) => {
      const startOff = daysBetween(minDate, new Date(fas.start_datum!))
      const endOff = daysBetween(minDate, new Date(fas.slut_datum!))
      const leftPct = (startOff / totalDays) * 100
      const widthPct = ((endOff - startOff + 1) / totalDays) * 100
      const bg = i % 2 === 0 ? '#fafafa' : '#fff'
      const dur = durationLabel(fas.start_datum!, fas.slut_datum!)
      return `
        <div style="display:flex;align-items:stretch;background:${bg};border-bottom:0.5px solid #f0f0f0;">
          <div style="width:${LABEL_W}px;flex-shrink:0;font-size:8px;color:#222;padding:6px 8px 6px 0;display:flex;align-items:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${fas.namn}</div>
          <div style="flex:1;position:relative;height:28px;">
            <div style="position:absolute;top:50%;transform:translateY(-50%);left:${leftPct.toFixed(2)}%;width:${Math.max(widthPct, 0.5).toFixed(2)}%;height:14px;background:${accent};border-radius:3px;opacity:0.85;display:flex;align-items:center;overflow:hidden;">
              ${widthPct > 8 ? `<span style="font-size:6.5px;color:#fff;padding-left:4px;white-space:nowrap;">${dur}</span>` : ''}
            </div>
          </div>
        </div>`
    }).join('')

    ganttHtml = `
      <div style="margin-bottom:20px;">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#000;margin-bottom:6px;border-bottom:1.5px solid ${accent};padding-bottom:3px;">Tidplan</div>
        <div style="display:flex;align-items:stretch;">
          <div style="width:${LABEL_W}px;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;height:16px;border-bottom:0.5px solid #d0d0d0;margin-bottom:2px;">${monthCells}</div>
        </div>
        ${phaseRows}
      </div>`
  }

  // ── Phase table ────────────────────────────────────────────
  const tableRows = faser.map((fas, i) => {
    const bg = i % 2 === 0 ? '#fafafa' : '#fff'
    const dur = fas.start_datum && fas.slut_datum ? durationLabel(fas.start_datum, fas.slut_datum) : '—'
    return `
      <tr style="background:${bg};">
        <td style="padding:5px 8px;font-size:8px;color:#111;border-bottom:0.5px solid #f0f0f0;">${fas.namn}</td>
        <td style="padding:5px 8px;font-size:8px;color:#555;font-family:monospace;border-bottom:0.5px solid #f0f0f0;">${fas.start_datum ? fmtDate(fas.start_datum) : '—'}</td>
        <td style="padding:5px 8px;font-size:8px;color:#555;font-family:monospace;border-bottom:0.5px solid #f0f0f0;">${fas.slut_datum ? fmtDate(fas.slut_datum) : '—'}</td>
        <td style="padding:5px 8px;font-size:8px;color:#555;text-align:right;border-bottom:0.5px solid #f0f0f0;">${dur}</td>
        ${fas.beskrivning ? `<td style="padding:5px 8px;font-size:7.5px;color:#888;border-bottom:0.5px solid #f0f0f0;">${fas.beskrivning}</td>` : '<td style="border-bottom:0.5px solid #f0f0f0;"></td>'}
      </tr>`
  }).join('')

  const companyLines = [
    org ? `Org.nr: ${org}` : '',
    tel,
    email,
    webb,
  ].filter(Boolean).map(l => `<div style="font-size:7px;color:#666;line-height:1.8;">${l}</div>`).join('')

  return `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 landscape; margin: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fff; width: 297mm; }
</style>
</head>
<body>
<div style="width:297mm;min-height:210mm;background:#fff;padding:22px 28px;display:flex;flex-direction:column;">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:1.5px solid ${accent};margin-bottom:16px;">
    <div>${logoHtml}</div>
    <div style="text-align:right;">
      <div style="font-size:8px;font-weight:700;color:#333;margin-bottom:2px;">${foretag}</div>
      ${companyLines}
    </div>
  </div>

  <!-- Title + info box -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
    <div>
      <div style="font-size:24px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#000;margin-bottom:4px;">Tidplan</div>
      <div style="font-size:8.5px;color:#666;">${forslag.forslag_nummer} &nbsp;·&nbsp; ${forslag.titel}</div>
    </div>
    <div style="background:#f8f8f8;border:0.5px solid #d0d0d0;padding:10px 14px;min-width:210px;">
      <div style="display:flex;margin-bottom:3px;">
        <span style="width:34%;font-size:7.5px;font-weight:700;color:#333;">Kund:</span>
        <span style="width:66%;font-size:7.5px;color:#000;">${forslag.projekt.kunder.namn}</span>
      </div>
      <div style="display:flex;margin-bottom:3px;">
        <span style="width:34%;font-size:7.5px;font-weight:700;color:#333;">Projekt:</span>
        <span style="width:66%;font-size:7.5px;color:#000;">${forslag.projekt.namn}</span>
      </div>
      <div style="display:flex;margin-bottom:3px;">
        <span style="width:34%;font-size:7.5px;font-weight:700;color:#333;">Nummer:</span>
        <span style="width:66%;font-size:7.5px;color:#000;font-family:monospace;">${forslag.projekt.projekt_nummer}</span>
      </div>
      <div style="display:flex;">
        <span style="width:34%;font-size:7.5px;font-weight:700;color:#333;">Datum:</span>
        <span style="width:66%;font-size:7.5px;color:#000;">${today}</span>
      </div>
    </div>
  </div>

  <!-- Gantt -->
  ${ganttHtml}

  <!-- Phase table -->
  <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#000;margin-bottom:6px;border-bottom:1.5px solid ${accent};padding-bottom:3px;">Faser</div>
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="border-bottom:1px solid #ccc;">
        <th style="text-align:left;padding:4px 8px;font-size:7.5px;color:#333;font-weight:700;width:30%;">Fas</th>
        <th style="text-align:left;padding:4px 8px;font-size:7.5px;color:#333;font-weight:700;width:16%;">Startdatum</th>
        <th style="text-align:left;padding:4px 8px;font-size:7.5px;color:#333;font-weight:700;width:16%;">Slutdatum</th>
        <th style="text-align:right;padding:4px 8px;font-size:7.5px;color:#333;font-weight:700;width:14%;">Varaktighet</th>
        <th style="text-align:left;padding:4px 8px;font-size:7.5px;color:#333;font-weight:700;width:24%;">Beskrivning</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <!-- Footer -->
  <div style="margin-top:auto;padding-top:10px;border-top:0.5px solid #e0e0e0;text-align:center;font-size:7px;color:#aaa;">
    ${foretag}${org ? ` &nbsp;·&nbsp; Org.nr: ${org}` : ''}
  </div>

</div>
</body>
</html>`
}
