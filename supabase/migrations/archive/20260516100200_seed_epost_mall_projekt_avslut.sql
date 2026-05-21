INSERT INTO epost_mallar (namn, amne, kropp_html, kategori, system_kod, aktiv, sortering)
SELECT
  'Projektavslut – feedback',
  'Hur kan vi bli bättre? – {{projekt_namn}}',
  '<p>Hej {{kund_namn}},</p>
<p>Vi förstår att ni valt att gå en annan väg med <strong>{{projekt_namn}}</strong>.</p>
<p>För oss på {{foretag_namn}} är det viktigaste att ständigt förbättra oss — och det kan vi bara göra med hjälp av er som känner oss. Din feedback, oavsett vad den handlar om, är ovärderlig för oss.</p>
<p>Det tar bara en minut:</p>
<p style="margin: 24px 0;"><a href="{{formulär_länk}}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Dela din feedback</a></p>
<p>Tack — varje svar gör oss bättre.</p>
<p>Med vänliga hälsningar,<br>{{foretag_namn}}</p>',
  'Uppföljning',
  'projekt_avslut_feedback',
  true,
  90
WHERE NOT EXISTS (SELECT 1 FROM epost_mallar WHERE system_kod = 'projekt_avslut_feedback');
