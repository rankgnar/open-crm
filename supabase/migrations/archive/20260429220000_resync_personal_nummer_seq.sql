-- Resync personal_nummer_seq with the actual MAX(personal_nummer) in the table.
-- The previous flow called peek_personal_nummer (read-only) and then inserted
-- with that value, leaving the sequence behind the actual max → next real
-- nextval() collides with an existing row.
SELECT setval(
  'personal_nummer_seq',
  GREATEST(
    (SELECT COALESCE(MAX((SUBSTRING(personal_nummer FROM 'EMP-(\d+)'))::int), 0) FROM personal),
    1
  )
);
