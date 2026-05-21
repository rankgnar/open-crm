INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv)
VALUES ('epost_skickat', 'E-post skickat', true)
ON CONFLICT (handelse) DO NOTHING;
