import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Database, Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react'

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

const CONFIG_DEFAULTS: DbConfig = {
  supabase_url: '',
  supabase_anon_key: '',
  supabase_service_role_key: '',
  web_app_url: '',
  client_app_url: '',
}

export function DatabaSPanel() {
  const [config, setConfig] = useState<DbConfig>(CONFIG_DEFAULTS)
  const [original, setOriginal] = useState<DbConfig>(CONFIG_DEFAULTS)
  const [ready, setReady] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const load = useCallback(() => {
    void Promise.all([
      window.api.invoke('config:db:get'),
      window.api.invoke('config:db:is-ready'),
    ]).then(([data, isReady]) => {
      const cfg = { ...CONFIG_DEFAULTS, ...(data as DbConfig) }
      setConfig(cfg)
      setOriginal(cfg)
      setReady(Boolean(isReady))
      setLoaded(true)
    })
  }, [])

  useEffect(() => { load() }, [load])

  const hasLocalConfig = Boolean(original.supabase_url)
  const isConnected = ready
  const usingEnvOnly = isConnected && !hasLocalConfig
  const isDirty =
    config.supabase_url !== original.supabase_url ||
    config.supabase_anon_key !== original.supabase_anon_key ||
    config.supabase_service_role_key !== original.supabase_service_role_key ||
    config.web_app_url !== original.web_app_url ||
    config.client_app_url !== original.client_app_url

  function update(patch: Partial<DbConfig>) {
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
    setOriginal(config)
    setEditing(false)
    setTimeout(() => setSaved(false), 2500)
  }

  function handleCancel() {
    setConfig(original)
    setTestResult(null)
    setEditing(false)
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    await window.api.invoke('config:db:set', { ...CONFIG_DEFAULTS })
    // Reload the renderer so the wizard modal triggers cleanly
    window.location.reload()
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={16} className="animate-spin text-muted" />
      </div>
    )
  }

  // ── Disconnect confirmation ─────────────────────────────────────────
  if (confirmDisconnect) {
    return (
      <div className="px-8 py-6 max-w-2xl">
        <div className="flex flex-col gap-4 px-6 py-5 rounded-xl border border-amber-400/30 bg-amber-400/5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-medium text-fg">Koppla från databasen?</p>
              <p className="text-sm text-muted leading-relaxed">
                Anslutningsuppgifterna raderas från den här installationen. OpenCRM kommer att be dig sätta upp en ny anslutning vid omstart. Datan i din Supabase-databas påverkas inte — endast den lokala konfigurationen rensas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-amber-400/20">
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 rounded-lg bg-red-400 text-bg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {disconnecting ? 'Kopplar från...' : 'Ja, koppla från'}
            </button>
            <button
              onClick={() => setConfirmDisconnect(false)}
              disabled={disconnecting}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-fg hover:bg-hover transition-colors disabled:opacity-40"
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Edit form ───────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="px-8 py-6 max-w-2xl flex flex-col gap-5">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted">Ändra anslutning</p>
          <p className="text-sm text-muted mt-1.5">
            Klistra in nya värden, testa anslutningen och spara. Ändringen träder i kraft direkt — ingen omstart krävs.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-elevated px-5 py-4">
          <FieldText
            label="API URL"
            value={config.supabase_url}
            onChange={(v) => update({ supabase_url: v })}
            placeholder="http://1.2.3.4:8000"
          />
          <SecretField
            label="Anon Key"
            value={config.supabase_anon_key}
            onChange={(v) => update({ supabase_anon_key: v })}
            placeholder="eyJhbGci..."
          />
          <SecretField
            label="Service Role Key"
            value={config.supabase_service_role_key}
            onChange={(v) => update({ supabase_service_role_key: v })}
            placeholder="eyJhbGci..."
          />

          <FieldText
            label="Signaturportalens URL"
            value={config.web_app_url}
            onChange={(v) => update({ web_app_url: v })}
            placeholder="https://sign.dittforetag.se"
          />
          <FieldText
            label="Kundportalens URL"
            value={config.client_app_url}
            onChange={(v) => update({ client_app_url: v })}
            placeholder="https://kund.dittforetag.se"
          />

          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-border">
            <button
              onClick={handleTest}
              disabled={testing || !config.supabase_url || !config.supabase_anon_key}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-fg hover:bg-hover transition-colors disabled:opacity-40"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
              Testa anslutning
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !testResult?.ok}
              title={!testResult?.ok ? 'Testa anslutningen först' : undefined}
              className="px-5 py-2 rounded-lg bg-fg text-bg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Sparar...' : saved ? 'Sparat ✓' : 'Spara'}
            </button>

            <button
              onClick={handleCancel}
              className="px-3 py-2 rounded-lg text-sm text-muted hover:text-fg hover:bg-hover transition-colors"
            >
              Avbryt
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
        </div>

        {isDirty && !saved && (
          <p className="text-xs text-amber-400">Du har osparade ändringar.</p>
        )}
      </div>
    )
  }

  // ── Read-only view ──────────────────────────────────────────────────
  const statusDescription = !isConnected
    ? 'Inga anslutningsuppgifter är konfigurerade.'
    : usingEnvOnly
      ? 'Anslutningen läses från .env (utvecklingsläge). Spara värden här för att skriva över i produktion.'
      : 'OpenCRM är ansluten till din Supabase-databas.'

  return (
    <div className="px-8 py-6 max-w-2xl flex flex-col gap-5">
      {/* Status */}
      <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-border bg-elevated">
        <span className={`size-2 rounded-full shrink-0 ${isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-400'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg">{isConnected ? (usingEnvOnly ? 'Ansluten · utvecklingsläge' : 'Ansluten') : 'Ej ansluten'}</p>
          <p className="text-xs text-muted mt-0.5">{statusDescription}</p>
        </div>
        {isConnected && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-fg hover:bg-hover transition-colors disabled:opacity-40"
          >
            {testing ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
            Testa
          </button>
        )}
      </div>

      {testResult && (
        <div className={`flex items-center gap-1.5 text-sm px-3 ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {testResult.ok
            ? <><CheckCircle size={14} /> Ansluten · {testResult.latency_ms} ms</>
            : <><XCircle size={14} /> {testResult.error}</>
          }
        </div>
      )}

      {/* Credentials display — only if config is stored locally (db-config.json) */}
      {hasLocalConfig && (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-elevated px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">API URL</label>
            <code className="text-xs font-mono text-fg break-all">{original.supabase_url}</code>
          </div>
          <SecretDisplay label="Anon Key" value={original.supabase_anon_key} />
          <SecretDisplay label="Service Role Key" value={original.supabase_service_role_key} />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Signaturportalens URL</label>
            <code className="text-xs font-mono text-fg break-all">{original.web_app_url || '—'}</code>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Kundportalens URL</label>
            <code className="text-xs font-mono text-fg break-all">{original.client_app_url || '—'}</code>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setEditing(true)}
          className="px-4 py-2 rounded-lg bg-fg text-bg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {hasLocalConfig ? 'Ändra anslutning' : 'Konfigurera anslutning'}
        </button>
        {hasLocalConfig && (
          <button
            onClick={() => setConfirmDisconnect(true)}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
          >
            Koppla från
          </button>
        )}
      </div>
    </div>
  )
}

function FieldText({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted">{label}</label>
      <input
        type="text"
        className="input font-mono text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
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
        <button type="button" onClick={() => setVisible((v) => !v)} className="text-muted hover:text-fg transition-colors p-1.5">
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

function SecretDisplay({ label, value }: { label: string; value: string }) {
  const [visible, setVisible] = useState(false)
  const masked = value ? '•'.repeat(Math.min(40, value.length)) : '—'
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted">{label}</label>
      <div className="flex items-center gap-1.5">
        <code className="flex-1 text-xs font-mono text-fg break-all">
          {visible ? value || '—' : masked}
        </code>
        {value && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="text-muted hover:text-fg transition-colors p-1.5"
            title={visible ? 'Dölj' : 'Visa'}
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  )
}
