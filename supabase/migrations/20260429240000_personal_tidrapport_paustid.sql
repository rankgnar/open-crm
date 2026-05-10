-- Lägg till lunch/paustid i tidrapport. Värdet är minuter som ska
-- dras av från brutto-tiden mellan incheckning och utcheckning.
-- timmar-kolumnen lagras netto (efter avdrag) som tidigare så
-- HistorikPage och godkännandeflödet inte behöver ändras.

ALTER TABLE personal_tidrapport
  ADD COLUMN IF NOT EXISTS paustid_minuter INT NOT NULL DEFAULT 0
    CHECK (paustid_minuter >= 0);
