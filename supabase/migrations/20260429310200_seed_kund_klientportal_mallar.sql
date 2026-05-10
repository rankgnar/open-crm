-- E-postmallar för klientportalen (open-crm-client):
--   • kund_klientportal_valkommen           — inbjudan att skapa lösenord
--   • kund_klientportal_losenord_aterstall  — återställ lösenord
--
-- Båda mallar konsumerar variabeln {{action_link}} som genereras
-- runtime av main-processen via supabase.auth.admin.generateLink({
-- type: 'invite' | 'recovery' }), parallellt med personal-mallarna.

BEGIN;

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'kund_klientportal_valkommen',
  'Kund — Välkomstinbjudan klientportal (skapa lösenord)',
  'Kund',
  'Välkommen till {{foretag_namn}}s klientportal — skapa ditt lösenord',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Klientportal</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">Välkommen till {{foretag_namn}}</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Du har fått åtkomst till <strong>{{foretag_namn}}</strong>s klientportal. Där kan du följa dina projekt, läsa signerade dokument och få översikt över dina filer och bilder.</p>
  <p style="font-size:15px;margin:0 0 14px">Klicka på knappen nedan för att skapa ditt lösenord och logga in.</p>
  <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="{{action_link}}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Skapa lösenord</a></td></tr></tbody></table>
  <p style="font-size:14px;color:#666;margin:0 0 14px">Länken är giltig i <strong style="color:#5363f2">24 timmar</strong>. Använd e-postadressen <strong>{{kund_email}}</strong> för att logga in.</p>
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Har du frågor? Svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  92,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'kund_klientportal_losenord_aterstall',
  'Kund — Återställ lösenord klientportal',
  'Kund',
  'Återställ ditt lösenord — {{foretag_namn}}s klientportal',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Lösenordsåterställning</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">Återställ ditt lösenord</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{kund_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Vi har tagit emot en begäran om att återställa lösenordet för ditt konto i <strong>{{foretag_namn}}</strong>s klientportal. Klicka på knappen nedan för att välja ett nytt lösenord.</p>
  <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="{{action_link}}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Återställ lösenord</a></td></tr></tbody></table>
  <p style="font-size:14px;color:#666;margin:0 0 14px">Länken är giltig i <strong style="color:#5363f2">1 timme</strong>. Om du inte begärde detta kan du bortse från detta mail — ditt lösenord ändras inte förrän du klickar på länken.</p>
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Har du frågor? Svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  93,
  true
);

COMMIT;
