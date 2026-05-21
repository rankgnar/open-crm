-- Block form submission unless the form has been explicitly sent to a customer
-- (status = 'skickat'). Previously draft forms (status = 'utkast') could also
-- be submitted, which was unintended.
CREATE OR REPLACE FUNCTION public.submit_frageblankett(p_token text, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.projekt_frageblankett%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.projekt_frageblankett WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_row.status = 'besvarat' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_answered');
  END IF;

  IF v_row.status != 'skickat' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_available');
  END IF;

  UPDATE public.projekt_frageblankett
  SET answers_json = p_answers, status = 'besvarat', besvarat_at = now()
  WHERE token = p_token;

  RETURN jsonb_build_object('ok', true);
END;
$$;
