INSERT INTO epost_mallar (namn, amne, kropp_html, kategori, system_kod, aktiv, sortering)
SELECT
  'Projekt-Single – feedback',
  'Hur kan vi bli bättre?',
  '<p>Hej {{kund_namn}},</p>
<p>Vi hoppas att ni haft en bra upplevelse med oss på {{foretag_namn}}.</p>
<p>För oss är det viktigaste att ständigt förbättra oss — och det kan vi bara göra med hjälp av er som känner oss. Din feedback, oavsett vad den handlar om, är ovärderlig för oss.</p>
<p>Det tar bara en minut:</p>
<p style="margin: 24px 0;"><a href="{{formulär_länk}}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Dela din feedback</a></p>
<p>Tack — varje svar gör oss bättre.</p>
<p>Med vänliga hälsningar,<br>{{foretag_namn}}</p>',
  'Uppföljning',
  'kund_avslut_feedback_manual',
  true,
  91
WHERE NOT EXISTS (SELECT 1 FROM epost_mallar WHERE system_kod = 'kund_avslut_feedback_manual');
