-- Aktivitetslogg: cubrir todo el ciclo de vida del proyecto.
-- Añade columna `kategori` para agrupar en el panel de Avancerat
-- y registra todos los nuevos eventos posibles.

ALTER TABLE aktivitetslogg_installningar
  ADD COLUMN IF NOT EXISTS kategori text NOT NULL DEFAULT 'ovrigt';

-- Backfill de eventos existentes con su categoría correspondiente
UPDATE aktivitetslogg_installningar SET kategori = 'projekt'    WHERE handelse IN ('projekt_skapat', 'status_andrad');
UPDATE aktivitetslogg_installningar SET kategori = 'forslag'    WHERE handelse IN ('forslag_skapat', 'forslag_status_andrad');
UPDATE aktivitetslogg_installningar SET kategori = 'ata'        WHERE handelse IN ('ata_signerad');
UPDATE aktivitetslogg_installningar SET kategori = 'epost'      WHERE handelse IN ('epost_skickat');
UPDATE aktivitetslogg_installningar SET kategori = 'fakturering' WHERE handelse IN ('faktura_skapad', 'faktura_status_andrad');
UPDATE aktivitetslogg_installningar SET kategori = 'signatur'   WHERE handelse IN ('signatur_inskickad');
UPDATE aktivitetslogg_installningar SET kategori = 'kostnader'  WHERE handelse IN ('material_inskickad', 'tidrapport_inskickad');

-- ── Kund ──────────────────────────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('kund_skapat',           'Kund skapad',                       true, 'kund'),
  ('kund_uppdaterad',       'Kund uppdaterad',                   true, 'kund'),
  ('kontaktperson_lagt_till','Kontaktperson tillagd',            true, 'kund'),
  ('kontaktperson_borttagen','Kontaktperson borttagen',          true, 'kund')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;

-- ── Projekt (extensión) ──────────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('kund_andrad',           'Kund ändrad på projekt',            true, 'projekt'),
  ('budget_andrad',          'Budget ändrad',                    true, 'projekt'),
  ('datum_andrade',          'Datum ändrade',                    true, 'projekt'),
  ('personal_tilldelad',     'Personal tilldelad',               true, 'projekt'),
  ('personal_avlagsnad',     'Personal borttagen',               true, 'projekt'),
  ('dokument_uppladdat',     'Dokument uppladdat',               true, 'projekt'),
  ('dokument_borttaget',     'Dokument borttaget',               true, 'projekt')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;

-- ── Förslag (extensión) ──────────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('forslag_skickat',        'Förslag skickat till kund',         true, 'forslag'),
  ('forslag_signerat',       'Förslag signerat av kund',          true, 'forslag'),
  ('forslag_avvisat',        'Förslag avvisat',                   true, 'forslag'),
  ('forslag_dupliserat',     'Förslag duplicerat',                true, 'forslag')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;

-- ── Order ────────────────────────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('order_skapad',           'Order skapad',                      true, 'order'),
  ('order_status_andrad',    'Order status ändrad',               true, 'order'),
  ('order_skickad',          'Order skickad',                     true, 'order'),
  ('order_slutford',         'Order slutförd',                    true, 'order')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;

-- ── ÄTA (extensión) ──────────────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('ata_skapad',             'ÄTA skapad',                        true, 'ata'),
  ('ata_status_andrad',      'ÄTA status ändrad',                 true, 'ata'),
  ('ata_skickad',            'ÄTA skickad till signering',        true, 'ata'),
  ('ata_avvisad',            'ÄTA avvisad',                       true, 'ata')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;

-- ── Tidplan ──────────────────────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('tidplan_fas_skapad',     'Tidplan: fas tillagd',              true, 'tidplan'),
  ('tidplan_fas_borttagen',  'Tidplan: fas borttagen',            true, 'tidplan'),
  ('tidplan_fas_andrad',     'Tidplan: fas ändrad',               true, 'tidplan'),
  ('tidplan_fas_omordnad',   'Tidplan: faser omordnade',          true, 'tidplan'),
  ('tidplan_subfas_slutford','Tidplan: uppgift slutförd',         true, 'tidplan'),
  ('tidplan_importerad',     'Tidplan importerad från förslag',   true, 'tidplan')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;

-- ── Kalender ─────────────────────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('kalender_handelse_skapad',   'Kalender: händelse skapad',     true, 'kalender'),
  ('kalender_handelse_slutford', 'Kalender: händelse slutförd',   true, 'kalender'),
  ('kalender_handelse_borttagen','Kalender: händelse borttagen',  true, 'kalender'),
  ('kalender_carry_over',         'Kalender: carry-over till nästa dag', false, 'kalender')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;

-- ── Kostnader (extensión) ────────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('arbetskostnad_lagt_till',   'Arbetskostnad: rad tillagd',     true, 'kostnader'),
  ('arbetskostnad_borttagen',   'Arbetskostnad: rad borttagen',   true, 'kostnader'),
  ('materialkostnad_lagt_till', 'Materialkostnad: rad tillagd',   true, 'kostnader'),
  ('materialkostnad_borttagen', 'Materialkostnad: rad borttagen', true, 'kostnader'),
  ('tidrapport_godkand',         'Tidrapport godkänd',            true, 'kostnader'),
  ('tidrapport_avvisad',         'Tidrapport avvisad',            true, 'kostnader')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;

-- ── Fakturering (extensión) ──────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('faktura_skickad',           'Faktura skickad',                true, 'fakturering'),
  ('faktura_betald',            'Faktura betald',                 true, 'fakturering'),
  ('faktura_forfallen',         'Faktura förfallen',              true, 'fakturering')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;

-- ── Signatur (extensión) ─────────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('signatur_skickad',          'Signatur: dokument skickat',     true, 'signatur'),
  ('signatur_paminnelse',       'Signatur: påminnelse skickad',   true, 'signatur')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;

-- ── Personal ─────────────────────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('personal_tid_registrerad', 'Personal: tid registrerad',       true, 'personal')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;

-- ── Revisor ──────────────────────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('revisor_anteckning_lagt_till','Revisor: anteckning tillagd',  true, 'revisor'),
  ('revisor_granskning_slutford', 'Revisor: granskning slutförd', true, 'revisor')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;

-- ── Workflows ────────────────────────────────────────────────────
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv, kategori) VALUES
  ('workflow_kort',            'Workflow kört på projekt',        false, 'workflow')
ON CONFLICT (handelse) DO UPDATE SET kategori = EXCLUDED.kategori;
