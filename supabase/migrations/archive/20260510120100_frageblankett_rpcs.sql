CREATE OR REPLACE FUNCTION public.get_frageblankett(p_token text)
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
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_row.status = 'besvarat' THEN
    RETURN jsonb_build_object(
      'status', 'besvarat',
      'titel', v_row.titel,
      'questions_json', v_row.questions_json,
      'answers_json', v_row.answers_json
    );
  END IF;

  -- Mark as sent on first open
  IF v_row.skickat_at IS NULL THEN
    UPDATE public.projekt_frageblankett
    SET skickat_at = now(), status = 'skickat'
    WHERE token = p_token;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'titel', v_row.titel,
    'questions_json', v_row.questions_json
  );
END;
$$;

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

  UPDATE public.projekt_frageblankett
  SET answers_json = p_answers, status = 'besvarat', besvarat_at = now()
  WHERE token = p_token;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_frageblankett(text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_frageblankett(text, jsonb) TO anon, authenticated;
