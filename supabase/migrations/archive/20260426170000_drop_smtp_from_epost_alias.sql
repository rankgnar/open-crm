ALTER TABLE epost_alias
  DROP COLUMN IF EXISTS smtp_host,
  DROP COLUMN IF EXISTS smtp_port,
  DROP COLUMN IF EXISTS smtp_user,
  DROP COLUMN IF EXISTS smtp_password_encrypted,
  DROP COLUMN IF EXISTS smtp_secure;
