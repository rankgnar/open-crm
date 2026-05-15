export interface AppInstallningar {
  id: string
  // Företag
  valuta: string
  foretag_namn: string
  foretag_org_nummer: string
  foretag_adress: string
  foretag_postnummer: string
  foretag_stad: string
  foretag_land: string
  foretag_telefon: string
  foretag_email: string
  foretag_webbadress: string
  foretag_bankgiro: string
  foretag_plusgiro: string
  foretag_momsreg_nummer: string
  skatteverket_ocr_nummer: string
  skatteverkets_bankgiro: string
  // Kunder defaults
  kund_std_land: string
  kund_std_landskod: string
  kund_std_status: string
  // Projekt defaults
  projekt_std_betalningsvillkor: string
  projekt_std_rot_procent: number
  projekt_std_villkor: string
  // Order defaults
  order_std_villkor: string
  // ÄTA defaults
  ata_std_villkor: string
  // Förslag defaults
  forslag_std_moms_procent: number
  forslag_std_giltig_dagar: number
  // ROT caps
  rot_avdrag_tak_enkel: number
  rot_avdrag_tak_dubbel: number
  // Logotyp
  foretag_logo_url: string
  // Branding (ikon — favicon & app icons)
  branding_ikon_master_url: string
  branding_favicon_16_url: string
  branding_favicon_32_url: string
  branding_apple_touch_icon_url: string
  branding_android_192_url: string
  branding_android_512_url: string
  // Arbetstid
  timmar_per_dag: number
  arbetsdagar_per_vecka: number
  // Integrations
  fortnox_client_id: string
  fortnox_client_secret: string
  fortnox_access_token: string
  fortnox_refresh_token: string
  fortnox_token_expires_at: number | null
  google_client_id: string
  google_client_secret: string
  google_access_token: string
  google_refresh_token: string
  zoho_client_id: string
  zoho_client_secret: string
  zoho_access_token: string
  zoho_refresh_token: string
  ai_enabled: boolean
  ai_provider: string
  ai_model: string
  ai_api_key: string
  // Klientportal
  kund_portal_auto_invite: boolean
  // Kalkylator presets (JSONB arrays, per section)
  kalkyl_ventanatyper?: unknown   // Fasad: window/door deductions
  kalkyl_taktyper?: unknown       // Shared slope types (fasad & tak)
  kalkyl_tak_avdrag?: unknown     // Tak: skylight/chimney openings
  kalkyl_golv_avdrag?: unknown    // Golv: staircase/pillar cutouts
  kalkyl_vagg_avdrag?: unknown    // Vägg: window/door deductions
  skapad_at: string
  uppdaterad_at: string
}

export interface ArbetsRoll {
  id: string
  namn: string
  timpris: number
  enhet: string
  aktiv: boolean
  sortering: number
  skapad_at: string
}

export interface Artikel {
  id: string
  article_number: string | null
  beskrivning: string
  enhet: string
  a_pris: number
  moms_procent: number
  account_number: number
  aktiv: boolean
  skapad_at: string
}

export interface Leverantor {
  id: string
  namn: string
  kontaktperson: string
  email: string
  telefon: string
  webbadress: string
  org_nummer: string
  anteckning: string
  aktiv: boolean
  skapad_at: string
}

export interface FasMall {
  id: string
  namn: string
  beskrivning: string
  aktiv: boolean
  sortering: number
  skapad_at: string
}

export interface FasMallFas {
  id: string
  mall_id: string
  namn: string
  sortering: number
  skapad_at: string
}

export interface FasMallSubfas {
  id: string
  fas_id: string
  namn: string
  sortering: number
  skapad_at: string
}

export interface MaterialKatalog {
  id: string
  leverantor_id: string
  artikel_nummer: string | null
  namn: string
  namn2: string | null
  kategori1: string | null
  kategori2: string | null
  kategori3: string | null
  kategori4: string | null
  enhet: string | null
  a_pris: number
  bredd: number | null
  tjocklek: number | null
  langd: number | null
  bild_url: string | null
  aktiv: boolean
  skapad_at: string
}

export type AiProviderSlug = 'anthropic' | 'openai' | 'google' | 'openrouter'

export type AiUppgift = 'forslag' | 'sammanfattning' | 'epost' | 'analys' | 'allman' | 'frageblankett' | 'villkor-beskrivning'

export interface AiProvider {
  id: string
  provider_slug: AiProviderSlug
  display_name: string
  aktiv: boolean
  api_key: string
  base_url: string
  sortering: number
  skapad_at: string
  uppdaterad_at: string
}

export interface AiAssistent {
  id: string
  provider_id: string
  namn: string
  beskrivning: string
  model_id: string
  system_prompt: string
  uppgifter: AiUppgift[]
  temperature: number
  max_tokens: number
  aktiv: boolean
  ar_standard: boolean
  sortering: number
  skapad_at: string
  uppdaterad_at: string
  provider?: Pick<AiProvider, 'provider_slug' | 'display_name'>
}

export interface AiTestResult {
  ok: boolean
  latency_ms: number
  error?: string
}

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiChatInput {
  assistent_id: string
  messages: AiChatMessage[]
}

export type InstallningarPanel =
  | 'foretag'
  | 'kunder'
  | 'projekt'
  | 'forslag'
  | 'ekonomi'
  | 'order'
  | 'ata'
  | 'yrkesroller'
  | 'artiklar'
  | 'materialkatalog'
  | 'fas-mallar'
  | 'epost-mallar'
  | 'epost-alias'
  | 'pdfs'
  | 'personal'
  | 'kalkyl'

export type AvanceratPanel =
  | 'databas'
  | 'fortnox'
  | 'google'
  | 'zoho'
  | 'aktivitetslogg'
  | 'ai-proveedores'
  | 'ai-asistenter'
  | 'workflows'
  | 'kontext'
  | 'workflow-nodes'
  | 'cron'
  | 'satellit-appar'

export interface CronJob {
  id: string
  label: string
  description: string | null
  schedule: string
  sql_command: string
  enabled: boolean
  last_run_at: string | null
  last_status: string | null
  last_result: string | null
  skapad_at: string
  uppdaterad_at: string
}

export interface PdfMall {
  id: string
  typ: string
  namn: string
  accent_farg: string
  portada_titel: string
  portada_titel_2: string
  portada_undertitel: string
  visa_portada: boolean
  visa_sammanfattning: boolean
  visa_schema: boolean
  visa_tidplan: boolean
  visa_arbetskostnad: boolean
  visa_materialkostnad: boolean
  visa_godkand_f_skatt: boolean
  visa_leverantor_material: boolean
  visa_fas_notat: boolean
  visa_villkor: boolean
  html_mall: string
  skapad_at: string
  uppdaterad_at: string
}

export interface AktivitetsloggSetting {
  handelse: string
  aktiv: boolean
  etikett: string
  kategori: string
}

// ── Workflows ──────────────────────────────────────────────────────────────

export type WorkflowNodeType =
  | 'data:projekt'
  | 'data:projekt:anteckningar'
  | 'data:projekt:dokument'
  | 'data:projekt:dokument-text'
  | 'data:projekt:text-files'
  | 'data:fas-mallar'
  | 'data:yrkesroller'
  | 'data:context'
  | 'data:forslag-faser'
  | 'data:forslag-faser-for-ai'
  | 'data:forslag-komplett'
  | 'ai:generate'
  | 'ai:analyze-bilder'
  | 'ai:analyze-pdf'
  | 'action:save-context'
  | 'action:create-forslag'
  | 'action:add-faser-to-forslag'
  | 'action:match-material-katalog'
  | 'action:search-web-price'
  | 'action:fill-forslag-kostnader'
  | 'action:apply-revisor-corrections'
  | 'action:create-tidplan'
  | 'action:import-forslag-from-extraction'
  | 'action:send-epost'
  | 'action:queue-epost'
  | 'action:create-fas-mall-from-ai'
  | 'action:add-missing-to-forslag'
  | 'action:fill-missing-forslag-kostnader'

export type WorkflowNodeCategory = 'data' | 'ai' | 'action'

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  label: string
  config: Record<string, unknown>
  position: number
}

export interface WorkflowEdge {
  from: string
  to: string
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export type WorkflowRunStatus = 'kör' | 'klar' | 'fel' | 'avbruten'

export interface WorkflowRunSummary {
  id: string
  status: WorkflowRunStatus
  startad_at: string
  duration_ms: number | null
}

export interface Workflow {
  id: string
  namn: string
  beskrivning: string
  kategori: string
  definition: WorkflowDefinition
  version: number
  aktiv: boolean
  sortering: number
  skapad_at: string
  uppdaterad_at: string
  lastRun?: WorkflowRunSummary | null
}

export interface WorkflowNodeResult {
  status: WorkflowRunStatus
  output: Record<string, unknown> | null
  error: string | null
  duration_ms: number
}

export interface WorkflowRun {
  id: string
  workflow_id: string
  trigger_type: string
  status: WorkflowRunStatus
  input_json: Record<string, unknown>
  output_json: Record<string, unknown> | null
  node_results: Record<string, WorkflowNodeResult>
  error_node: string | null
  error_msg: string | null
  startad_at: string
  avslutad_at: string | null
  duration_ms: number | null
}

export interface WorkflowSequence {
  id: string
  namn: string
  beskrivning: string
  workflow_ids: string[]
  aktiv: boolean
  skapad_at: string
  workflows?: Pick<Workflow, 'id' | 'namn'>[]
}

export interface WorkflowTrigger {
  id: string
  workflow_id: string | null
  sequence_id: string | null
  sequence_ids: string[] | null
  seccion: string
  etikett: string
  icon: string
  sortering: number
  skapad_at: string
  workflow?: Pick<Workflow, 'id' | 'namn' | 'definition'>
  sequence?: WorkflowSequence
  sequence_workflows?: Pick<Workflow, 'id' | 'namn'>[]
}

export interface WorkflowRunInput {
  workflow_id: string
  input: Record<string, unknown>
  trigger_type?: string
}

export interface SequenceRun {
  id: string
  sequence_id: string | null
  trigger_id: string | null
  projekt_id: string | null
  workflow_ids: string[]
  current_step: number
  status: WorkflowRunStatus
  workflow_run_ids: string[]
  collected_input: Record<string, unknown>
  error_step: number | null
  error_msg: string | null
  startad_at: string
  uppdaterad_at: string
  avslutad_at: string | null
}

export interface WorkflowProgressEvent {
  run_id: string
  node_id: string
  status: WorkflowRunStatus
  output?: Record<string, unknown>
  error?: string
}

export interface WorkflowRunResult {
  run_id: string
  status: WorkflowRunStatus
  output: Record<string, unknown> | null
  error_node: string | null
  error_msg: string | null
  duration_ms: number
}
