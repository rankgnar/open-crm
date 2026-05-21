UPDATE epost_mallar
SET kropp_html = replace(kropp_html, 'Öppna och signera offert', 'Öppna uppdaterad offert')
WHERE system_kod = 'signatur_uppdaterad_version_kund_forslag';
