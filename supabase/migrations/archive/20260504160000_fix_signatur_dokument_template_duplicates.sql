-- Fix duplicate title rendering in signatur templates for the 'dokument' type.
--
-- The helper buildDokumentTitelBlock() produces " — <title>" and is meant to
-- append the human title after the document number on begäran emails. For
-- forslag/order/ata it works because the main reference is a number
-- ({{forslag_nummer}}, {{order_nummer}}, {{ata_nummer}}) and the block adds
-- the optional title. For 'dokument' the main reference is already the
-- title, so the block duplicates it:
--   "Vi har förberett dokumentet RANKGNAR — RANKGNAR"
--
-- Same shape in the admin notification template: the structured table had
-- "Dokument: Dokument <title>" and "Titel: <title>", duplicating the title
-- only for the dokument type. Other types ship "Dokument: Offert OFF-001"
-- + "Titel: <title>" — distinct values.

BEGIN;

-- 1) Begäran om signering (kund-facing) — drop redundant {{dokument_titel_block}}
UPDATE epost_mallar
   SET kropp_html    = REPLACE(
         kropp_html,
         '<strong>{{dokument_titel}}</strong>{{dokument_titel_block}}',
         '<strong>{{dokument_titel}}</strong>'
       ),
       uppdaterad_at = now()
 WHERE system_kod = 'signatur_begaran_dokument';

-- 2) Notifikation till admin (signerat) — drop the redundant title from the
--    "Dokument" row so the structure matches forslag/order/ata where that
--    row carries the typ + nummer and "Titel" carries the title separately.
UPDATE epost_mallar
   SET kropp_html    = REPLACE(
         kropp_html,
         'Dokument <strong>{{titel}}</strong>',
         'Dokument'
       ),
       uppdaterad_at = now()
 WHERE system_kod = 'signatur_notifikation_admin_dokument';

COMMIT;
