-- ============================================================
-- SQUASH MIGRATION  2026-05-22
-- Replaces 265 historical migrations with one clean baseline.
-- All statements are idempotent (IF NOT EXISTS / OR REPLACE).
-- Safe to run on existing installs: everything is a no-op.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm"    WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA extensions;

-- Sequences
CREATE SEQUENCE IF NOT EXISTS public.ata_nummer_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.forslag_nummer_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.inventarier_lopnr_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.kunder_nummer_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.order_nummer_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.personal_nummer_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.projekt_nummer_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;

-- Tables

CREATE TABLE IF NOT EXISTS public._applied_migrations (
    filename text NOT NULL,
    applied_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT _applied_migrations_pkey PRIMARY KEY (filename)
);

CREATE TABLE IF NOT EXISTS public.ai_asistenter (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    namn text NOT NULL,
    beskrivning text DEFAULT ''::text NOT NULL,
    model_id text NOT NULL,
    system_prompt text DEFAULT ''::text NOT NULL,
    uppgifter text[] DEFAULT '{}'::text[] NOT NULL,
    temperature numeric DEFAULT 0.7 NOT NULL,
    max_tokens integer DEFAULT 2048 NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    ar_standard boolean DEFAULT false NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    uppdaterad_at timestamptz DEFAULT now(),
    category text DEFAULT 'Allmänt'::text NOT NULL,
    CONSTRAINT ai_asistenter_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ai_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_slug text NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    api_key text DEFAULT ''::text NOT NULL,
    base_url text DEFAULT ''::text NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    uppdaterad_at timestamptz DEFAULT now(),
    CONSTRAINT ai_providers_pkey PRIMARY KEY (id),
    CONSTRAINT ai_providers_provider_slug_key UNIQUE (provider_slug)
);

CREATE TABLE IF NOT EXISTS public.aktivitetslogg_installningar (
    handelse text NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    etikett text NOT NULL,
    kategori text DEFAULT 'ovrigt'::text NOT NULL,
    CONSTRAINT aktivitetslogg_installningar_pkey PRIMARY KEY (handelse)
);

CREATE TABLE IF NOT EXISTS public.app_admins (
    auth_user_id uuid NOT NULL,
    email text,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT app_admins_pkey PRIMARY KEY (auth_user_id)
);

CREATE TABLE IF NOT EXISTS public.app_installningar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    foretag_namn text DEFAULT ''::text NOT NULL,
    foretag_org_nummer text DEFAULT ''::text NOT NULL,
    foretag_adress text DEFAULT ''::text NOT NULL,
    foretag_postnummer text DEFAULT ''::text NOT NULL,
    foretag_stad text DEFAULT ''::text NOT NULL,
    foretag_land text DEFAULT 'Sverige'::text NOT NULL,
    foretag_telefon text DEFAULT ''::text NOT NULL,
    foretag_email text DEFAULT ''::text NOT NULL,
    foretag_webbadress text DEFAULT ''::text NOT NULL,
    foretag_bankgiro text DEFAULT ''::text NOT NULL,
    foretag_plusgiro text DEFAULT ''::text NOT NULL,
    foretag_momsreg_nummer text DEFAULT ''::text NOT NULL,
    kund_std_land text DEFAULT 'Sverige'::text NOT NULL,
    kund_std_landskod text DEFAULT 'SE'::text NOT NULL,
    kund_std_status text DEFAULT 'potentiell'::text NOT NULL,
    projekt_std_betalningsvillkor text DEFAULT '30 dagar netto'::text NOT NULL,
    projekt_std_rot_procent numeric DEFAULT 30 NOT NULL,
    forslag_std_moms_procent numeric DEFAULT 25 NOT NULL,
    forslag_std_giltig_dagar integer DEFAULT 30 NOT NULL,
    rot_avdrag_tak_enkel numeric DEFAULT 50000 NOT NULL,
    rot_avdrag_tak_dubbel numeric DEFAULT 100000 NOT NULL,
    fortnox_client_id text DEFAULT ''::text NOT NULL,
    fortnox_client_secret text DEFAULT ''::text NOT NULL,
    fortnox_access_token text DEFAULT ''::text NOT NULL,
    fortnox_refresh_token text DEFAULT ''::text NOT NULL,
    fortnox_token_expires_at bigint,
    google_client_id text DEFAULT ''::text NOT NULL,
    google_client_secret text DEFAULT ''::text NOT NULL,
    google_access_token text DEFAULT ''::text NOT NULL,
    google_refresh_token text DEFAULT ''::text NOT NULL,
    zoho_client_id text DEFAULT ''::text NOT NULL,
    zoho_client_secret text DEFAULT ''::text NOT NULL,
    zoho_access_token text DEFAULT ''::text NOT NULL,
    zoho_refresh_token text DEFAULT ''::text NOT NULL,
    ai_enabled boolean DEFAULT false NOT NULL,
    ai_provider text DEFAULT 'anthropic'::text NOT NULL,
    ai_model text DEFAULT 'claude-sonnet-4-6'::text NOT NULL,
    ai_api_key text DEFAULT ''::text NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    uppdaterad_at timestamptz DEFAULT now(),
    projekt_std_villkor text DEFAULT ''::text NOT NULL,
    valuta varchar(10) DEFAULT 'kr'::character varying,
    timmar_per_dag integer DEFAULT 8 NOT NULL,
    arbetsdagar_per_vecka integer DEFAULT 5 NOT NULL,
    foretag_logo_url text DEFAULT ''::text NOT NULL,
    order_std_villkor text DEFAULT ''::text NOT NULL,
    ata_std_villkor text DEFAULT ''::text NOT NULL,
    branding_ikon_master_url text DEFAULT ''::text NOT NULL,
    branding_favicon_16_url text DEFAULT ''::text NOT NULL,
    branding_favicon_32_url text DEFAULT ''::text NOT NULL,
    branding_apple_touch_icon_url text DEFAULT ''::text NOT NULL,
    branding_android_192_url text DEFAULT ''::text NOT NULL,
    branding_android_512_url text DEFAULT ''::text NOT NULL,
    kund_portal_auto_invite boolean DEFAULT false NOT NULL,
    skatteverket_ocr_nummer text DEFAULT ''::text NOT NULL,
    skatteverkets_bankgiro text DEFAULT ''::text NOT NULL,
    kalkyl_ventanatyper jsonb DEFAULT '[]'::jsonb,
    kalkyl_taktyper jsonb DEFAULT '[]'::jsonb,
    kalkyl_tak_avdrag jsonb DEFAULT '[]'::jsonb,
    kalkyl_golv_avdrag jsonb DEFAULT '[]'::jsonb,
    kalkyl_vagg_avdrag jsonb DEFAULT '[]'::jsonb,
    avslut_feedback_aktiv boolean DEFAULT false NOT NULL,
    CONSTRAINT app_installningar_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.arbets_roller (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    timpris numeric DEFAULT 0 NOT NULL,
    enhet text DEFAULT 'tim'::text NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    CONSTRAINT arbets_roller_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.artiklar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_number text,
    beskrivning text NOT NULL,
    enhet text DEFAULT 'st'::text NOT NULL,
    a_pris numeric DEFAULT 0 NOT NULL,
    moms_procent numeric DEFAULT 25 NOT NULL,
    account_number integer DEFAULT 3001 NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    CONSTRAINT artiklar_pkey PRIMARY KEY (id),
    CONSTRAINT artiklar_article_number_key UNIQUE (article_number)
);

CREATE TABLE IF NOT EXISTS public.ata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ata_nummer text NOT NULL,
    projekt_id uuid NOT NULL,
    kund_id uuid NOT NULL,
    kund_namn text NOT NULL,
    kund_org_nr text DEFAULT ''::text,
    titel text NOT NULL,
    beskrivning text DEFAULT ''::text,
    villkor text,
    status text DEFAULT 'Utkast'::text NOT NULL,
    belopp_netto numeric DEFAULT 0 NOT NULL,
    belopp_moms numeric DEFAULT 0 NOT NULL,
    belopp_total numeric DEFAULT 0 NOT NULL,
    godkand_av text,
    godkand_datum timestamptz,
    signatur_data text,
    fas_id uuid,
    subfas_id uuid,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ata_pkey PRIMARY KEY (id),
    CONSTRAINT ata_ata_nummer_key UNIQUE (ata_nummer)
);

CREATE TABLE IF NOT EXISTS public.ata_rader (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ata_id uuid NOT NULL,
    beskrivning text DEFAULT ''::text NOT NULL,
    antal numeric DEFAULT 1 NOT NULL,
    enhet text DEFAULT 'st'::text NOT NULL,
    a_pris numeric DEFAULT 0 NOT NULL,
    belopp numeric DEFAULT 0 NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ata_rader_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.bank_transaktioner (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    datum date NOT NULL,
    beskrivning text NOT NULL,
    belopp numeric NOT NULL,
    saldo numeric,
    referens text,
    importerat_at timestamptz DEFAULT now(),
    CONSTRAINT bank_transaktioner_pkey PRIMARY KEY (id),
    CONSTRAINT bank_transaktioner_datum_beskrivning_belopp_key UNIQUE (datum, beskrivning, belopp)
);

CREATE TABLE IF NOT EXISTS public.cron_jobs (
    id text NOT NULL,
    label text NOT NULL,
    description text,
    schedule text NOT NULL,
    sql_command text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    last_run_at timestamptz,
    last_status text,
    last_result text,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT cron_jobs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ekonomi_utfall (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projekt_id uuid NOT NULL,
    kategori text DEFAULT 'övrigt'::text NOT NULL,
    beskrivning text DEFAULT ''::text NOT NULL,
    belopp numeric DEFAULT 0,
    datum date DEFAULT CURRENT_DATE,
    skapad_at timestamptz DEFAULT now(),
    tidrapport_id uuid,
    CONSTRAINT ekonomi_utfall_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.epost_alias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etikett text DEFAULT ''::text NOT NULL,
    fran_namn text DEFAULT ''::text NOT NULL,
    fran_adress text NOT NULL,
    signatur_html text DEFAULT ''::text NOT NULL,
    provider text DEFAULT 'zoho'::text NOT NULL,
    zoho_send_mail_id text,
    standard boolean DEFAULT false NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT epost_alias_pkey PRIMARY KEY (id),
    CONSTRAINT epost_alias_fran_adress_key UNIQUE (fran_adress),
    CONSTRAINT epost_alias_zoho_send_mail_id_key UNIQUE (zoho_send_mail_id)
);

CREATE TABLE IF NOT EXISTS public.epost_ko (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alias_id uuid,
    mall_id uuid,
    till text NOT NULL,
    cc text DEFAULT ''::text,
    amne text DEFAULT ''::text NOT NULL,
    kropp_html text DEFAULT ''::text NOT NULL,
    bilagor jsonb DEFAULT '[]'::jsonb NOT NULL,
    kund_id uuid,
    projekt_id uuid,
    forslag_id uuid,
    faktura_id uuid,
    schemalagd_till timestamptz NOT NULL,
    status text DEFAULT 'väntar'::text NOT NULL,
    forsok integer DEFAULT 0 NOT NULL,
    fel_meddelande text DEFAULT ''::text,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    skickad_at timestamptz,
    metadata jsonb,
    CONSTRAINT epost_ko_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.epost_mallar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    amne text DEFAULT ''::text NOT NULL,
    kropp_html text DEFAULT ''::text NOT NULL,
    kategori text DEFAULT 'Allmänt'::text NOT NULL,
    alias_id uuid,
    aktiv boolean DEFAULT true NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    system_kod text,
    meddelande_standard text,
    questions_json jsonb,
    CONSTRAINT epost_mallar_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fakturering_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projekt_id uuid NOT NULL,
    forslag_id uuid NOT NULL,
    forslag_nummer text NOT NULL,
    forslag_titel text NOT NULL,
    total_arbete numeric DEFAULT 0 NOT NULL,
    total_material numeric DEFAULT 0 NOT NULL,
    total_ue numeric DEFAULT 0 NOT NULL,
    total_netto numeric DEFAULT 0 NOT NULL,
    rot_eligible numeric DEFAULT 0 NOT NULL,
    rot_avdrag numeric DEFAULT 0 NOT NULL,
    moms_totalt numeric DEFAULT 0 NOT NULL,
    att_betala_totalt numeric DEFAULT 0 NOT NULL,
    etapper jsonb DEFAULT '[]'::jsonb NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT fakturaplan_snapshots_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fas_mall_faser (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mall_id uuid NOT NULL,
    namn text NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    CONSTRAINT fas_mall_faser_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fas_mall_subfaser (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fas_id uuid NOT NULL,
    namn text NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    CONSTRAINT fas_mall_subfaser_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fas_mallar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    beskrivning text DEFAULT ''::text NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    CONSTRAINT fas_mallar_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.forslag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    forslag_nummer text,
    projekt_id uuid NOT NULL,
    titel text NOT NULL,
    status text DEFAULT 'utkast'::text NOT NULL,
    giltig_till date,
    moms_procent numeric DEFAULT 25,
    sammanfattning text,
    ai_analys text,
    skapad_at timestamptz DEFAULT now(),
    uppdaterad_at timestamptz DEFAULT now(),
    godkand_av text,
    godkand_datum timestamptz,
    signatur_data text,
    CONSTRAINT forslag_pkey PRIMARY KEY (id),
    CONSTRAINT forslag_forslag_nummer_key UNIQUE (forslag_nummer)
);

CREATE TABLE IF NOT EXISTS public.forslag_arbetskostnad (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subfas_id uuid NOT NULL,
    beskrivning text DEFAULT ''::text NOT NULL,
    yrkesroll text DEFAULT ''::text,
    antal_timmar numeric DEFAULT 0,
    timpris numeric DEFAULT 0,
    rot_berattigad boolean DEFAULT false,
    skapad_at timestamptz DEFAULT now(),
    CONSTRAINT forslag_arbetskostnad_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.forslag_epost_refs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    forslag_id uuid NOT NULL,
    message_id text NOT NULL,
    folder_id text DEFAULT ''::text NOT NULL,
    provider text DEFAULT 'zoho'::text NOT NULL,
    amne text DEFAULT ''::text NOT NULL,
    fran_adress text DEFAULT ''::text NOT NULL,
    fran_namn text DEFAULT ''::text NOT NULL,
    snippet text DEFAULT ''::text NOT NULL,
    datum timestamptz NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT forslag_epost_refs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.forslag_faser (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    forslag_id uuid NOT NULL,
    namn text DEFAULT ''::text NOT NULL,
    beskrivning text,
    sortering integer DEFAULT 0,
    skapad_at timestamptz DEFAULT now(),
    start_datum date,
    slut_datum date,
    notat text,
    aktiv boolean DEFAULT true NOT NULL,
    CONSTRAINT forslag_faser_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.forslag_materialkostnad (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subfas_id uuid NOT NULL,
    beskrivning text DEFAULT ''::text NOT NULL,
    enhet text DEFAULT 'st'::text,
    antal numeric DEFAULT 0,
    a_pris numeric DEFAULT 0,
    leverantor text DEFAULT ''::text,
    skapad_at timestamptz DEFAULT now(),
    CONSTRAINT forslag_materialkostnad_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.forslag_sms_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    forslag_id uuid NOT NULL,
    mall_namn text DEFAULT ''::text NOT NULL,
    meddelande text NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT forslag_sms_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.forslag_statusar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    farg text DEFAULT 'muted'::text NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    inbyggd boolean DEFAULT false NOT NULL,
    CONSTRAINT forslag_statusar_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.forslag_subfaser (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fas_id uuid NOT NULL,
    namn text DEFAULT ''::text NOT NULL,
    beskrivning text,
    sortering integer DEFAULT 0,
    skapad_at timestamptz DEFAULT now(),
    CONSTRAINT forslag_subfaser_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.forslag_underentreprenorer (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subfas_id uuid NOT NULL,
    namn text DEFAULT ''::text NOT NULL,
    beskrivning text DEFAULT ''::text,
    inkl_material boolean DEFAULT false,
    kostnad numeric DEFAULT 0,
    skapad_at timestamptz DEFAULT now(),
    CONSTRAINT forslag_underentreprenorer_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.inventarier (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lopnr integer DEFAULT nextval('inventarier_lopnr_seq'::regclass) NOT NULL,
    kategori text DEFAULT ''::text NOT NULL,
    benamning text DEFAULT ''::text NOT NULL,
    tillverkare_modell text DEFAULT ''::text NOT NULL,
    serienr text DEFAULT ''::text NOT NULL,
    antal integer DEFAULT 1 NOT NULL,
    skick text DEFAULT 'Bra'::text NOT NULL,
    placering text DEFAULT ''::text NOT NULL,
    updated_by_user_id uuid,
    updated_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT inventarier_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.kalender_event_dokument (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    filnamn text NOT NULL,
    mime_type text DEFAULT ''::text NOT NULL,
    storlek bigint DEFAULT 0 NOT NULL,
    storage_path text NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT kalender_event_dokument_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.kalender_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titel text NOT NULL,
    beskrivning text DEFAULT ''::text NOT NULL,
    plats text DEFAULT ''::text NOT NULL,
    start timestamptz NOT NULL,
    slut timestamptz NOT NULL,
    hel_dag boolean DEFAULT false NOT NULL,
    aterkommer boolean DEFAULT false NOT NULL,
    deltagare jsonb DEFAULT '[]'::jsonb NOT NULL,
    kund_id uuid,
    farg text DEFAULT '#6366f1'::text NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    projekt_id uuid,
    url text DEFAULT ''::text NOT NULL,
    fas_id uuid,
    slutford boolean DEFAULT false NOT NULL,
    kalender_id uuid,
    epost_ref jsonb,
    CONSTRAINT kalender_events_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.kalendrar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    farg text DEFAULT '#6366f1'::text NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT kalendrar_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.kund_avslutsfeedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kund_id uuid NOT NULL,
    projekt_namn text NOT NULL,
    token text NOT NULL,
    questions_json jsonb NOT NULL,
    answers_json jsonb,
    status text DEFAULT 'skickat'::text NOT NULL,
    skickat_at timestamptz DEFAULT now(),
    besvarat_at timestamptz,
    skapad_at timestamptz DEFAULT now(),
    CONSTRAINT kund_avslutsfeedback_pkey PRIMARY KEY (id),
    CONSTRAINT kund_avslutsfeedback_token_key UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS public.kund_portal_invite_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kund_id uuid NOT NULL,
    source_lank_id uuid,
    created_at timestamptz DEFAULT now() NOT NULL,
    processed_at timestamptz,
    error text,
    CONSTRAINT kund_portal_invite_queue_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.kund_statusar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    farg text DEFAULT 'muted'::text NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    inbyggd boolean DEFAULT false NOT NULL,
    CONSTRAINT kund_statusar_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.kund_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    kund_id uuid NOT NULL,
    email text,
    invited_at timestamptz DEFAULT now() NOT NULL,
    accepted_at timestamptz,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT kund_users_pkey PRIMARY KEY (id),
    CONSTRAINT kund_users_auth_user_id_kund_id_key UNIQUE (auth_user_id, kund_id)
);

CREATE TABLE IF NOT EXISTS public.kunder (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    email text,
    telefon text,
    adress text,
    stad text,
    postnummer text,
    org_nummer text,
    status text DEFAULT 'potentiell'::text NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    uppdaterad_at timestamptz DEFAULT now(),
    adress_2 text,
    land text DEFAULT 'Sverige'::text,
    landskod text DEFAULT 'SE'::text,
    telefon_2 text,
    fax text,
    webbadress text,
    fastighetsbeteckning text,
    brf_org_nummer text,
    medsokande_namn text,
    medsokande_personnummer text,
    kundnummer text,
    order_std_villkor text DEFAULT ''::text NOT NULL,
    ata_std_villkor text DEFAULT ''::text NOT NULL,
    login_anteckning text,
    kalender_farg text,
    personnummer text,
    avslut_questions_template jsonb,
    CONSTRAINT kunder_pkey PRIMARY KEY (id),
    CONSTRAINT kunder_kundnummer_key UNIQUE (kundnummer)
);

CREATE TABLE IF NOT EXISTS public.kvitton (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    datum date DEFAULT CURRENT_DATE NOT NULL,
    leverantor text,
    belopp numeric,
    moms numeric,
    kategori text,
    beskrivning text,
    projekt_id uuid,
    status text DEFAULT 'att_hantera'::text NOT NULL,
    fil_storage_path text NOT NULL,
    fil_namn text NOT NULL,
    mime_type text NOT NULL,
    storlek bigint NOT NULL,
    fortnox_voucher_id text,
    skapad_av_user_id uuid,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT kvitton_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.leverantorer (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    kontaktperson text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    telefon text DEFAULT ''::text NOT NULL,
    webbadress text DEFAULT ''::text NOT NULL,
    org_nummer text DEFAULT ''::text NOT NULL,
    anteckning text DEFAULT ''::text NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    CONSTRAINT leverantorer_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.material_import_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    leverantor_id uuid NOT NULL,
    mappings jsonb DEFAULT '{}'::jsonb NOT NULL,
    decimal_separator text DEFAULT ','::text NOT NULL,
    delimiter text DEFAULT '	'::text NOT NULL,
    skip_rows integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT material_import_config_pkey PRIMARY KEY (id),
    CONSTRAINT material_import_config_leverantor_id_key UNIQUE (leverantor_id)
);

CREATE TABLE IF NOT EXISTS public.material_katalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    leverantor_id uuid NOT NULL,
    artikel_nummer text,
    namn text NOT NULL,
    namn2 text,
    kategori1 text,
    kategori2 text,
    kategori3 text,
    kategori4 text,
    enhet text,
    a_pris numeric DEFAULT 0 NOT NULL,
    bredd numeric,
    tjocklek numeric,
    langd numeric,
    bild_url text,
    aktiv boolean DEFAULT true NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT material_katalog_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.order_rader (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    beskrivning text DEFAULT ''::text NOT NULL,
    antal numeric DEFAULT 1 NOT NULL,
    enhet text DEFAULT 'st'::text NOT NULL,
    a_pris numeric DEFAULT 0 NOT NULL,
    belopp numeric DEFAULT 0 NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT order_rader_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ordrar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_nummer text NOT NULL,
    projekt_id uuid NOT NULL,
    kund_id uuid NOT NULL,
    kund_namn text NOT NULL,
    kund_org_nr text DEFAULT ''::text,
    titel text NOT NULL,
    beskrivning text DEFAULT ''::text,
    status text DEFAULT 'Utkast'::text NOT NULL,
    belopp_netto numeric DEFAULT 0 NOT NULL,
    belopp_moms numeric DEFAULT 0 NOT NULL,
    belopp_total numeric DEFAULT 0 NOT NULL,
    godkand_av text,
    godkand_datum timestamptz,
    signatur_data text,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    fas_id uuid,
    subfas_id uuid,
    villkor text,
    CONSTRAINT ordrar_pkey PRIMARY KEY (id),
    CONSTRAINT ordrar_order_nummer_key UNIQUE (order_nummer)
);

CREATE TABLE IF NOT EXISTS public.pdf_mallar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    typ text NOT NULL,
    namn text NOT NULL,
    accent_farg text DEFAULT '#1B3A6B'::text NOT NULL,
    portada_titel text DEFAULT ''::text NOT NULL,
    portada_undertitel text DEFAULT ''::text NOT NULL,
    visa_portada boolean DEFAULT true NOT NULL,
    visa_sammanfattning boolean DEFAULT true NOT NULL,
    visa_schema boolean DEFAULT true NOT NULL,
    visa_tidplan boolean DEFAULT false NOT NULL,
    visa_arbetskostnad boolean DEFAULT true NOT NULL,
    visa_materialkostnad boolean DEFAULT true NOT NULL,
    visa_godkand_f_skatt boolean DEFAULT true NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    html_mall text DEFAULT ''::text NOT NULL,
    visa_leverantor_material boolean DEFAULT true NOT NULL,
    visa_villkor boolean DEFAULT true NOT NULL,
    portada_titel_2 text DEFAULT ''::text NOT NULL,
    visa_fas_notat boolean DEFAULT true NOT NULL,
    CONSTRAINT pdf_mallar_pkey PRIMARY KEY (id),
    CONSTRAINT pdf_mallar_typ_key UNIQUE (typ)
);

CREATE TABLE IF NOT EXISTS public.personal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personal_nummer text NOT NULL,
    namn text NOT NULL,
    personnummer text,
    roll text,
    personaltyp text,
    loneform text,
    anstallningsform text,
    email text,
    telefon text,
    postadress text,
    postnummer text,
    ort text,
    anstallningsdatum date,
    slutdatum date,
    manadslön numeric,
    timlön numeric,
    sysselsattningsgrad numeric,
    status text DEFAULT 'aktiv'::text NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    supabase_user_id uuid,
    admin_last_read_chat_at timestamptz,
    clearingnummer text,
    kontonummer text,
    bank text,
    CONSTRAINT personal_pkey PRIMARY KEY (id),
    CONSTRAINT personal_personal_nummer_key UNIQUE (personal_nummer),
    CONSTRAINT personal_supabase_user_id_key UNIQUE (supabase_user_id)
);

CREATE TABLE IF NOT EXISTS public.personal_anteckningar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personal_id uuid NOT NULL,
    titel text DEFAULT ''::text NOT NULL,
    innehall text DEFAULT ''::text NOT NULL,
    farg text DEFAULT 'muted'::text NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT personal_anteckningar_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personal_chat (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personal_id uuid NOT NULL,
    fran_admin boolean NOT NULL,
    innehall text NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT personal_chat_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personal_dokument (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personal_id uuid NOT NULL,
    filnamn text NOT NULL,
    mime_type text NOT NULL,
    storlek bigint NOT NULL,
    storage_path text NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    kategori text DEFAULT 'dokument'::text NOT NULL,
    CONSTRAINT personal_dokument_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personal_ledighet (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personal_id uuid NOT NULL,
    typ text NOT NULL,
    startdatum date NOT NULL,
    slutdatum date NOT NULL,
    godkand boolean DEFAULT false NOT NULL,
    kommentar text,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    status text DEFAULT 'inskickad'::text NOT NULL,
    CONSTRAINT personal_ledighet_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personal_loneposter (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personal_id uuid NOT NULL,
    typ text NOT NULL,
    belopp numeric NOT NULL,
    beskrivning text DEFAULT ''::text NOT NULL,
    datum date NOT NULL,
    manad text NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT personal_loneposter_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personal_statusar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    farg text DEFAULT 'muted'::text NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT personal_statusar_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personal_tidrapport (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personal_id uuid NOT NULL,
    datum date NOT NULL,
    timmar numeric NOT NULL,
    typ text DEFAULT 'normal'::text NOT NULL,
    beskrivning text,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    projekt_id uuid,
    status text DEFAULT 'inskickad'::text NOT NULL,
    godkand_at timestamptz,
    incheckning time,
    utcheckning time,
    transportmedel text NOT NULL,
    paustid_minuter integer DEFAULT 0 NOT NULL,
    beskrivning_oversatt text,
    beskrivning_sprak text,
    beskrivning_oversatt_at timestamptz,
    CONSTRAINT personal_tidrapport_pkey PRIMARY KEY (id),
    CONSTRAINT personal_tidrapport_personal_datum_unique UNIQUE (personal_id, datum)
);

CREATE TABLE IF NOT EXISTS public.projekt (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projekt_nummer text,
    kund_id uuid NOT NULL,
    namn text NOT NULL,
    beskrivning text,
    status text DEFAULT 'planering'::text NOT NULL,
    startdatum date,
    slutdatum date,
    budget_total numeric DEFAULT 0,
    skapad_at timestamptz DEFAULT now(),
    uppdaterad_at timestamptz DEFAULT now(),
    arbetsplats_adress text,
    arbetsplats_postnummer text,
    arbetsplats_stad text,
    rot_avdrag boolean DEFAULT false NOT NULL,
    rot_procent numeric DEFAULT 30,
    betalningsvillkor text DEFAULT '30 dagar netto'::text,
    rot_inkludera_medsokande boolean DEFAULT false NOT NULL,
    villkor text,
    kalender_farg text,
    CONSTRAINT projekt_pkey PRIMARY KEY (id),
    CONSTRAINT projekt_projekt_nummer_key UNIQUE (projekt_nummer)
);

CREATE TABLE IF NOT EXISTS public.projekt_aktiviteter (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projekt_id uuid NOT NULL,
    text text NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT projekt_aktiviteter_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.projekt_anteckningar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projekt_id uuid NOT NULL,
    innehall text NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    titel text DEFAULT ''::text NOT NULL,
    farg text DEFAULT 'muted'::text NOT NULL,
    CONSTRAINT projekt_anteckningar_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.projekt_context (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projekt_id uuid NOT NULL,
    nyckel text NOT NULL,
    varde text DEFAULT ''::text NOT NULL,
    workflow_run_id uuid,
    skapad_at timestamptz DEFAULT now(),
    uppdaterad_at timestamptz DEFAULT now(),
    CONSTRAINT projekt_context_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.projekt_dokument (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projekt_id uuid NOT NULL,
    filnamn text NOT NULL,
    mime_type text NOT NULL,
    storlek bigint NOT NULL,
    storage_path text NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppladdad_av_personal_id uuid,
    synlig_for_kund boolean DEFAULT false NOT NULL,
    kategori text DEFAULT 'dokument'::text NOT NULL,
    carpeta text,
    CONSTRAINT projekt_dokument_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.projekt_frageblankett (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projekt_id uuid NOT NULL,
    token text DEFAULT encode(gen_random_bytes(16), 'hex'::text) NOT NULL,
    titel text DEFAULT 'Frågeformulär'::text NOT NULL,
    questions_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    answers_json jsonb,
    status text DEFAULT 'utkast'::text NOT NULL,
    skickat_at timestamptz,
    besvarat_at timestamptz,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT projekt_frageblankett_pkey PRIMARY KEY (id),
    CONSTRAINT projekt_frageblankett_token_key UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS public.projekt_personal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projekt_id uuid NOT NULL,
    personal_id uuid NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT projekt_personal_pkey PRIMARY KEY (id),
    CONSTRAINT projekt_personal_projekt_id_personal_id_key UNIQUE (projekt_id, personal_id)
);

CREATE TABLE IF NOT EXISTS public.projekt_sms_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projekt_id uuid NOT NULL,
    mall_namn text DEFAULT ''::text NOT NULL,
    meddelande text NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT projekt_sms_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.projekt_statusar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    farg text DEFAULT 'muted'::text NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    inbyggd boolean DEFAULT false NOT NULL,
    CONSTRAINT projekt_statusar_pkey PRIMARY KEY (id),
    CONSTRAINT projekt_statusar_namn_key UNIQUE (namn)
);

CREATE TABLE IF NOT EXISTS public.sequence_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sequence_id uuid,
    trigger_id uuid,
    projekt_id uuid,
    workflow_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    current_step integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'kör'::text NOT NULL,
    workflow_run_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    collected_input jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_step integer,
    error_msg text,
    startad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    avslutad_at timestamptz,
    CONSTRAINT sequence_runs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.signatur_fritta_dokument (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projekt_id uuid NOT NULL,
    titel text NOT NULL,
    filnamn text NOT NULL,
    mime_type text NOT NULL,
    storlek bigint NOT NULL,
    storage_path text NOT NULL,
    arkiverad_dokument_id uuid,
    arkiverad_at timestamptz,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT signatur_fritta_dokument_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.signatur_lankar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    dokument_typ text NOT NULL,
    dokument_id uuid NOT NULL,
    kund_id uuid,
    kund_email text NOT NULL,
    dokument_hash text DEFAULT ''::text NOT NULL,
    meddelande text,
    skapad_av text,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    gar_ut_at timestamptz NOT NULL,
    oppnad_at timestamptz,
    signerad_at timestamptz,
    signerad_namn text,
    signerad_ip inet,
    signerad_ua text,
    signatur_data text,
    revoked_at timestamptz,
    signed_pdf_url text,
    document_pdf_url text,
    signerad_personnummer text,
    signerad_metod text,
    signerad_dokument_hash text,
    andring_begard_at timestamptz,
    andring_historik jsonb DEFAULT '[]'::jsonb NOT NULL,
    revisioner_historik jsonb DEFAULT '[]'::jsonb NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    last_oppnad_at timestamptz,
    auto_invite_kund_portal boolean DEFAULT false NOT NULL,
    final_document_pdf_url text,
    paminnelse_historik jsonb DEFAULT '[]'::jsonb NOT NULL,
    specifikation_pdf_url text,
    tidplan_pdf_url text,
    CONSTRAINT signatur_lankar_pkey PRIMARY KEY (id),
    CONSTRAINT signatur_lankar_token_key UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS public.sms_mallar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    meddelande text DEFAULT ''::text NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now() NOT NULL,
    uppdaterad_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT sms_mallar_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.workflow_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    trigger_type text DEFAULT 'manual'::text NOT NULL,
    status text DEFAULT 'kör'::text NOT NULL,
    input_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    output_json jsonb,
    node_results jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_node text,
    error_msg text,
    startad_at timestamptz DEFAULT now(),
    avslutad_at timestamptz,
    duration_ms integer,
    CONSTRAINT workflow_runs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.workflow_sequences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    beskrivning text DEFAULT ''::text NOT NULL,
    workflow_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    CONSTRAINT workflow_sequences_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.workflow_triggers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid,
    seccion text NOT NULL,
    etikett text NOT NULL,
    icon text DEFAULT 'Zap'::text NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    sequence_ids jsonb,
    sequence_id uuid,
    trigger_inputs jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT workflow_triggers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namn text NOT NULL,
    beskrivning text DEFAULT ''::text NOT NULL,
    kategori text DEFAULT 'forslag'::text NOT NULL,
    definition jsonb DEFAULT '{"edges": [], "nodes": []}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    sortering integer DEFAULT 0 NOT NULL,
    skapad_at timestamptz DEFAULT now(),
    uppdaterad_at timestamptz DEFAULT now(),
    CONSTRAINT workflows_pkey PRIMARY KEY (id)
);

-- Foreign keys
DO $$ BEGIN ALTER TABLE public.ai_asistenter ADD CONSTRAINT ai_asistenter_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.ai_providers(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ata ADD CONSTRAINT ata_subfas_id_fkey FOREIGN KEY (subfas_id) REFERENCES public.forslag_subfaser(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ata ADD CONSTRAINT ata_fas_id_fkey FOREIGN KEY (fas_id) REFERENCES public.forslag_faser(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ata ADD CONSTRAINT ata_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ata ADD CONSTRAINT ata_kund_id_fkey FOREIGN KEY (kund_id) REFERENCES public.kunder(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ata_rader ADD CONSTRAINT ata_rader_ata_id_fkey FOREIGN KEY (ata_id) REFERENCES public.ata(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ekonomi_utfall ADD CONSTRAINT ekonomi_utfall_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ekonomi_utfall ADD CONSTRAINT ekonomi_utfall_tidrapport_id_fkey FOREIGN KEY (tidrapport_id) REFERENCES public.personal_tidrapport(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.epost_ko ADD CONSTRAINT epost_ko_mall_id_fkey FOREIGN KEY (mall_id) REFERENCES public.epost_mallar(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.epost_ko ADD CONSTRAINT epost_ko_alias_id_fkey FOREIGN KEY (alias_id) REFERENCES public.epost_alias(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.epost_ko ADD CONSTRAINT epost_ko_forslag_id_fkey FOREIGN KEY (forslag_id) REFERENCES public.forslag(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.epost_ko ADD CONSTRAINT epost_ko_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.epost_ko ADD CONSTRAINT epost_ko_kund_id_fkey FOREIGN KEY (kund_id) REFERENCES public.kunder(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.epost_mallar ADD CONSTRAINT epost_mallar_alias_id_fkey FOREIGN KEY (alias_id) REFERENCES public.epost_alias(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.fakturering_snapshots ADD CONSTRAINT fakturaplan_snapshots_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.fakturering_snapshots ADD CONSTRAINT fakturaplan_snapshots_forslag_id_fkey FOREIGN KEY (forslag_id) REFERENCES public.forslag(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.fas_mall_faser ADD CONSTRAINT fas_mall_faser_mall_id_fkey FOREIGN KEY (mall_id) REFERENCES public.fas_mallar(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.fas_mall_subfaser ADD CONSTRAINT fas_mall_subfaser_fas_id_fkey FOREIGN KEY (fas_id) REFERENCES public.fas_mall_faser(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.forslag ADD CONSTRAINT forslag_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.forslag_arbetskostnad ADD CONSTRAINT forslag_arbetskostnad_subfas_id_fkey FOREIGN KEY (subfas_id) REFERENCES public.forslag_subfaser(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.forslag_epost_refs ADD CONSTRAINT forslag_epost_refs_forslag_id_fkey FOREIGN KEY (forslag_id) REFERENCES public.forslag(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.forslag_faser ADD CONSTRAINT forslag_faser_forslag_id_fkey FOREIGN KEY (forslag_id) REFERENCES public.forslag(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.forslag_materialkostnad ADD CONSTRAINT forslag_materialkostnad_subfas_id_fkey FOREIGN KEY (subfas_id) REFERENCES public.forslag_subfaser(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.forslag_sms_log ADD CONSTRAINT forslag_sms_log_forslag_id_fkey FOREIGN KEY (forslag_id) REFERENCES public.forslag(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.forslag_subfaser ADD CONSTRAINT forslag_subfaser_fas_id_fkey FOREIGN KEY (fas_id) REFERENCES public.forslag_faser(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.forslag_underentreprenorer ADD CONSTRAINT forslag_underentreprenorer_subfas_id_fkey FOREIGN KEY (subfas_id) REFERENCES public.forslag_subfaser(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kalender_event_dokument ADD CONSTRAINT kalender_event_dokument_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.kalender_events(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kalender_events ADD CONSTRAINT kalender_events_kund_id_fkey FOREIGN KEY (kund_id) REFERENCES public.kunder(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kalender_events ADD CONSTRAINT kalender_events_kalender_id_fkey FOREIGN KEY (kalender_id) REFERENCES public.kalendrar(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kalender_events ADD CONSTRAINT kalender_events_fas_id_fkey FOREIGN KEY (fas_id) REFERENCES public.forslag_faser(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kalender_events ADD CONSTRAINT kalender_events_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kund_avslutsfeedback ADD CONSTRAINT kund_avslutsfeedback_kund_id_fkey FOREIGN KEY (kund_id) REFERENCES public.kunder(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kund_portal_invite_queue ADD CONSTRAINT kund_portal_invite_queue_kund_id_fkey FOREIGN KEY (kund_id) REFERENCES public.kunder(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kund_portal_invite_queue ADD CONSTRAINT kund_portal_invite_queue_source_lank_id_fkey FOREIGN KEY (source_lank_id) REFERENCES public.signatur_lankar(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kund_users ADD CONSTRAINT kund_users_kund_id_fkey FOREIGN KEY (kund_id) REFERENCES public.kunder(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kvitton ADD CONSTRAINT kvitton_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.material_import_config ADD CONSTRAINT material_import_config_leverantor_id_fkey FOREIGN KEY (leverantor_id) REFERENCES public.leverantorer(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.material_katalog ADD CONSTRAINT material_katalog_leverantor_id_fkey FOREIGN KEY (leverantor_id) REFERENCES public.leverantorer(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.order_rader ADD CONSTRAINT order_rader_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.ordrar(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ordrar ADD CONSTRAINT ordrar_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ordrar ADD CONSTRAINT ordrar_subfas_id_fkey FOREIGN KEY (subfas_id) REFERENCES public.forslag_subfaser(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ordrar ADD CONSTRAINT ordrar_fas_id_fkey FOREIGN KEY (fas_id) REFERENCES public.forslag_faser(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ordrar ADD CONSTRAINT ordrar_kund_id_fkey FOREIGN KEY (kund_id) REFERENCES public.kunder(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.personal_anteckningar ADD CONSTRAINT personal_anteckningar_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.personal_chat ADD CONSTRAINT personal_chat_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.personal_dokument ADD CONSTRAINT personal_dokument_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.personal_ledighet ADD CONSTRAINT personal_ledighet_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.personal_loneposter ADD CONSTRAINT personal_loneposter_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.personal_tidrapport ADD CONSTRAINT personal_tidrapport_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.personal_tidrapport ADD CONSTRAINT personal_tidrapport_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projekt ADD CONSTRAINT projekt_kund_id_fkey FOREIGN KEY (kund_id) REFERENCES public.kunder(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projekt_aktiviteter ADD CONSTRAINT projekt_aktiviteter_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projekt_anteckningar ADD CONSTRAINT projekt_anteckningar_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projekt_context ADD CONSTRAINT projekt_context_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projekt_context ADD CONSTRAINT projekt_context_workflow_run_id_fkey FOREIGN KEY (workflow_run_id) REFERENCES public.workflow_runs(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projekt_dokument ADD CONSTRAINT projekt_dokument_uppladdad_av_personal_id_fkey FOREIGN KEY (uppladdad_av_personal_id) REFERENCES public.personal(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projekt_dokument ADD CONSTRAINT projekt_dokument_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projekt_frageblankett ADD CONSTRAINT projekt_frageblankett_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projekt_personal ADD CONSTRAINT projekt_personal_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES public.personal(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projekt_personal ADD CONSTRAINT projekt_personal_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projekt_sms_log ADD CONSTRAINT projekt_sms_log_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.sequence_runs ADD CONSTRAINT sequence_runs_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.workflow_sequences(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.sequence_runs ADD CONSTRAINT sequence_runs_trigger_id_fkey FOREIGN KEY (trigger_id) REFERENCES public.workflow_triggers(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.signatur_fritta_dokument ADD CONSTRAINT signatur_fritta_dokument_projekt_id_fkey FOREIGN KEY (projekt_id) REFERENCES public.projekt(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.signatur_fritta_dokument ADD CONSTRAINT signatur_fritta_dokument_arkiverad_dokument_id_fkey FOREIGN KEY (arkiverad_dokument_id) REFERENCES public.projekt_dokument(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.signatur_lankar ADD CONSTRAINT signatur_lankar_kund_id_fkey FOREIGN KEY (kund_id) REFERENCES public.kunder(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.workflow_runs ADD CONSTRAINT workflow_runs_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.workflow_triggers ADD CONSTRAINT workflow_triggers_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.workflow_sequences(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.workflow_triggers ADD CONSTRAINT workflow_triggers_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes (non-PK)
CREATE INDEX IF NOT EXISTS idx_ai_asistenter_provider_id ON public.ai_asistenter USING btree (provider_id);
CREATE UNIQUE INDEX IF NOT EXISTS ai_providers_provider_slug_key ON public.ai_providers USING btree (provider_slug);
CREATE UNIQUE INDEX IF NOT EXISTS artiklar_article_number_key ON public.artiklar USING btree (article_number);
CREATE UNIQUE INDEX IF NOT EXISTS ata_ata_nummer_key ON public.ata USING btree (ata_nummer);
CREATE INDEX IF NOT EXISTS idx_ata_fas_id ON public.ata USING btree (fas_id);
CREATE INDEX IF NOT EXISTS idx_ata_kund_id ON public.ata USING btree (kund_id);
CREATE INDEX IF NOT EXISTS idx_ata_projekt_id ON public.ata USING btree (projekt_id);
CREATE INDEX IF NOT EXISTS idx_ata_status ON public.ata USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ata_subfas_id ON public.ata USING btree (subfas_id);
CREATE INDEX IF NOT EXISTS idx_ata_rader_ata_id ON public.ata_rader USING btree (ata_id);
CREATE UNIQUE INDEX IF NOT EXISTS bank_transaktioner_datum_beskrivning_belopp_key ON public.bank_transaktioner USING btree (datum, beskrivning, belopp);
CREATE INDEX IF NOT EXISTS ekonomi_utfall_tidrapport_id_idx ON public.ekonomi_utfall USING btree (tidrapport_id);
CREATE INDEX IF NOT EXISTS idx_ekonomi_utfall_projekt_id ON public.ekonomi_utfall USING btree (projekt_id);
CREATE UNIQUE INDEX IF NOT EXISTS epost_alias_fran_adress_key ON public.epost_alias USING btree (fran_adress);
CREATE UNIQUE INDEX IF NOT EXISTS epost_alias_one_standard ON public.epost_alias USING btree (standard) WHERE (standard = true);
CREATE UNIQUE INDEX IF NOT EXISTS epost_alias_zoho_send_mail_id_key ON public.epost_alias USING btree (zoho_send_mail_id);
CREATE INDEX IF NOT EXISTS epost_ko_due_idx ON public.epost_ko USING btree (status, schemalagd_till) WHERE (status = 'väntar'::text);
CREATE UNIQUE INDEX IF NOT EXISTS idx_epost_mallar_system_kod ON public.epost_mallar USING btree (system_kod) WHERE (system_kod IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS fakturering_snapshots_forslag_id_key ON public.fakturering_snapshots USING btree (forslag_id);
CREATE INDEX IF NOT EXISTS idx_fas_mall_faser_mall_id ON public.fas_mall_faser USING btree (mall_id);
CREATE INDEX IF NOT EXISTS idx_fas_mall_subfaser_fas_id ON public.fas_mall_subfaser USING btree (fas_id);
CREATE UNIQUE INDEX IF NOT EXISTS forslag_forslag_nummer_key ON public.forslag USING btree (forslag_nummer);
CREATE INDEX IF NOT EXISTS idx_forslag_projekt_id ON public.forslag USING btree (projekt_id);
CREATE INDEX IF NOT EXISTS idx_forslag_arbete_subfas_id ON public.forslag_arbetskostnad USING btree (subfas_id);
CREATE INDEX IF NOT EXISTS forslag_epost_refs_forslag_id_idx ON public.forslag_epost_refs USING btree (forslag_id);
CREATE INDEX IF NOT EXISTS idx_forslag_faser_forslag_id ON public.forslag_faser USING btree (forslag_id);
CREATE INDEX IF NOT EXISTS idx_forslag_material_subfas_id ON public.forslag_materialkostnad USING btree (subfas_id);
CREATE INDEX IF NOT EXISTS forslag_sms_log_forslag_id_idx ON public.forslag_sms_log USING btree (forslag_id);
CREATE INDEX IF NOT EXISTS idx_forslag_subfaser_fas_id ON public.forslag_subfaser USING btree (fas_id);
CREATE INDEX IF NOT EXISTS idx_forslag_ue_subfas_id ON public.forslag_underentreprenorer USING btree (subfas_id);
CREATE INDEX IF NOT EXISTS inventarier_lopnr_idx ON public.inventarier USING btree (lopnr);
CREATE INDEX IF NOT EXISTS kalender_event_dokument_event_idx ON public.kalender_event_dokument USING btree (event_id);
CREATE INDEX IF NOT EXISTS kalender_events_fas_idx ON public.kalender_events USING btree (fas_id);
CREATE INDEX IF NOT EXISTS kalender_events_kalender_idx ON public.kalender_events USING btree (kalender_id);
CREATE INDEX IF NOT EXISTS kalender_events_kund_idx ON public.kalender_events USING btree (kund_id);
CREATE INDEX IF NOT EXISTS kalender_events_open_idx ON public.kalender_events USING btree (start) WHERE (slutford = false);
CREATE INDEX IF NOT EXISTS kalender_events_projekt_idx ON public.kalender_events USING btree (projekt_id);
CREATE INDEX IF NOT EXISTS kalender_events_start_idx ON public.kalender_events USING btree (start);
CREATE INDEX IF NOT EXISTS idx_kund_avslutsfeedback_kund ON public.kund_avslutsfeedback USING btree (kund_id);
CREATE UNIQUE INDEX IF NOT EXISTS kund_avslutsfeedback_token_key ON public.kund_avslutsfeedback USING btree (token);
CREATE INDEX IF NOT EXISTS idx_kund_portal_invite_queue_pending ON public.kund_portal_invite_queue USING btree (created_at) WHERE (processed_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_kund_users_auth ON public.kund_users USING btree (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_kund_users_kund ON public.kund_users USING btree (kund_id);
CREATE UNIQUE INDEX IF NOT EXISTS kund_users_auth_user_id_kund_id_key ON public.kund_users USING btree (auth_user_id, kund_id);
CREATE INDEX IF NOT EXISTS idx_kunder_status ON public.kunder USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS kunder_kundnummer_key ON public.kunder USING btree (kundnummer);
CREATE INDEX IF NOT EXISTS kvitton_datum_idx ON public.kvitton USING btree (datum DESC);
CREATE INDEX IF NOT EXISTS kvitton_projekt_id_idx ON public.kvitton USING btree (projekt_id);
CREATE INDEX IF NOT EXISTS kvitton_skapad_av_idx ON public.kvitton USING btree (skapad_av_user_id);
CREATE INDEX IF NOT EXISTS kvitton_status_idx ON public.kvitton USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS material_import_config_leverantor_id_key ON public.material_import_config USING btree (leverantor_id);
CREATE INDEX IF NOT EXISTS idx_material_katalog_namn_trgm ON public.material_katalog USING gin (namn gin_trgm_ops);
CREATE INDEX IF NOT EXISTS material_katalog_aktiv_idx ON public.material_katalog USING btree (aktiv);
CREATE INDEX IF NOT EXISTS material_katalog_leverantor_idx ON public.material_katalog USING btree (leverantor_id);
CREATE INDEX IF NOT EXISTS material_katalog_namn_idx ON public.material_katalog USING btree (lower(namn));
CREATE INDEX IF NOT EXISTS idx_order_rader_order_id ON public.order_rader USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_ordrar_fas_id ON public.ordrar USING btree (fas_id);
CREATE INDEX IF NOT EXISTS idx_ordrar_kund_id ON public.ordrar USING btree (kund_id);
CREATE INDEX IF NOT EXISTS idx_ordrar_projekt_id ON public.ordrar USING btree (projekt_id);
CREATE INDEX IF NOT EXISTS idx_ordrar_status ON public.ordrar USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ordrar_subfas_id ON public.ordrar USING btree (subfas_id);
CREATE UNIQUE INDEX IF NOT EXISTS ordrar_order_nummer_key ON public.ordrar USING btree (order_nummer);
CREATE UNIQUE INDEX IF NOT EXISTS pdf_mallar_typ_key ON public.pdf_mallar USING btree (typ);
CREATE UNIQUE INDEX IF NOT EXISTS personal_personal_nummer_key ON public.personal USING btree (personal_nummer);
CREATE INDEX IF NOT EXISTS personal_personnummer_idx ON public.personal USING btree (personnummer);
CREATE INDEX IF NOT EXISTS personal_status_idx ON public.personal USING btree (status);
CREATE INDEX IF NOT EXISTS personal_supabase_user_id_idx ON public.personal USING btree (supabase_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS personal_supabase_user_id_key ON public.personal USING btree (supabase_user_id);
CREATE INDEX IF NOT EXISTS personal_anteckningar_personal_id_idx ON public.personal_anteckningar USING btree (personal_id);
CREATE INDEX IF NOT EXISTS idx_personal_chat_personal_id_skapad_at ON public.personal_chat USING btree (personal_id, skapad_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_dokument_personal_kategori ON public.personal_dokument USING btree (personal_id, kategori, skapad_at DESC);
CREATE INDEX IF NOT EXISTS personal_dokument_personal_id_idx ON public.personal_dokument USING btree (personal_id);
CREATE INDEX IF NOT EXISTS personal_ledighet_personal_id_idx ON public.personal_ledighet USING btree (personal_id);
CREATE INDEX IF NOT EXISTS personal_ledighet_status_idx ON public.personal_ledighet USING btree (status);
CREATE INDEX IF NOT EXISTS personal_loneposter_manad_idx ON public.personal_loneposter USING btree (manad);
CREATE INDEX IF NOT EXISTS personal_loneposter_personal_id_idx ON public.personal_loneposter USING btree (personal_id);
CREATE INDEX IF NOT EXISTS personal_statusar_sortering_idx ON public.personal_statusar USING btree (sortering);
CREATE INDEX IF NOT EXISTS personal_tidrapport_datum_idx ON public.personal_tidrapport USING btree (datum);
CREATE UNIQUE INDEX IF NOT EXISTS personal_tidrapport_personal_datum_unique ON public.personal_tidrapport USING btree (personal_id, datum);
CREATE INDEX IF NOT EXISTS personal_tidrapport_personal_id_idx ON public.personal_tidrapport USING btree (personal_id);
CREATE INDEX IF NOT EXISTS personal_tidrapport_projekt_id_idx ON public.personal_tidrapport USING btree (projekt_id);
CREATE INDEX IF NOT EXISTS personal_tidrapport_status_idx ON public.personal_tidrapport USING btree (status);
CREATE INDEX IF NOT EXISTS idx_projekt_kund_id ON public.projekt USING btree (kund_id);
CREATE INDEX IF NOT EXISTS idx_projekt_status ON public.projekt USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS projekt_projekt_nummer_key ON public.projekt USING btree (projekt_nummer);
CREATE INDEX IF NOT EXISTS projekt_aktiviteter_projekt_id_idx ON public.projekt_aktiviteter USING btree (projekt_id);
CREATE INDEX IF NOT EXISTS idx_projekt_anteckningar_projekt_id ON public.projekt_anteckningar USING btree (projekt_id);
CREATE INDEX IF NOT EXISTS idx_projekt_context_projekt_id ON public.projekt_context USING btree (projekt_id);
CREATE INDEX IF NOT EXISTS projekt_dokument_projekt_id_idx ON public.projekt_dokument USING btree (projekt_id);
CREATE INDEX IF NOT EXISTS projekt_dokument_projekt_kategori_idx ON public.projekt_dokument USING btree (projekt_id, kategori);
CREATE INDEX IF NOT EXISTS projekt_dokument_uppladdad_av_personal_id_idx ON public.projekt_dokument USING btree (uppladdad_av_personal_id);
CREATE INDEX IF NOT EXISTS idx_frageblankett_projekt ON public.projekt_frageblankett USING btree (projekt_id);
CREATE INDEX IF NOT EXISTS idx_frageblankett_token ON public.projekt_frageblankett USING btree (token);
CREATE UNIQUE INDEX IF NOT EXISTS projekt_frageblankett_token_key ON public.projekt_frageblankett USING btree (token);
CREATE INDEX IF NOT EXISTS projekt_personal_personal_id_idx ON public.projekt_personal USING btree (personal_id);
CREATE INDEX IF NOT EXISTS projekt_personal_projekt_id_idx ON public.projekt_personal USING btree (projekt_id);
CREATE UNIQUE INDEX IF NOT EXISTS projekt_personal_projekt_id_personal_id_key ON public.projekt_personal USING btree (projekt_id, personal_id);
CREATE INDEX IF NOT EXISTS projekt_sms_log_projekt_id_skapad_at_idx ON public.projekt_sms_log USING btree (projekt_id, skapad_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS projekt_statusar_namn_key ON public.projekt_statusar USING btree (namn);
CREATE INDEX IF NOT EXISTS sequence_runs_resumable_idx ON public.sequence_runs USING btree (sequence_id, projekt_id, uppdaterad_at DESC) WHERE (status = 'fel'::text);
CREATE INDEX IF NOT EXISTS sequence_runs_sequence_idx ON public.sequence_runs USING btree (sequence_id, startad_at DESC);
CREATE INDEX IF NOT EXISTS idx_signatur_fritta_dokument_projekt ON public.signatur_fritta_dokument USING btree (projekt_id);
CREATE INDEX IF NOT EXISTS idx_signatur_lankar_doc ON public.signatur_lankar USING btree (dokument_typ, dokument_id);
CREATE INDEX IF NOT EXISTS idx_signatur_lankar_pending ON public.signatur_lankar USING btree (signerad_at) WHERE (signerad_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_signatur_lankar_token ON public.signatur_lankar USING btree (token);
CREATE UNIQUE INDEX IF NOT EXISTS signatur_lankar_token_key ON public.signatur_lankar USING btree (token);
CREATE INDEX IF NOT EXISTS idx_wf_runs_startad_at ON public.workflow_runs USING btree (startad_at DESC);
CREATE INDEX IF NOT EXISTS idx_wf_runs_workflow_id ON public.workflow_runs USING btree (workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_triggers_seccion ON public.workflow_triggers USING btree (seccion);

-- Functions
CREATE OR REPLACE FUNCTION public.carry_over_kalender()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  today_local date := (now() at time zone 'Europe/Stockholm')::date;
  moved_count int;
begin
  with updated as (
    update public.kalender_events e
    set
      start = (today_local + ((e.start at time zone 'Europe/Stockholm')::time))
              at time zone 'Europe/Stockholm',
      slut  = (today_local + ((e.slut  at time zone 'Europe/Stockholm')::time))
              at time zone 'Europe/Stockholm',
      uppdaterad_at = now()
    where e.slutford = false
      and e.aterkommer = false
      and (e.start at time zone 'Europe/Stockholm')::date < today_local
    returning 1
  )
  select count(*) into moved_count from updated;

  update public.cron_jobs
  set last_run_at = now(),
      last_status = 'ok',
      last_result = jsonb_build_object('moved', moved_count)::text
  where id = 'kalender_carry_over';

  return jsonb_build_object('moved', moved_count);
exception when others then
  update public.cron_jobs
  set last_run_at = now(),
      last_status = 'error',
      last_result = sqlerrm
  where id = 'kalender_carry_over';
  raise;
end;
$function$;

CREATE OR REPLACE FUNCTION public.clear_change_request(p_link_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link        signatur_lankar%ROWTYPE;
  v_log_aktiv   BOOLEAN;
  v_doc_nummer  TEXT;
  v_doc_titel   TEXT;
  v_projekt_id  UUID;
BEGIN
  SELECT * INTO v_link FROM signatur_lankar WHERE id = p_link_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;

  UPDATE signatur_lankar
     SET andring_begard_at  = NULL,
         revisioner_historik = revisioner_historik
                               || jsonb_build_array(jsonb_build_object('at', now()))
   WHERE id = v_link.id;

  IF v_link.dokument_typ = 'forslag' THEN
    UPDATE forslag
       SET status = 'Skickat'
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, forslag_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
  END IF;

  SELECT aktiv INTO v_log_aktiv
    FROM aktivitetslogg_installningar
   WHERE handelse = 'signatur_inskickad';

  IF v_log_aktiv IS TRUE AND v_projekt_id IS NOT NULL THEN
    INSERT INTO projekt_anteckningar (projekt_id, titel, innehall)
    VALUES (
      v_projekt_id,
      format('Skickat uppdaterad version — offert %s', COALESCE(v_doc_nummer, v_doc_titel, '')),
      to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI')
    );
  END IF;

  RETURN jsonb_build_object('status', 'cleared');
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_kund_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT kund_id
    FROM public.kund_users
   WHERE auth_user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.delete_signing_link(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link signatur_lankar%ROWTYPE;
BEGIN
  SELECT * INTO v_link FROM signatur_lankar WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_link.signerad_at IS NOT NULL THEN
    IF v_link.dokument_typ = 'forslag' THEN
      UPDATE forslag
         SET status        = 'Utkast',
             godkand_av    = NULL,
             godkand_datum = NULL,
             signatur_data = NULL
       WHERE id = v_link.dokument_id;
    ELSIF v_link.dokument_typ = 'order' THEN
      UPDATE ordrar
         SET status        = 'Utkast',
             godkand_av    = NULL,
             godkand_datum = NULL,
             signatur_data = NULL
       WHERE id = v_link.dokument_id;
    END IF;
  END IF;

  DELETE FROM signatur_lankar WHERE id = p_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.exec_cron_command(p_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cmd text;
begin
  select sql_command into cmd from public.cron_jobs where id = p_id;
  if cmd is null then
    raise exception 'cron job % not found', p_id;
  end if;
  execute cmd;
end;
$function$;

CREATE OR REPLACE FUNCTION public.find_material_candidates(p_sokterm text, p_min_similarity double precision DEFAULT 0.35, p_limit integer DEFAULT 1)
 RETURNS TABLE(id uuid, artikel_nummer text, namn text, enhet text, a_pris double precision, leverantor_id uuid, similarity_score double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    id,
    artikel_nummer,
    namn,
    enhet,
    a_pris::float8,
    leverantor_id,
    similarity(namn, p_sokterm)::float8 AS similarity_score
  FROM material_katalog
  WHERE aktiv = true
    AND similarity(namn, p_sokterm) >= p_min_similarity
  ORDER BY similarity_score DESC
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.format_personnummer(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH n AS (SELECT normalize_personnummer(p) AS d)
  SELECT CASE
    WHEN length(d) = 12 THEN substring(d, 1, 8) || '-' || substring(d, 9, 4)
    WHEN length(d) = 10 THEN substring(d, 1, 6) || '-' || substring(d, 7, 4)
    ELSE COALESCE(p, '')
  END
  FROM n
$function$;

CREATE OR REPLACE FUNCTION public.get_avslutsfeedback(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  r kund_avslutsfeedback%ROWTYPE;
BEGIN
  SELECT * INTO r FROM kund_avslutsfeedback WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF r.status = 'besvarat' THEN
    RETURN jsonb_build_object('status', 'besvarat', 'answers_json', r.answers_json, 'questions_json', r.questions_json, 'projekt_namn', r.projekt_namn);
  END IF;
  RETURN jsonb_build_object('status', 'ok', 'questions_json', r.questions_json, 'projekt_namn', r.projekt_namn);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_frageblankett(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.projekt_frageblankett%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.projekt_frageblankett WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_row.status = 'besvarat' THEN
    RETURN jsonb_build_object('status', 'besvarat');
  END IF;

  -- Mark as sent on first open
  IF v_row.skickat_at IS NULL THEN
    UPDATE public.projekt_frageblankett
    SET skickat_at = now(), status = 'skickat'
    WHERE token = p_token;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'titel', v_row.titel,
    'questions_json', v_row.questions_json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_signing_doc(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link        signatur_lankar%ROWTYPE;
  v_status      TEXT;
  v_doc         jsonb;
  v_lines       jsonb;
  v_kund        jsonb;
  v_projekt     jsonb;
  v_foretag     jsonb;
  v_xff         TEXT;
  v_request_ip  TEXT;
  v_first_open  BOOLEAN := FALSE;
  v_should_log  BOOLEAN := FALSE;
  v_new_count   INTEGER;
  v_log_aktiv   BOOLEAN;
  v_projekt_id  UUID;
BEGIN
  SELECT * INTO v_link FROM signatur_lankar WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  BEGIN
    v_xff := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    IF v_xff IS NOT NULL THEN
      v_request_ip := split_part(v_xff, ',', 1);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_request_ip := NULL;
  END;

  IF v_link.revoked_at IS NOT NULL THEN
    v_status := 'revoked';
  ELSIF v_link.signerad_at IS NOT NULL THEN
    v_status := 'signed';
  ELSIF v_link.gar_ut_at < now() THEN
    v_status := 'expired';
  ELSE
    v_status := 'ok';

    v_first_open := v_link.oppnad_at IS NULL;
    v_should_log := v_first_open
                 OR v_link.last_oppnad_at IS NULL
                 OR v_link.last_oppnad_at < now() - interval '30 minutes';

    UPDATE signatur_lankar
       SET view_count     = view_count + 1,
           last_oppnad_at = now(),
           oppnad_at      = COALESCE(oppnad_at, now())
     WHERE id = v_link.id
     RETURNING view_count INTO v_new_count;

    IF v_should_log AND v_link.dokument_typ = 'forslag' THEN
      SELECT aktiv INTO v_log_aktiv
        FROM aktivitetslogg_installningar
       WHERE handelse = 'kund_oppnade_forslag';

      IF v_log_aktiv IS TRUE THEN
        SELECT projekt_id INTO v_projekt_id
          FROM forslag WHERE id = v_link.dokument_id;

        IF v_projekt_id IS NOT NULL THEN
          INSERT INTO projekt_aktiviteter (projekt_id, text)
          VALUES (
            v_projekt_id,
            CASE
              WHEN v_first_open THEN 'Kund öppnade offert (första gången)'
              ELSE format('Kund öppnade offert igen (%s gånger totalt)', v_new_count)
            END
          );
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_link.dokument_typ = 'forslag' THEN
    SELECT to_jsonb(f) INTO v_doc FROM forslag f WHERE f.id = v_link.dokument_id;
    IF v_doc IS NULL THEN RETURN jsonb_build_object('status', 'not_found'); END IF;

    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ff.id, 'namn', ff.namn, 'beskrivning', ff.beskrivning, 'sortering', ff.sortering,
        'subfaser', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', sf.id, 'namn', sf.namn, 'beskrivning', sf.beskrivning, 'sortering', sf.sortering,
              'arbete',   COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.skapad_at) FROM forslag_arbetskostnad a WHERE a.subfas_id = sf.id), '[]'::jsonb),
              'material', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.skapad_at) FROM forslag_materialkostnad m WHERE m.subfas_id = sf.id), '[]'::jsonb),
              'underentreprenorer', COALESCE((SELECT jsonb_agg(to_jsonb(ue) ORDER BY ue.skapad_at) FROM forslag_underentreprenorer ue WHERE ue.subfas_id = sf.id), '[]'::jsonb)
            ) ORDER BY sf.sortering, sf.skapad_at)
          FROM forslag_subfaser sf WHERE sf.fas_id = ff.id
        ), '[]'::jsonb)
      ) ORDER BY ff.sortering, ff.skapad_at
    ) INTO v_lines
    FROM forslag_faser ff WHERE ff.forslag_id = v_link.dokument_id;
    v_lines := COALESCE(v_lines, '[]'::jsonb);

    SELECT to_jsonb(p) INTO v_projekt FROM projekt p WHERE p.id = (v_doc->>'projekt_id')::uuid;
    SELECT to_jsonb(k) INTO v_kund FROM kunder k WHERE k.id = (v_projekt->>'kund_id')::uuid;
  ELSIF v_link.dokument_typ = 'order' THEN
    SELECT to_jsonb(o) INTO v_doc FROM ordrar o WHERE o.id = v_link.dokument_id;
    IF v_doc IS NULL THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
    SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.sortering, r.skapad_at), '[]'::jsonb)
      INTO v_lines FROM order_rader r WHERE r.order_id = v_link.dokument_id;
    SELECT to_jsonb(p) INTO v_projekt FROM projekt p WHERE p.id = (v_doc->>'projekt_id')::uuid;
    SELECT to_jsonb(k) INTO v_kund FROM kunder k WHERE k.id = (v_doc->>'kund_id')::uuid;
  ELSIF v_link.dokument_typ = 'fritt' THEN
    SELECT to_jsonb(d) INTO v_doc
      FROM signatur_fritta_dokument d
     WHERE d.id = v_link.dokument_id;
    IF v_doc IS NULL THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
    v_lines := '[]'::jsonb;
    SELECT to_jsonb(p) INTO v_projekt FROM projekt p WHERE p.id = (v_doc->>'projekt_id')::uuid;
    SELECT to_jsonb(k) INTO v_kund   FROM kunder k WHERE k.id = (v_projekt->>'kund_id')::uuid;
  END IF;

  SELECT jsonb_build_object(
    'foretag_namn',          a.foretag_namn,
    'foretag_org_nummer',    a.foretag_org_nummer,
    'foretag_adress',        a.foretag_adress,
    'foretag_postnummer',    a.foretag_postnummer,
    'foretag_stad',          a.foretag_stad,
    'foretag_telefon',       a.foretag_telefon,
    'foretag_email',         a.foretag_email,
    'foretag_webbadress',    a.foretag_webbadress,
    'foretag_logo_url',      a.foretag_logo_url,
    'valuta',                a.valuta
  ) INTO v_foretag
  FROM app_installningar a LIMIT 1;

  RETURN jsonb_build_object(
    'status',                 v_status,
    'doc_typ',                v_link.dokument_typ,
    'doc',                    v_doc,
    'lines',                  COALESCE(v_lines, '[]'::jsonb),
    'kund',                   v_kund,
    'projekt',                v_projekt,
    'foretag',                v_foretag,
    'gar_ut_at',              v_link.gar_ut_at,
    'kund_email',             v_link.kund_email,
    'request_ip',             v_request_ip,
    'signerad_at',            v_link.signerad_at,
    'signerad_namn',          v_link.signerad_namn,
    'signerad_ip',            v_link.signerad_ip,
    'signerad_personnummer',  v_link.signerad_personnummer,
    'signerad_metod',         v_link.signerad_metod,
    'signerad_dokument_hash', v_link.signerad_dokument_hash,
    'andring_begard_at',      v_link.andring_begard_at,
    'andring_historik',       v_link.andring_historik,
    'revisioner_historik',    v_link.revisioner_historik,
    'document_pdf_url',       v_link.document_pdf_url,
    'final_document_pdf_url', v_link.final_document_pdf_url,
    'specifikation_pdf_url',  v_link.specifikation_pdf_url,
    'tidplan_pdf_url',        v_link.tidplan_pdf_url,
    'signed_pdf_url',         v_link.signed_pdf_url
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.inject_template_vars(template text, vars jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result TEXT := COALESCE(template, '');
  k TEXT;
BEGIN
  IF vars IS NULL THEN RETURN result; END IF;
  FOR k IN SELECT jsonb_object_keys(vars) LOOP
    result := replace(result, '{{' || k || '}}', COALESCE(vars->>k, ''));
  END LOOP;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_app_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.app_admins WHERE auth_user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_kund_user_for(check_kund_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.kund_users
     WHERE auth_user_id = auth.uid()
       AND kund_id = check_kund_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.kvitton_set_uppdaterad_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.uppdaterad_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_personal_to_auth()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_email     text;
  active_count   int;
  matched_row    personal%ROWTYPE;
BEGIN
  user_email := lower(auth.jwt() ->> 'email');
  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT count(*) INTO active_count
  FROM personal
  WHERE supabase_user_id IS NULL
    AND lower(status) <> 'inaktiv'
    AND lower(email) = user_email;

  IF active_count > 1 THEN
    RETURN jsonb_build_object('status', 'ambiguous');
  END IF;

  IF active_count = 0 THEN
    IF EXISTS (
      SELECT 1 FROM personal
      WHERE lower(email) = user_email
        AND lower(status) = 'inaktiv'
    ) THEN
      RETURN jsonb_build_object('status', 'inactive');
    END IF;
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  UPDATE personal
  SET supabase_user_id = auth.uid()
  WHERE supabase_user_id IS NULL
    AND lower(status) <> 'inaktiv'
    AND lower(email) = user_email
  RETURNING * INTO matched_row;

  IF matched_row.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  RETURN jsonb_build_object('status', 'linked', 'record', to_jsonb(matched_row));
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_my_kund_users_accepted()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.kund_users
     SET accepted_at = now()
   WHERE auth_user_id = auth.uid()
     AND accepted_at IS NULL;
$function$;

CREATE OR REPLACE FUNCTION public.nextval_ata_nummer()
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT nextval('ata_nummer_seq');
$function$;

CREATE OR REPLACE FUNCTION public.nextval_forslag_nummer()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT nextval('forslag_nummer_seq') $function$;

CREATE OR REPLACE FUNCTION public.nextval_kunder_nummer()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT nextval('kunder_nummer_seq');
$function$;

CREATE OR REPLACE FUNCTION public.nextval_order_nummer()
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT nextval('order_nummer_seq');
$function$;

CREATE OR REPLACE FUNCTION public.nextval_personal_nummer()
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT nextval('personal_nummer_seq');
$function$;

CREATE OR REPLACE FUNCTION public.nextval_projekt_nummer()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT nextval('projekt_nummer_seq') $function$;

CREATE OR REPLACE FUNCTION public.normalize_personnummer(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT regexp_replace(COALESCE(p, ''), '[^0-9]', '', 'g')
$function$;

CREATE OR REPLACE FUNCTION public.peek_ata_nummer()
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END
  FROM ata_nummer_seq;
$function$;

CREATE OR REPLACE FUNCTION public.peek_forslag_nummer()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM forslag_nummer_seq $function$;

CREATE OR REPLACE FUNCTION public.peek_kunder_nummer()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END
  FROM kunder_nummer_seq;
$function$;

CREATE OR REPLACE FUNCTION public.peek_order_nummer()
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END
  FROM order_nummer_seq;
$function$;

CREATE OR REPLACE FUNCTION public.peek_personal_nummer()
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT last_value + 1 FROM personal_nummer_seq;
$function$;

CREATE OR REPLACE FUNCTION public.peek_projekt_nummer()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM projekt_nummer_seq $function$;

CREATE OR REPLACE FUNCTION public.protect_inbyggd_statusar()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.inbyggd IS TRUE THEN
      RAISE EXCEPTION 'Statusen "%" är inbyggd och kan inte tas bort.', OLD.namn
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.inbyggd IS TRUE AND NEW.namn IS DISTINCT FROM OLD.namn THEN
      RAISE EXCEPTION 'Statusen "%" är inbyggd och kan inte byta namn.', OLD.namn
        USING ERRCODE = 'check_violation';
    END IF;
    -- Don't let admins flip inbyggd off either — that would defeat the lock.
    IF OLD.inbyggd IS TRUE AND NEW.inbyggd IS FALSE THEN
      RAISE EXCEPTION 'Statusen "%" är inbyggd och kan inte avmarkeras.', OLD.namn
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_signature_changes(p_token text, p_reason text, p_ua text, p_bilder_urls text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link           signatur_lankar%ROWTYPE;
  v_reason         TEXT;
  v_xff            TEXT;
  v_ip             INET;
  v_log_aktiv      BOOLEAN;
  v_kund_namn      TEXT;
  v_doc_titel      TEXT;
  v_doc_nummer     TEXT;
  v_projekt_id     UUID;
  v_foretag_email  TEXT;
  v_alias_id       UUID;
  v_alias_signatur TEXT := '';
  v_mall_admin     RECORD;
  v_use_alias      UUID;
  v_amne           TEXT;
  v_kropp          TEXT;
  v_vars           jsonb;
  v_datum          TEXT;
  v_bilder_block   TEXT;
  v_url            TEXT;
BEGIN
  IF p_token IS NULL OR p_reason IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  v_reason := trim(p_reason);
  IF length(v_reason) < 5 THEN
    RETURN jsonb_build_object('status', 'invalid_reason');
  END IF;

  SELECT * INTO v_link FROM signatur_lankar WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'revoked'); END IF;
  IF v_link.signerad_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'signed'); END IF;
  IF v_link.gar_ut_at < now()      THEN RETURN jsonb_build_object('status', 'expired'); END IF;
  IF v_link.dokument_typ <> 'forslag' THEN
    RETURN jsonb_build_object('status', 'unsupported_doc_typ');
  END IF;

  BEGIN
    v_xff := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    IF v_xff IS NOT NULL THEN
      v_ip := split_part(v_xff, ',', 1)::inet;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  UPDATE signatur_lankar
     SET andring_begard_at = now(),
         andring_historik  = andring_historik
                             || jsonb_build_array(jsonb_build_object(
                                  'at',     now(),
                                  'reason', v_reason,
                                  'ip',     v_ip::text,
                                  'ua',     p_ua,
                                  'bilder', to_jsonb(COALESCE(p_bilder_urls, '{}'))
                                ))
   WHERE id = v_link.id;

  UPDATE forslag
     SET status = 'Ändring begärd'
   WHERE id = v_link.dokument_id
   RETURNING projekt_id, titel, forslag_nummer
     INTO v_projekt_id, v_doc_titel, v_doc_nummer;

  SELECT aktiv INTO v_log_aktiv
    FROM aktivitetslogg_installningar
   WHERE handelse = 'signatur_inskickad';

  IF v_log_aktiv IS TRUE THEN
    SELECT k.namn INTO v_kund_namn FROM kunder k WHERE k.id = v_link.kund_id;
    SELECT a.foretag_email INTO v_foretag_email FROM app_installningar a LIMIT 1;

    IF v_projekt_id IS NOT NULL THEN
      INSERT INTO projekt_anteckningar (projekt_id, titel, innehall)
      VALUES (
        v_projekt_id,
        format('Kund begärde ändring — offert %s', COALESCE(v_doc_nummer, v_doc_titel, '')),
        format(
          E'%s\nIP: %s\n\n%s',
          to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
          COALESCE(v_ip::text, '—'),
          v_reason
        )
      );
    END IF;

    SELECT id INTO v_alias_id FROM epost_alias WHERE aktiv ORDER BY standard DESC NULLS LAST, sortering LIMIT 1;
    v_datum := to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI');

    -- Build image block for admin email: small clickable thumbnails or empty string
    v_bilder_block := '';
    IF p_bilder_urls IS NOT NULL AND array_length(p_bilder_urls, 1) > 0 THEN
      v_bilder_block := '<div style="margin:14px 0 0;display:flex;flex-wrap:wrap;gap:8px">';
      FOREACH v_url IN ARRAY p_bilder_urls LOOP
        v_bilder_block := v_bilder_block
          || format(
               '<a href="%s" target="_blank" rel="noreferrer" style="display:block"><img src="%s" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #e5e5e5"></a>',
               v_url, v_url
             );
      END LOOP;
      v_bilder_block := v_bilder_block || '</div>';
    END IF;

    v_vars := jsonb_build_object(
      'kund_namn',      COALESCE(v_kund_namn, '—'),
      'kund_email',     COALESCE(v_link.kund_email, '—'),
      'doc_nummer',     COALESCE(v_doc_nummer, ''),
      'titel',          COALESCE(v_doc_titel, ''),
      'datum',          v_datum,
      'anledning',      v_reason,
      'bilder_block',   v_bilder_block,
      'alias_signatur', ''
    );

    IF v_foretag_email IS NOT NULL AND length(v_foretag_email) > 0 THEN
      SELECT * INTO v_mall_admin
        FROM epost_mallar
       WHERE system_kod = 'signatur_andring_begard_admin_forslag' AND aktiv
       LIMIT 1;

      IF v_mall_admin IS NOT NULL THEN
        SELECT signatur_html INTO v_alias_signatur
          FROM epost_alias WHERE id = v_mall_admin.alias_id;
        v_vars := v_vars || jsonb_build_object('alias_signatur', COALESCE(v_alias_signatur, ''));
        v_use_alias := COALESCE(v_mall_admin.alias_id, v_alias_id);
        v_amne  := inject_template_vars(v_mall_admin.amne, v_vars);
        v_kropp := inject_template_vars(v_mall_admin.kropp_html, v_vars);

        INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
        VALUES (
          v_use_alias, v_foretag_email, v_amne, v_kropp,
          v_link.kund_id, v_projekt_id, v_link.dokument_id,
          now(), 'väntar'
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'received');
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_signature_changes(p_token text, p_reason text, p_ua text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link            signatur_lankar%ROWTYPE;
  v_reason          TEXT;
  v_xff             TEXT;
  v_ip              INET;
  v_log_aktiv       BOOLEAN;
  v_kund_namn       TEXT;
  v_doc_titel       TEXT;
  v_doc_nummer      TEXT;
  v_projekt_id      UUID;
  v_foretag_email   TEXT;
  v_alias_id        UUID;
  v_alias_signatur  TEXT := '';
  v_mall_admin      RECORD;
  v_use_alias       UUID;
  v_amne            TEXT;
  v_kropp           TEXT;
  v_vars            jsonb;
  v_datum           TEXT;
BEGIN
  IF p_token IS NULL OR p_reason IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  v_reason := trim(p_reason);
  IF length(v_reason) < 5 THEN
    RETURN jsonb_build_object('status', 'invalid_reason');
  END IF;

  SELECT * INTO v_link FROM signatur_lankar WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'revoked'); END IF;
  IF v_link.signerad_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'signed'); END IF;
  IF v_link.gar_ut_at < now()      THEN RETURN jsonb_build_object('status', 'expired'); END IF;
  IF v_link.dokument_typ NOT IN ('forslag', 'fritt') THEN
    RETURN jsonb_build_object('status', 'unsupported_doc_typ');
  END IF;

  BEGIN
    v_xff := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    IF v_xff IS NOT NULL THEN
      v_ip := split_part(v_xff, ',', 1)::inet;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  UPDATE signatur_lankar
     SET andring_begard_at = now(),
         andring_historik  = andring_historik
                             || jsonb_build_array(jsonb_build_object(
                                  'at',     now(),
                                  'reason', v_reason,
                                  'ip',     v_ip::text,
                                  'ua',     p_ua
                                ))
   WHERE id = v_link.id;

  IF v_link.dokument_typ = 'forslag' THEN
    UPDATE forslag
       SET status = 'Ändring begärd'
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, forslag_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
  ELSE
    -- 'fritt' — no status column, just look up the title for the audit trail.
    SELECT projekt_id, titel, NULL::text
      INTO v_projekt_id, v_doc_titel, v_doc_nummer
      FROM signatur_fritta_dokument
     WHERE id = v_link.dokument_id;
  END IF;

  -- Audit trail: anteckning + admin email, mirroring submit_signature.
  SELECT aktiv INTO v_log_aktiv
    FROM aktivitetslogg_installningar
   WHERE handelse = 'signatur_inskickad';

  IF v_log_aktiv IS TRUE THEN
    SELECT k.namn INTO v_kund_namn FROM kunder k WHERE k.id = v_link.kund_id;
    SELECT a.foretag_email INTO v_foretag_email FROM app_installningar a LIMIT 1;

    IF v_projekt_id IS NOT NULL THEN
      INSERT INTO projekt_anteckningar (projekt_id, innehall)
      VALUES (
        v_projekt_id,
        format(
          E'Kund begärde ändring på %s %s\n%s\n\n%s',
          CASE v_link.dokument_typ WHEN 'forslag' THEN 'offert' ELSE 'dokument' END,
          COALESCE(v_doc_nummer, v_doc_titel, ''),
          to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
          v_reason
        )
      );
    END IF;

    SELECT id INTO v_alias_id FROM epost_alias WHERE aktiv ORDER BY standard DESC NULLS LAST, sortering LIMIT 1;
    v_datum := to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI');

    v_vars := jsonb_build_object(
      'kund_namn',      COALESCE(v_kund_namn, '—'),
      'kund_email',     COALESCE(v_link.kund_email, '—'),
      'doc_nummer',     COALESCE(v_doc_nummer, ''),
      'titel',          COALESCE(v_doc_titel, ''),
      'datum',          v_datum,
      'anledning',      v_reason,
      'alias_signatur', ''
    );

    IF v_foretag_email IS NOT NULL AND length(v_foretag_email) > 0 THEN
      -- Try the type-specific template first, then fall back to a generic one
      -- so 'fritt' works even on installations that haven't customised it.
      SELECT * INTO v_mall_admin
        FROM epost_mallar
       WHERE system_kod = 'signatur_andring_begard_admin_' ||
                          CASE v_link.dokument_typ WHEN 'fritt' THEN 'dokument' ELSE v_link.dokument_typ END
         AND aktiv
       LIMIT 1;
      IF v_mall_admin IS NULL AND v_link.dokument_typ <> 'forslag' THEN
        SELECT * INTO v_mall_admin
          FROM epost_mallar
         WHERE system_kod = 'signatur_andring_begard_admin_dokument' AND aktiv
         LIMIT 1;
      END IF;

      IF v_mall_admin IS NOT NULL THEN
        SELECT signatur_html INTO v_alias_signatur
          FROM epost_alias WHERE id = v_mall_admin.alias_id;
        v_vars := v_vars || jsonb_build_object('alias_signatur', COALESCE(v_alias_signatur, ''));
        v_use_alias := COALESCE(v_mall_admin.alias_id, v_alias_id);
        v_amne  := inject_template_vars(v_mall_admin.amne, v_vars);
        v_kropp := inject_template_vars(v_mall_admin.kropp_html, v_vars);

        INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
        VALUES (
          v_use_alias, v_foretag_email, v_amne, v_kropp,
          v_link.kund_id, v_projekt_id,
          CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
          now(), 'väntar'
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'received');
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_signing_link(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE signatur_lankar SET revoked_at = now() WHERE id = p_id AND revoked_at IS NULL;
$function$;

CREATE OR REPLACE FUNCTION public.setval_ata_nummer(new_value bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT setval('ata_nummer_seq', new_value, false);
$function$;

CREATE OR REPLACE FUNCTION public.setval_forslag_nummer(new_value bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT setval('forslag_nummer_seq', new_value, false);
$function$;

CREATE OR REPLACE FUNCTION public.setval_kunder_nummer(new_value bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT setval('kunder_nummer_seq', new_value, false);
$function$;

CREATE OR REPLACE FUNCTION public.setval_order_nummer(new_value bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT setval('order_nummer_seq', new_value, false);
$function$;

CREATE OR REPLACE FUNCTION public.setval_personal_nummer(new_value bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM setval('personal_nummer_seq', new_value);
END;
$function$;

CREATE OR REPLACE FUNCTION public.setval_projekt_nummer(new_value bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT setval('projekt_nummer_seq', new_value, false);
$function$;

CREATE OR REPLACE FUNCTION public.signatur_lank_uploadable(p_token text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM signatur_lankar
    WHERE token = p_token
      AND revoked_at IS NULL
      AND signerad_at IS NULL
      AND gar_ut_at >= now()
  );
$function$;

CREATE OR REPLACE FUNCTION public.submit_avslutsfeedback(p_token text, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE kund_avslutsfeedback
  SET answers_json = p_answers, status = 'besvarat', besvarat_at = now()
  WHERE token = p_token AND status = 'skickat';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_answered');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_frageblankett(p_token text, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.projekt_frageblankett%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.projekt_frageblankett WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_row.status = 'besvarat' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_answered');
  END IF;

  IF v_row.status != 'skickat' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_available');
  END IF;

  UPDATE public.projekt_frageblankett
  SET answers_json = p_answers, status = 'besvarat', besvarat_at = now()
  WHERE token = p_token;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_signature(p_token text, p_namn text, p_signatur text, p_ua text, p_pdf_url text DEFAULT NULL::text, p_personnummer text DEFAULT NULL::text, p_dokument_hash text DEFAULT NULL::text, p_specifikation_pdf_url text DEFAULT NULL::text, p_tidplan_pdf_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link              signatur_lankar%ROWTYPE;
  v_ip                INET;
  v_xff               TEXT;
  v_log_aktiv         BOOLEAN;
  v_projekt_id        UUID;
  v_kund_email        TEXT;
  v_kund_namn         TEXT;
  v_doc_titel         TEXT;
  v_doc_nummer        TEXT;
  v_foretag_namn      TEXT;
  v_foretag_email     TEXT;
  v_alias_id          UUID;
  v_acepterat_exists  BOOLEAN;
  v_auto_invite       BOOLEAN;
  v_pdf_button        TEXT := '';
  v_pdf_admin_line    TEXT := '';
  v_doc_typ_label     TEXT;
  v_doc_typ_label_def TEXT;
  v_datum             TEXT;
  v_alias_signatur    TEXT := '';
  v_vars              jsonb;
  v_mall_kund         RECORD;
  v_mall_admin        RECORD;
  v_amne              TEXT;
  v_kropp             TEXT;
  v_use_alias         UUID;
  v_kod_kund          TEXT;
  v_kod_admin         TEXT;
  v_signed_pnr_norm   TEXT;
  v_kund_pnr_norm     TEXT;
BEGIN
  IF p_token IS NULL OR p_namn IS NULL OR length(trim(p_namn)) = 0 OR p_signatur IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT * INTO v_link FROM signatur_lankar WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'revoked'); END IF;
  IF v_link.signerad_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'signed'); END IF;
  IF v_link.gar_ut_at < now() THEN RETURN jsonb_build_object('status', 'expired'); END IF;

  BEGIN
    v_xff := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    IF v_xff IS NOT NULL THEN
      v_ip := split_part(v_xff, ',', 1)::inet;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  UPDATE signatur_lankar
     SET signerad_at            = now(),
         signerad_namn          = trim(p_namn),
         signerad_ip            = v_ip,
         signerad_ua            = p_ua,
         signerad_personnummer  = NULLIF(trim(COALESCE(p_personnummer, '')), ''),
         signerad_metod         = 'epost_lank',
         signerad_dokument_hash = NULLIF(trim(COALESCE(p_dokument_hash, '')), ''),
         signatur_data          = p_signatur,
         signed_pdf_url         = p_pdf_url,
         specifikation_pdf_url  = COALESCE(NULLIF(p_specifikation_pdf_url, ''), v_link.specifikation_pdf_url),
         tidplan_pdf_url        = COALESCE(NULLIF(p_tidplan_pdf_url, ''), v_link.tidplan_pdf_url)
   WHERE id = v_link.id;

  IF v_link.dokument_typ = 'forslag' THEN
    UPDATE forslag
       SET status = 'accepterat',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, forslag_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;

    IF v_projekt_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM projekt_statusar WHERE namn = 'Acepterat')
        INTO v_acepterat_exists;
      IF v_acepterat_exists THEN
        UPDATE projekt SET status = 'Acepterat' WHERE id = v_projekt_id;
      END IF;
    END IF;
  ELSIF v_link.dokument_typ = 'order' THEN
    UPDATE ordrar
       SET status = 'Godkänd',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, order_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
  ELSIF v_link.dokument_typ = 'ata' THEN
    UPDATE ata
       SET status = 'Godkänd',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, ata_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
  ELSIF v_link.dokument_typ = 'fritt' THEN
    SELECT projekt_id, titel, NULL::text
      INTO v_projekt_id, v_doc_titel, v_doc_nummer
      FROM signatur_fritta_dokument
     WHERE id = v_link.dokument_id;
  END IF;

  -- Sync personnummer to the kund record (or flag a mismatch).
  IF v_link.kund_id IS NOT NULL AND p_personnummer IS NOT NULL THEN
    v_signed_pnr_norm := normalize_personnummer(p_personnummer);
    IF length(v_signed_pnr_norm) >= 10 THEN
      SELECT normalize_personnummer(personnummer) INTO v_kund_pnr_norm
        FROM kunder WHERE id = v_link.kund_id;

      IF v_kund_pnr_norm IS NULL OR length(v_kund_pnr_norm) = 0 THEN
        UPDATE kunder
           SET personnummer = format_personnummer(p_personnummer)
         WHERE id = v_link.kund_id;
      ELSIF right(v_kund_pnr_norm, 10) <> right(v_signed_pnr_norm, 10) THEN
        IF v_projekt_id IS NOT NULL THEN
          INSERT INTO projekt_anteckningar (projekt_id, titel, innehall)
          VALUES (
            v_projekt_id,
            'Personnummer-avvikelse vid signering',
            format(
              E'Kunden signerade med personnummer %s, men kundkortet i CRM:et har %s. Verifiera vilken uppgift som är korrekt.',
              format_personnummer(p_personnummer),
              format_personnummer(v_kund_pnr_norm)
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;

  SELECT aktiv INTO v_log_aktiv
    FROM aktivitetslogg_installningar
   WHERE handelse = 'signatur_inskickad';

  IF v_log_aktiv IS TRUE THEN
    v_kund_email := v_link.kund_email;
    SELECT k.namn INTO v_kund_namn FROM kunder k WHERE k.id = v_link.kund_id;

    SELECT a.foretag_namn, a.foretag_email INTO v_foretag_namn, v_foretag_email
      FROM app_installningar a LIMIT 1;

    IF v_projekt_id IS NOT NULL THEN
      INSERT INTO projekt_anteckningar (projekt_id, titel, innehall)
      VALUES (
        v_projekt_id,
        format('Signerad %s — %s',
               v_link.dokument_typ,
               COALESCE(v_doc_nummer, v_doc_titel, '')),
        format(
          E'Signerad av %s\n%s\nIP: %s',
          trim(p_namn),
          to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
          COALESCE(v_ip::text, '—')
        )
      );
    END IF;

    SELECT id INTO v_alias_id FROM epost_alias WHERE aktiv ORDER BY standard DESC NULLS LAST, sortering LIMIT 1;

    v_kod_kund  := 'signatur_bekraftelse_kund_'  || CASE v_link.dokument_typ WHEN 'fritt' THEN 'dokument' ELSE v_link.dokument_typ END;
    v_kod_admin := 'signatur_notifikation_admin_' || CASE v_link.dokument_typ WHEN 'fritt' THEN 'dokument' ELSE v_link.dokument_typ END;

    v_doc_typ_label     := CASE v_link.dokument_typ
                              WHEN 'forslag' THEN 'offert'
                              WHEN 'order'   THEN 'order'
                              WHEN 'ata'     THEN 'ÄTA-arbete'
                              ELSE 'dokument'
                            END;
    v_doc_typ_label_def := CASE v_link.dokument_typ
                              WHEN 'forslag' THEN 'offerten'
                              WHEN 'order'   THEN 'ordern'
                              WHEN 'ata'     THEN 'ÄTA-arbetet'
                              ELSE 'dokumentet'
                            END;
    v_datum             := to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI');

    IF p_pdf_url IS NOT NULL AND length(p_pdf_url) > 0 THEN
      v_pdf_button := format(
        '<table cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="%s" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Ladda ner Signerad %s</a></td></tr></tbody></table>',
        p_pdf_url,
        CASE v_link.dokument_typ
          WHEN 'forslag' THEN 'Offert'
          WHEN 'order'   THEN 'Order'
          WHEN 'ata'     THEN 'ÄTA-arbete'
          ELSE 'Dokument'
        END
      );
      v_pdf_admin_line := format('<div style="margin-top:18px;font-size:13px;color:#666"><strong style="color:#1a1a1a">PDF:</strong> <a href="%s" style="color:#5363f2">%s</a></div>', p_pdf_url, p_pdf_url);
    END IF;

    IF p_specifikation_pdf_url IS NOT NULL AND length(p_specifikation_pdf_url) > 0 THEN
      v_pdf_button := v_pdf_button || format(
        '<table cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="%s" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Ladda ner signerad Specifikation</a></td></tr></tbody></table>',
        p_specifikation_pdf_url
      );
    END IF;

    IF p_tidplan_pdf_url IS NOT NULL AND length(p_tidplan_pdf_url) > 0 THEN
      v_pdf_button := v_pdf_button || format(
        '<table cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="%s" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:600;font-size:14px">Ladda ner signerad Tidplan</a></td></tr></tbody></table>',
        p_tidplan_pdf_url
      );
    END IF;

    v_vars := jsonb_build_object(
      'kund_namn',          COALESCE(v_kund_namn, trim(p_namn)),
      'kund_email',         COALESCE(v_kund_email, '—'),
      'foretag_namn',       COALESCE(v_foretag_namn, ''),
      'namn',               trim(p_namn),
      'doc_nummer',         COALESCE(v_doc_nummer, ''),
      'doc_typ',            v_link.dokument_typ,
      'doc_typ_label',      v_doc_typ_label,
      'doc_typ_label_def',  v_doc_typ_label_def,
      'titel',              COALESCE(v_doc_titel, ''),
      'datum',              v_datum,
      'ip',                 COALESCE(v_ip::text, '—'),
      'pdf_lank',           COALESCE(p_pdf_url, ''),
      'pdf_button',         v_pdf_button,
      'pdf_admin_line',     v_pdf_admin_line,
      'alias_signatur',     ''
    );

    IF v_kund_email IS NOT NULL AND length(v_kund_email) > 0 THEN
      SELECT * INTO v_mall_kund
        FROM epost_mallar
       WHERE system_kod = v_kod_kund AND aktiv
       LIMIT 1;

      IF FOUND THEN
        SELECT signatur_html INTO v_alias_signatur
          FROM epost_alias WHERE id = v_mall_kund.alias_id;
        v_vars := v_vars || jsonb_build_object('alias_signatur', COALESCE(v_alias_signatur, ''));
        v_use_alias := COALESCE(v_mall_kund.alias_id, v_alias_id);
        v_amne  := inject_template_vars(v_mall_kund.amne, v_vars);
        v_kropp := inject_template_vars(v_mall_kund.kropp_html, v_vars);

        INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
        VALUES (
          v_use_alias, v_kund_email, v_amne, v_kropp,
          v_link.kund_id, v_projekt_id,
          CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
          now(), 'väntar'
        );
      END IF;
    END IF;

    IF v_foretag_email IS NOT NULL AND length(v_foretag_email) > 0 THEN
      SELECT * INTO v_mall_admin
        FROM epost_mallar
       WHERE system_kod = v_kod_admin AND aktiv
       LIMIT 1;

      IF FOUND THEN
        SELECT signatur_html INTO v_alias_signatur
          FROM epost_alias WHERE id = v_mall_admin.alias_id;
        v_vars := v_vars || jsonb_build_object('alias_signatur', COALESCE(v_alias_signatur, ''));
        v_use_alias := COALESCE(v_mall_admin.alias_id, v_alias_id);
        v_amne  := inject_template_vars(v_mall_admin.amne, v_vars);
        v_kropp := inject_template_vars(v_mall_admin.kropp_html, v_vars);

        INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
        VALUES (
          v_use_alias, v_foretag_email, v_amne, v_kropp,
          v_link.kund_id, v_projekt_id,
          CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
          now(), 'väntar'
        );
      END IF;
    END IF;
  END IF;

  -- Portal auto-invite: independent of the email toggle above.
  -- For forslag: respects the kund_portal_auto_invite toggle in app_installningar.
  -- For fritt: respects the per-link auto_invite_kund_portal flag.
  IF v_link.kund_id IS NOT NULL THEN
    IF v_link.dokument_typ = 'forslag' THEN
      SELECT a.kund_portal_auto_invite INTO v_auto_invite
        FROM app_installningar a LIMIT 1;
      IF v_auto_invite IS TRUE THEN
        INSERT INTO kund_portal_invite_queue (kund_id, source_lank_id)
        VALUES (v_link.kund_id, v_link.id);
      END IF;
    ELSIF v_link.dokument_typ = 'fritt' AND v_link.auto_invite_kund_portal IS TRUE THEN
      INSERT INTO kund_portal_invite_queue (kund_id, source_lank_id)
      VALUES (v_link.kund_id, v_link.id);
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'signed');
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_signature(p_token text, p_namn text, p_signatur text, p_ua text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link              signatur_lankar%ROWTYPE;
  v_ip                INET;
  v_xff               TEXT;
  v_log_aktiv         BOOLEAN;
  v_projekt_id        UUID;
  v_kund_email        TEXT;
  v_kund_namn         TEXT;
  v_doc_titel         TEXT;
  v_doc_nummer        TEXT;
  v_foretag_namn      TEXT;
  v_foretag_email     TEXT;
  v_admin_amne        TEXT;
  v_kund_amne         TEXT;
  v_admin_kropp       TEXT;
  v_kund_kropp        TEXT;
  v_alias_id          UUID;
  v_acepterat_exists  BOOLEAN;
BEGIN
  IF p_token IS NULL OR p_namn IS NULL OR length(trim(p_namn)) = 0 OR p_signatur IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT * INTO v_link FROM signatur_lankar WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'revoked'); END IF;
  IF v_link.signerad_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'signed'); END IF;
  IF v_link.gar_ut_at < now() THEN RETURN jsonb_build_object('status', 'expired'); END IF;

  BEGIN
    v_xff := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    IF v_xff IS NOT NULL THEN
      v_ip := split_part(v_xff, ',', 1)::inet;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  UPDATE signatur_lankar
     SET signerad_at = now(),
         signerad_namn = trim(p_namn),
         signerad_ip = v_ip,
         signerad_ua = p_ua,
         signatur_data = p_signatur
   WHERE id = v_link.id;

  IF v_link.dokument_typ = 'forslag' THEN
    UPDATE forslag
       SET status = 'accepterat',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, forslag_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;

    -- Bump the parent project to 'Acepterat' if that status exists.
    IF v_projekt_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM projekt_statusar WHERE namn = 'Acepterat')
        INTO v_acepterat_exists;
      IF v_acepterat_exists THEN
        UPDATE projekt SET status = 'Acepterat' WHERE id = v_projekt_id;
      END IF;
    END IF;
  ELSE
    UPDATE ordrar
       SET status = 'Godkänd',
           godkand_av = trim(p_namn),
           godkand_datum = now(),
           signatur_data = p_signatur
     WHERE id = v_link.dokument_id
     RETURNING projekt_id, titel, order_nummer
       INTO v_projekt_id, v_doc_titel, v_doc_nummer;
  END IF;

  SELECT aktiv INTO v_log_aktiv
    FROM aktivitetslogg_installningar
   WHERE handelse = 'signatur_inskickad';

  IF v_log_aktiv IS TRUE THEN
    SELECT k.namn, k.email INTO v_kund_namn, v_kund_email
      FROM kunder k WHERE k.id = v_link.kund_id;
    IF v_kund_email IS NULL THEN v_kund_email := v_link.kund_email; END IF;

    SELECT a.foretag_namn, a.foretag_email INTO v_foretag_namn, v_foretag_email
      FROM app_installningar a LIMIT 1;

    IF v_projekt_id IS NOT NULL THEN
      INSERT INTO projekt_anteckningar (projekt_id, titel, innehall)
      VALUES (
        v_projekt_id,
        format('Signerad %s — %s', v_link.dokument_typ, COALESCE(v_doc_nummer, '')),
        format(
          E'Signerad av %s\n%s\nIP: %s',
          trim(p_namn),
          to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
          COALESCE(v_ip::text, '—')
        )
      );
    END IF;

    SELECT id INTO v_alias_id FROM epost_alias WHERE aktiv ORDER BY standard DESC NULLS LAST, sortering LIMIT 1;

    IF v_kund_email IS NOT NULL AND length(v_kund_email) > 0 THEN
      v_kund_amne := format('Bekräftelse: signerad %s %s',
        CASE WHEN v_link.dokument_typ = 'forslag' THEN 'offert' ELSE 'order' END,
        COALESCE(v_doc_nummer, ''));
      v_kund_kropp := format(
        '<p>Hej %s,</p><p>Tack! Din signering av %s %s har registrerats kl %s.</p><p>Med vänlig hälsning,<br>%s</p>',
        COALESCE(v_kund_namn, trim(p_namn)),
        CASE WHEN v_link.dokument_typ = 'forslag' THEN 'offerten' ELSE 'ordern' END,
        COALESCE(v_doc_nummer, ''),
        to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
        COALESCE(v_foretag_namn, '')
      );
      INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
      VALUES (
        v_alias_id, v_kund_email, v_kund_amne, v_kund_kropp,
        v_link.kund_id, v_projekt_id,
        CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
        now(), 'väntar'
      );
    END IF;

    IF v_foretag_email IS NOT NULL AND length(v_foretag_email) > 0 THEN
      v_admin_amne := format('Kund signerade %s %s',
        CASE WHEN v_link.dokument_typ = 'forslag' THEN 'offert' ELSE 'order' END,
        COALESCE(v_doc_nummer, ''));
      v_admin_kropp := format(
        '<p>%s (%s) signerade %s %s — %s.</p><p>Tid: %s · IP: %s</p>',
        trim(p_namn),
        COALESCE(v_kund_email, '—'),
        CASE WHEN v_link.dokument_typ = 'forslag' THEN 'offerten' ELSE 'ordern' END,
        COALESCE(v_doc_nummer, ''),
        COALESCE(v_doc_titel, ''),
        to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
        COALESCE(v_ip::text, '—')
      );
      INSERT INTO epost_ko (alias_id, till, amne, kropp_html, kund_id, projekt_id, forslag_id, schemalagd_till, status)
      VALUES (
        v_alias_id, v_foretag_email, v_admin_amne, v_admin_kropp,
        v_link.kund_id, v_projekt_id,
        CASE WHEN v_link.dokument_typ = 'forslag' THEN v_link.dokument_id ELSE NULL END,
        now(), 'väntar'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'signed');
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_cron_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
declare
  jobname_to_remove text := coalesce(old.id, new.id);
begin
  -- Always unschedule first if the job is currently scheduled.
  -- Keeps the logic idempotent and handles renames of
  -- schedule/command cleanly.
  if exists (select 1 from cron.job where jobname = jobname_to_remove) then
    perform cron.unschedule(jobname_to_remove);
  end if;

  if (tg_op = 'DELETE') then
    return old;
  end if;

  if (new.enabled) then
    perform cron.schedule(new.id, new.schedule, new.sql_command);
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_personal_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.uppdaterad_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.uppdaterad_at = now();
  RETURN NEW;
END;
$function$;

-- Triggers
DROP TRIGGER IF EXISTS ai_asistenter_updated_at ON public.ai_asistenter;
CREATE TRIGGER ai_asistenter_updated_at BEFORE UPDATE ON public.ai_asistenter FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS ai_providers_updated_at ON public.ai_providers;
CREATE TRIGGER ai_providers_updated_at BEFORE UPDATE ON public.ai_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS app_installningar_updated_at ON public.app_installningar;
CREATE TRIGGER app_installningar_updated_at BEFORE UPDATE ON public.app_installningar FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS ata_updated_at ON public.ata;
CREATE TRIGGER ata_updated_at BEFORE UPDATE ON public.ata FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS cron_jobs_sync ON public.cron_jobs;
CREATE TRIGGER cron_jobs_sync AFTER INSERT OR DELETE OR UPDATE OF enabled, schedule, sql_command ON public.cron_jobs FOR EACH ROW EXECUTE FUNCTION sync_cron_job();

DROP TRIGGER IF EXISTS cron_jobs_updated_at ON public.cron_jobs;
CREATE TRIGGER cron_jobs_updated_at BEFORE UPDATE ON public.cron_jobs FOR EACH ROW EXECUTE FUNCTION moddatetime('uppdaterad_at');

DROP TRIGGER IF EXISTS epost_alias_updated_at ON public.epost_alias;
CREATE TRIGGER epost_alias_updated_at BEFORE UPDATE ON public.epost_alias FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS epost_ko_updated_at ON public.epost_ko;
CREATE TRIGGER epost_ko_updated_at BEFORE UPDATE ON public.epost_ko FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS epost_mallar_updated_at ON public.epost_mallar;
CREATE TRIGGER epost_mallar_updated_at BEFORE UPDATE ON public.epost_mallar FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS forslag_updated_at ON public.forslag;
CREATE TRIGGER forslag_updated_at BEFORE UPDATE ON public.forslag FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS protect_inbyggd_forslag_statusar ON public.forslag_statusar;
CREATE TRIGGER protect_inbyggd_forslag_statusar BEFORE DELETE OR UPDATE ON public.forslag_statusar FOR EACH ROW EXECUTE FUNCTION protect_inbyggd_statusar();

DROP TRIGGER IF EXISTS kalendrar_updated_at ON public.kalendrar;
CREATE TRIGGER kalendrar_updated_at BEFORE UPDATE ON public.kalendrar FOR EACH ROW EXECUTE FUNCTION moddatetime('uppdaterad_at');

DROP TRIGGER IF EXISTS protect_inbyggd_kund_statusar ON public.kund_statusar;
CREATE TRIGGER protect_inbyggd_kund_statusar BEFORE DELETE OR UPDATE ON public.kund_statusar FOR EACH ROW EXECUTE FUNCTION protect_inbyggd_statusar();

DROP TRIGGER IF EXISTS kunder_updated_at ON public.kunder;
CREATE TRIGGER kunder_updated_at BEFORE UPDATE ON public.kunder FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS kvitton_uppdaterad_at_trigger ON public.kvitton;
CREATE TRIGGER kvitton_uppdaterad_at_trigger BEFORE UPDATE ON public.kvitton FOR EACH ROW EXECUTE FUNCTION kvitton_set_uppdaterad_at();

DROP TRIGGER IF EXISTS ordrar_updated_at ON public.ordrar;
CREATE TRIGGER ordrar_updated_at BEFORE UPDATE ON public.ordrar FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS personal_updated_at ON public.personal;
CREATE TRIGGER personal_updated_at BEFORE UPDATE ON public.personal FOR EACH ROW EXECUTE FUNCTION update_personal_updated_at();

DROP TRIGGER IF EXISTS projekt_updated_at ON public.projekt;
CREATE TRIGGER projekt_updated_at BEFORE UPDATE ON public.projekt FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS projekt_context_updated_at ON public.projekt_context;
CREATE TRIGGER projekt_context_updated_at BEFORE UPDATE ON public.projekt_context FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS sms_mallar_updated_at ON public.sms_mallar;
CREATE TRIGGER sms_mallar_updated_at BEFORE UPDATE ON public.sms_mallar FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS enable
ALTER TABLE public._applied_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_asistenter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aktivitetslogg_installningar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_installningar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arbets_roller ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artiklar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ata_rader ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ekonomi_utfall ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epost_alias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epost_ko ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epost_mallar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fakturering_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fas_mall_faser ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fas_mall_subfaser ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fas_mallar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forslag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forslag_arbetskostnad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forslag_epost_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forslag_faser ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forslag_materialkostnad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forslag_statusar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forslag_subfaser ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forslag_underentreprenorer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventarier ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kalender_event_dokument ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kalender_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kalendrar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kund_portal_invite_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kund_statusar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kund_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kunder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kvitton ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leverantorer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_import_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_katalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_rader ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordrar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_mallar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_anteckningar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_dokument ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_ledighet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_loneposter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_statusar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_tidrapport ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projekt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projekt_aktiviteter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projekt_anteckningar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projekt_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projekt_dokument ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projekt_frageblankett ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projekt_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projekt_statusar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatur_fritta_dokument ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatur_lankar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "authenticated_can_select" ON public.aktivitetslogg_installningar;
CREATE POLICY "authenticated_can_select" ON public.aktivitetslogg_installningar
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "app_admins_select_self" ON public.app_admins;
CREATE POLICY "app_admins_select_self" ON public.app_admins
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "app_installningar_public_select" ON public.app_installningar;
CREATE POLICY "app_installningar_public_select" ON public.app_installningar
    AS PERMISSIVE
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "ata_admin_all" ON public.ata;
CREATE POLICY "ata_admin_all" ON public.ata
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "ata_client_select" ON public.ata;
CREATE POLICY "ata_client_select" ON public.ata
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (((status <> 'Utkast'::text) AND (kund_id IN ( SELECT current_user_kund_ids() AS current_user_kund_ids))));

DROP POLICY IF EXISTS "ata_rader_admin_all" ON public.ata_rader;
CREATE POLICY "ata_rader_admin_all" ON public.ata_rader
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "ata_rader_client_select" ON public.ata_rader;
CREATE POLICY "ata_rader_client_select" ON public.ata_rader
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((ata_id IN ( SELECT ata.id
   FROM ata
  WHERE ((ata.status <> 'Utkast'::text) AND (ata.kund_id IN ( SELECT current_user_kund_ids() AS current_user_kund_ids))))));

DROP POLICY IF EXISTS "cron_jobs_admin_all" ON public.cron_jobs;
CREATE POLICY "cron_jobs_admin_all" ON public.cron_jobs
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "forslag_admin_all" ON public.forslag;
CREATE POLICY "forslag_admin_all" ON public.forslag
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "forslag_client_select" ON public.forslag;
CREATE POLICY "forslag_client_select" ON public.forslag
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (((status <> 'Utkast'::text) AND (projekt_id IN ( SELECT projekt.id
   FROM projekt
  WHERE (projekt.kund_id IN ( SELECT current_user_kund_ids() AS current_user_kund_ids))))));

DROP POLICY IF EXISTS "forslag_arbetskostnad_admin_all" ON public.forslag_arbetskostnad;
CREATE POLICY "forslag_arbetskostnad_admin_all" ON public.forslag_arbetskostnad
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "forslag_faser_admin_all" ON public.forslag_faser;
CREATE POLICY "forslag_faser_admin_all" ON public.forslag_faser
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "forslag_faser_client_select" ON public.forslag_faser;
CREATE POLICY "forslag_faser_client_select" ON public.forslag_faser
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((forslag_id IN ( SELECT forslag.id
   FROM forslag
  WHERE ((forslag.status <> 'Utkast'::text) AND (forslag.projekt_id IN ( SELECT projekt.id
           FROM projekt
          WHERE (projekt.kund_id IN ( SELECT current_user_kund_ids() AS current_user_kund_ids))))))));

DROP POLICY IF EXISTS "forslag_materialkostnad_admin_all" ON public.forslag_materialkostnad;
CREATE POLICY "forslag_materialkostnad_admin_all" ON public.forslag_materialkostnad
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "forslag_subfaser_admin_all" ON public.forslag_subfaser;
CREATE POLICY "forslag_subfaser_admin_all" ON public.forslag_subfaser
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "forslag_underentreprenorer_admin_all" ON public.forslag_underentreprenorer;
CREATE POLICY "forslag_underentreprenorer_admin_all" ON public.forslag_underentreprenorer
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "authenticated_insert_inventarier" ON public.inventarier;
CREATE POLICY "authenticated_insert_inventarier" ON public.inventarier
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_inventarier" ON public.inventarier;
CREATE POLICY "authenticated_read_inventarier" ON public.inventarier
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "authenticated_update_inventarier" ON public.inventarier;
CREATE POLICY "authenticated_update_inventarier" ON public.inventarier
    AS PERMISSIVE
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "kalender_events_admin_all" ON public.kalender_events;
CREATE POLICY "kalender_events_admin_all" ON public.kalender_events
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "kalender_events_insert_assigned" ON public.kalender_events;
CREATE POLICY "kalender_events_insert_assigned" ON public.kalender_events
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (((projekt_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (projekt_personal pp
     JOIN personal p ON ((p.id = pp.personal_id)))
  WHERE ((p.supabase_user_id = auth.uid()) AND (pp.projekt_id = kalender_events.projekt_id) AND (lower(p.status) <> 'inaktiv'::text))))));

DROP POLICY IF EXISTS "kund_portal_invite_queue_admin_all" ON public.kund_portal_invite_queue;
CREATE POLICY "kund_portal_invite_queue_admin_all" ON public.kund_portal_invite_queue
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "kund_users_admin_all" ON public.kund_users;
CREATE POLICY "kund_users_admin_all" ON public.kund_users
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "kund_users_select_self" ON public.kund_users;
CREATE POLICY "kund_users_select_self" ON public.kund_users
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "kunder_admin_all" ON public.kunder;
CREATE POLICY "kunder_admin_all" ON public.kunder
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "kunder_client_select" ON public.kunder;
CREATE POLICY "kunder_client_select" ON public.kunder
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((id IN ( SELECT current_user_kund_ids() AS current_user_kund_ids)));

DROP POLICY IF EXISTS "kvitton_admin_all" ON public.kvitton;
CREATE POLICY "kvitton_admin_all" ON public.kvitton
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "order_rader_admin_all" ON public.order_rader;
CREATE POLICY "order_rader_admin_all" ON public.order_rader
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "order_rader_client_select" ON public.order_rader;
CREATE POLICY "order_rader_client_select" ON public.order_rader
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((order_id IN ( SELECT ordrar.id
   FROM ordrar
  WHERE ((ordrar.status <> 'Utkast'::text) AND (ordrar.kund_id IN ( SELECT current_user_kund_ids() AS current_user_kund_ids))))));

DROP POLICY IF EXISTS "ordrar_admin_all" ON public.ordrar;
CREATE POLICY "ordrar_admin_all" ON public.ordrar
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "ordrar_client_select" ON public.ordrar;
CREATE POLICY "ordrar_client_select" ON public.ordrar
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (((status <> 'Utkast'::text) AND (kund_id IN ( SELECT current_user_kund_ids() AS current_user_kund_ids))));

DROP POLICY IF EXISTS "personal_admin_all" ON public.personal;
CREATE POLICY "personal_admin_all" ON public.personal
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "personal_select_own" ON public.personal;
CREATE POLICY "personal_select_own" ON public.personal
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((supabase_user_id = auth.uid()));

DROP POLICY IF EXISTS "chat_insert_own" ON public.personal_chat;
CREATE POLICY "chat_insert_own" ON public.personal_chat
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (((fran_admin = false) AND (EXISTS ( SELECT 1
   FROM personal p
  WHERE ((p.id = personal_chat.personal_id) AND (p.supabase_user_id = auth.uid()) AND (lower(p.status) <> 'inaktiv'::text))))));

DROP POLICY IF EXISTS "chat_select_own" ON public.personal_chat;
CREATE POLICY "chat_select_own" ON public.personal_chat
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM personal p
  WHERE ((p.id = personal_chat.personal_id) AND (p.supabase_user_id = auth.uid())))));

DROP POLICY IF EXISTS "personal_chat_admin_all" ON public.personal_chat;
CREATE POLICY "personal_chat_admin_all" ON public.personal_chat
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK ((is_app_admin() AND (fran_admin = true)));

DROP POLICY IF EXISTS "dokument_select_own" ON public.personal_dokument;
CREATE POLICY "dokument_select_own" ON public.personal_dokument
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM personal p
  WHERE ((p.id = personal_dokument.personal_id) AND (p.supabase_user_id = auth.uid())))));

DROP POLICY IF EXISTS "ledighet_delete_own_pending" ON public.personal_ledighet;
CREATE POLICY "ledighet_delete_own_pending" ON public.personal_ledighet
    AS PERMISSIVE
    FOR DELETE
    TO authenticated
    USING (((status = 'inskickad'::text) AND (EXISTS ( SELECT 1
   FROM personal p
  WHERE ((p.id = personal_ledighet.personal_id) AND (p.supabase_user_id = auth.uid()))))));

DROP POLICY IF EXISTS "ledighet_insert_own" ON public.personal_ledighet;
CREATE POLICY "ledighet_insert_own" ON public.personal_ledighet
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK ((EXISTS ( SELECT 1
   FROM personal p
  WHERE ((p.id = personal_ledighet.personal_id) AND (p.supabase_user_id = auth.uid()) AND (lower(p.status) <> 'inaktiv'::text)))));

DROP POLICY IF EXISTS "ledighet_select_own" ON public.personal_ledighet;
CREATE POLICY "ledighet_select_own" ON public.personal_ledighet
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM personal p
  WHERE ((p.id = personal_ledighet.personal_id) AND (p.supabase_user_id = auth.uid())))));

DROP POLICY IF EXISTS "tidrapport_delete_own_pending" ON public.personal_tidrapport;
CREATE POLICY "tidrapport_delete_own_pending" ON public.personal_tidrapport
    AS PERMISSIVE
    FOR DELETE
    TO authenticated
    USING (((status = 'inskickad'::text) AND (EXISTS ( SELECT 1
   FROM personal p
  WHERE ((p.id = personal_tidrapport.personal_id) AND (p.supabase_user_id = auth.uid()))))));

DROP POLICY IF EXISTS "tidrapport_insert_own" ON public.personal_tidrapport;
CREATE POLICY "tidrapport_insert_own" ON public.personal_tidrapport
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK ((EXISTS ( SELECT 1
   FROM personal p
  WHERE ((p.id = personal_tidrapport.personal_id) AND (p.supabase_user_id = auth.uid()) AND (lower(p.status) <> 'inaktiv'::text)))));

DROP POLICY IF EXISTS "tidrapport_select_own" ON public.personal_tidrapport;
CREATE POLICY "tidrapport_select_own" ON public.personal_tidrapport
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM personal p
  WHERE ((p.id = personal_tidrapport.personal_id) AND (p.supabase_user_id = auth.uid())))));

DROP POLICY IF EXISTS "projekt_admin_all" ON public.projekt;
CREATE POLICY "projekt_admin_all" ON public.projekt
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "projekt_client_select" ON public.projekt;
CREATE POLICY "projekt_client_select" ON public.projekt
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((kund_id IN ( SELECT current_user_kund_ids() AS current_user_kund_ids)));

DROP POLICY IF EXISTS "projekt_select_assigned" ON public.projekt;
CREATE POLICY "projekt_select_assigned" ON public.projekt
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM (projekt_personal pp
     JOIN personal p ON ((p.id = pp.personal_id)))
  WHERE ((pp.projekt_id = projekt.id) AND (p.supabase_user_id = auth.uid()) AND (lower(p.status) <> 'inaktiv'::text)))));

DROP POLICY IF EXISTS "projekt_anteckningar_admin_all" ON public.projekt_anteckningar;
CREATE POLICY "projekt_anteckningar_admin_all" ON public.projekt_anteckningar
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "projekt_anteckningar_insert_assigned" ON public.projekt_anteckningar;
CREATE POLICY "projekt_anteckningar_insert_assigned" ON public.projekt_anteckningar
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK ((EXISTS ( SELECT 1
   FROM (projekt_personal pp
     JOIN personal p ON ((p.id = pp.personal_id)))
  WHERE ((p.supabase_user_id = auth.uid()) AND (pp.projekt_id = projekt_anteckningar.projekt_id) AND (lower(p.status) <> 'inaktiv'::text)))));

DROP POLICY IF EXISTS "projekt_dokument_admin_all" ON public.projekt_dokument;
CREATE POLICY "projekt_dokument_admin_all" ON public.projekt_dokument
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "projekt_dokument_client_select" ON public.projekt_dokument;
CREATE POLICY "projekt_dokument_client_select" ON public.projekt_dokument
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (((synlig_for_kund = true) AND (projekt_id IN ( SELECT projekt.id
   FROM projekt
  WHERE (projekt.kund_id IN ( SELECT current_user_kund_ids() AS current_user_kund_ids))))));

DROP POLICY IF EXISTS "projekt_dokument_insert_assigned" ON public.projekt_dokument;
CREATE POLICY "projekt_dokument_insert_assigned" ON public.projekt_dokument
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK ((EXISTS ( SELECT 1
   FROM (projekt_personal pp
     JOIN personal p ON ((p.id = pp.personal_id)))
  WHERE ((p.supabase_user_id = auth.uid()) AND (pp.projekt_id = projekt_dokument.projekt_id) AND (lower(p.status) <> 'inaktiv'::text) AND (p.id = projekt_dokument.uppladdad_av_personal_id)))));

DROP POLICY IF EXISTS "projekt_dokument_select_assigned" ON public.projekt_dokument;
CREATE POLICY "projekt_dokument_select_assigned" ON public.projekt_dokument
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM (projekt_personal pp
     JOIN personal p ON ((p.id = pp.personal_id)))
  WHERE ((p.supabase_user_id = auth.uid()) AND (pp.projekt_id = projekt_dokument.projekt_id)))));

DROP POLICY IF EXISTS "pp_select_own" ON public.projekt_personal;
CREATE POLICY "pp_select_own" ON public.projekt_personal
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM personal p
  WHERE ((p.id = projekt_personal.personal_id) AND (p.supabase_user_id = auth.uid())))));

DROP POLICY IF EXISTS "authenticated_can_select" ON public.projekt_statusar;
CREATE POLICY "authenticated_can_select" ON public.projekt_statusar
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "signatur_lankar_admin_all" ON public.signatur_lankar;
CREATE POLICY "signatur_lankar_admin_all" ON public.signatur_lankar
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (is_app_admin())
    WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "signatur_lankar_client_select" ON public.signatur_lankar;
CREATE POLICY "signatur_lankar_client_select" ON public.signatur_lankar
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (((signerad_at IS NOT NULL) AND (kund_id IN ( SELECT current_user_kund_ids() AS current_user_kund_ids))));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('andring-bilder', 'andring-bilder', true, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('branding', 'branding', true, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('kalender-dokument', 'kalender-dokument', false, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('kvitton', 'kvitton', false, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('personal-dokument', 'personal-dokument', false, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('projekt-dokument', 'projekt-dokument', false, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('revisor-dokument', 'revisor-dokument', false, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('signed-docs', 'signed-docs', true, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('signing-pdfs', 'signing-pdfs', true, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "andring_bilder_insert" ON storage.objects;
CREATE POLICY "andring_bilder_insert" ON storage.objects
    AS PERMISSIVE
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (((bucket_id = 'andring-bilder'::text) AND (EXISTS ( SELECT 1
   FROM signatur_lankar sl
  WHERE ((sl.token = (storage.foldername(objects.name))[1]) AND (sl.revoked_at IS NULL) AND (sl.gar_ut_at >= now()))))));

DROP POLICY IF EXISTS "andring_bilder_select" ON storage.objects;
CREATE POLICY "andring_bilder_select" ON storage.objects
    AS PERMISSIVE
    FOR SELECT
    TO anon, authenticated
    USING ((bucket_id = 'andring-bilder'::text));

DROP POLICY IF EXISTS "branding_select_direct_only" ON storage.objects;
CREATE POLICY "branding_select_direct_only" ON storage.objects
    AS PERMISSIVE
    FOR SELECT
    TO anon, authenticated
    USING (((bucket_id = 'branding'::text) AND (name IS NOT NULL) AND (name <> ''::text)));

DROP POLICY IF EXISTS "kalender dokument allow all" ON storage.objects;
CREATE POLICY "kalender dokument allow all" ON storage.objects
    AS PERMISSIVE
    FOR ALL
    TO anon, authenticated
    USING ((bucket_id = 'kalender-dokument'::text))
    WITH CHECK ((bucket_id = 'kalender-dokument'::text));

DROP POLICY IF EXISTS "kvitton_delete_admin" ON storage.objects;
CREATE POLICY "kvitton_delete_admin" ON storage.objects
    AS PERMISSIVE
    FOR DELETE
    TO authenticated
    USING (((bucket_id = 'kvitton'::text) AND is_app_admin()));

DROP POLICY IF EXISTS "kvitton_insert_admin" ON storage.objects;
CREATE POLICY "kvitton_insert_admin" ON storage.objects
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (((bucket_id = 'kvitton'::text) AND is_app_admin()));

DROP POLICY IF EXISTS "kvitton_select_admin" ON storage.objects;
CREATE POLICY "kvitton_select_admin" ON storage.objects
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (((bucket_id = 'kvitton'::text) AND is_app_admin()));

DROP POLICY IF EXISTS "personal_dokument_select_own" ON storage.objects;
CREATE POLICY "personal_dokument_select_own" ON storage.objects
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (((bucket_id = 'personal-dokument'::text) AND (EXISTS ( SELECT 1
   FROM personal p
  WHERE ((p.supabase_user_id = auth.uid()) AND ((p.id)::text = (storage.foldername(objects.name))[1]))))));

DROP POLICY IF EXISTS "projekt_dokument_insert_admin" ON storage.objects;
CREATE POLICY "projekt_dokument_insert_admin" ON storage.objects
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (((bucket_id = 'projekt-dokument'::text) AND is_app_admin()));

DROP POLICY IF EXISTS "projekt_dokument_insert_assigned" ON storage.objects;
CREATE POLICY "projekt_dokument_insert_assigned" ON storage.objects
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (((bucket_id = 'projekt-dokument'::text) AND (EXISTS ( SELECT 1
   FROM (projekt_personal pp
     JOIN personal p ON ((p.id = pp.personal_id)))
  WHERE ((p.supabase_user_id = auth.uid()) AND ((pp.projekt_id)::text = (storage.foldername(objects.name))[1]) AND (lower(p.status) <> 'inaktiv'::text))))));

DROP POLICY IF EXISTS "projekt_dokument_select_admin" ON storage.objects;
CREATE POLICY "projekt_dokument_select_admin" ON storage.objects
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (((bucket_id = 'projekt-dokument'::text) AND is_app_admin()));

DROP POLICY IF EXISTS "projekt_dokument_select_assigned" ON storage.objects;
CREATE POLICY "projekt_dokument_select_assigned" ON storage.objects
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (((bucket_id = 'projekt-dokument'::text) AND (EXISTS ( SELECT 1
   FROM (projekt_personal pp
     JOIN personal p ON ((p.id = pp.personal_id)))
  WHERE ((p.supabase_user_id = auth.uid()) AND ((pp.projekt_id)::text = (storage.foldername(objects.name))[1]))))));

DROP POLICY IF EXISTS "projekt_dokument_select_kund" ON storage.objects;
CREATE POLICY "projekt_dokument_select_kund" ON storage.objects
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (((bucket_id = 'projekt-dokument'::text) AND (EXISTS ( SELECT 1
   FROM (projekt_dokument pd
     JOIN projekt p ON ((p.id = pd.projekt_id)))
  WHERE ((pd.storage_path = objects.name) AND (pd.synlig_for_kund = true) AND (p.kund_id IN ( SELECT current_user_kund_ids() AS current_user_kund_ids)))))));

DROP POLICY IF EXISTS "signed_docs_insert" ON storage.objects;
CREATE POLICY "signed_docs_insert" ON storage.objects
    AS PERMISSIVE
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (((bucket_id = 'signed-docs'::text) AND signatur_lank_uploadable((storage.foldername(name))[1])));

DROP POLICY IF EXISTS "signed_docs_select_direct_only" ON storage.objects;
CREATE POLICY "signed_docs_select_direct_only" ON storage.objects
    AS PERMISSIVE
    FOR SELECT
    TO anon, authenticated
    USING (((bucket_id = 'signed-docs'::text) AND (name IS NOT NULL) AND (name <> ''::text)));

DROP POLICY IF EXISTS "signed_docs_update" ON storage.objects;
CREATE POLICY "signed_docs_update" ON storage.objects
    AS PERMISSIVE
    FOR UPDATE
    TO anon, authenticated
    USING (((bucket_id = 'signed-docs'::text) AND signatur_lank_uploadable((storage.foldername(name))[1])));

DROP POLICY IF EXISTS "signing_pdfs_select_direct_only" ON storage.objects;
CREATE POLICY "signing_pdfs_select_direct_only" ON storage.objects
    AS PERMISSIVE
    FOR SELECT
    TO anon, authenticated
    USING (((bucket_id = 'signing-pdfs'::text) AND (name IS NOT NULL) AND (name <> ''::text)));
