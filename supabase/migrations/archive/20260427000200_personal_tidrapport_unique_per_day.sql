-- Prevent duplicate tidrapport submissions for the same employee on the same day.
-- If a row needs to be replaced (rejected, mistake), admin deletes it in the CRM
-- and the employee can resubmit.

ALTER TABLE personal_tidrapport
  ADD CONSTRAINT personal_tidrapport_personal_datum_unique
  UNIQUE (personal_id, datum);
