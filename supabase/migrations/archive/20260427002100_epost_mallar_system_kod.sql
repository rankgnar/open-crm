-- Allow specific mallar to be referenced by stable code from server-side
-- automations (e.g. submit_signature uses 'signatur_bekraftelse_kund').
-- The admin still freely edits subject, body and alias from the UI.

ALTER TABLE epost_mallar
  ADD COLUMN IF NOT EXISTS system_kod TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_epost_mallar_system_kod
  ON epost_mallar(system_kod) WHERE system_kod IS NOT NULL;

-- Tag the existing 'Signaturbegäran' mall (seeded earlier) so the admin's
-- modal still picks it up via system_kod even after rename.
UPDATE epost_mallar
   SET system_kod = 'signatur_begaran'
 WHERE namn = 'Signaturbegäran' AND system_kod IS NULL;

-- Seed two new system-mallar — only if they don't exist yet.
INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering)
SELECT
  'signatur_bekraftelse_kund',
  'Signatur — bekräftelse till kund',
  'Signatur',
  'Bekräftelse: signerad {{doc_typ_label}} {{doc_nummer}}',
  '<p>Hej {{kund_namn}},</p>'
  || '<p>Tack! Din signering av {{doc_typ_label_def}} <strong>{{doc_nummer}}</strong> har registrerats kl {{datum}}.</p>'
  || '{{pdf_button}}'
  || '<p>Med vänlig hälsning,<br>{{foretag_namn}}</p>'
  || '{{alias_signatur}}',
  31
WHERE NOT EXISTS (SELECT 1 FROM epost_mallar WHERE system_kod = 'signatur_bekraftelse_kund');

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering)
SELECT
  'signatur_bekraftelse_admin',
  'Signatur — notis till admin',
  'Signatur',
  'Kund signerade {{doc_typ_label}} {{doc_nummer}}',
  '<p><strong>{{namn}}</strong> ({{kund_email}}) signerade {{doc_typ_label_def}} <strong>{{doc_nummer}}</strong> — {{titel}}.</p>'
  || '<p>Tid: {{datum}} · IP: {{ip}}</p>'
  || '{{pdf_admin_line}}',
  32
WHERE NOT EXISTS (SELECT 1 FROM epost_mallar WHERE system_kod = 'signatur_bekraftelse_admin');
