import type { ForslagWithProjekt, ForslagFas } from '@/sections/forslag/types'
import type { PdfMall, AppInstallningar } from '@/sections/installningar/types'

// Swedish day abbreviations indexed by getDay() (0 = Sunday)
const DAY_LABELS_BY_DOW = ['S', 'M', 'T', 'O', 'T', 'F', 'L']

const LABEL_W = 160
// A4 landscape ≈ 1122px at 96 DPI, minus 56px horizontal padding, minus LABEL_W
const GANTT_AVAILABLE = 906

function isoWeek(d: Date): number {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7))
  const y1 = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  return Math.ceil((((utc.getTime() - y1.getTime()) / 86400000) + 1) / 7)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('sv-SE')
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
    const allMs = scheduledFaser.flatMap(f => [
      new Date(f.start_datum!).getTime(),
      new Date(f.slut_datum!).getTime(),
    ])
    let tStart = addDays(new Date(Math.min(...allMs)), -7)
    let tEnd = addDays(new Date(Math.max(...allMs)), 7)

    // Align to Monday/Sunday week boundaries
    tStart.setDate(tStart.getDate() - ((tStart.getDay() + 6) % 7))
    const edow = tEnd.getDay()
    if (edow !== 0) tEnd.setDate(tEnd.getDate() + (7 - edow))

    const days: Date[] = []
    const cur = new Date(tStart)
    while (cur <= tEnd) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    const totalDays = days.length

    const DAY_PX = GANTT_AVAILABLE / totalDays
    const ganttW = GANTT_AVAILABLE

    // Month groups
    const monthGroups: { label: string; count: number }[] = []
    for (const d of days) {
      const label = d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
      if (!monthGroups.length || monthGroups[monthGroups.length - 1].label !== label) {
        monthGroups.push({ label, count: 1 })
      } else {
        monthGroups[monthGroups.length - 1].count++
      }
    }

    // Week groups
    const weekGroups: { weekNum: number; count: number }[] = []
    for (const d of days) {
      const wn = isoWeek(d)
      if (!weekGroups.length || weekGroups[weekGroups.length - 1].weekNum !== wn) {
        weekGroups.push({ weekNum: wn, count: 1 })
      } else {
        weekGroups[weekGroups.length - 1].count++
      }
    }

    const monthCells = monthGroups.map(mg =>
      `<div style="width:${mg.count * DAY_PX}px;flex-shrink:0;font-size:7px;color:#333;font-weight:600;overflow:hidden;white-space:nowrap;border-right:0.5px solid #e0e0e0;padding:2px 4px;text-transform:capitalize;">${mg.label}</div>`
    ).join('')

    const weekCells = weekGroups.map(wg =>
      `<div style="width:${wg.count * DAY_PX}px;flex-shrink:0;font-size:7px;color:#888;text-align:center;border-right:0.5px solid #e8e8e8;padding:2px 0;">v${wg.weekNum}</div>`
    ).join('')

    const dayCells = days.map(d => {
      const dow = d.getDay()
      const isWeekend = dow === 0 || dow === 6
      return `<div style="width:${DAY_PX}px;flex-shrink:0;font-size:6px;text-align:center;padding:1px 0;color:${isWeekend ? '#f87171' : '#bbb'};background:${isWeekend ? 'rgba(252,165,165,0.15)' : 'transparent'};">${DAY_LABELS_BY_DOW[dow]}</div>`
    }).join('')

    // Repeating weekend shade aligned to Monday start
    const bgStripe = `repeating-linear-gradient(90deg, transparent 0px, transparent ${5 * DAY_PX}px, rgba(252,165,165,0.08) ${5 * DAY_PX}px, rgba(252,165,165,0.08) ${7 * DAY_PX}px)`

    const phaseRows = faser.map((fas, i) => {
      const rowBg = i % 2 === 0 ? '#fafafa' : '#fff'

      if (!fas.start_datum || !fas.slut_datum) {
        return `
          <div style="display:flex;align-items:stretch;border-bottom:0.5px solid #f0f0f0;background:${rowBg};">
            <div style="width:${LABEL_W}px;flex-shrink:0;font-size:8px;color:#222;padding:6px 8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${fas.namn}</div>
            <div style="width:${ganttW}px;height:26px;background:${bgStripe};background-size:${7 * DAY_PX}px 100%;"></div>
          </div>`
      }

      const startOff = daysBetween(tStart, new Date(fas.start_datum))
      const endOff = daysBetween(tStart, new Date(fas.slut_datum))
      const leftPx = startOff * DAY_PX
      const widthPx = Math.max((endOff - startOff + 1) * DAY_PX, 4)
      return `
        <div style="display:flex;align-items:stretch;border-bottom:0.5px solid #f0f0f0;background:${rowBg};">
          <div style="width:${LABEL_W}px;flex-shrink:0;font-size:8px;color:#222;padding:6px 8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${fas.namn}</div>
          <div style="width:${ganttW}px;height:26px;position:relative;background:${bgStripe};background-size:${7 * DAY_PX}px 100%;">
            <div style="position:absolute;top:50%;transform:translateY(-50%);left:${leftPx}px;width:${widthPx}px;height:14px;background:rgba(52,211,153,0.2);border:1px solid rgba(52,211,153,0.5);border-radius:3px;overflow:hidden;"></div>
          </div>
        </div>`
    }).join('')

    ganttHtml = `
      <div style="margin-bottom:20px;">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#000;margin-bottom:4px;border-bottom:1.5px solid ${accent};padding-bottom:3px;">Tidplan</div>
        <div style="display:flex;border-bottom:0.5px solid #ccc;">
          <div style="width:${LABEL_W}px;flex-shrink:0;border-right:0.5px solid #e0e0e0;"></div>
          ${monthCells}
        </div>
        <div style="display:flex;border-bottom:0.5px solid #ccc;">
          <div style="width:${LABEL_W}px;flex-shrink:0;border-right:0.5px solid #e0e0e0;"></div>
          ${weekCells}
        </div>
        <div style="display:flex;border-bottom:0.5px solid #ddd;">
          <div style="width:${LABEL_W}px;flex-shrink:0;border-right:0.5px solid #e0e0e0;"></div>
          ${dayCells}
        </div>
        ${phaseRows}
      </div>`
  }

  // ── Phase table ────────────────────────────────────────────
  const tableRows = faser.map((fas, i) => {
    const bg = i % 2 === 0 ? '#fafafa' : '#fff'
    return `
      <tr style="background:${bg};">
        <td style="padding:5px 8px;font-size:8px;color:#111;border-bottom:0.5px solid #f0f0f0;">${fas.namn}</td>
        <td style="padding:5px 8px;font-size:8px;color:#555;font-family:monospace;border-bottom:0.5px solid #f0f0f0;">${fas.start_datum ? fmtDate(fas.start_datum) : '—'}</td>
        <td style="padding:5px 8px;font-size:8px;color:#555;font-family:monospace;border-bottom:0.5px solid #f0f0f0;">${fas.slut_datum ? fmtDate(fas.slut_datum) : '—'}</td>
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
        <th style="text-align:left;padding:4px 8px;font-size:7.5px;color:#333;font-weight:700;width:50%;">Fas</th>
        <th style="text-align:left;padding:4px 8px;font-size:7.5px;color:#333;font-weight:700;width:25%;">Startdatum</th>
        <th style="text-align:left;padding:4px 8px;font-size:7.5px;color:#333;font-weight:700;width:25%;">Slutdatum</th>
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
