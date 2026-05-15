UPDATE epost_mallar
SET meddelande_standard = 'Hej {{kund_namn}}! Vi ville bara höra om du fått chansen att titta på offerten vi skickade. Hör gärna av dig om du har frågor eller funderingar. Vi hjälper gärna till! 😊'
WHERE system_kod = 'signatur_paminnelse_forslag'
  AND meddelande_standard IS NULL;
