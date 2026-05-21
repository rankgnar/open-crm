-- Toggle for auto-creating projekt_anteckningar when an employee submits a tidrapport.
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv)
VALUES ('tidrapport_inskickad', 'Auto-anteckning vid tidrapport', true)
ON CONFLICT (handelse) DO NOTHING;
