-- Link ekonomi_utfall rows created from approved tidrapporter back to the source.
-- ON DELETE CASCADE: if the tidrapport is deleted, the utfall row disappears automatically.
ALTER TABLE ekonomi_utfall
  ADD COLUMN tidrapport_id UUID REFERENCES personal_tidrapport(id) ON DELETE CASCADE;

CREATE INDEX ON ekonomi_utfall (tidrapport_id);
