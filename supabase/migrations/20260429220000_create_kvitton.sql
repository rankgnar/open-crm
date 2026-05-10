-- Kvitton — recibos físicos (compras en caja, gasolina, etc.) no recibidos por mail.
-- El admin los sube desde el CRM desktop o desde la PWA `open-crm-remote`.
-- Estado manual `att_hantera` ↔ `hanterade`. Sin envío a Fortnox aún.

CREATE TABLE IF NOT EXISTS public.kvitton (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  datum               DATE         NOT NULL,
  leverantor          TEXT         NOT NULL,
  belopp              NUMERIC(12,2) NOT NULL,
  moms                NUMERIC(12,2),
  kategori            TEXT,
  beskrivning         TEXT,
  projekt_id          UUID         REFERENCES public.projekt(id) ON DELETE SET NULL,
  status              TEXT         NOT NULL DEFAULT 'att_hantera'
                                   CHECK (status IN ('att_hantera','hanterade')),
  fil_storage_path    TEXT         NOT NULL,
  fil_namn            TEXT         NOT NULL,
  mime_type           TEXT         NOT NULL,
  storlek             BIGINT       NOT NULL,
  fortnox_voucher_id  TEXT,
  skapad_av_user_id   UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  skapad_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  uppdaterad_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kvitton_datum_idx        ON public.kvitton (datum DESC);
CREATE INDEX IF NOT EXISTS kvitton_status_idx       ON public.kvitton (status);
CREATE INDEX IF NOT EXISTS kvitton_projekt_id_idx   ON public.kvitton (projekt_id);
CREATE INDEX IF NOT EXISTS kvitton_skapad_av_idx    ON public.kvitton (skapad_av_user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.kvitton_set_uppdaterad_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.uppdaterad_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kvitton_uppdaterad_at_trigger ON public.kvitton;
CREATE TRIGGER kvitton_uppdaterad_at_trigger
  BEFORE UPDATE ON public.kvitton
  FOR EACH ROW EXECUTE FUNCTION public.kvitton_set_uppdaterad_at();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('kvitton', 'kvitton', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: solo admin (open-crm-remote). Desktop usa service_role y bypasa RLS.
ALTER TABLE public.kvitton ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kvitton_admin_all ON public.kvitton;
CREATE POLICY kvitton_admin_all ON public.kvitton
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Storage policies para el bucket kvitton (admin SELECT/INSERT/DELETE)
DROP POLICY IF EXISTS "kvitton_select_admin" ON storage.objects;
CREATE POLICY "kvitton_select_admin" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kvitton'
    AND public.is_app_admin()
  );

DROP POLICY IF EXISTS "kvitton_insert_admin" ON storage.objects;
CREATE POLICY "kvitton_insert_admin" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'kvitton'
    AND public.is_app_admin()
  );

DROP POLICY IF EXISTS "kvitton_delete_admin" ON storage.objects;
CREATE POLICY "kvitton_delete_admin" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'kvitton'
    AND public.is_app_admin()
  );
