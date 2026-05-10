-- Update get_frageblankett to also return the project name (projekt.namn)
-- so the form app can show it in the welcome screen.

CREATE OR REPLACE FUNCTION public.get_frageblankett(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row   public.projekt_frageblankett%ROWTYPE;
  v_namn  text;
BEGIN
  SELECT * INTO v_row FROM public.projekt_frageblankett WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT namn INTO v_namn FROM public.projekt WHERE id = v_row.projekt_id;

  IF v_row.status = 'besvarat' THEN
    RETURN jsonb_build_object(
      'status',        'besvarat',
      'titel',         v_row.titel,
      'projekt_namn',  v_namn,
      'questions_json', v_row.questions_json,
      'answers_json',  v_row.answers_json
    );
  END IF;

  IF v_row.skickat_at IS NULL THEN
    UPDATE public.projekt_frageblankett
    SET skickat_at = now(), status = 'skickat'
    WHERE token = p_token;
  END IF;

  RETURN jsonb_build_object(
    'status',        'ok',
    'titel',         v_row.titel,
    'projekt_namn',  v_namn,
    'questions_json', v_row.questions_json
  );
END;
$$;
