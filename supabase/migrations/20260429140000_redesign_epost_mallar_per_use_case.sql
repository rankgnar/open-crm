-- Redesign epost_mallar: 1 plantilla por caso de uso, sin compartir.
-- Cada plantilla con system_kod único, HTML profesional alineado con la firma corporativa.
--
-- Cambios:
--   • Elimina las 4 plantillas obsoletas (3 Signatur genéricas + Välkommen)
--   • Actualiza las 4 existentes con system_kod nuevo + HTML profesional
--   • Inserta 12 nuevas plantillas específicas (4 begäran + 4 bekräftelse + 4 notifikation)
--   • Reemplaza submit_signature() para elegir mall por system_kod = '...' || dokument_typ
--   • Fix de paso: submit_signature ahora maneja correctamente dokument_typ='fritt'
--   • alias_id queda NULL en TODAS las nuevas — cada tenant lo asigna desde la UI
--     o se aplica via PATCH para esta instalación

BEGIN;

-- ============================================================================
-- 1) Eliminar plantillas obsoletas
-- ============================================================================
DELETE FROM epost_mallar
 WHERE system_kod IN (
   'signatur_begaran',
   'signatur_bekraftelse_kund',
   'signatur_bekraftelse_admin'
 ) OR namn IN ('Signaturbegäran', 'Signatur — bekräftelse till kund', 'Signatur > To admin', 'Välkommen');

-- ============================================================================
-- 2) Actualizar las 4 plantillas existentes (preservar ids para no romper workflows)
-- ============================================================================

UPDATE epost_mallar SET
  system_kod = 'faktura_utskick_kund',
  namn       = 'Faktura — Utskick till kund',
  kategori   = 'Faktura',
  amne       = 'Faktura {{faktura_nummer}} — {{foretag_namn}}',
  kropp_html = $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Faktura {{faktura_nummer}}</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">{{projekt_namn}}</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Bifogat finner du faktura <strong>{{faktura_nummer}}</strong> avseende <strong>{{projekt_namn}}</strong>.</p>
  <p style="font-size:15px;margin:0 0 24px">Vänligen betala enligt angivna villkor på fakturan. Vid frågor — svara direkt på detta mail.</p>
  <p style="font-size:13px;color:#888;margin:0;padding-top:20px;border-top:1px solid #eaeaea">Tack för förtroendet.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  sortering  = 60,
  uppdaterad_at = now()
 WHERE namn = 'Faktura-utskick';

UPDATE epost_mallar SET
  system_kod = 'faktura_paminnelse_kund',
  namn       = 'Faktura — Påminnelse till kund',
  kategori   = 'Faktura',
  amne       = 'Påminnelse: faktura {{faktura_nummer}}',
  kropp_html = $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Påminnelse — Faktura {{faktura_nummer}}</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">Obetald faktura</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Vi vill påminna om faktura <strong style="color:#dc2626">{{faktura_nummer}}</strong> som ännu inte är reglerad.</p>
  <p style="font-size:15px;margin:0 0 24px">Vänligen betala snarast eller hör av dig om något är oklart — så löser vi det tillsammans.</p>
  <p style="font-size:13px;color:#888;margin:0;padding-top:20px;border-top:1px solid #eaeaea">Om du redan har betalat, bortse från detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  sortering  = 70,
  uppdaterad_at = now()
 WHERE namn = 'Påminnelse';

UPDATE epost_mallar SET
  system_kod = 'projekt_tackmail_kund',
  namn       = 'Projekt avslutat — Tackmail till kund',
  kategori   = 'Uppföljning',
  amne       = 'Tack för förtroendet — {{foretag_namn}}',
  kropp_html = $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Projekt avslutat</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">Tack för förtroendet</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Tack för ditt förtroende och för ett bra samarbete kring <strong>{{projekt_namn}}</strong>. Det har varit ett nöje att arbeta med dig.</p>
  <p style="font-size:15px;margin:0 0 24px">Vi hoppas att du är nöjd med resultatet och att vi får möjligheten att hjälpa dig igen i framtiden.</p>
  <p style="font-size:13px;color:#888;margin:0;padding-top:20px;border-top:1px solid #eaeaea">Behöver du tilläggsarbeten eller har frågor? Hör av dig när som helst.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  sortering  = 80,
  uppdaterad_at = now()
 WHERE namn = 'Tackmail';

UPDATE epost_mallar SET
  system_kod = 'offert_utskick_kund',
  namn       = 'Offert — Utskick till kund',
  kategori   = 'Offert',
  amne       = 'Offert {{offert_nummer}} — {{foretag_namn}}',
  kropp_html = $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Offert {{offert_nummer}}</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">{{projekt_namn}}</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Bifogat finner du vår offert <strong>{{offert_nummer}}</strong> för projektet <strong>{{projekt_namn}}</strong>.</p>
  <p style="font-size:15px;margin:0 0 24px">Offerten är giltig till <strong style="color:#5363f2">{{offert_giltig_till}}</strong>. Tveka inte att höra av dig om du har frågor.</p>
  <p style="font-size:13px;color:#888;margin:0;padding-top:20px;border-top:1px solid #eaeaea">Har du frågor om offerten? Svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  sortering  = 50,
  uppdaterad_at = now()
 WHERE namn = 'Offert-utskick';

-- ============================================================================
-- 3) Insertar 12 plantillas nuevas (begäran/bekräftelse/notifikation × 4 tipos)
-- ============================================================================

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'signatur_begaran_forslag',
  'Förslag — Begäran om signering',
  'Förslag',
  'Signera offert {{forslag_nummer}} — {{foretag_namn}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Offert {{forslag_nummer}}</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">{{projekt_namn}}</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Vi har förberett offerten <strong>{{forslag_nummer}}</strong>{{dokument_titel_block}}. Klicka på knappen nedan för att granska och signera digitalt.</p>
  <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="{{signatur_lank}}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Öppna och signera offert</a></td></tr></tbody></table>
  <p style="font-size:14px;color:#666;margin:0 0 14px">Länken är giltig till <strong style="color:#5363f2">{{signatur_giltigt_till}}</strong>.</p>
  {{meddelande_block}}
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Har du frågor? Svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  10,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'signatur_begaran_order',
  'Order — Begäran om signering',
  'Order',
  'Signera order {{order_nummer}} — {{foretag_namn}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Order {{order_nummer}}</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">{{projekt_namn}}</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Vi har förberett ordern <strong>{{order_nummer}}</strong>{{dokument_titel_block}}. Klicka på knappen nedan för att granska och signera digitalt.</p>
  <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="{{signatur_lank}}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Öppna och signera order</a></td></tr></tbody></table>
  <p style="font-size:14px;color:#666;margin:0 0 14px">Länken är giltig till <strong style="color:#5363f2">{{signatur_giltigt_till}}</strong>.</p>
  {{meddelande_block}}
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Har du frågor? Svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  20,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'signatur_begaran_ata',
  'ÄTA — Begäran om signering',
  'ÄTA',
  'Signera ÄTA {{ata_nummer}} — {{foretag_namn}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">ÄTA {{ata_nummer}}</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">{{projekt_namn}}</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Vi har förberett ÄTA-arbetet <strong>{{ata_nummer}}</strong>{{dokument_titel_block}}. Klicka på knappen nedan för att granska och signera digitalt.</p>
  <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="{{signatur_lank}}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Öppna och signera ÄTA</a></td></tr></tbody></table>
  <p style="font-size:14px;color:#666;margin:0 0 14px">Länken är giltig till <strong style="color:#5363f2">{{signatur_giltigt_till}}</strong>.</p>
  {{meddelande_block}}
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Har du frågor? Svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  30,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'signatur_begaran_dokument',
  'Dokument — Begäran om signering',
  'Dokument',
  'Signera dokument — {{foretag_namn}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Dokument</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">{{projekt_namn}}</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Vi har förberett dokumentet <strong>{{dokument_titel}}</strong>{{dokument_titel_block}}. Klicka på knappen nedan för att granska och signera digitalt.</p>
  <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="{{signatur_lank}}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Öppna och signera dokument</a></td></tr></tbody></table>
  <p style="font-size:14px;color:#666;margin:0 0 14px">Länken är giltig till <strong style="color:#5363f2">{{signatur_giltigt_till}}</strong>.</p>
  {{meddelande_block}}
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Har du frågor? Svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  40,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'signatur_bekraftelse_kund_forslag',
  'Förslag — Bekräftelse till kund (signerad)',
  'Förslag',
  'Bekräftelse: signerad offert {{doc_nummer}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Offert signerad</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">Signering bekräftad</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Tack! Din signering av offerten <strong>{{doc_nummer}}</strong> har registrerats <strong style="color:#10b981">{{datum}}</strong>.</p>
  {{pdf_button}}
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Spara detta meddelande som kvitto. Om du behöver hjälp, svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  11,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'signatur_bekraftelse_kund_order',
  'Order — Bekräftelse till kund (signerad)',
  'Order',
  'Bekräftelse: signerad order {{doc_nummer}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Order signerad</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">Signering bekräftad</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Tack! Din signering av ordern <strong>{{doc_nummer}}</strong> har registrerats <strong style="color:#10b981">{{datum}}</strong>.</p>
  {{pdf_button}}
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Spara detta meddelande som kvitto. Om du behöver hjälp, svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  21,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'signatur_bekraftelse_kund_ata',
  'ÄTA — Bekräftelse till kund (signerad)',
  'ÄTA',
  'Bekräftelse: signerad ÄTA {{doc_nummer}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">ÄTA signerad</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">Signering bekräftad</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Tack! Din signering av ÄTA-arbetet <strong>{{doc_nummer}}</strong> har registrerats <strong style="color:#10b981">{{datum}}</strong>.</p>
  {{pdf_button}}
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Spara detta meddelande som kvitto. Om du behöver hjälp, svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  31,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'signatur_bekraftelse_kund_dokument',
  'Dokument — Bekräftelse till kund (signerad)',
  'Dokument',
  'Bekräftelse: signerat dokument',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Dokument signerat</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">Signering bekräftad</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Tack! Din signering av dokumentet <strong>{{titel}}</strong> har registrerats <strong style="color:#10b981">{{datum}}</strong>.</p>
  {{pdf_button}}
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Spara detta meddelande som kvitto. Om du behöver hjälp, svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  41,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'signatur_notifikation_admin_forslag',
  'Förslag — Notifikation till admin (signerad)',
  'Förslag',
  'Kund signerade offert {{doc_nummer}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.5">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:24px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#10b981;margin:0 0 6px;font-weight:600">Offert signerad av kund</p>
  <div style="background:#fafafa;border:1px solid #eaeaea;border-radius:8px;padding:20px 24px;margin-top:14px">
    <div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Dokument</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">Offert <strong>{{doc_nummer}}</strong></div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Titel</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">{{titel}}</div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Signerat av</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a"><strong>{{namn}}</strong></div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Kund</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">{{kund_namn}} <span style="color:#888">&lt;{{kund_email}}&gt;</span></div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Tidpunkt</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">{{datum}}</div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">IP</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a"><code style="font-family:monospace;font-size:13px;color:#666">{{ip}}</code></div></div>
  </div>
  {{pdf_admin_line}}
</div>$mall$,
  12,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'signatur_notifikation_admin_order',
  'Order — Notifikation till admin (signerad)',
  'Order',
  'Kund signerade order {{doc_nummer}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.5">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:24px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#10b981;margin:0 0 6px;font-weight:600">Order signerad av kund</p>
  <div style="background:#fafafa;border:1px solid #eaeaea;border-radius:8px;padding:20px 24px;margin-top:14px">
    <div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Dokument</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">Order <strong>{{doc_nummer}}</strong></div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Titel</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">{{titel}}</div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Signerat av</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a"><strong>{{namn}}</strong></div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Kund</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">{{kund_namn}} <span style="color:#888">&lt;{{kund_email}}&gt;</span></div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Tidpunkt</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">{{datum}}</div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">IP</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a"><code style="font-family:monospace;font-size:13px;color:#666">{{ip}}</code></div></div>
  </div>
  {{pdf_admin_line}}
</div>$mall$,
  22,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'signatur_notifikation_admin_ata',
  'ÄTA — Notifikation till admin (signerad)',
  'ÄTA',
  'Kund signerade ÄTA {{doc_nummer}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.5">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:24px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#10b981;margin:0 0 6px;font-weight:600">ÄTA signerad av kund</p>
  <div style="background:#fafafa;border:1px solid #eaeaea;border-radius:8px;padding:20px 24px;margin-top:14px">
    <div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Dokument</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">ÄTA <strong>{{doc_nummer}}</strong></div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Titel</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">{{titel}}</div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Signerat av</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a"><strong>{{namn}}</strong></div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Kund</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">{{kund_namn}} <span style="color:#888">&lt;{{kund_email}}&gt;</span></div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Tidpunkt</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">{{datum}}</div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">IP</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a"><code style="font-family:monospace;font-size:13px;color:#666">{{ip}}</code></div></div>
  </div>
  {{pdf_admin_line}}
</div>$mall$,
  32,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'signatur_notifikation_admin_dokument',
  'Dokument — Notifikation till admin (signerat)',
  'Dokument',
  'Kund signerade dokument',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.5">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:24px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#10b981;margin:0 0 6px;font-weight:600">Dokument signerat av kund</p>
  <div style="background:#fafafa;border:1px solid #eaeaea;border-radius:8px;padding:20px 24px;margin-top:14px">
    <div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Dokument</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">Dokument <strong>{{titel}}</strong></div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Titel</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">{{titel}}</div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Signerat av</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a"><strong>{{namn}}</strong></div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Kund</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">{{kund_namn}} <span style="color:#888">&lt;{{kund_email}}&gt;</span></div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">Tidpunkt</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a">{{datum}}</div></div><div style="display:table-row"><div style="display:table-cell;padding:6px 16px 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;vertical-align:top;width:120px">IP</div><div style="display:table-cell;padding:6px 0;font-size:14px;color:#1a1a1a"><code style="font-family:monospace;font-size:13px;color:#666">{{ip}}</code></div></div>
  </div>
  {{pdf_admin_line}}
</div>$mall$,
  42,
  true
);

-- ============================================================================
-- 4) Reemplazar submit_signature() para elegir plantilla por system_kod
--    + Fix de paso: manejar correctamente dokument_typ='fritt'
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_signature(
  p_token   TEXT,
  p_namn    TEXT,
  p_signatur TEXT,
  p_ua      TEXT,
  p_pdf_url TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link              signatur_lankar%ROWTYPE;
  v_ip                INET;
  v_xff               TEXT;
  v_log_aktiv         BOOLEAN;
  v_projekt_id        UUID;
  v_kund_email        TEXT;
  v_kund_namn         TEXT;
  v_doc_titel         TEXT;
  v_doc_nummer        TEXT;
  v_foretag_namn      TEXT;
  v_foretag_email     TEXT;
  v_alias_id          UUID;
  v_acepterat_exists  BOOLEAN;
  v_pdf_button        TEXT := '';
  v_pdf_admin_line    TEXT := '';
  v_doc_typ_label     TEXT;
  v_doc_typ_label_def TEXT;
  v_datum             TEXT;
  v_alias_signatur    TEXT := '';
  v_vars              jsonb;
  v_mall_kund         RECORD;
  v_mall_admin        RECORD;
  v_amne              TEXT;
  v_kropp             TEXT;
  v_use_alias         UUID;
  v_kod_kund          TEXT;
  v_kod_admin         TEXT;
BEGIN
  IF p_token IS NULL OR p_namn IS NULL OR length(trim(p_namn)) = 0 OR p_signatur IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT * INTO v_link FROM signatur_lankar WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'revoked'); END IF;
  IF v_link.signerad_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'signed'); END IF;
  IF v_link.gar_ut_at < now() THEN RETURN jsonb_build_object('status', 'expired'); END IF;

  BEGIN
    v_xff := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    IF v_xff IS NOT NULL THEN
      v_ip := split_part(v_xff, ',', 1)::inet;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  UPDATE signatur_lankar
     SET signerad_at = now(),
         signerad_namn = trim(p_namn),
         signerad_ip = v_ip,
         signerad_ua = p_ua,
         signatur_data = p_signatur,
         signed_pdf_url = p_pdf_url
   WHERE id = v_link.id;

  -- Update source document (none for 'fritt' — it has no source table)
  IF v_link.dokument_typ = 'forslag' THEN
    UPDATE forslag
       SET status = 'accepterat',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, forslag_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;

    IF v_projekt_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM projekt_statusar WHERE namn = 'Acepterat')
        INTO v_acepterat_exists;
      IF v_acepterat_exists THEN
        UPDATE projekt SET status = 'Acepterat' WHERE id = v_projekt_id;
      END IF;
    END IF;
  ELSIF v_link.dokument_typ = 'order' THEN
    UPDATE ordrar
       SET status = 'Godkänd',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, order_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
  ELSIF v_link.dokument_typ = 'ata' THEN
    UPDATE ata
       SET status = 'Godkänd',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, ata_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
  ELSIF v_link.dokument_typ = 'fritt' THEN
    -- No source doc to update. Resolve projekt + titel from upload metadata.
    SELECT projekt_id, titel, NULL::text
      INTO v_projekt_id, v_doc_titel, v_doc_nummer
      FROM signatur_fritta_dokument
     WHERE id = v_link.dokument_id;
  END IF;

  SELECT aktiv INTO v_log_aktiv
    FROM aktivitetslogg_installningar
   WHERE handelse = 'signatur_inskickad';

  IF v_log_aktiv IS TRUE THEN
    v_kund_email := v_link.kund_email;
    SELECT k.namn INTO v_kund_namn FROM kunder k WHERE k.id = v_link.kund_id;

    SELECT a.foretag_namn, a.foretag_email INTO v_foretag_namn, v_foretag_email
      FROM app_installningar a LIMIT 1;

    IF v_projekt_id IS NOT NULL THEN
      INSERT INTO projekt_anteckningar (projekt_id, titel, innehall)
      VALUES (
        v_projekt_id,
        format('Signerad %s — %s',
               v_link.dokument_typ,
               COALESCE(v_doc_nummer, v_doc_titel, '')),
        format(
          E'Signerad av %s\n%s\nIP: %s',
          trim(p_namn),
          to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
          COALESCE(v_ip::text, '—')
        )
      );
    END IF;

    SELECT id INTO v_alias_id FROM epost_alias WHERE aktiv ORDER BY standard DESC NULLS LAST, sortering LIMIT 1;

    -- Map dokument_typ → ('fritt' uses 'dokument' suffix for system_kod)
    v_kod_kund  := 'signatur_bekraftelse_kund_'  || CASE v_link.dokument_typ WHEN 'fritt' THEN 'dokument' ELSE v_link.dokument_typ END;
    v_kod_admin := 'signatur_notifikation_admin_' || CASE v_link.dokument_typ WHEN 'fritt' THEN 'dokument' ELSE v_link.dokument_typ END;

    v_doc_typ_label     := CASE v_link.dokument_typ
                              WHEN 'forslag' THEN 'offert'
                              WHEN 'order'   THEN 'order'
                              WHEN 'ata'     THEN 'ÄTA-arbete'
                              ELSE 'dokument'
                            END;
    v_doc_typ_label_def := CASE v_link.dokument_typ
                              WHEN 'forslag' THEN 'offerten'
                              WHEN 'order'   THEN 'ordern'
                              WHEN 'ata'     THEN 'ÄTA-arbetet'
                              ELSE 'dokumentet'
                            END;
    v_datum             := to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI');

    IF p_pdf_url IS NOT NULL AND length(p_pdf_url) > 0 THEN
      v_pdf_button := format(
        '<table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="%s" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Ladda ner signerad PDF</a></td></tr></tbody></table>',
        p_pdf_url
      );
      v_pdf_admin_line := format('<div style="margin-top:18px;font-size:13px;color:#666"><strong style="color:#1a1a1a">PDF:</strong> <a href="%s" style="color:#5363f2">%s</a></div>', p_pdf_url, p_pdf_url);
    END IF;

    v_vars := jsonb_build_object(
      'kund_namn',          COALESCE(v_kund_namn, trim(p_namn)),
      'kund_email',         COALESCE(v_kund_email, '—'),
      'foretag_namn',       COALESCE(v_foretag_namn, ''),
      'namn',               trim(p_namn),
      'doc_nummer',         COALESCE(v_doc_nummer, ''),
      'doc_typ',            v_link.dokument_typ,
      'doc_typ_label',      v_doc_typ_label,
      'doc_typ_label_def',  v_doc_typ_label_def,
      'titel',              COALESCE(v_doc_titel, ''),
      'datum',              v_datum,
      'ip',                 COALESCE(v_ip::text, '—'),
      'pdf_lank',           COALESCE(p_pdf_url, ''),
      'pdf_button',         v_pdf_button,
      'pdf_admin_line',     v_pdf_admin_line,
      'alias_signatur',     ''
    );

    -- Customer confirmation (typ-specific mall by system_kod)
    IF v_kund_email IS NOT NULL AND length(v_kund_email) > 0 THEN
      SELECT * INTO v_mall_kund
        FROM epost_mallar
       WHERE system_kod = v_kod_kund AND aktiv
       LIMIT 1;

      IF v_mall_kund IS NOT NULL THEN
        SELECT signatur_html INTO v_alias_signatur
          FROM epost_alias WHERE id = v_mall_kund.alias_id;
        v_vars := v_vars || jsonb_build_object('alias_signatur', COALESCE(v_alias_signatur, ''));
        v_use_alias := COALESCE(v_mall_kund.alias_id, v_alias_id);
        v_amne  := inject_template_vars(v_mall_kund.amne, v_vars);
        v_kropp := inject_template_vars(v_mall_kund.kropp_html, v_vars);

        INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
        VALUES (
          v_use_alias, v_kund_email, v_amne, v_kropp,
          v_link.kund_id, v_projekt_id,
          CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
          now(), 'väntar'
        );
      END IF;
    END IF;

    -- Admin notification (typ-specific mall by system_kod)
    IF v_foretag_email IS NOT NULL AND length(v_foretag_email) > 0 THEN
      SELECT * INTO v_mall_admin
        FROM epost_mallar
       WHERE system_kod = v_kod_admin AND aktiv
       LIMIT 1;

      IF v_mall_admin IS NOT NULL THEN
        SELECT signatur_html INTO v_alias_signatur
          FROM epost_alias WHERE id = v_mall_admin.alias_id;
        v_vars := v_vars || jsonb_build_object('alias_signatur', COALESCE(v_alias_signatur, ''));
        v_use_alias := COALESCE(v_mall_admin.alias_id, v_alias_id);
        v_amne  := inject_template_vars(v_mall_admin.amne, v_vars);
        v_kropp := inject_template_vars(v_mall_admin.kropp_html, v_vars);

        INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
        VALUES (
          v_use_alias, v_foretag_email, v_amne, v_kropp,
          v_link.kund_id, v_projekt_id,
          CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
          now(), 'väntar'
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'signed');
END;
$$;

REVOKE ALL ON FUNCTION submit_signature(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_signature(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

COMMIT;

