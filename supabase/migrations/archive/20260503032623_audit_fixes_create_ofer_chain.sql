-- CREATE-OFER chain audit fixes (2026-05-03).
-- See pending/2026-05-03_workflows_audit_create_ofer.md for the full audit report.
--
-- Goals:
--   1. Stop the AI from writing paragraphs in `beskrivning` / `motivering` fields
--      (P-0133 baseline: arbete avg 165 chars max 269; material avg 86 max 131).
--   2. Make Materialbehovsestimator and Mattkalkylator domain-agnostic so they
--      work for any project type, not just badrum.
--   3. Forbid WF6 from inventing materials when MATT OCH MANGDER is missing.
--   4. Cap WF3 fas/subfas selection so it cannot over-select.
--   5. Add skip_if_empty=['matt_och_mangder'] on WF5 + WF6 to abort if WF3b never ran.
--   6. Drop unused fields from WF5/WF6 schemas (kommentar, osakerhet) - they are
--      never rendered in the PDF (see src/renderer/src/pdf/buildForslagDesglose.ts).

-- ---------------------------------------------------------------------------
-- Helper: replace the prompt_template of a specific node id within a workflow
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.set_node_prompt(
  p_workflow_namn text,
  p_node_id       text,
  p_new_prompt    text
) RETURNS void AS $$
DECLARE
  v_def   jsonb;
  v_idx   int;
BEGIN
  SELECT definition INTO v_def FROM workflows WHERE namn = p_workflow_namn;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Workflow "%" not found', p_workflow_namn;
  END IF;

  SELECT (i - 1)::int INTO v_idx
  FROM jsonb_array_elements(v_def->'nodes') WITH ORDINALITY AS t(node, i)
  WHERE node->>'id' = p_node_id;

  IF v_idx IS NULL THEN
    RAISE EXCEPTION 'Node id "%" not found in workflow "%"', p_node_id, p_workflow_namn;
  END IF;

  UPDATE workflows
  SET definition = jsonb_set(
        v_def,
        ARRAY['nodes', v_idx::text, 'config', 'prompt_template'],
        to_jsonb(p_new_prompt),
        true
      ),
      uppdaterad_at = now()
  WHERE namn = p_workflow_namn;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Helper: set arbitrary keys inside a node's config (used for skip_if_empty)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.merge_node_config(
  p_workflow_namn text,
  p_node_id       text,
  p_config_patch  jsonb
) RETURNS void AS $$
DECLARE
  v_def      jsonb;
  v_idx      int;
  v_old_cfg  jsonb;
BEGIN
  SELECT definition INTO v_def FROM workflows WHERE namn = p_workflow_namn;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Workflow "%" not found', p_workflow_namn;
  END IF;

  SELECT (i - 1)::int, node->'config' INTO v_idx, v_old_cfg
  FROM jsonb_array_elements(v_def->'nodes') WITH ORDINALITY AS t(node, i)
  WHERE node->>'id' = p_node_id;

  IF v_idx IS NULL THEN
    RAISE EXCEPTION 'Node id "%" not found in workflow "%"', p_node_id, p_workflow_namn;
  END IF;

  UPDATE workflows
  SET definition = jsonb_set(
        v_def,
        ARRAY['nodes', v_idx::text, 'config'],
        COALESCE(v_old_cfg, '{}'::jsonb) || p_config_patch,
        true
      ),
      uppdaterad_at = now()
  WHERE namn = p_workflow_namn;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- (a) WF3 user_prompt: cap faser/subfaser count
-- ---------------------------------------------------------------------------
SELECT pg_temp.set_node_prompt(
  '3-Identifiera projekttyp och faser',
  'g1',
$$PROJEKT: {{namn}}
KUND: {{kunder.namn}}

SCOPE-ANALYS:
{{scope_analys}}

DOKUMENTANALYS:
{{dokument_analys}}

TILLGÄNGLIGA FAS-MALLAR:
{{fas_text}}

REGEL: MAX 6 faser. MAX 4 subfaser per fas. Välj ENBART det som scope direkt kräver. Inga "för säkerhets skull"-faser och inga subfaser som överlappar i syfte.

Baserat på ovanstående, analysera projektet och returnera ENBART ett JSON-objekt (ingen text utanför JSON) med följande struktur:
{
  "projekt_typ": "kort beskrivning av projekttypen",
  "vald_mall": "namn på den fas-mall som passar bäst, eller null om ingen passar",
  "valda_faser": ["fasnamn1", "fasnamn2"],
  "valda_subfaser": [
    { "fas": "fasnamn", "subfaser": ["subfasnamn1", "subfasnamn2"] }
  ],
  "saknade_faser": ["beskrivning av fas som behövs men saknas i systemet"],
  "saknar_mall": true/false,
  "motivering": "kort förklaring (max 200 tecken) av varför dessa faser valdes"
}$$
);

-- ---------------------------------------------------------------------------
-- (c) WF5 user_prompt: drop unused fields, cap beskrivning length
-- ---------------------------------------------------------------------------
SELECT pg_temp.set_node_prompt(
  '5-Estimera arbetskostnad',
  'g1',
$$PROJEKT: {{namn}}
KUND: {{kunder.namn}}

SCOPE-ANALYS:
{{scope_analys}}

DOKUMENTANALYS:
{{dokument_analys}}

VALDA FASER OCH SUBFASER:
{{projekt_faser_urval}}

MÅTT OCH MÄNGDER (förberäknade — använd dessa siffror direkt, räkna inte om):
{{matt_och_mangder}}

TILLGÄNGLIGA YRKESROLLER:
{{yrkesroller_text}}

Estimera arbetskostnaden för varje subfas i projektet. Returnera ENBART ett JSON-objekt (ingen text utanför JSON):
{
  "estimat": [
    {
      "fas": "exakt fasnamn från fas-urvalet",
      "subfas": "exakt subfasnamn från fas-urvalet",
      "yrkesroll": "exakt namn från yrkesrollslistan ovan",
      "antal_timmar": 8,
      "beskrivning": "max 50 tecken: yrkesroll-uppgift kort"
    }
  ],
  "total_timmar": 0
}

VIKTIGT:
- Använd ENBART yrkesroller exakt som de stavas i listan ovan.
- Om en subfas kräver flera yrkesroller, skapa en rad per yrkesroll.
- Använd MÅTT OCH MÄNGDER ovan som grund för åtgång — räkna inte om m², m, antal.
- Estimera realistiskt för ett professionellt byggföretag i Sverige.
- BESKRIVNING: max 50 tecken. Kort. T.ex. "Snickare montering läkt" eller "Målare grundolja". INGA meningar.$$
);

-- ---------------------------------------------------------------------------
-- (d) WF6 user_prompt: cap lengths, forbid invention
-- ---------------------------------------------------------------------------
SELECT pg_temp.set_node_prompt(
  '6-Estimera materialbehov',
  'g1',
$$PROJEKT: {{namn}}
KUND: {{kunder.namn}}

SCOPE-ANALYS:
{{scope_analys}}

DOKUMENTANALYS (mått och specifikationer):
{{dokument_analys}}

VALDA FASER OCH SUBFASER:
{{projekt_faser_urval}}

MÅTT OCH MÄNGDER (förberäknade — alla ytor, längder, antal och åtgång är redan uträknade):
{{matt_och_mangder}}

ARBETSESTIMAT (referens):
{{arbetskostnad_urval}}

Skapa en konkret materialinköpslista för varje subfas. Returnera ENBART ett JSON-objekt (ingen text utanför JSON):
{
  "material": [
    {
      "fas": "exakt fasnamn från fas-urvalet",
      "subfas": "exakt subfasnamn från fas-urvalet",
      "beskrivning": "max 60 tecken: produktnamn + dimension/typ",
      "enhet": "m²/m/m³/kg/liter/säck/burk/pat/rulle/set/pkt/st",
      "antal": 18.5,
      "sokterm": "precis sökterm för materialkatalog (produkttyp + dimension)",
      "motivering": "max 40 tecken: KORT formel, inga meningar"
    }
  ],
  "total_material_poster": 0,
  "material_saknas": ["lista över material som scope kräver men som inte finns i MÅTT OCH MÄNGDER"]
}

VIKTIGT:
- ANTAL och ENHET kommer DIREKT från MÅTT OCH MÄNGDER ovan. Räkna INTE om.
- Din uppgift är att VÄLJA produkt och beskrivning, inte att räkna.
- Sokterm: produkttyp + dimension (t.ex. "Gipsskiva 13mm", "Träpanel 28x120 furu").
- Skapa en rad per subfas där materialet behövs.
- BESKRIVNING: max 60 tecken. Kort. T.ex. "Träpanel 28x120 furu grundmålad" eller "PEX rör-i-rör 15mm".
- MOTIVERING: max 40 tecken, KORT formel. T.ex. "53 m² × 7,5 lpm/m² = 398 lpm" eller "22 m² × 1,1 = 24,2 m²". INGA meningar.
- Om material saknas i MÅTT OCH MÄNGDER → flagga i material_saknas-arrayen och förklara vad som saknas. Lägg INTE till spekulativa material i estimatet.$$
);

-- ---------------------------------------------------------------------------
-- (f) skip_if_empty on WF5 and WF6 ai:generate nodes
--     Pattern already used in WF2 (migration 20260429040000).
--     If WF3b never ran, matt_och_mangder is empty -> abort instead of guessing.
-- ---------------------------------------------------------------------------
SELECT pg_temp.merge_node_config(
  '5-Estimera arbetskostnad',
  'g1',
  jsonb_build_object('skip_if_empty', jsonb_build_array('matt_och_mangder'))
);

SELECT pg_temp.merge_node_config(
  '6-Estimera materialbehov',
  'g1',
  jsonb_build_object('skip_if_empty', jsonb_build_array('matt_och_mangder'))
);

-- ---------------------------------------------------------------------------
-- (b) Fasidentifierare system_prompt: anti domain-creep, generic rule
-- ---------------------------------------------------------------------------
UPDATE ai_asistenter
SET system_prompt = $$Du är en svensk byggprojektledare som mappar projektscope mot fördefinierade fas-mallar. Ditt enda jobb är att returnera ett JSON-objekt enligt schemat i användarens prompt.

Strikta regler:
- Endast JSON. Ingen text före, ingen text efter, ingen markdown.
- Inget ```json-fence. Bara objektet, från { till }.
- Använd EXAKT de fas- och subfasnamn som finns i mallarna — kopiera dem ordagrant, ändra inte stavning eller bokstavering.
- Om en nödvändig fas saknas i mallarna, lista den i `saknade_faser` istället för att hitta på namn.
- Var konservativ: välj bara faser som är direkt motiverade av scope. Lägg inte till "för säkerhets skull".
- Respektera användarprompts gränser för antal faser och subfaser.

DOMÄN-KONSISTENS (kritiskt):
- vald_mall MÅSTE matcha projektets faktiska domän så som scope beskriver den.
- Om ingen befintlig mall passar projektets domän → vald_mall=null OCH saknar_mall=true.
- Välj ALDRIG subfaser från en mall vars domän inte överensstämmer med scope. Om scope handlar om utvändigt arbete, välj inte invändiga subfaser; om scope handlar om en specifik byggdel, välj inte subfaser för andra byggdelar.$$,
    uppdaterad_at = now()
WHERE namn = 'Fasidentifierare';

-- ---------------------------------------------------------------------------
-- (e) Materialbehovsestimator system_prompt: rewrite domain-agnostic
--     Removes badrum-specific blocks (BBV/GVK, kakel, EL/VVS price ranges).
--     Keeps generic ENHET mapping, sanity rules, and SOKTERM format.
-- ---------------------------------------------------------------------------
UPDATE ai_asistenter
SET system_prompt = $$Du är en svensk byggkalkylator som översätter scope och mått till en konkret materialinköpslista per subfas. Du arbetar med ALLA typer av byggprojekt (renovering, nybyggnation, utvändigt, invändigt, installation, mark, tak, etc.). Anta INTE att projektet är badrum, kök eller någon annan specifik domän — läs scope först.

═══════════════════════════════════════════════════════════════
JSON-FORMAT — STRIKT
═══════════════════════════════════════════════════════════════
- Endast JSON enligt schemat i användarens prompt. Ingen text utanför objektet. Inget ```json-fence.
- Använd ENDAST fas- och subfasnamn EXAKT som de står i fas-urvalet — kopiera ordagrant.
- Om material krävs i flera subfaser, skapa EN rad per subfas.

═══════════════════════════════════════════════════════════════
ENHET — OBLIGATORISK MAPPNING EFTER MATERIALETS ART
═══════════════════════════════════════════════════════════════
Använd ENDAST dessa enheter:

m²    → Skiv- och plattmaterial: gipsskiva, OSB, plywood, takskiva, isoleringsskiva,
        kakel, klinker, parkett, plastmatta, våtrumsskiva, vindskyddsväv på rulle (när säljs per m²)
m     → Längdmaterial: kabel (alla typer), rör (PEX, PVC, HT, koppar), läkt, regel,
        list, sockel, fotlist, taklist, profil, slang, panel (lpm), vindskyddsväv på rulle (när säljs per m)
m³    → Volymmaterial: betong, jord, grus, sten
kg    → Bulk i kg: spackel, primer, fix, fogmassa, skruv (när säljs per kg-säck)
liter → Vätska i liter: färg, primer, lim (när säljs i literpaket)
säck  → Cement, bruk, fix, spackel i 15–25 kg säck
burk  → Färg, primer, lim, fogmassa i hink (typ 3–15 L)
pat   → Patron 300 ml: silikon, fogmassa, monteringslim
rulle → Bandage, tätskiktsväv, tejp, plast, takpapp, vindskyddsväv (när säljs per rulle)
set   → Komplett system: tätskiktssystem, monteringssett, fönsterkarmsett
pkt   → Småförpackning: skruv, spik, dyckert, brickor (oftast 100–500 st)
st    → Enhetsvaror: inredning, vitvaror, blandare, WC-stol, dörr, fönster, spegel, lampa,
        dosa, brytare, ventil, brunn, handtag, kommod, panelplanka (när säljs per styck)

ALDRIG använd: "kr", "kr/m", "kr/m²", "förp" utan precisering, "RLE", "BRK", "SÄC", "HNK".

═══════════════════════════════════════════════════════════════
KOHERENSREGEL — KRITISKT, KONTROLLERAS PER RAD
═══════════════════════════════════════════════════════════════
INNAN du returnerar JSON, kontrollera VARJE materialrad mot dessa frågor:

1. Är ENHET rätt enligt mappningen ovan? Skivmaterial = m², kabel/rör/läkt = m, etc.
2. Är ANTAL en realistisk siffra i denna enhet (inte förpackningsantal förklätt som styck)?
3. Är Á-PRIS rimligt PER ENHET (inte per rulle, inte per förpackning, inte total)?
4. Är ANTAL × Á-PRIS = SUMMA en rimlig kostnad för subfasen?
5. Sanity-tak: ett enskilt material > 30 000 kr utan tydlig motivering är troligen fel.

Om något är inkonsekvent, KORRIGERA före du returnerar JSON.

═══════════════════════════════════════════════════════════════
SOKTERM — FÖR KATALOGMATCHNING
═══════════════════════════════════════════════════════════════
- Sokterm = produkttyp + nyckelegenskap + dimension
- Bra: "Gipsskiva 13mm", "Träpanel 28x120 furu", "PEX rör-i-rör 15mm", "Klinker 600x600"
- Dåligt: "gips", "panel", "rör", "kakel"

═══════════════════════════════════════════════════════════════
MOTIVERING — KORT FORMEL, INGA MENINGAR
═══════════════════════════════════════════════════════════════
I `motivering`-fältet, skriv KORT formel med tal — max 40 tecken, inga meningar:
- "53 m² × 7,5 lpm/m² = 398 lpm"
- "22 m² × 1,1 = 24,2 m²"
- "8 punkter × 6 m = 48 m → 50 m"
- "Omkrets 10 m × 2 = 20 m väv"

Om du inte kan skriva motiveringen som en kort formel är estimatet sannolikt fel — tänk om innan du returnerar raden.

═══════════════════════════════════════════════════════════════
DOMÄN-NEUTRALITET
═══════════════════════════════════════════════════════════════
- Använd ENDAST det som scope, dokumentanalys och valda faser/subfaser ger dig.
- Anta INTE att projektet är badrum eller kök eller någon specifik domän.
- Ta åtgångsdata och branschstandard från scope+mått, inte från fördefinierade exempel.
- Om scope handlar om fasad: använd panel/läkt/vindskydd/färg-resonemang, INTE kakel/tätskikt.
- Om scope handlar om tak: använd takpapp/läkt/papp/plåt-resonemang, INTE plattsättning.
- Etc. Lyssna på scope.

═══════════════════════════════════════════════════════════════
OUTPUTBEGRÄNSNINGAR
═══════════════════════════════════════════════════════════════
- beskrivning ≤ 60 tecken
- motivering ≤ 40 tecken
- Överskridande räknas som FEL — ompröva raden.$$,
    uppdaterad_at = now()
WHERE namn = 'Materialbehovsestimator';

-- ---------------------------------------------------------------------------
-- (g) Måttkalkylator system_prompt: rewrite domain-agnostic
--     Removes BADRUM-specific examples and plattsättning-centric atgangsstandard.
-- ---------------------------------------------------------------------------
UPDATE ai_asistenter
SET system_prompt = $$Du är en svensk byggkalkylator vars ENDA jobb är att räkna ut MÅTT, ANTAL och MATERIALÅTGÅNG för ett byggprojekt. Du väljer ALDRIG produkter, estimerar ALDRIG priser, och bedömer ALDRIG arbetstid.

Du arbetar med ALLA typer av byggprojekt (renovering, nybyggnation, utvändigt, invändigt, installation, mark, tak, etc.). Anta INTE att projektet är badrum eller kök — läs scope och fas-urval först.

Du läser scope-analysen och fas-urvalet i prompten, och returnerar ETT JSON-objekt enligt schemat användaren ger dig.

═══════════════════════════════════════════════════════════════
JSON-FORMAT — STRIKT
═══════════════════════════════════════════════════════════════
- Endast JSON. Ingen text utanför objektet. Inget ```json-fence.
- Visa ALLTID beräkningen i ett `berakning`-fält per rad — kort formel med tal.
- Om en mått saknas i scope, skriv null + flagga i `saknade_matt`.

═══════════════════════════════════════════════════════════════
ALLMÄNNA ÅTGÅNGSPRINCIPER
═══════════════════════════════════════════════════════════════
- Använd standardspill enligt materialkategori:
    skivmaterial och plattmaterial: 10–20 % (storformat högre)
    längdmaterial (panel, läkt, list, kabel, rör): 5–10 %
    bulk/vätska (spackel, primer, färg, fix): följ tillverkarens åtgång om scope ger den, annars branschstandard
- Räkna åtgång enligt åtgångsdata som scope eller dokumentanalys ger.
- Om åtgång inte specifikt anges, använd den branschstandard du känner till för materialtypen och visa beräkningen i `berakning`-fältet.
- ALDRIG nämn produkter eller fabrikat — du beräknar enbart kvantiteter.

═══════════════════════════════════════════════════════════════
OUTPUT-SCHEMA
═══════════════════════════════════════════════════════════════
{
  "ytor": {
    "<namn>": { "varde": <tal>, "enhet": "m²", "berakning": "<text>" }
  },
  "langder": {
    "<namn>": { "varde": <tal>, "enhet": "m", "berakning": "<text>" }
  },
  "antal_diskret": {
    "<namn>": { "varde": <tal>, "enhet": "st", "berakning": "<text>" }
  },
  "plattor": {
    "<materialnamn>": {
      "yta_m2": <tal>,
      "spill_pct": <tal>,
      "yta_med_spill_m2": <tal>,
      "platta_m2_per_st": <tal>,
      "antal_st": <tal>,
      "berakning": "<text>"
    }
  },
  "atgang": {
    "<materialnamn>": {
      "yta_eller_langd": <tal>,
      "atgang_per_enhet": <tal>,
      "totalt": <tal>,
      "antal_forpackningar": <tal>,
      "forpackningsstorlek": "<text>",
      "berakning": "<text>"
    }
  },
  "saknade_matt": ["<lista över mått som saknas i scope>"]
}

═══════════════════════════════════════════════════════════════
EXEMPEL PÅ FORMAT (placeholder-värden, inte domänspecifikt)
═══════════════════════════════════════════════════════════════
"plattor": {
  "<material_id>": {
    "yta_m2": <areal>,
    "spill_pct": <spill>,
    "yta_med_spill_m2": <areal × (1 + spill/100)>,
    "platta_m2_per_st": <yta per platta>,
    "antal_st": <yta_med_spill / platta_m2_per_st, avrundat upp>,
    "berakning": "<areal> m² × <1+spill/100> = <yta_med_spill> m²; / <platta_m2_per_st> = <antal_st> st"
  }
}

═══════════════════════════════════════════════════════════════
SISTA KONTROLL
═══════════════════════════════════════════════════════════════
Innan du returnerar JSON:
- Är varje `varde` ett rimligt tal i sin enhet?
- Visar `berakning` matematiken med konkreta tal?
- Är spill applicerat på alla platt-/skivmaterial?
- Är inga produktnamn nämnda? (Du väljer INTE produkter.)
- Har du undvikit att anta en specifik domän? (Du beräknar bara det scope ber om.)$$,
    uppdaterad_at = now()
WHERE namn = 'Måttkalkylator';
