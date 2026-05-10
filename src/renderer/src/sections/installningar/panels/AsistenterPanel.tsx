import { useState, useEffect, useCallback } from 'react'
import { Plus, Sparkles, Star, Trash2 } from 'lucide-react'
import type { AiAssistent, AiProvider, AiProviderSlug, AiUppgift } from '../types'

const UPPGIFTER: { value: AiUppgift; label: string }[] = [
  { value: 'forslag', label: 'Förslag' },
  { value: 'sammanfattning', label: 'Sammanfattning' },
  { value: 'epost', label: 'E-post' },
  { value: 'analys', label: 'Analys' },
  { value: 'allman', label: 'Allmän' },
  { value: 'frageblankett', label: 'Formulärgenerator' }
]

const FALLBACK_MODELS: Record<AiProviderSlug, string[]> = {
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-6', 'claude-haiku-3-5'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3', 'o3-mini'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash-001'],
  openrouter: [
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-haiku-4.5',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'google/gemini-2.5-pro',
    'meta-llama/llama-3.3-70b-instruct',
    'deepseek/deepseek-chat'
  ]
}

const PROVIDER_SLUG_MAP: Record<string, AiProviderSlug> = {
  anthropic: 'anthropic', openai: 'openai', google: 'google', openrouter: 'openrouter'
}

function EmptyDetail() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-8">
      <Sparkles size={28} className="text-subtle" />
      <p className="text-sm font-medium text-muted">Välj en assistent</p>
      <p className="text-xs text-subtle max-w-xs">Välj en assistent från listan eller skapa en ny för att konfigurera den.</p>
    </div>
  )
}

function AssistentDetail({
  assistent,
  providers,
  onUpdate,
  onDelete,
  onSetStandard
}: {
  assistent: AiAssistent
  providers: AiProvider[]
  onUpdate: (a: AiAssistent) => void
  onDelete: (id: string) => void
  onSetStandard: (id: string) => void
}) {
  const [models, setModels] = useState<string[]>([])
  const [systemPrompt, setSystemPrompt] = useState(assistent.system_prompt)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const currentProvider = providers.find((p) => p.id === assistent.provider_id)
  const slug: AiProviderSlug = PROVIDER_SLUG_MAP[currentProvider?.provider_slug ?? ''] ?? 'anthropic'

  const loadModels = useCallback(async (provSlug: AiProviderSlug) => {
    try {
      const data = await window.api.invoke('ai:providers:models', { provider_slug: provSlug }) as string[]
      setModels(data.length > 0 ? data : FALLBACK_MODELS[provSlug])
    } catch {
      setModels(FALLBACK_MODELS[provSlug])
    }
  }, [])

  useEffect(() => {
    loadModels(slug)
  }, [slug, loadModels])

  useEffect(() => {
    setSystemPrompt(assistent.system_prompt)
  }, [assistent.id, assistent.system_prompt])

  async function update(fields: Partial<AiAssistent>) {
    const updated = await window.api.invoke('ai:asistenter:update', { id: assistent.id, ...fields }) as AiAssistent
    onUpdate(updated)
  }

  async function handleProviderChange(providerId: string) {
    const prov = providers.find((p) => p.id === providerId)
    const newSlug: AiProviderSlug = PROVIDER_SLUG_MAP[prov?.provider_slug ?? ''] ?? 'anthropic'
    const newModels = FALLBACK_MODELS[newSlug]
    setModels(newModels)
    await update({ provider_id: providerId, model_id: newModels[0] ?? '' })
    loadModels(newSlug)
  }

  async function handleSaveSystemPrompt() {
    await update({ system_prompt: systemPrompt })
  }

  async function handleDelete() {
    await window.api.invoke('ai:asistenter:delete', assistent.id)
    onDelete(assistent.id)
  }

  async function handleSetStandard() {
    await window.api.invoke('ai:asistenter:set-standard', assistent.id)
    onSetStandard(assistent.id)
  }

  function toggleUppgift(val: AiUppgift) {
    const current = assistent.uppgifter ?? []
    const next = current.includes(val) ? current.filter((u) => u !== val) : [...current, val]
    update({ uppgifter: next })
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Sección 1 — Identidad */}
      <div className="px-8 py-6 border-b border-border">
        <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Identitet</p>
        <div className="grid grid-cols-3 gap-x-8 gap-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Namn</label>
            <input
              type="text"
              className="input text-sm text-muted"
              defaultValue={assistent.namn}
              onBlur={(e) => { if (e.target.value !== assistent.namn) update({ namn: e.target.value }) }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Proveedor</label>
            <select
              className="input text-sm text-muted"
              value={assistent.provider_id}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Modell</label>
            <select
              className="input text-sm text-muted"
              value={assistent.model_id}
              onChange={(e) => update({ model_id: e.target.value })}
            >
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Sección 2 — Parámetros */}
      <div className="px-8 py-6 border-b border-border">
        <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Parametrar</p>
        <div className="grid grid-cols-3 gap-x-8 gap-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Temperature <span className="text-subtle">({assistent.temperature})</span></label>
            <input
              type="range"
              min={0} max={2} step={0.1}
              className="w-full accent-current"
              defaultValue={assistent.temperature}
              onMouseUp={(e) => update({ temperature: parseFloat((e.target as HTMLInputElement).value) })}
            />
            <div className="flex justify-between text-[10px] text-subtle">
              <span>0 Precis</span>
              <span>2 Kreativ</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Max tokens</label>
            <input
              type="number"
              className="input text-sm text-muted"
              defaultValue={assistent.max_tokens}
              min={256}
              max={32000}
              step={256}
              onBlur={(e) => { const v = parseInt(e.target.value); if (v !== assistent.max_tokens) update({ max_tokens: v }) }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Standard</label>
            <div className="flex items-center gap-2 h-9">
              {assistent.ar_standard
                ? <div className="flex items-center gap-1.5 text-xs text-amber-400"><Star size={13} className="fill-amber-400" /> Standardassistent</div>
                : <button onClick={handleSetStandard} className="text-xs text-muted hover:text-fg border border-border px-3 py-1.5 rounded transition-colors">Sätt som standard</button>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Sección 3 — Beskrivning y Uppgifter */}
      <div className="px-8 py-6 border-b border-border">
        <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Användning</p>
        <div className="grid grid-cols-3 gap-x-8 gap-y-5">
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Beskrivning</label>
            <input
              type="text"
              className="input text-sm text-muted"
              defaultValue={assistent.beskrivning}
              placeholder="Kort beskrivning av assistentens syfte..."
              onBlur={(e) => { if (e.target.value !== assistent.beskrivning) update({ beskrivning: e.target.value }) }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Uppgifter</label>
            <div className="flex flex-col gap-1">
              {UPPGIFTER.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 text-xs text-muted cursor-pointer hover:text-fg">
                  <input
                    type="checkbox"
                    checked={assistent.uppgifter?.includes(value) ?? false}
                    onChange={() => toggleUppgift(value)}
                    className="accent-current"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sección 4 — System Prompt */}
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] uppercase tracking-widest text-muted">System Prompt</p>
          <button
            onClick={handleSaveSystemPrompt}
            className="text-xs text-muted hover:text-fg border border-border px-3 py-1 rounded transition-colors"
          >
            Spara
          </button>
        </div>
        <textarea
          className="input w-full text-sm font-mono resize-none"
          rows={8}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Du är en hjälpsam assistent för ett byggnadsföretag..."
        />
      </div>

      {/* Footer */}
      <div className="px-8 py-4 flex items-center justify-between mt-auto">
        <div />
        {confirmDelete
          ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">Är du säker?</span>
              <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 px-3 py-1.5 rounded transition-colors">Radera</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted hover:text-fg border border-border px-3 py-1.5 rounded transition-colors">Avbryt</button>
            </div>
          )
          : (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs text-muted hover:text-red-400 transition-colors">
              <Trash2 size={13} />
              Radera assistent
            </button>
          )
        }
      </div>
    </div>
  )
}

export function AsistenterPanel() {
  const [asistenter, setAsistenter] = useState<AiAssistent[]>([])
  const [providers, setProviders] = useState<AiProvider[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      window.api.invoke('ai:asistenter:list') as Promise<AiAssistent[]>,
      window.api.invoke('ai:providers:list') as Promise<AiProvider[]>
    ]).then(([a, p]) => {
      setAsistenter(a)
      setProviders(p)
    })
  }, [])

  async function handleCreate() {
    if (providers.length === 0) return
    const created = await window.api.invoke('ai:asistenter:create', {
      provider_id: providers[0].id,
      namn: 'Ny assistent',
      beskrivning: '',
      model_id: 'claude-sonnet-4-6',
      system_prompt: '',
      uppgifter: [],
      temperature: 0.7,
      max_tokens: 2048,
      aktiv: true,
      ar_standard: false,
      sortering: asistenter.length
    }) as AiAssistent
    setAsistenter((prev) => [...prev, created])
    setSelectedId(created.id)
  }

  function handleUpdate(updated: AiAssistent) {
    setAsistenter((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }

  function handleDelete(id: string) {
    setAsistenter((prev) => prev.filter((a) => a.id !== id))
    setSelectedId(null)
  }

  function handleSetStandard(id: string) {
    setAsistenter((prev) => prev.map((a) => ({ ...a, ar_standard: a.id === id })))
  }

  const selected = asistenter.find((a) => a.id === selectedId) ?? null

  return (
    <div className="flex flex-1 min-h-0 h-full overflow-hidden">
      {/* Lista izquierda */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <p className="text-xs text-muted uppercase tracking-widest">Asistentes</p>
          <button onClick={handleCreate} className="text-muted hover:text-fg transition-colors" title="Ny assistent">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-auto py-1">
          {asistenter.length === 0 && (
            <p className="text-xs text-subtle px-4 py-3">Inga asistenter ännu.</p>
          )}
          {asistenter.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={`w-full text-left px-4 py-2.5 transition-colors ${selectedId === a.id ? 'bg-hover text-fg' : 'text-muted hover:text-fg hover:bg-hover'}`}
            >
              <div className="flex items-center gap-1.5">
                {a.ar_standard && <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
                <p className="text-sm truncate">{a.namn}</p>
              </div>
              <p className="text-[11px] text-subtle truncate mt-0.5">
                {a.provider?.display_name ?? '—'} · {a.model_id}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Detalle derecho */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {selected
          ? <AssistentDetail
              key={selected.id}
              assistent={selected}
              providers={providers}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onSetStandard={handleSetStandard}
            />
          : <EmptyDetail />
        }
      </div>
    </div>
  )
}
