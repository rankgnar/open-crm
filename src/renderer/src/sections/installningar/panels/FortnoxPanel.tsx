import { useState, useEffect } from 'react'
import { Eye, EyeOff, ExternalLink, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppConfig } from '@/context/AppConfig'

const REDIRECT_URI = 'http://localhost:9999/callback'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="p-1 rounded text-muted hover:text-fg hover:bg-hover transition-colors" title="Kopiera">
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-muted leading-relaxed">
      <span className="shrink-0 size-5 rounded-full bg-hover text-fg text-[11px] font-semibold flex items-center justify-center mt-0.5">{n}</span>
      <span>{children}</span>
    </li>
  )
}

function LinkBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <button
      onClick={() => window.api.invoke('shell:open-external', href)}
      className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
    >
      {children}<ExternalLink size={10} className="ml-0.5" />
    </button>
  )
}

function SetupGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border bg-elevated overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm text-muted hover:text-fg hover:bg-hover transition-colors"
      >
        <span className="font-medium">Hur skaffar jag Client ID och Client Secret?</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-border">
          <ol className="mt-4 flex flex-col gap-3">
            <Step n={1}>
              Öppna{' '}
              <LinkBtn href="https://developer.fortnox.se">Fortnox Developer Portal</LinkBtn>
              {' '}och logga in med ditt Fortnox-konto.
            </Step>
            <Step n={2}>
              Klicka <b className="text-fg">Skapa ny applikation</b> → välj <b className="text-fg">Integration</b>.
            </Step>
            <Step n={3}>
              Fyll i ett namn (t.ex. <span className="font-mono text-xs bg-hover px-1 py-0.5 rounded">OpenCRM</span>) och klistra in denna Redirect URI:
              <div className="mt-2 flex items-center gap-2 bg-hover rounded-lg px-3 py-2">
                <span className="font-mono text-xs text-fg flex-1 select-all">{REDIRECT_URI}</span>
                <CopyButton text={REDIRECT_URI} />
              </div>
            </Step>
            <Step n={4}>
              Spara appen och kopiera <b className="text-fg">Client ID</b> och <b className="text-fg">Client Secret</b> till fälten ovan.
            </Step>
            <Step n={5}>
              Klicka <b className="text-fg">Anslut till Fortnox</b> nedan, godkänn åtkomsten i webbläsaren — klar!
            </Step>
          </ol>
        </div>
      )}
    </div>
  )
}

function SecretField({ label, field }: { label: string; field: 'fortnox_client_id' | 'fortnox_client_secret' }) {
  const { config, updateConfig } = useAppConfig()
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!config) return null
  const cfg = config

  async function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = e.target.value
    if (val === cfg[field]) return
    await updateConfig({ [field]: val })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
        {label}
        {saved && <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] inline-block" />}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type={show ? 'text' : 'password'}
          className="input flex-1 font-mono text-xs"
          defaultValue={cfg[field]}
          placeholder={field === 'fortnox_client_id' ? 'Client ID' : 'Client Secret'}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
        <button onClick={() => setShow((s) => !s)} className="text-muted hover:text-fg transition-colors p-1.5">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

export function FortnoxPanel() {
  const { config } = useAppConfig()
  const [tokenScopes, setTokenScopes] = useState<string[]>([])

  const isConnected = Boolean(config?.fortnox_access_token)
  const hasCredentials = Boolean(config?.fortnox_client_id && config?.fortnox_client_secret)

  useEffect(() => {
    window.api.invoke('fortnox:auth:status')
      .then((s) => setTokenScopes((s as { scopes: string[] }).scopes ?? []))
      .catch(() => {})
  }, [isConnected])

  async function handleConnect() {
    if (!config?.fortnox_client_id || !config?.fortnox_client_secret) return
    await window.api.invoke('fortnox:auth:start', config.fortnox_client_id, config.fortnox_client_secret)
  }

  async function handleDisconnect() {
    await window.api.invoke('fortnox:auth:disconnect')
    window.location.reload()
  }

  const statusDescription = isConnected
    ? 'OpenCRM är ansluten till Fortnox och kan synka fakturor, kunder och artiklar.'
    : hasCredentials
      ? 'Klicka "Anslut till Fortnox" för att godkänna åtkomst i webbläsaren.'
      : 'Fyll i Client ID och Client Secret för att kunna ansluta.'

  return (
    <div className="px-8 py-6 max-w-2xl flex flex-col gap-5">
      {/* Status */}
      <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-border bg-elevated">
        <span className={`size-2 rounded-full shrink-0 ${isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-400'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg">{isConnected ? 'Ansluten' : 'Ej ansluten'}</p>
          <p className="text-xs text-muted mt-0.5">{statusDescription}</p>
        </div>
      </div>

      {/* Credentials */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-elevated px-5 py-4">
        <SecretField label="Client ID" field="fortnox_client_id" />
        <SecretField label="Client Secret" field="fortnox_client_secret" />
      </div>

      {/* Setup guide */}
      <SetupGuide />

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {isConnected ? (
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
          >
            Koppla från
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={!hasCredentials}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fg text-bg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ExternalLink size={14} />
            Anslut till Fortnox
          </button>
        )}
        <button
          onClick={() => window.api.invoke('shell:open-external', 'https://apps.fortnox.se')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted hover:text-fg hover:bg-hover rounded-lg transition-colors"
        >
          <ExternalLink size={12} />
          Skapa app på Fortnox
        </button>
      </div>

      {/* Scopes */}
      {isConnected && tokenScopes.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-elevated px-5 py-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">Scopes (aktiva i token)</p>
          <div className="flex flex-wrap gap-2">
            {tokenScopes.map((s) => (
              <span key={s} className="px-2 py-1 rounded text-xs bg-hover text-muted font-mono">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
