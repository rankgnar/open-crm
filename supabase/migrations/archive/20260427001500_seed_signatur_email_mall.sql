-- Default email template the admin uses when sending a signing link to the
-- client. Variables are interpolated by the existing CRM email engine:
--   {{kund_namn}}, {{foretag_namn}}, {{forslag_nummer}}, {{order_nummer}},
--   {{projekt_namn}}, {{signatur_lank}}, {{signatur_giltigt_till}},
--   {{alias_signatur}}, {{meddelande}}.
INSERT INTO epost_mallar (namn, kategori, amne, kropp_html, sortering)
VALUES (
  'Signaturbegäran',
  'Signatur',
  'Signera {{forslag_nummer}}{{order_nummer}} — {{foretag_namn}}',
  '<p>Hej {{kund_namn}},</p>'
  || '<p>Klicka på länken nedan för att granska och signera digitalt:</p>'
  || '<p><a href="{{signatur_lank}}" style="display:inline-block;padding:12px 22px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Öppna och signera</a></p>'
  || '<p>Länken är giltig till {{signatur_giltigt_till}}.</p>'
  || '<p>{{meddelande}}</p>'
  || '<p>{{alias_signatur}}</p>',
  30
)
ON CONFLICT DO NOTHING;
