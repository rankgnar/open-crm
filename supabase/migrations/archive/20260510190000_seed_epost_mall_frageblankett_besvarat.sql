-- Notification template sent to company when a client submits a questionnaire.
-- Configurable via Inställningar → E-post → Mallar → "Formulär besvarat — notifiering".
-- Toggle aktiv to enable/disable. Variables: {{kund_namn}}, {{projekt_namn}}, {{blankett_titel}}, {{formulär_länk}}, {{foretag_namn}}, {{datum}}

INSERT INTO epost_mallar (namn, amne, kropp_html, kategori, system_kod, aktiv, sortering)
SELECT
  'Formulär besvarat — notifiering',
  'Nytt svar: {{blankett_titel}} — {{kund_namn}}',
  E'<p>Hej,</p>\n<p><strong>{{kund_namn}}</strong> har besvarat formuläret <em>{{blankett_titel}}</em> för projektet <strong>{{projekt_namn}}</strong>.</p>\n<p>Datum: {{datum}}</p>\n<p><a href="{{formulär_länk}}">Öppna formuläret i Open-CRM</a></p>',
  'Allmänt',
  'frageblankett_besvarat',
  true,
  101
WHERE NOT EXISTS (
  SELECT 1 FROM epost_mallar WHERE system_kod = 'frageblankett_besvarat'
);
