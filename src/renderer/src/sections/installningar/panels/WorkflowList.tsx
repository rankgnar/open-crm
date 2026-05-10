import { useState, useRef, useEffect } from 'react'
import { Plus, CheckCircle2, XCircle, Loader2, Clock, X, Check } from 'lucide-react'
import type { Workflow, WorkflowRunStatus } from '../types'
import { SelectField } from '@/components/SelectField'

interface Props {
  workflows: Workflow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (namn: string, kategori: string) => void
  loading: boolean
}

const KATEGORI_ORDER = ['forslag', 'tidplan', 'projekt', 'kunder', 'fakturor', 'analys', 'epost']
const KATEGORI_LABELS: Record<string, string> = {
  forslag: 'Förslag', tidplan: 'Tidplan', projekt: 'Projekt',
  kunder: 'Kunder', fakturor: 'Fakturor', analys: 'Analys', epost: 'E-post',
}

function RunBadge({ status }: { status: WorkflowRunStatus }) {
  if (status === 'klar') return <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
  if (status === 'fel') return <XCircle size={11} className="text-red-400 shrink-0" />
  if (status === 'kör') return <Loader2 size={11} className="text-blue-400 animate-spin shrink-0" />
  return <Clock size={11} className="text-muted shrink-0" />
}

export function WorkflowList({ workflows, selectedId, onSelect, onCreate, loading }: Props) {
  const [creating, setCreating] = useState(false)
  const [namn, setNamn] = useState('')
  const [kategori, setKategori] = useState('forslag')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  async function handleSubmit() {
    if (!namn.trim() || saving) return
    setSaving(true)
    try {
      await onCreate(namn.trim(), kategori)
      setNamn('')
      setKategori('forslag')
      setCreating(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setNamn('')
    setKategori('forslag')
    setCreating(false)
  }

  const grouped = KATEGORI_ORDER.reduce<Record<string, Workflow[]>>((acc, k) => {
    const items = workflows.filter(w => w.kategori === k)
    if (items.length > 0) acc[k] = items
    return acc
  }, {})
  workflows.forEach(w => {
    if (!KATEGORI_ORDER.includes(w.kategori)) {
      grouped['epost'] = [...(grouped['epost'] ?? []), w]
    }
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border shrink-0">
        {creating ? (
          <div className="flex flex-col gap-1.5">
            <input
              ref={inputRef}
              value={namn}
              onChange={e => setNamn(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') handleCancel() }}
              placeholder="Namn på workflow..."
              className="w-full bg-bg border border-border rounded px-2.5 py-1.5 text-xs text-fg focus:outline-none focus:border-blue-400/60 placeholder:text-subtle"
            />
            <div className="flex items-center gap-1.5">
              <SelectField
                value={kategori}
                onChange={setKategori}
                className="flex-1"
                options={KATEGORI_ORDER.map((k) => ({ value: k, label: KATEGORI_LABELS[k] }))}
              />
              <button
                onClick={handleSubmit}
                disabled={!namn.trim() || saving}
                className="p-1.5 rounded bg-blue-400/10 border border-blue-400/30 text-blue-400 hover:bg-blue-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button onClick={handleCancel} className="p-1.5 rounded hover:bg-hover text-muted hover:text-fg transition-colors">
                <X size={13} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded text-xs text-fg bg-hover hover:bg-elevated transition-colors"
          >
            <Plus size={13} />
            Nytt workflow
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto py-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="text-muted animate-spin" />
          </div>
        )}

        {!loading && workflows.length === 0 && !creating && (
          <p className="px-4 py-6 text-xs text-muted text-center">Inga workflows ännu.</p>
        )}

        {Object.entries(grouped).map(([kat, items]) => (
          <div key={kat} className="mb-3">
            <p className="px-4 mb-1 text-[10px] uppercase tracking-widest text-subtle">
              {KATEGORI_LABELS[kat] ?? kat}
            </p>
            {items.map(wf => (
              <button
                key={wf.id}
                onClick={() => onSelect(wf.id)}
                className={`w-full text-left px-4 py-2 flex items-center gap-2 transition-colors ${
                  selectedId === wf.id ? 'bg-hover text-fg' : 'text-muted hover:text-fg hover:bg-hover'
                }`}
              >
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${wf.aktiv ? 'bg-emerald-400' : 'bg-border'}`} />
                <span className="flex-1 text-xs truncate">{wf.namn}</span>
                {wf.lastRun && <RunBadge status={wf.lastRun.status} />}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
