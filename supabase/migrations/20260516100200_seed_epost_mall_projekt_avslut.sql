INSERT INTO epost_mallar (namn, amne, kropp_html, kategori, system_kod, aktiv, sortering)
VALUES (
  'Projektavslut – feedback',
  'Vi beklagar att vi inte fick möjligheten – {{projekt_namn}}',
  '<p>Hej {{kund_namn}},</p>
<p>Vi förstår att ni valt att inte gå vidare med oss för <strong>{{projekt_namn}}</strong>, och vi respekterar ert beslut.</p>
<p>Det skulle hjälpa oss enormt om ni kunde ta 2 minuter och besvara några korta frågor om ert val:</p>
<p style="margin: 24px 0;"><a href="{{formulär_länk}}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Besvara formuläret</a></p>
<p>Tack på förhand,<br>{{foretag_namn}}</p>',
  'Uppföljning',
  'projekt_avslut_feedback',
  true,
  90
)
ON CONFLICT (system_kod) DO NOTHING;
