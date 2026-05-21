INSERT INTO epost_mallar (namn, kategori, amne, kropp_html, bilaga_typ, sortering) VALUES
  (
    'Offert-utskick',
    'Offert',
    'Offert {{offert_nummer}} — {{foretag_namn}}',
    '<p>Hej {{kund_namn}},</p>'
    || '<p>Bifogat finner du vår offert {{offert_nummer}} för projektet {{projekt_namn}}.</p>'
    || '<p>Offerten är giltig till {{offert_giltig_till}}. Tveka inte att höra av dig om du har frågor.</p>'
    || '<p>{{alias_signatur}}</p>',
    'offert_pdf',
    10
  ),
  (
    'Faktura-utskick',
    'Faktura',
    'Faktura {{faktura_nummer}} — {{foretag_namn}}',
    '<p>Hej {{kund_namn}},</p>'
    || '<p>Bifogat finner du faktura {{faktura_nummer}} avseende {{projekt_namn}}.</p>'
    || '<p>Vänligen betala enligt angivna villkor på fakturan.</p>'
    || '<p>{{alias_signatur}}</p>',
    'faktura_pdf',
    20
  ),
  (
    'Påminnelse',
    'Faktura',
    'Påminnelse: faktura {{faktura_nummer}}',
    '<p>Hej {{kund_namn}},</p>'
    || '<p>Vi vill påminna dig om faktura {{faktura_nummer}} som ännu inte är reglerad.</p>'
    || '<p>Vänligen betala snarast eller kontakta oss om något är oklart.</p>'
    || '<p>{{alias_signatur}}</p>',
    'ingen',
    30
  ),
  (
    'Tackmail',
    'Uppföljning',
    'Tack för förtroendet — {{foretag_namn}}',
    '<p>Hej {{kund_namn}},</p>'
    || '<p>Tack för ditt förtroende och för ett bra samarbete kring {{projekt_namn}}.</p>'
    || '<p>Vi hoppas att vi får möjligheten att hjälpa dig igen i framtiden.</p>'
    || '<p>{{alias_signatur}}</p>',
    'ingen',
    40
  ),
  (
    'Välkommen',
    'Välkommen',
    'Välkommen som kund hos {{foretag_namn}}',
    '<p>Hej {{kund_namn}},</p>'
    || '<p>Vi vill hälsa dig varmt välkommen som kund hos {{foretag_namn}}.</p>'
    || '<p>Du kan alltid nå oss på {{foretag_email}} eller {{foretag_telefon}}.</p>'
    || '<p>{{alias_signatur}}</p>',
    'ingen',
    50
  );
