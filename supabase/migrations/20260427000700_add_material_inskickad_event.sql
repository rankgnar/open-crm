-- Toggle for auto-creating projekt_anteckningar + kalender task when an
-- employee submits a material request from the personal app.
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv)
VALUES ('material_inskickad', 'Auto-logg vid materialbegäran (anteckning + kalender)', true)
ON CONFLICT (handelse) DO NOTHING;
