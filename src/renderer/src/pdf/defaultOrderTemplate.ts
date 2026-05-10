export interface OrderRadForPdf {
  beskrivning: string
  antal: number
  enhet: string
  a_pris: number
  belopp: number
}

const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))

export function buildOrderRaderHtml(rader: OrderRadForPdf[], valuta: string): string {
  if (rader.length === 0) {
    return `<p style="font-size:10px;color:#666;font-style:italic;">Inga rader.</p>`
  }
  const rows = rader.map((r) => `
    <tr>
      <td style="padding:8px 10px;font-size:9.5px;color:#111;border-bottom:0.5px solid #eee;">${escapeHtml(r.beskrivning)}</td>
      <td style="padding:8px 10px;font-size:9.5px;color:#444;border-bottom:0.5px solid #eee;text-align:right;font-variant-numeric:tabular-nums;">${fmt(r.antal)}</td>
      <td style="padding:8px 10px;font-size:9.5px;color:#444;border-bottom:0.5px solid #eee;">${escapeHtml(r.enhet)}</td>
      <td style="padding:8px 10px;font-size:9.5px;color:#444;border-bottom:0.5px solid #eee;text-align:right;font-variant-numeric:tabular-nums;">${fmt(r.a_pris)} ${valuta}</td>
      <td style="padding:8px 10px;font-size:9.5px;color:#000;border-bottom:0.5px solid #eee;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;">${fmt(r.belopp)} ${valuta}</td>
    </tr>
  `).join('')

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <thead>
        <tr style="background:#f0f0f0;">
          <th style="padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#555;text-align:left;">Beskrivning</th>
          <th style="padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#555;text-align:right;width:60px;">Antal</th>
          <th style="padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#555;text-align:left;width:60px;">Enhet</th>
          <th style="padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#555;text-align:right;width:90px;">À-pris</th>
          <th style="padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#555;text-align:right;width:100px;">Belopp</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default: return c
    }
  })
}

export const DEFAULT_ORDER_HTML = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #fff;
    width: 210mm;
  }

  .content-page { width: 210mm; min-height: 297mm; background: #fff; padding: 40px 44px; display: flex; flex-direction: column; color: #111; }
  .content-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 0.5px solid #333; margin-bottom: 22px; }
  .content-logo { font-size: 18px; font-weight: 800; color: {{accent_farg}}; letter-spacing: 3px; text-transform: uppercase; }
  .content-company-info { text-align: right; }
  .content-company-line { font-size: 7.5px; color: #666; line-height: 1.75; }
  .title-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }
  .title-left { width: 45%; }
  .doc-title { font-size: 20px; font-weight: 800; color: #000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
  .doc-subtitle { font-size: 10px; color: #666; }
  .title-right { width: 51%; }
  .info-box { background: #f8f8f8; border: 0.5px solid #d0d0d0; padding: 12px 14px; }
  .info-row { display: flex; margin-bottom: 4px; }
  .info-row:last-child { margin-bottom: 0; }
  .info-label { width: 38%; font-size: 8px; font-weight: 700; color: #333; }
  .info-value { width: 62%; font-size: 8px; color: #000; }
  .section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: #555; margin: 18px 0 6px; }
  .beskrivning-box { padding: 12px 14px; border: 0.5px solid #e0e0e0; background: #fafafa; font-size: 10px; color: #333; line-height: 1.6; white-space: pre-wrap; }
  .totals-box { display: flex; justify-content: flex-end; margin-top: 18px; }
  .totals-table { min-width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 10px; }
  .totals-row.netto { border-bottom: 0.5px solid #ddd; }
  .totals-row.total { font-weight: 800; font-size: 12px; color: {{accent_farg}}; padding-top: 8px; border-top: 1px solid {{accent_farg}}; margin-top: 4px; }
  .signatur-box { margin-top: 28px; padding: 18px 20px; border: 0.5px solid #d0d0d0; border-radius: 4px; background: #fdfdfd; }
  .signatur-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: {{accent_farg}}; margin-bottom: 10px; }
  .signatur-img { max-height: 90px; max-width: 280px; object-fit: contain; background: #fff; padding: 4px; border: 0.5px solid #eee; }
  .signatur-meta { display: flex; gap: 20px; margin-top: 10px; font-size: 9px; color: #555; }
  .signatur-meta strong { color: #111; font-weight: 700; }
  .villkor-box { margin-top: 20px; padding: 14px 18px; border: 0.5px solid #e0e0e0; border-radius: 4px; background: #fafafa; }
  .villkor-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #888; margin-bottom: 8px; }
  .villkor-text { font-size: 10px; color: #444; line-height: 1.6; white-space: pre-wrap; }
  .content-footer { text-align: center; font-size: 8px; color: #999; padding-top: 10px; border-top: 0.5px solid #e0e0e0; margin-top: auto; padding-bottom: 4px; }
</style>
</head>
<body>

<div class="content-page">
  <div class="content-header">
    <div class="content-logo">{{logo_html}}</div>
    <div class="content-company-info">
      <div class="content-company-line">Org.nr: {{foretag_org_nummer}}{{visa_godkand_fskatt_text}}</div>
      <div class="content-company-line">{{foretag_telefon}} &nbsp;·&nbsp; {{foretag_email}} &nbsp;·&nbsp; {{foretag_webbadress}}</div>
    </div>
  </div>

  <div class="title-section">
    <div class="title-left">
      <div class="doc-title">{{order_nummer}}</div>
      <div class="doc-subtitle">{{titel}}</div>
    </div>
    <div class="title-right">
      <div class="info-box">
        <div class="info-row"><span class="info-label">Kund:</span><span class="info-value">{{kund_namn}}</span></div>
        <div class="info-row"><span class="info-label">Org.nr:</span><span class="info-value">{{kund_org_nr}}</span></div>
        <div class="info-row"><span class="info-label">Projekt:</span><span class="info-value">{{projekt_namn}}</span></div>
        <div class="info-row"><span class="info-label">Fas:</span><span class="info-value">{{fas_namn}}</span></div>
        <div class="info-row"><span class="info-label">Subfas:</span><span class="info-value">{{subfas_namn}}</span></div>
        <div class="info-row"><span class="info-label">Datum:</span><span class="info-value">{{datum}}</span></div>
      </div>
    </div>
  </div>

  <div style="display:{{visa_beskrivning_display}};">
    <div class="section-title">Beskrivning / motivering</div>
    <div class="beskrivning-box">{{beskrivning}}</div>
  </div>

  <div class="section-title">Specifikation</div>
  {{rader_html}}

  <div class="totals-box">
    <div class="totals-table">
      <div class="totals-row netto">
        <span>Netto</span><span>{{netto}} {{valuta}}</span>
      </div>
      <div class="totals-row">
        <span>Moms 25%</span><span>{{moms}} {{valuta}}</span>
      </div>
      <div class="totals-row total">
        <span>Totalt</span><span>{{total}} {{valuta}}</span>
      </div>
    </div>
  </div>

  <div style="display:{{visa_villkor_display}};">
    <div class="villkor-box">
      <div class="villkor-label">Villkor</div>
      <div class="villkor-text">{{villkor_text}}</div>
    </div>
  </div>

  <div class="content-footer">{{foretag_namn}} &nbsp;·&nbsp; Org.nr: {{foretag_org_nummer}}</div>
</div>

</body>
</html>`
