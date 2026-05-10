-- Quick-upload från PWA: användaren tar foto och sparar utan att fylla i
-- detaljer. Alla detaljer läggs till senare från CRM. Därför gör vi
-- leverantor + belopp nullable, och datum får default = idag.

ALTER TABLE public.kvitton
  ALTER COLUMN leverantor DROP NOT NULL,
  ALTER COLUMN belopp     DROP NOT NULL,
  ALTER COLUMN datum      SET DEFAULT CURRENT_DATE;
