CREATE TABLE public.projekt_frageblankett (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id     uuid NOT NULL REFERENCES public.projekt(id) ON DELETE CASCADE,
  token          text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  titel          text NOT NULL DEFAULT 'Frågeformulär',
  questions_json jsonb NOT NULL DEFAULT '[]',
  answers_json   jsonb,
  status         text NOT NULL DEFAULT 'utkast'
                   CHECK (status IN ('utkast', 'skickat', 'besvarat')),
  skickat_at     timestamptz,
  besvarat_at    timestamptz,
  skapad_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_frageblankett_projekt ON public.projekt_frageblankett(projekt_id);
CREATE INDEX idx_frageblankett_token   ON public.projekt_frageblankett(token);

ALTER TABLE public.projekt_frageblankett ENABLE ROW LEVEL SECURITY;
