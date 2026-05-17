import { useState, useEffect } from 'react'
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { AiProvider, AiProviderSlug, AiTestResult } from '../types'

const PROVIDER_ICONS: Record<AiProviderSlug, string> = {
  anthropic: '◆',
  openai: '⬡',
  google: '✦',
  openrouter: '◇'
}

const PROVIDER_DESCRIPTIONS: Record<AiProviderSlug, string> = {
  anthropic: 'Claude Opus, Sonnet, Haiku — Anthropic API',
  openai: 'GPT-4o, o3, o3-mini — OpenAI API',
  google: 'Gemini 2.5 Pro, 2.0 Flash — Google AI API',
  openrouter: 'Samlad tillgång till 300+ modeller — Claude, Gemini, Llama, DeepSeek, Mistral…'
}

const API_KEY_PLACEHOLDERS: Record<AiProviderSlug, string> = {
  anthropic: 'sk-ant-...',
  openai: 'sk-...',
  google: 'AIza...',
  openrouter: 'sk-or-v1-...'
}

function ProviderBlock({ provider, onUpdate }: { provider: AiProvider; onUpdate: (updated: AiProvider) => void }) {
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<AiTestResult | null>(null)

  async function handleApiKeyBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = e.target.value
    if (val === provider.api_key) return
    const updated = await window.api.invoke('ai:providers:update', { id: provider.id, api_key: val }) as AiProvider
    onUpdate(updated)
  }

  async function handleAktivToggle() {
    const updated = await window.api.invoke('ai:providers:update', { id: provider.id, aktiv: !provider.aktiv }) as AiProvider
    onUpdate(updated)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const result = await window.api.invoke('ai:providers:test', { provider_slug: provider.provider_slug }) as AiTestResult
    setTestResult(result)
    if (result.ok !== provider.aktiv) {
      const updated = await window.api.invoke('ai:providers:update', { id: provider.id, aktiv: result.ok }) as AiProvider
      onUpdate(updated)
    }
    setTesting(false)
  }

  const hasKey = provider.api_key.length > 0

  return (
    <div className="px-8 py-6 border-b border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-lg text-muted font-mono">{PROVIDER_ICONS[provider.provider_slug]}</span>
          <div>
            <p className="text-sm font-medium text-fg">{provider.display_name}</p>
            <p className="text-xs text-subtle">{PROVIDER_DESCRIPTIONS[provider.provider_slug]}</p>
          </div>
          {testResult?.ok && (
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing || !hasKey}
            className="text-xs text-muted hover:text-fg border border-border px-3 py-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? <Loader2 size={12} className="animate-spin inline" /> : 'Testa anslutning'}
          </button>
          <button
            onClick={handleAktivToggle}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${provider.aktiv ? 'border-emerald-400/30 text-emerald-400 bg-emerald-400/5' : 'border-border text-subtle'}`}
          >
            {provider.aktiv ? 'Aktiv' : 'Inaktiv'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-8 gap-y-4">
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wider text-muted">API Key</label>
          <div className="flex items-center gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              className="input flex-1 font-mono text-xs"
              defaultValue={provider.api_key}
              placeholder={API_KEY_PLACEHOLDERS[provider.provider_slug]}
              onBlur={handleApiKeyBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
            <button onClick={() => setShowKey((s) => !s)} className="text-muted hover:text-fg transition-colors shrink-0">
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wider text-muted">Status</label>
          <div className="flex items-center gap-2 h-9">
            {testResult === null && !testing && (
              <p className="text-xs text-subtle">Ej testad</p>
            )}
            {testing && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 size={13} className="animate-spin" />
                Ansluter…
              </div>
            )}
            {testResult !== null && !testing && (
              <div className={`flex items-center gap-2 text-xs ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {testResult.ok
                  ? <><CheckCircle2 size={13} /> OK · {testResult.latency_ms}ms</>
                  : <><XCircle size={13} /> {testResult.error ?? 'Error'}</>
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AiLeverantorPanel() {
  const [providers, setProviders] = useState<AiProvider[]>([])

  useEffect(() => {
    window.api.invoke('ai:providers:list').then((data) => setProviders(data as AiProvider[]))
  }, [])

  function handleUpdate(updated: AiProvider) {
    setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  return (
    <div className="flex flex-col">
      <div className="px-8 py-4 border-b border-border">
        <p className="text-xs text-muted">Konfigurera API-nycklar för varje AI-leverantör. Nycklarna lagras lokalt och lämnar aldrig huvudprocessen.</p>
      </div>
      {providers.map((p) => (
        <ProviderBlock key={p.id} provider={p} onUpdate={handleUpdate} />
      ))}
    </div>
  )
}
