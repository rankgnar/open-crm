-- Trace ekonomi_utfall rows back to the Fortnox supplier invoice they were created from.
-- UNIQUE prevents the same supplier invoice from being imported twice.
ALTER TABLE ekonomi_utfall
  ADD COLUMN fortnox_givennumber INTEGER UNIQUE;

CREATE INDEX ON ekonomi_utfall (fortnox_givennumber);
