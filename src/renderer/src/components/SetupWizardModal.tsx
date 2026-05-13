import { useState, useEffect, useMemo } from 'react'
import {
  CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Copy, Check,
  Database, Loader2, CheckCircle, XCircle, Eye, EyeOff, Upload, Sparkles, Server, Box,
} from 'lucide-react'

const REPO_URL = 'https://github.com/rankgnar/open-crm-setup'
const SETUP_CMD = 'git clone https://github.com/rankgnar/open-crm-setup.git && cd open-crm-setup && sudo bash setup.sh'

// Strip non-printable-ASCII (em-dash, NBSP, smart quotes, ...) that gets pasted
// from terminals and breaks fetch headers downstream.
function sanitizeAscii(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, '').trim()
}

interface DbConfig {
  supabase_url: string
  supabase_anon_key: string
  supabase_service_role_key: string
  web_app_url: string
  client_app_url: string
}

interface TestResult {
  ok: boolean
  latency_ms: number
  error?: string
}

interface CompanyDraft {
  foretag_namn: string
  foretag_org_nummer: string
  foretag_telefon: string
  foretag_email: string
  foretag_webbadress: string
  foretag_logo_url: string
}

const CONFIG_DEFAULTS: DbConfig = {
  supabase_url: '',
  supabase_anon_key: '',
  supabase_service_role_key: '',
  web_app_url: '',
  client_app_url: '',
}

const COMPANY_DEFAULTS: CompanyDraft = {
  foretag_namn: '',
  foretag_org_nummer: '',
  foretag_telefon: '',
  foretag_email: '',
  foretag_webbadress: '',
  foretag_logo_url: '',
}

const STEP_TITLES = [
  'Välkommen till OpenCRM',
  'Skaffa en VPS',
  'Installera Supabase',
  'Anslut OpenCRM till databasen',
  'Företagsinformation',
] as const

const STEP_SUBTITLES = [
  'Den här guiden hjälper dig att sätta upp allt från grunden — steg för steg.',
  'En egen server där din databas körs. Du äger datan.',
  'Kör ett enda kommando på din VPS. Skriptet sköter resten.',
  'Klistra in värdena från installationsskriptet och testa anslutningen.',
  'Lite information om ditt företag — så är OpenCRM redo att användas.',
] as const

interface Props {
  onComplete: () => void
}

export function SetupWizardModal({ onComplete }: Props) {
  const [step, setStep] = useState(0)

  // ── Step 1 (welcome) — auto-advanceable ─────────────────────────────
  // ── Step 2 (vps) — confirmation gate ────────────────────────────────
  const [vpsConfirmed, setVpsConfirmed] = useState(false)
  // ── Step 3 (supabase) — confirmation gate ───────────────────────────
  const [supabaseConfirmed, setSupabaseConfirmed] = useState(false)

  // ── Step 4 (connect) — DB config + test + save ──────────────────────
  const [config, setConfig] = useState<DbConfig>(CONFIG_DEFAULTS)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // ── Step 5 (company) ────────────────────────────────────────────────
  const [company, setCompany] = useState<CompanyDraft>(COMPANY_DEFAULTS)
  const [companyLoaded, setCompanyLoaded] = useState(false)
  const [companyError, setCompanyError] = useState<string | null>(null)
  const [companyLogoLoading, setCompanyLogoLoading] = useState(false)

  // Initial load — read existing config + ready state
  useEffect(() => {
    let cancelled = false
    void Promise.all([
      window.api.invoke('config:db:get'),
      window.api.invoke('config:db:is-ready'),
    ]).then(([data, ready]) => {
      if (cancelled) return
      const cfg = { ...CONFIG_DEFAULTS, ...(data as DbConfig) }
      setConfig(cfg)
      setConfigLoaded(true)
      if (ready) {
        // DB already connected — pre-pass step 4 so user can flow through
        setSaved(true)
        setTestResult({ ok: true, latency_ms: 0 })
      }
    })
    return () => { cancelled = true }
  }, [])

  // When user reaches step 5, load company data once
  useEffect(() => {
    if (step !== 4 || companyLoaded) return
    if (!saved || !testResult?.ok) return
    let cancelled = false
    window.api.invoke('db:installningar:get')
      .then((data) => {
        if (cancelled) return
        const cfg = data as Record<string, unknown>
        setCompany({
          foretag_namn: String(cfg.foretag_namn ?? ''),
          foretag_org_nummer: String(cfg.foretag_org_nummer ?? ''),
          foretag_telefon: String(cfg.foretag_telefon ?? ''),
          foretag_email: String(cfg.foretag_email ?? ''),
          foretag_webbadress: String(cfg.foretag_webbadress ?? ''),
          foretag_logo_url: String(cfg.foretag_logo_url ?? ''),
        })
        setCompanyLoaded(true)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setCompanyError(e?.message ?? 'Kunde inte läsa företagsinformation')
      })
    return () => { cancelled = true }
  }, [step, companyLoaded, saved, testResult])

  function updateConfig(patch: Partial<DbConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }))
    setTestResult(null)
    setSaved(false)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const result = await window.api.invoke('config:db:test', config) as TestResult
    setTestResult(result)
    setTesting(false)
  }

  async function handleSave() {
    setSaving(true)
    await window.api.invoke('config:db:set', config)
    setSaving(false)
    setSaved(true)
  }

  async function persistCompany(field: keyof CompanyDraft, value: string) {
    try {
      await window.api.invoke('db:installningar:update', { [field]: value })
    } catch (e) {
      setCompanyError(e instanceof Error ? e.message : 'Kunde inte spara fältet')
    }
  }

  function updateCompany(field: keyof CompanyDraft, value: string) {
    setCompany((prev) => ({ ...prev, [field]: value }))
  }

  async function handlePickLogo() {
    setCompanyLogoLoading(true)
    try {
      const dataUrl = await window.api.invoke('pdf:pick-logo') as string | null
      if (dataUrl) {
        updateCompany('foretag_logo_url', dataUrl)
        await persistCompany('foretag_logo_url', dataUrl)
      }
    } finally {
      setCompanyLogoLoading(false)
    }
  }

  async function handleRemoveLogo() {
    updateCompany('foretag_logo_url', '')
    await persistCompany('foretag_logo_url', '')
  }

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0: return true
      case 1: return vpsConfirmed
      case 2: return supabaseConfirmed
      case 3: return saved && testResult?.ok === true
      case 4: return Boolean(company.foretag_namn.trim() && company.foretag_org_nummer.trim())
      default: return false
    }
  }, [step, vpsConfirmed, supabaseConfirmed, saved, testResult, company])

  function handleNext() {
    if (step < STEP_TITLES.length - 1) {
      setStep((s) => s + 1)
    } else {
      onComplete()
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1)
  }

  const isLast = step === STEP_TITLES.length - 1

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-6 py-6 bg-black/70 backdrop-blur-sm" style={{ animation: 'wizardFadeIn 0.2s ease-out' }}>
      <div className="relative flex flex-col w-full max-w-2xl h-full max-h-[720px] bg-elevated border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-border/50 shrink-0">
          <div
            className="h-full bg-emerald-400 transition-all duration-300"
            style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="px-10 pt-10 pb-6 shrink-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
            Steg {step + 1} av {STEP_TITLES.length}
          </p>
          <h1 className="text-2xl font-semibold text-fg mt-2">{STEP_TITLES[step]}</h1>
          <p className="text-sm text-muted mt-2 max-w-md leading-relaxed">{STEP_SUBTITLES[step]}</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-10 pb-6 min-h-0" key={step} style={{ animation: 'wizardSlideIn 0.25s ease-out' }}>
          {step === 0 && <WelcomeStep />}
          {step === 1 && <VpsStep confirmed={vpsConfirmed} onConfirm={setVpsConfirmed} />}
          {step === 2 && <SupabaseStep confirmed={supabaseConfirmed} onConfirm={setSupabaseConfirmed} />}
          {step === 3 && (
            <ConnectStep
              config={config}
              configLoaded={configLoaded}
              testResult={testResult}
              testing={testing}
              saved={saved}
              saving={saving}
              onUpdate={updateConfig}
              onTest={handleTest}
              onSave={handleSave}
            />
          )}
          {step === 4 && (
            <CompanyStep
              company={company}
              loaded={companyLoaded}
              error={companyError}
              logoLoading={companyLogoLoading}
              onUpdate={updateCompany}
              onBlur={persistCompany}
              onPickLogo={handlePickLogo}
              onRemoveLogo={handleRemoveLogo}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-10 py-5 border-t border-border bg-sidebar shrink-0">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted hover:text-fg hover:bg-hover transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} /> Föregående
          </button>

          <div className="flex items-center gap-2">
            {STEP_TITLES.map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full transition-colors ${i <= step ? 'bg-emerald-400' : 'bg-border'}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={!canAdvance}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-fg text-bg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isLast ? 'Slutför' : 'Nästa'} <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes wizardFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes wizardSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── Step 1: Welcome ─────────────────────────────────────────────────

function WelcomeStep() {
  const ITEMS = [
    { icon: Server, label: 'Skaffa en VPS', desc: 'Din egen server hos en leverantör — vi rekommenderar Hostinger.' },
    { icon: Box,    label: 'Installera Supabase', desc: 'Ett kommando installerar din databas på VPS-en.' },
    { icon: Database, label: 'Anslut OpenCRM', desc: 'Klistra in värdena från skriptet — vi testar anslutningen.' },
    { icon: Sparkles, label: 'Företagsinformation', desc: 'Lite information om ditt företag och du är igång.' },
  ]
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg leading-relaxed">
        OpenCRM är ett komplett CRM-system som anpassar sig efter ditt företag — oavsett bransch. Den här guiden tar dig igenom installationen på cirka <span className="text-fg font-medium">15–20 minuter</span>.
      </p>
      <div className="flex flex-col gap-2 mt-2">
        {ITEMS.map(({ icon: Icon, label, desc }, i) => (
          <div key={label} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border bg-bg/40">
            <div className="size-8 rounded-lg bg-elevated border border-border flex items-center justify-center shrink-0 text-muted">
              <Icon size={14} />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-sm text-fg font-medium">{i + 2}. {label}</p>
              <p className="text-xs text-muted leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-subtle mt-3">Klicka på <span className="text-muted">Nästa</span> för att börja.</p>
    </div>
  )
}

// ── Step 2: VPS ─────────────────────────────────────────────────────

function VpsStep({ confirmed, onConfirm }: { confirmed: boolean; onConfirm: (v: boolean) => void }) {
  function openExternal(e: React.MouseEvent, url: string) {
    e.preventDefault()
    void window.api.invoke('shell:open-external', url)
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-wider text-muted">Rekommenderad leverantör</p>
        <a
          href="https://www.hostinger.com/vps-hosting"
          onClick={(e) => openExternal(e, 'https://www.hostinger.com/vps-hosting')}
          className="flex flex-col gap-1 rounded-lg border border-border px-4 py-3 hover:bg-hover hover:border-fg/30 transition-colors w-fit"
        >
          <span className="text-sm text-fg font-medium flex items-center gap-1.5">
            Hostinger VPS <ExternalLink size={11} className="text-muted" />
          </span>
          <span className="text-[11px] text-muted">Prisvärd, enkel att hantera</span>
        </a>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-wider text-muted">Minimikrav</p>
        <ul className="text-xs text-muted flex flex-col gap-1.5 px-1">
          <li className="flex items-center gap-2"><span className="text-fg">·</span> 2 CPU / 4 GB RAM / 20 GB SSD</li>
          <li className="flex items-center gap-2"><span className="text-fg">·</span> Ubuntu 22.04 eller Debian 12</li>
        </ul>
      </div>

      <label className="flex items-center gap-2.5 mt-2 px-4 py-3 rounded-lg border border-border bg-bg/40 cursor-pointer hover:bg-hover transition-colors">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
          className="accent-emerald-400 size-4"
        />
        <span className="text-sm text-fg">Jag har en VPS klar och redo att använda.</span>
      </label>
    </div>
  )
}

// ── Step 3: Supabase ────────────────────────────────────────────────

function SupabaseStep({ confirmed, onConfirm }: { confirmed: boolean; onConfirm: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted leading-relaxed">
        Anslut till din VPS via SSH och kör kommandot nedan. Det installerar Docker, startar Supabase och skapar alla databastabeller automatiskt.
      </p>

      <CopyBlock text={SETUP_CMD} />

      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-wider text-muted">När skriptet är klart får du tre värden</p>
        <ul className="text-xs text-muted flex flex-col gap-1 px-1">
          <li className="flex items-center gap-2"><span className="text-fg">·</span> <span className="text-fg">API URL</span> — t.ex. http://1.2.3.4:8000</li>
          <li className="flex items-center gap-2"><span className="text-fg">·</span> <span className="text-fg">Anon Key</span> — börjar med eyJ…</li>
          <li className="flex items-center gap-2"><span className="text-fg">·</span> <span className="text-fg">Service Role Key</span> — börjar med eyJ…</li>
        </ul>
        <p className="text-[11px] text-subtle mt-1">Spara dessa värden — du behöver dem i nästa steg. Skriptet tar cirka 10–15 minuter.</p>
      </div>

      <a
        href={REPO_URL}
        onClick={(e) => { e.preventDefault(); void window.api.invoke('shell:open-external', REPO_URL) }}
        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors w-fit"
      >
        <ExternalLink size={12} /> Visa skriptet på GitHub
      </a>

      <label className="flex items-center gap-2.5 mt-1 px-4 py-3 rounded-lg border border-border bg-bg/40 cursor-pointer hover:bg-hover transition-colors">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
          className="accent-emerald-400 size-4"
        />
        <span className="text-sm text-fg">Jag har kört skriptet och har de tre värdena klara.</span>
      </label>
    </div>
  )
}

// ── Step 4: Connect ─────────────────────────────────────────────────

interface ConnectStepProps {
  config: DbConfig
  configLoaded: boolean
  testResult: TestResult | null
  testing: boolean
  saved: boolean
  saving: boolean
  onUpdate: (patch: Partial<DbConfig>) => void
  onTest: () => Promise<void>
  onSave: () => Promise<void>
}

function ConnectStep({ config, configLoaded, testResult, testing, saved, saving, onUpdate, onTest, onSave }: ConnectStepProps) {
  if (!configLoaded) return <Loader2 size={16} className="animate-spin text-muted" />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-wider text-muted">API URL</label>
        <input
          type="text"
          className="input font-mono text-xs"
          value={config.supabase_url}
          onChange={(e) => onUpdate({ supabase_url: sanitizeAscii(e.target.value) })}
          placeholder="http://1.2.3.4:8000"
        />
      </div>

      <SecretField
        label="Anon Key"
        value={config.supabase_anon_key}
        onChange={(v) => onUpdate({ supabase_anon_key: sanitizeAscii(v) })}
        placeholder="eyJhbGci..."
      />

      <SecretField
        label="Service Role Key"
        value={config.supabase_service_role_key}
        onChange={(v) => onUpdate({ supabase_service_role_key: sanitizeAscii(v) })}
        placeholder="eyJhbGci..."
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-wider text-muted">Signaturportalens URL</label>
        <input
          type="text"
          className="input font-mono text-xs"
          value={config.web_app_url}
          onChange={(e) => onUpdate({ web_app_url: sanitizeAscii(e.target.value) })}
          placeholder="https://sign.dittforetag.se"
        />
        <p className="text-[11px] text-subtle">Krävs för att skicka signaturlänkar via e-post.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-wider text-muted">Kundportalens URL</label>
        <input
          type="text"
          className="input font-mono text-xs"
          value={config.client_app_url}
          onChange={(e) => onUpdate({ client_app_url: sanitizeAscii(e.target.value) })}
          placeholder="https://kund.dittforetag.se"
        />
        <p className="text-[11px] text-subtle">Krävs för att bjuda in kunder till kundportalen.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap pt-2">
        <button
          onClick={onTest}
          disabled={testing || !config.supabase_url || !config.supabase_anon_key}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-fg hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
          Testa anslutning
        </button>

        <button
          onClick={onSave}
          disabled={saving || !testResult?.ok}
          title={!testResult?.ok ? 'Testa anslutningen först' : undefined}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-fg text-bg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? 'Sparar...' : saved ? 'Sparat ✓' : 'Spara'}
        </button>

        {testResult && (
          <div className={`flex items-center gap-1.5 text-sm ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {testResult.ok
              ? <><CheckCircle size={14} /> Ansluten · {testResult.latency_ms} ms</>
              : <><XCircle size={14} /> {testResult.error}</>
            }
          </div>
        )}
      </div>

      {saved && testResult?.ok && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span className="text-xs text-emerald-400">Anslutningen är klar. Klicka <span className="font-medium">Nästa</span> för att fortsätta.</span>
        </div>
      )}
    </div>
  )
}

// ── Step 5: Company ─────────────────────────────────────────────────

interface CompanyStepProps {
  company: CompanyDraft
  loaded: boolean
  error: string | null
  logoLoading: boolean
  onUpdate: (field: keyof CompanyDraft, value: string) => void
  onBlur: (field: keyof CompanyDraft, value: string) => Promise<void>
  onPickLogo: () => Promise<void>
  onRemoveLogo: () => Promise<void>
}

function CompanyStep({ company, loaded, error, logoLoading, onUpdate, onBlur, onPickLogo, onRemoveLogo }: CompanyStepProps) {
  if (!loaded && !error) return <Loader2 size={16} className="animate-spin text-muted" />

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg border border-red-400/30 bg-red-400/5">
          <XCircle size={13} /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <CompanyField
          label="Företagsnamn *"
          value={company.foretag_namn}
          onChange={(v) => onUpdate('foretag_namn', v)}
          onBlur={(v) => onBlur('foretag_namn', v)}
          placeholder="Mitt företag AB"
        />
        <CompanyField
          label="Org.nummer *"
          value={company.foretag_org_nummer}
          onChange={(v) => onUpdate('foretag_org_nummer', v)}
          onBlur={(v) => onBlur('foretag_org_nummer', v)}
          placeholder="000000-0000"
        />
        <CompanyField
          label="Telefon"
          value={company.foretag_telefon}
          onChange={(v) => onUpdate('foretag_telefon', v)}
          onBlur={(v) => onBlur('foretag_telefon', v)}
        />
        <CompanyField
          label="E-post"
          type="email"
          value={company.foretag_email}
          onChange={(v) => onUpdate('foretag_email', v)}
          onBlur={(v) => onBlur('foretag_email', v)}
        />
        <CompanyField
          label="Url"
          value={company.foretag_webbadress}
          onChange={(v) => onUpdate('foretag_webbadress', v)}
          onBlur={(v) => onBlur('foretag_webbadress', v)}
          placeholder="https://..."
        />
      </div>

      <div className="flex flex-col gap-2 mt-1">
        <label className="text-[11px] uppercase tracking-wider text-muted">Logotyp</label>
        {company.foretag_logo_url ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-14 w-40 rounded-lg border border-border bg-bg shrink-0">
              <img src={company.foretag_logo_url} alt="Logotyp" className="max-h-10 max-w-[150px] object-contain" />
            </div>
            <button onClick={onPickLogo} disabled={logoLoading} className="text-xs rounded-lg border border-border px-3 py-1.5 text-muted hover:text-fg hover:border-fg/40 transition-colors disabled:opacity-50">
              Byt
            </button>
            <button onClick={onRemoveLogo} className="text-xs text-muted hover:text-red-400 transition-colors">
              Ta bort
            </button>
          </div>
        ) : (
          <button
            onClick={onPickLogo}
            disabled={logoLoading}
            className="flex items-center gap-2 h-12 px-4 rounded-lg border border-dashed border-border hover:border-fg/30 hover:bg-hover transition-colors text-muted hover:text-fg disabled:opacity-50 w-fit"
          >
            <Upload size={14} />
            <span className="text-sm">{logoLoading ? 'Laddar...' : 'Välj logotyp'}</span>
          </button>
        )}
      </div>

      <p className="text-[11px] text-subtle">
        Du kan justera fler inställningar senare under <span className="text-muted">Inställningar → Företag</span>.
      </p>
    </div>
  )
}

// ── Reusable bits ───────────────────────────────────────────────────

function CompanyField({ label, value, onChange, onBlur, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted">{label}</label>
      <input
        type={type}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex items-start gap-2 rounded-lg bg-bg border border-border px-4 py-3">
      <code className="flex-1 font-mono text-xs text-emerald-400 break-all leading-relaxed">{text}</code>
      <button onClick={handleCopy} className="shrink-0 text-muted hover:text-fg transition-colors mt-0.5" title="Kopiera">
        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      </button>
    </div>
  )
}

function SecretField({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type={visible ? 'text' : 'password'}
          className="input flex-1 font-mono text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button type="button" onClick={() => setVisible(v => !v)} className="text-muted hover:text-fg transition-colors p-1.5">
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}
