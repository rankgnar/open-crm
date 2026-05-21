-- Aktivera Realtime för personal_chat så att empleados-PWAn kan
-- prenumerera på INSERT istället för att polla var 15:e sekund.
-- REPLICA IDENTITY DEFAULT räcker — vi behöver bara nya rader.

ALTER PUBLICATION supabase_realtime ADD TABLE personal_chat;
