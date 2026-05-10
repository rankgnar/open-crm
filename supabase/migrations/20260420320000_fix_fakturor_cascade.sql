-- Fix: fakturor should cascade-delete when their projekt is deleted
ALTER TABLE fakturor DROP CONSTRAINT IF EXISTS fakturor_projekt_id_fkey;
ALTER TABLE fakturor ADD CONSTRAINT fakturor_projekt_id_fkey
  FOREIGN KEY (projekt_id) REFERENCES projekt(id) ON DELETE CASCADE;
