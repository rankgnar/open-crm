-- Fix: Granska och komplettera förslag — quality of analysis
-- Adds matt_och_mangder + arbetskostnad_urval context nodes,
-- rewrites the AI prompt to require real quantities/prices,
-- and hardens the assistant system prompt with unit mapping rules.

DO $$
DECLARE
  v_assistent uuid;
  v_workflow  uuid;
  v_sys_prompt text;
  v_prompt    text;
BEGIN
  SELECT id INTO v_assistent FROM ai_asistenter WHERE namn = 'Förslag-kompletterare';
  IF v_assistent IS NULL THEN
    RAISE EXCEPTION 'Assistent "Förslag-kompletterare" hittades inte.';
  END IF;

  SELECT id INTO v_workflow FROM workflows WHERE namn = 'Granska och komplettera förslag';
  IF v_workflow IS NULL THEN
    RAISE EXCEPTION 'Workflow "Granska och komplettera förslag" hittades inte.';
  END IF;

  -- ── Hardened system prompt ────────────────────────────────────────────────
  v_sys_prompt := $SYS$Du är en erfaren svensk byggkalkylator. Du granskar befintliga förslag och identifierar material och arbete som tydligt saknas. Du returnerar alltid ren JSON utan kodblock eller förklaringar.

═══════════════════════════════════════════════════════════════
ENHET — OBLIGATORISK MAPPNING EFTER MATERIALETS ART
═══════════════════════════════════════════════════════════════
Använd ENDAST dessa enheter:

m²    → Skiv- och plattmaterial: gipsskiva, OSB, plywood, trallvirke (yta), kakel, klinker,
        parkett, plastmatta, våtrumsskiva, isoleringsskiva, ogräsmatta
m     → Längdmaterial: kabel (alla typer), rör (PEX, PVC, HT, koppar), läkt, regel,
        list, sockel, fotlist, taklist, profil, slang, panel (lpm)
m³    → Volymmaterial: betong, jord, grus, sten
kg    → Bulk i kg: spackel, primer, fix, fogmassa, skruv (när säljs per kg-säck)
liter → Vätska i liter: färg, primer, lim, impregnering (när säljs per liter)
säck  → Cement, bruk, fix, spackel i 15–25 kg säck
burk  → Färg, primer, lim, fogmassa i hink (typ 3–15 L)
pat   → Patron 300 ml: silikon, fogmassa, monteringslim
rulle → Bandage, tätskiktsväv, tejp, plast, takpapp
pkt   → Småförpackning: skruv, spik, dyckert, brickor (oftast 100–500 st)
st    → Enhetsvaror: blandare, WC-stol, dörr, fönster, spegel, lampa, brunn, handtag,
        spotlight, betongkantstenarna räknas individuellt, enstaka detaljer

ALDRIG använd: "kr", "kr/m²", "förp", eller "st" för material som säljs per yta/längd.

═══════════════════════════════════════════════════════════════
KOHERENSREGLER — KONTROLLERA VARJE RAD INNAN DU RETURNERAR
═══════════════════════════════════════════════════════════════
1. Är ENHET rätt enligt mappningen? (trallvirke = m², inte st)
2. Är ANTAL en realistisk siffra i denna enhet?
3. Är A_PRIS rimligt PER ENHET i svensk byggmarknad 2024?
4. ANTAL × A_PRIS = rimlig totalkostnad för raden?
5. Sanity-tak: ett enskilt material > 30 000 kr utan tydlig motivering är troligen fel.

═══════════════════════════════════════════════════════════════
KVANTITETER
═══════════════════════════════════════════════════════════════
Om MÅTT OCH MÄNGDER finns i prompten: använd de siffrorna direkt — räkna inte om.
Om de saknas: uppskatta från scope (yta, längd, antal) och ange motivering i kommentar.
Sätt ALDRIG antal=1, enhet="st" som placeholder — varje rad ska vara genomtänkt.
A_PRIS ska alltid vara > 0 — uppskatta ett rimligt marknadspris om du inte vet exakt.$SYS$;

  -- ── Improved prompt template ──────────────────────────────────────────────
  v_prompt := $TMPL$PROJEKT: {{namn}}
KUND: {{kunder.namn}}

SCOPE-ANALYS:
{{scope_analys}}

DOKUMENTANALYS:
{{dokument_analys}}

MÅTT OCH MÄNGDER (förberäknade mått — om tillgängliga, använd dessa siffror direkt för antal):
{{matt_och_mangder}}

ARBETSESTIMAT (referens — visar vad som ska utföras per subfas):
{{arbetskostnad_urval}}

FÖRSLAG NULÄGE — dessa poster FINNS REDAN, lägg INTE till dem igen:
{{forslag_komplett_text}}

UPPGIFT: Identifiera material och arbete som TYDLIGT SAKNAS i förslaget givet scope och mått.

Regler:
- Om MÅTT OCH MÄNGDER finns: använd de siffrorna direkt för antal — räkna inte om
- Om mått saknas: uppskatta antal från scope (t.ex. 22 kvm altan → trallvirke 22 m², etc.)
- Ange ALLTID realistisk enhet enligt enhetsmappningen i din systemprompt
- Ange ett rimligt a_pris baserat på svensk byggmarknad 2024 — 0 kr är inte acceptabelt
- MAX 10 poster totalt
- Om ingenting saknas → returnera "additions": [], "antal_tillagger": 0

Returnera ENBART ett JSON-objekt (ingen text utanför JSON):
{
  "additions": [
    {
      "fas": "exakt fasnamn (befintligt eller nytt)",
      "subfas": "exakt subfasnamn (befintligt eller nytt)",
      "typ": "material",
      "beskrivning": "produktnamn + dimension/typ, max 60 tecken",
      "enhet": "m²",
      "antal": 22.0,
      "a_pris": 320,
      "leverantor": ""
    },
    {
      "fas": "exakt fasnamn",
      "subfas": "exakt subfasnamn",
      "typ": "arbete",
      "yrkesroll": "Snickare",
      "antal_timmar": 8,
      "beskrivning": "kort beskrivning av arbetet, max 60 tecken"
    }
  ],
  "kommentar": "vad som lades till och varför, max 200 tecken",
  "antal_tillagger": 0
}$TMPL$;

  -- ── 1. Update assistant ───────────────────────────────────────────────────
  UPDATE ai_asistenter
  SET
    system_prompt = v_sys_prompt,
    max_tokens    = 5000
  WHERE id = v_assistent;

  -- ── 2. Update workflow definition (8 nodes) ───────────────────────────────
  UPDATE workflows
  SET definition = jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id','n_projekt', 'type','data:projekt',          'label','Projektdata',            'config','{}' ::jsonb,                                                                     'position',0),
      jsonb_build_object('id','n_scope',   'type','data:context',          'label','Scope-analys',            'config','{"nyckel":"scope_analys","optional":true}'::jsonb,                              'position',1),
      jsonb_build_object('id','n_dok',     'type','data:context',          'label','Dokumentanalys',          'config','{"nyckel":"dokument_analys","optional":true}'::jsonb,                           'position',2),
      jsonb_build_object('id','n_matt',    'type','data:context',          'label','Mått och mängder',        'config','{"nyckel":"matt_och_mangder","optional":true}'::jsonb,                          'position',3),
      jsonb_build_object('id','n_arbete',  'type','data:context',          'label','Arbetsestimat',           'config','{"nyckel":"arbetskostnad_urval","optional":true}'::jsonb,                       'position',4),
      jsonb_build_object('id','n_forslag', 'type','data:forslag-komplett', 'label','Förslag nuläge',          'config','{}' ::jsonb,                                                                     'position',5),
      jsonb_build_object('id','n_ai',      'type','ai:generate',           'label','Identifiera saknade poster','config', jsonb_build_object('assistent_id',v_assistent::text,'prompt_template',v_prompt),'position',6),
      jsonb_build_object('id','n_add',     'type','action:add-missing-to-forslag','label','Lägg till saknade poster','config','{}' ::jsonb,                                                              'position',7)
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('from','n_projekt','to','n_scope'),
      jsonb_build_object('from','n_scope',  'to','n_dok'),
      jsonb_build_object('from','n_dok',    'to','n_matt'),
      jsonb_build_object('from','n_matt',   'to','n_arbete'),
      jsonb_build_object('from','n_arbete', 'to','n_forslag'),
      jsonb_build_object('from','n_forslag','to','n_ai'),
      jsonb_build_object('from','n_ai',     'to','n_add')
    )
  )
  WHERE id = v_workflow;

END $$;
