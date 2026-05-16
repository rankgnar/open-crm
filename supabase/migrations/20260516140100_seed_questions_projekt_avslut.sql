UPDATE public.epost_mallar
SET questions_json = '[
  {"id":"q1","label":"Vad påverkade ert beslut mest?","type":"select","required":true,
   "options":["Priset passade inte oss","Vi valde en annan leverantör","Projektet är pausat tillfälligt","Vi fick ett bättre erbjudande","Annat"]},
  {"id":"q2","label":"Hur upplevde ni kontakten med oss?","type":"select","required":false,
   "options":["Mycket bra","Bra","Det gick bra","Kunde vara bättre"]},
  {"id":"q3","label":"Får vi hålla kontakt och skicka er erbjudanden i framtiden?","type":"boolean","required":true,"options":null}
]'::jsonb
WHERE system_kod = 'projekt_avslut_feedback';
