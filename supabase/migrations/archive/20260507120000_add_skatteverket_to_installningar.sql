ALTER TABLE app_installningar
  ADD COLUMN IF NOT EXISTS skatteverket_ocr_nummer text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS skatteverkets_bankgiro   text NOT NULL DEFAULT '';
