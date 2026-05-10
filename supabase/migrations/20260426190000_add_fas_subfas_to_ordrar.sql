-- Order kan kopplas till en specifik fas (och valfritt en subfas) i projektets förslag.
-- Mönster lika kalender_events.fas_id — ON DELETE SET NULL för att inte förlora order
-- om fasen tas bort senare.

ALTER TABLE ordrar
  ADD COLUMN fas_id    uuid REFERENCES forslag_faser(id)    ON DELETE SET NULL,
  ADD COLUMN subfas_id uuid REFERENCES forslag_subfaser(id) ON DELETE SET NULL;

CREATE INDEX idx_ordrar_fas_id    ON ordrar(fas_id);
CREATE INDEX idx_ordrar_subfas_id ON ordrar(subfas_id);
