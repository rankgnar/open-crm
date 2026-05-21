ALTER TABLE kalender_events ADD COLUMN IF NOT EXISTS personal_ids text[] DEFAULT '{}';
