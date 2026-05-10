-- Toggle so admin can disable the auto side-effects (note + emails) when a
-- customer signs from the public link. Tidrapport pattern.
INSERT INTO aktivitetslogg_installningar (handelse, etikett, aktiv)
VALUES ('signatur_inskickad', 'Auto-logg vid kundsignatur (anteckning + e-post)', true)
ON CONFLICT (handelse) DO NOTHING;
