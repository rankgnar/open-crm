-- Switch the PDF-import workflow from PDF-blob analysis (Anthropic-only)
-- to plain text extraction (works with any provider, including OpenAI/
-- OpenRouter which the test setup uses).
--
-- The original workflow piped the PDF as a binary attachment to
-- ai:analyze-pdf. That path is gated to Anthropic's document API in
-- executeChatWithFiles — for OpenAI/OpenRouter the PDF is silently
-- dropped and the model is told "PDF-analys stöds inte". So the model
-- correctly reported it couldn't process the PDF.
--
-- New flow: data:projekt:dokument-text uses pdfjs-dist in the main
-- process to extract plain text, then ai:generate sends it as a regular
-- chat message via the new prompt_template. action:save-context now
-- persists the AI's parsed JSON (ai_raw) under the same key
-- 'importerad_pdf_struktur' as before.
--
-- Touches only the workflow seeded by 20260504170000. No other workflow
-- or assistent is modified.

DO $$
DECLARE
  v_assistent uuid;
BEGIN
  SELECT id INTO v_assistent FROM ai_asistenter WHERE namn = 'PDF-import-extraktor';
  IF v_assistent IS NULL THEN
    RAISE EXCEPTION 'PDF-import-extraktor saknas — kan inte uppdatera workflow.';
  END IF;

  UPDATE workflows
  SET definition = jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object(
        'id', 'd1',
        'type', 'data:projekt',
        'label', 'Projektdata',
        'config', '{}'::jsonb,
        'position', 0
      ),
      jsonb_build_object(
        'id', 'd2',
        'type', 'data:projekt:dokument-text',
        'label', 'Extrahera PDF-text',
        'config', '{}'::jsonb,
        'position', 1
      ),
      jsonb_build_object(
        'id', 'a1',
        'type', 'ai:generate',
        'label', 'AI — Strukturera offerten',
        'config', jsonb_build_object(
          'assistent_id', v_assistent::text,
          'prompt_template', E'Här följer text extraherad från ett offert-PDF. Strukturera den enligt schemat i din systeminstruktion. Returnera ENBART JSON.\n\n{{pdf_text}}'
        ),
        'position', 2
      ),
      jsonb_build_object(
        'id', 's1',
        'type', 'action:save-context',
        'label', 'Spara extraherad struktur',
        'config', jsonb_build_object(
          'nyckel', 'importerad_pdf_struktur',
          'source_key', 'ai_raw'
        ),
        'position', 3
      ),
      jsonb_build_object(
        'id', 'a2',
        'type', 'action:import-forslag-from-extraction',
        'label', 'Skapa förslag + tidplan',
        'config', '{}'::jsonb,
        'position', 4
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from', 'd1', 'to', 'd2'),
      jsonb_build_object('from', 'd2', 'to', 'a1'),
      jsonb_build_object('from', 'a1', 'to', 's1'),
      jsonb_build_object('from', 's1', 'to', 'a2')
    )
  ),
  uppdaterad_at = now()
  WHERE namn = 'Importera förslag från PDF';
END $$;
