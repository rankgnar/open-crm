-- Do not return answers_json to anonymous token holders after submission.
-- The admin reads answers via the authenticated Electron app (service role).
-- Returning answers via the public RPC meant anyone with the form link could
-- re-read submitted customer data indefinitely.
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
    RETURN jsonb_build_object('status', 'besvarat');
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
