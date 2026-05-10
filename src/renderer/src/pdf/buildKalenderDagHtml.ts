import type { KalenderEvent } from '@/sections/kalender/types'

interface KundRef { id: string; namn: string }
interface ProjektRef { id: string; namn: string; projekt_nummer: string; kund_id: string }

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatTid(iso: string): string {
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

function getVeckonummer(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function tidLabel(e: KalenderEvent): string {
  if (e.hel_dag) return 'Hela dagen'
  return `${formatTid(e.start)} – ${formatTid(e.slut)}`
}

function kontextLabel(e: KalenderEvent, kunder: KundRef[], projekt: ProjektRef[]): string {
  if (e.projekt_id) {
    const p = projekt.find(pr => pr.id === e.projekt_id)
    if (p) {
      const k = kunder.find(ku => ku.id === p.kund_id)
      const pNamn = `${p.projekt_nummer} · ${p.namn}`
      return k ? `${pNamn} · ${k.namn}` : pNamn
    }
  }
  if (e.kund_id) {
    const k = kunder.find(ku => ku.id === e.kund_id)
    if (k) return k.namn
  }
  if (e.sync_revisor) return 'Revisor'
  return 'Lokal'
}

export function buildKalenderDagHtml(
  dag: Date,
  events: KalenderEvent[],
  kunder: KundRef[],
  projekt: ProjektRef[],
): string {
  const dagRubrik = dag.toLocaleDateString('sv-SE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const veckonr = getVeckonummer(dag)
  const today = new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })

  const sorted = [...events].sort((a, b) => {
    if (a.hel_dag && !b.hel_dag) return -1
    if (!a.hel_dag && b.hel_dag) return 1
    return new Date(a.start).getTime() - new Date(b.start).getTime()
  })

  const antal = sorted.length
  const antalLabel = `${antal} ${antal === 1 ? 'händelse' : 'händelser'}`

  let bodyHtml = ''
  if (sorted.length === 0) {
    bodyHtml = `<div class="empty">Inga händelser denna dag</div>`
  } else {
    bodyHtml = sorted.map(e => {
      const farg = e.farg || '#6366f1'
      const titel = escapeHtml(e.titel || '(utan titel)')
      const tid = escapeHtml(tidLabel(e))
      const kontext = escapeHtml(kontextLabel(e, kunder, projekt))
      const plats = e.plats ? escapeHtml(e.plats) : ''
      const url = e.url ? escapeHtml(e.url) : ''
      const beskr = e.beskrivning ? escapeHtml(e.beskrivning).replace(/\n/g, '<br>') : ''

      const platsRow = plats
        ? `<div class="event-detail"><span class="event-detail-label">Plats</span>${plats}</div>`
        : ''
      const urlRow = url
        ? `<div class="event-detail"><span class="event-detail-label">Länk</span>${url}</div>`
        : ''
      const beskrRow = beskr
        ? `<div class="event-detail"><span class="event-detail-label">Anteckning</span><span>${beskr}</span></div>`
        : ''

      return `
        <div class="event">
          <div class="stripe" style="background:${farg};"></div>
          <div class="event-body">
            <div class="event-time">${tid}</div>
            <div class="event-title">${titel}</div>
            <div class="event-context">${kontext}</div>
            ${platsRow}
            ${urlRow}
            ${beskrRow}
          </div>
        </div>`
    }).join('')
  }

  return `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 40px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1a1a1a;
    font-size: 11px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    padding-bottom: 16px;
    border-bottom: 1.5px solid #1a1a1a;
    margin-bottom: 18px;
  }
  .day {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 4px 0;
    letter-spacing: -0.01em;
    text-transform: capitalize;
  }
  .meta {
    margin: 0;
    font-size: 9.5px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .empty {
    padding: 60px 0;
    text-align: center;
    color: #888;
    font-size: 12px;
    font-style: italic;
  }
  .event {
    display: flex;
    gap: 14px;
    padding: 12px 0;
    border-bottom: 0.5px solid #e5e5e5;
    page-break-inside: avoid;
  }
  .event:last-child { border-bottom: none; }
  .stripe {
    width: 3px;
    flex-shrink: 0;
    border-radius: 2px;
    background: #999;
  }
  .event-body { flex: 1; min-width: 0; }
  .event-time {
    font-size: 10px;
    color: #555;
    font-weight: 600;
    margin-bottom: 3px;
    font-variant-numeric: tabular-nums;
  }
  .event-title {
    font-size: 13px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 3px;
  }
  .event-context {
    font-size: 10px;
    color: #666;
    margin-bottom: 4px;
  }
  .event-detail {
    font-size: 10px;
    color: #333;
    margin-top: 4px;
    line-height: 1.45;
  }
  .event-detail-label {
    display: inline-block;
    min-width: 64px;
    color: #999;
    text-transform: uppercase;
    font-size: 8.5px;
    letter-spacing: 0.1em;
    vertical-align: top;
    padding-right: 8px;
  }
  .footer {
    margin-top: 28px;
    padding-top: 12px;
    border-top: 0.5px solid #e5e5e5;
    font-size: 8.5px;
    color: #999;
    text-align: center;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  @page { size: A4; margin: 0; }
</style>
</head>
<body>
  <div class="header">
    <h1 class="day">${escapeHtml(dagRubrik)}</h1>
    <p class="meta">Vecka ${veckonr} · ${antalLabel}</p>
  </div>
  ${bodyHtml}
  <div class="footer">Genererad ${escapeHtml(today)} · OpenCRM</div>
</body>
</html>`
}
