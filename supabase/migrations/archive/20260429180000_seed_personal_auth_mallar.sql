-- Mallar för app-åtkomst (open-crm-app, anställdas PWA):
--   • personal_valkommen           — inbjudan att skapa lösenord
--   • personal_losenord_aterstall  — återställ lösenord
--
-- Båda mallar konsumerar variabeln {{action_link}} som genereras runtime av
-- main-processen via supabase.auth.admin.generateLink({ type: 'invite' | 'recovery' }).
--
-- Designen följer samma mönster som de övriga 16 mallarna:
--   gradient-bar #5363f2, knapp #10b981, system-ui font, 600px max width.

BEGIN;

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'personal_valkommen',
  'Personal — Välkomstinbjudan (skapa lösenord)',
  'Personal',
  'Välkommen till {{foretag_namn}} — skapa ditt lösenord',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">App-åtkomst</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">Välkommen till {{foretag_namn}}</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{personal_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Du har fått åtkomst till <strong>{{foretag_namn}}</strong>s personalapp. Klicka på knappen nedan för att skapa ditt lösenord och logga in.</p>
  <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="{{action_link}}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Skapa lösenord</a></td></tr></tbody></table>
  <p style="font-size:14px;color:#666;margin:0 0 14px">Länken är giltig i <strong style="color:#5363f2">24 timmar</strong>. Använd e-postadressen <strong>{{personal_email}}</strong> för att logga in.</p>
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Har du frågor? Svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  90,
  true
);

INSERT INTO epost_mallar (system_kod, namn, kategori, amne, kropp_html, sortering, aktiv)
VALUES (
  'personal_losenord_aterstall',
  'Personal — Återställ lösenord',
  'Personal',
  'Återställ ditt lösenord — {{foretag_namn}}',
  $mall$<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,Cantarell,'Noto Sans',sans-serif;max-width:600px;color:#1a1a1a;line-height:1.6">
  <div style="height:3px;background:linear-gradient(90deg,#5363f2 35%,#e5e5e5 35%);margin-bottom:28px"></div>
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;font-weight:600">Lösenordsåterställning</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;line-height:1.3">Återställ ditt lösenord</h1>
  <p style="font-size:15px;margin:0 0 14px">Hej {{personal_namn}},</p>
  <p style="font-size:15px;margin:0 0 14px">Vi har tagit emot en begäran om att återställa lösenordet för ditt konto i <strong>{{foretag_namn}}</strong>s personalapp. Klicka på knappen nedan för att välja ett nytt lösenord.</p>
  <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="{{action_link}}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Återställ lösenord</a></td></tr></tbody></table>
  <p style="font-size:14px;color:#666;margin:0 0 14px">Länken är giltig i <strong style="color:#5363f2">1 timme</strong>. Om du inte begärde detta kan du bortse från detta mail — ditt lösenord ändras inte förrän du klickar på länken.</p>
  <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:20px;border-top:1px solid #eaeaea">Har du frågor? Svara direkt på detta mail.</p>
</div>
<div style="margin-top:32px">{{alias_signatur}}</div>$mall$,
  91,
  true
);

COMMIT;
