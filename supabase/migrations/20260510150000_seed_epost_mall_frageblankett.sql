-- Email template for sending questionnaire link to client.
-- Configurable via Inställningar → E-post → Mallar.
-- Supports variables: {{kund_namn}}, {{projekt_namn}}, {{formulär_länk}}, {{foretag_namn}}

INSERT INTO epost_mallar (namn, amne, kropp_html, kategori, system_kod, aktiv, sortering)
SELECT
  'Frågeformulär — länk till klient',
  'Lite mer information om {{projekt_namn}}',
  E'<p>Hej {{kund_namn}},</p>\n<p>För att vi ska kunna ta fram ett bra underlag för ditt projekt behöver vi lite mer information från dig.</p>\n<p>Klicka på länken nedan och fyll i formuläret — det tar bara några minuter:</p>\n<p><a href="{{formulär_länk}}">Öppna formuläret</a></p>\n<p>Med vänliga hälsningar,<br>{{foretag_namn}}</p>',
  'Allmänt',
  'frageblankett_link',
  true,
  100
WHERE NOT EXISTS (
  SELECT 1 FROM epost_mallar WHERE system_kod = 'frageblankett_link'
);
