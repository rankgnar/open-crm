CREATE TABLE aktivitetslogg_installningar (
  handelse text PRIMARY KEY,
  aktiv boolean NOT NULL DEFAULT true,
  etikett text NOT NULL
);

INSERT INTO aktivitetslogg_installningar VALUES
  ('projekt_skapat', true, 'Projekt skapat'),
  ('status_andrad',  true, 'Status ändrad'),
  ('forslag_skapat', true, 'Förslag skapat'),
  ('faktura_skapad', true, 'Faktura skapad');
