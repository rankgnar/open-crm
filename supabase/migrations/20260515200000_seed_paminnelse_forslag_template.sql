-- Seed reminder email template for Förslag.
-- Sent when the admin wants to nudge a client who has not yet reviewed/signed
-- the offer. Reuses the same existing signing link — no new link is created.

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, meddelande_standard, sortering, aktiv)
SELECT
  'signatur_paminnelse_forslag',
  'Förslag — Påminnelse',
  'Förslag',
  'Påminnelse: offert {{forslag_nummer}} väntar på din granskning',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Påminnelse — Offert {{forslag_nummer}}</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">{{projekt_namn}}</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Vi vill påminna om att offert <strong>{{forslag_nummer}}</strong>{{dokument_titel_block}} fortfarande väntar på din granskning. Klicka på knappen nedan för att öppna och signera digitalt.</p>
  <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="{{signatur_lank}}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Granska och signera offert</a></td></tr></tbody></table>
  <p style="font-size:14px;color:#666;margin:0 0 14px">Länken är giltig till <strong style="color:#5363f2">{{signatur_giltigt_till}}</strong>.</p>
  {{meddelande_block}}
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Har du redan svarat eller har frågor? Svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  'Hej {{kund_namn}}! Vi ville bara höra om du fått chansen att titta på offerten vi skickade. Hör gärna av dig om du har frågor eller funderingar. Vi hjälper gärna till! 😊',
  15,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM epost_mallar WHERE system_kod = 'signatur_paminnelse_forslag'
);
