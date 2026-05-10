-- Order-PDF har ingen portada — uppdaterar befintlig rad så att flaggan är i synk
-- med den nya plantilan (där cover-blocket är borttaget helt).

UPDATE pdf_mallar
   SET visa_portada = false,
       portada_titel = '',
       portada_undertitel = ''
 WHERE typ = 'order';
