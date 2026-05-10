-- Email templates for "Skicka uppdaterad version" — the resend that goes
-- out after the customer used "Begär ändring" and the admin reworked
-- the document. Until now the resend reused 'signatur_begaran_*', which
-- is identical to the first invitation — the customer couldn't tell it
-- was a follow-up. These templates are explicitly framed as a response.
--
-- Two flavours: a forslag-specific one (uses {{forslag_nummer}}) and a
-- generic 'dokument' one used as a fallback for fritt and any future
-- doc type. Vars also include {{andring_resumen}} — the latest request
-- the customer made — so the email shows we addressed it, and the
-- admin's optional follow-up note via {{meddelande_block}}.

BEGIN;

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
SELECT
  'signatur_uppdaterad_version_kund_forslag',
  'Förslag — Uppdaterad version efter ändring',
  'Förslag',
  'Uppdaterad offert {{forslag_nummer}} — {{foretag_namn}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#10b981 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#10b981;margin:0 0 6px;font-weight:600">Uppdaterad version</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">{{projekt_namn}}</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Vi har gått igenom dina synpunkter och bifogar en uppdaterad version av offerten <strong>{{forslag_nummer}}</strong>{{dokument_titel_block}}. Granska och signera digitalt när det passar dig.</p>
  {{andring_resumen_block}}
  {{meddelande_block}}
  <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="{{signatur_lank}}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Öppna och signera offert</a></td></tr></tbody></table>
  <p style="font-size:14px;color:#666;margin:0 0 14px">Länken är giltig till <strong style="color:#10b981">{{signatur_giltigt_till}}</strong>.</p>
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Behöver du ytterligare ändringar? Svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  15,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM epost_mallar WHERE system_kod = 'signatur_uppdaterad_version_kund_forslag'
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
SELECT
  'signatur_uppdaterad_version_kund_dokument',
  'Dokument — Uppdaterad version efter ändring',
  'Signering',
  'Uppdaterat dokument — {{foretag_namn}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#10b981 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#10b981;margin:0 0 6px;font-weight:600">Uppdaterad version</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">{{projekt_namn}}</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Vi har gått igenom dina synpunkter och bifogar en uppdaterad version av dokumentet{{dokument_titel_block}}. Granska och signera digitalt när det passar dig.</p>
  {{andring_resumen_block}}
  {{meddelande_block}}
  <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="{{signatur_lank}}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Öppna och signera dokumentet</a></td></tr></tbody></table>
  <p style="font-size:14px;color:#666;margin:0 0 14px">Länken är giltig till <strong style="color:#10b981">{{signatur_giltigt_till}}</strong>.</p>
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Behöver du ytterligare ändringar? Svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  16,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM epost_mallar WHERE system_kod = 'signatur_uppdaterad_version_kund_dokument'
);

COMMIT;
