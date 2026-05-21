INSERT INTO aktivitetslogg_installningar VALUES
  ('forslag_status_andrad', true, 'Förslag status ändrad'),
  ('faktura_status_andrad', true, 'Faktura status ändrad')
ON CONFLICT (handelse) DO NOTHING;
