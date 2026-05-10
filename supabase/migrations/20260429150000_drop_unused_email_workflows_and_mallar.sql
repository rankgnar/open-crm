-- Limpieza: eliminar workflows email y plantillas que no están conectadas
-- a ningún consumidor real (sin trigger configurado, sin botón en UI, 0 runs).
--
-- Filosofía: mantener solo lo que se usa. Si en el futuro se necesita un envío
-- automático (faktura-utskick, offert-utskick, påminnelse, tackmail), se crea
-- entonces con el botón/workflow correspondiente acoplado.
--
-- Lo que se conserva (y se usa activamente):
--   • 4× signatur_begaran_*           — botón "Skicka för signatur"
--   • 4× signatur_bekraftelse_kund_*  — submit_signature() al firmar
--   • 4× signatur_notifikation_admin_* — submit_signature() al firmar

BEGIN;

-- ============================================================================
-- 1) Eliminar 3 workflows email (sin trigger, 0 runs históricos)
-- ============================================================================
DELETE FROM workflows
 WHERE kategori = 'epost'
   AND namn IN (
     'Skicka Offert till kund',
     'Påminnelse om Faktura',
     'Tackmail efter avslutat projekt'
   );

-- ============================================================================
-- 2) Eliminar 4 plantillas sin consumidor
-- ============================================================================
DELETE FROM epost_mallar
 WHERE system_kod IN (
   'offert_utskick_kund',
   'faktura_utskick_kund',
   'faktura_paminnelse_kund',
   'projekt_tackmail_kund'
 );

COMMIT;
