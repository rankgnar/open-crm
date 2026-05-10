export const DEFAULT_FORSLAG_HTML = `<!DOCTYPE html>
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

  /* ── PAGE 1: Dark cover ─────────────────────────── */
  .cover {
    width: 210mm;
    height: 297mm;
    background: #0f172b;
    position: relative;
    overflow: hidden;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    padding: 48px 56px 36px;
    color: #fff;
  }
  .cover-orb {
    position: absolute;
    right: -80px;
    top: -60px;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: #1d4ed8;
    opacity: 0.18;
    pointer-events: none;
  }
  .cover-band {
    position: absolute;
    left: -20px;
    bottom: 130px;
    width: 420px;
    height: 52px;
    background: #f97316;
    opacity: 0.08;
    pointer-events: none;
  }
  .cover-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    position: relative;
    z-index: 1;
  }
  .cover-logo {
    font-size: 22px;
    font-weight: 800;
    color: #fff;
    letter-spacing: 3px;
    text-transform: uppercase;
  }
  .cover-company-info { text-align: right; }
  .cover-company-line {
    font-size: 8px;
    color: #e2e8f0;
    letter-spacing: 0.3px;
    line-height: 1.9;
  }
  .cover-title-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
    z-index: 1;
    padding: 0 0 32px;
  }
  .cover-title {
    font-size: 40px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #fff;
    line-height: 1.1;
    margin-bottom: 12px;
  }
  .cover-subtitle {
    font-size: 14px;
    color: #cbd5e1;
    letter-spacing: 0.2px;
  }
  .cover-info-box {
    background: #111a31;
    border: 1px solid #1f2b46;
    border-radius: 8px;
    padding: 20px 24px;
    position: relative;
    z-index: 1;
  }
  .cover-info-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 8px;
  }
  .cover-info-label {
    font-size: 9px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .cover-info-value {
    font-size: 11px;
    font-weight: 700;
    color: #e2e8f0;
    text-align: right;
    max-width: 65%;
  }
  .cover-divider {
    border: none;
    border-top: 1px solid #1f2b46;
    margin: 12px 0;
  }
  .cover-total-label {
    font-size: 9px;
    color: #facc15;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 6px;
  }
  .cover-total-value {
    font-size: 28px;
    font-weight: 800;
    color: #fbbf24;
  }
  .cover-footer {
    text-align: center;
    font-size: 8px;
    color: #475569;
    padding-top: 14px;
    position: relative;
    z-index: 1;
  }

  /* ── PAGE 2: Content ────────────────────────────── */
  .content-page {
    width: 210mm;
    min-height: 297mm;
    background: #fff;
    padding: 40px 44px;
    display: flex;
    flex-direction: column;
    color: #111;
  }
  .content-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 14px;
    border-bottom: 0.5px solid #333;
    margin-bottom: 22px;
  }
  .content-logo {
    font-size: 18px;
    font-weight: 800;
    color: {{accent_farg}};
    letter-spacing: 3px;
    text-transform: uppercase;
  }
  .content-company-info { text-align: right; }
  .content-company-line {
    font-size: 7.5px;
    color: #666;
    line-height: 1.75;
  }
  .title-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 22px;
  }
  .title-left { width: 45%; }
  .doc-title {
    font-size: 20px;
    font-weight: 800;
    color: #000;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 5px;
  }
  .doc-subtitle { font-size: 10px; color: #666; }
  .title-right { width: 51%; }
  .info-box {
    background: #f8f8f8;
    border: 0.5px solid #d0d0d0;
    padding: 12px 14px;
  }
  .info-row { display: flex; margin-bottom: 4px; }
  .info-row:last-child { margin-bottom: 0; }
  .info-label { width: 36%; font-size: 8px; font-weight: 700; color: #333; }
  .info-value { width: 64%; font-size: 8px; color: #000; }
  .summary-box {
    background: #f6f2ea;
    border: 0.5px solid #d4af37;
    border-radius: 4px;
    padding: 16px 18px;
    margin-bottom: 20px;
  }
  .summary-title {
    font-size: 11px;
    font-weight: 800;
    color: #0f172b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .summary-label { font-size: 9px; color: #374151; }
  .summary-value { font-size: 9px; font-weight: 700; color: #0f172b; }
  .summary-divider { border: none; border-top: 0.5px solid #d4af37; margin: 8px 0; }
  .summary-final {
    font-size: 10px;
    font-weight: 800;
    color: #b45309;
    text-transform: uppercase;
    margin-top: 6px;
  }
  .content-footer {
    text-align: center;
    font-size: 8px;
    color: #999;
    padding-top: 10px;
    border-top: 0.5px solid #e0e0e0;
    margin-top: auto;
    padding-bottom: 4px;
  }
</style>
</head>
<body>

<!-- PAGE 1: Dark cover -->
<div class="cover" style="display:{{visa_portada_display}};">
  <div class="cover-orb"></div>
  <div class="cover-band"></div>

  <div class="cover-header">
    <div class="cover-logo">{{logo_html}}</div>
    <div class="cover-company-info">
      <div class="cover-company-line">{{foretag_namn}}</div>
      <div class="cover-company-line">Org.nr: {{foretag_org_nummer}}</div>
      {{visa_godkand_fskatt_html}}
      <div class="cover-company-line">{{foretag_telefon}}</div>
      <div class="cover-company-line">{{foretag_email}}</div>
      <div class="cover-company-line">{{foretag_webbadress}}</div>
    </div>
  </div>

  <div class="cover-title-section">
    <div class="cover-title">{{portada_titel}}</div>
    <div class="cover-subtitle">{{portada_undertitel}}</div>
  </div>

  <div class="cover-info-box">
    <div class="cover-info-row">
      <span class="cover-info-label">Projekt-nr</span>
      <span class="cover-info-value">{{projekt_nummer}}</span>
    </div>
    <div class="cover-info-row">
      <span class="cover-info-label">Förslag-nr</span>
      <span class="cover-info-value">{{forslag_nummer}}</span>
    </div>
    <div class="cover-info-row">
      <span class="cover-info-label">Kund</span>
      <span class="cover-info-value">{{kund_namn}}</span>
    </div>
    <div class="cover-info-row">
      <span class="cover-info-label">Projekt</span>
      <span class="cover-info-value">{{projekt_namn}}</span>
    </div>
    <div class="cover-info-row">
      <span class="cover-info-label">Adress</span>
      <span class="cover-info-value">{{adress}}</span>
    </div>
    <div class="cover-info-row">
      <span class="cover-info-label">Datum</span>
      <span class="cover-info-value">{{datum}}</span>
    </div>
    <div class="cover-info-row">
      <span class="cover-info-label">Giltighet</span>
      <span class="cover-info-value">{{giltighet}}</span>
    </div>
    <hr class="cover-divider">
    <div class="cover-total-label">Offertvärde inkl. moms</div>
    <div class="cover-total-value">{{offertvarde}} {{valuta}}</div>
  </div>

  <div class="cover-footer">{{foretag_namn}} &nbsp;·&nbsp; Org.nr: {{foretag_org_nummer}}</div>
</div>

<!-- PAGE 2: Content summary -->
<div class="content-page" style="display:{{visa_sammanfattning_display}};">
  <div class="content-header">
    <div class="content-logo">{{logo_html}}</div>
    <div class="content-company-info">
      <div class="content-company-line">Org.nr: {{foretag_org_nummer}}{{visa_godkand_fskatt_text}}</div>
      <div class="content-company-line">{{foretag_telefon}} &nbsp;·&nbsp; {{foretag_email}} &nbsp;·&nbsp; {{foretag_webbadress}}</div>
    </div>
  </div>

  <div class="title-section">
    <div class="title-left">
      <div class="doc-title">{{portada_titel}}</div>
      <div class="doc-subtitle">{{portada_undertitel}}</div>
    </div>
    <div class="title-right">
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Projekt-nr:</span>
          <span class="info-value">{{projekt_nummer}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Förslag-nr:</span>
          <span class="info-value">{{forslag_nummer}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Kund:</span>
          <span class="info-value">{{kund_namn}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Projekt:</span>
          <span class="info-value">{{projekt_namn}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Adress:</span>
          <span class="info-value">{{adress}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Datum:</span>
          <span class="info-value">{{datum}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Giltighet:</span>
          <span class="info-value">{{giltighet}}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="summary-box">
    <div class="summary-title">Sammanfattning av offert</div>
    <div class="summary-row">
      <span class="summary-label">Arbetskostnad (exkl. moms)</span>
      <span class="summary-value">{{arbetskostnad}} {{valuta}}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Materialkostnad (exkl. moms)</span>
      <span class="summary-value">{{materialkostnad}} {{valuta}}</span>
    </div>
    <hr class="summary-divider">
    <div class="summary-row">
      <span class="summary-label">Netto (exkl. moms)</span>
      <span class="summary-value">{{netto_exkl_moms}} {{valuta}}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Moms {{moms_procent_text}}%</span>
      <span class="summary-value">{{moms_belopp}} {{valuta}}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Totalt pris (inkl. moms)</span>
      <span class="summary-value">{{total_inkl_moms}} {{valuta}}</span>
    </div>
    <div class="summary-row" style="display:{{rot_avdrag_display}};">
      <span class="summary-label">ROT-avdrag ({{rot_procent_text}}% av arbete inkl. moms)</span>
      <span class="summary-value">- {{rot_avdrag}} {{valuta}}</span>
    </div>
    <hr class="summary-divider">
    <div class="summary-final">Att betala: {{offertvarde}} {{valuta}}</div>
  </div>

  <div style="display:{{visa_villkor_display}};margin-top:20px;padding:14px 18px;border:0.5px solid #e0e0e0;border-radius:4px;background:#fafafa;">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#888;margin-bottom:8px;">Villkor</div>
    <div style="font-size:10px;color:#444;line-height:1.6;white-space:pre-wrap;">{{projekt_villkor}}</div>
  </div>

  <div class="content-footer">{{foretag_namn}} &nbsp;·&nbsp; Org.nr: {{foretag_org_nummer}}</div>
</div>

<!-- PAGE 3: Desglose completo de faser/subfaser -->
<div class="content-page" style="page-break-before: always;">
  <div class="content-header">
    <div class="content-logo">{{logo_html}}</div>
    <div class="content-company-info">
      <div class="content-company-line">Org.nr: {{foretag_org_nummer}}{{visa_godkand_fskatt_text}}</div>
      <div class="content-company-line">{{foretag_telefon}} &nbsp;·&nbsp; {{foretag_email}} &nbsp;·&nbsp; {{foretag_webbadress}}</div>
    </div>
  </div>

  <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#000;margin-bottom:16px;padding-bottom:8px;border-bottom:0.5px solid #e0e0e0;">
    Kostnadsspecifikation
  </div>

  {{desglose_html}}

  <div class="content-footer" style="margin-top:24px;">{{foretag_namn}} &nbsp;·&nbsp; Org.nr: {{foretag_org_nummer}}</div>
</div>

</body>
</html>`

