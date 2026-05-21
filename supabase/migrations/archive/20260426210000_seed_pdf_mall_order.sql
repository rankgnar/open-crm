-- PDF-mall för Order (ÄTA — ändringsorder).
-- ON CONFLICT DO NOTHING så migrationen är idempotent.

INSERT INTO pdf_mallar (typ, namn, portada_titel, portada_undertitel, accent_farg, visa_portada, visa_villkor, visa_godkand_f_skatt)
VALUES ('order', 'Order', 'ORDER', 'Tilläggsarbete utanför projektets ursprungliga budget', '#1B3A6B', true, false, true)
ON CONFLICT (typ) DO NOTHING;
