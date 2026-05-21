CREATE TABLE pdf_mallar (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  typ text NOT NULL UNIQUE,
  namn text NOT NULL,
  accent_farg text NOT NULL DEFAULT '#1B3A6B',
  portada_titel text NOT NULL DEFAULT '',
  portada_undertitel text NOT NULL DEFAULT '',
  visa_portada boolean NOT NULL DEFAULT true,
  visa_sammanfattning boolean NOT NULL DEFAULT true,
  visa_schema boolean NOT NULL DEFAULT true,
  visa_tidplan boolean NOT NULL DEFAULT false,
  visa_arbetskostnad boolean NOT NULL DEFAULT true,
  visa_materialkostnad boolean NOT NULL DEFAULT true,
  visa_godkand_f_skatt boolean NOT NULL DEFAULT true,
  skapad_at timestamptz NOT NULL DEFAULT now(),
  uppdaterad_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO pdf_mallar (typ, namn, portada_titel, portada_undertitel) VALUES
  ('forslag', 'Förslag', 'FÖRSLAG', 'Sammanställning av arbete och material'),
  ('kunder-lista', 'Kundlista', 'KUNDLISTA', 'Sammanställning av alla kunder'),
  ('projekt-lista', 'Projektlista', 'PROJEKTLISTA', 'Sammanställning av alla projekt'),
  ('projekt', 'Projekt', 'PROJEKT', 'Projektöversikt och tidplan');
