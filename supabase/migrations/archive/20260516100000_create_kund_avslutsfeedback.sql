CREATE TABLE kund_avslutsfeedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kund_id uuid NOT NULL REFERENCES kunder(id) ON DELETE CASCADE,
  projekt_namn text NOT NULL,
  token text UNIQUE NOT NULL,
  questions_json jsonb NOT NULL,
  answers_json jsonb,
  status text NOT NULL DEFAULT 'skickat' CHECK (status IN ('skickat', 'besvarat')),
  skickat_at timestamptz DEFAULT now(),
  besvarat_at timestamptz,
  skapad_at timestamptz DEFAULT now()
);

CREATE INDEX idx_kund_avslutsfeedback_kund ON kund_avslutsfeedback(kund_id);

-- Public RPC: read form by token
CREATE OR REPLACE FUNCTION get_avslutsfeedback(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r kund_avslutsfeedback%ROWTYPE;
BEGIN
  SELECT * INTO r FROM kund_avslutsfeedback WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF r.status = 'besvarat' THEN
    RETURN jsonb_build_object('status', 'besvarat', 'answers_json', r.answers_json, 'questions_json', r.questions_json, 'projekt_namn', r.projekt_namn);
  END IF;
  RETURN jsonb_build_object('status', 'ok', 'questions_json', r.questions_json, 'projekt_namn', r.projekt_namn);
END;
$$;
GRANT EXECUTE ON FUNCTION get_avslutsfeedback(text) TO anon;

-- Public RPC: submit answers
CREATE OR REPLACE FUNCTION submit_avslutsfeedback(p_token text, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE kund_avslutsfeedback
  SET answers_json = p_answers, status = 'besvarat', besvarat_at = now()
  WHERE token = p_token AND status = 'skickat';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_answered');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_avslutsfeedback(text, jsonb) TO anon;
