DROP TRIGGER IF EXISTS protect_inbyggd_kund_statusar ON public.kund_statusar;
DROP TABLE IF EXISTS public.kund_statusar;
ALTER TABLE public.kunder DROP COLUMN IF EXISTS status;
ALTER TABLE IF EXISTS public.app_config DROP COLUMN IF EXISTS kund_std_status;
