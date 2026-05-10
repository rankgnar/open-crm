import { useState } from 'react'
import { Plus, Calendar, FileText, Upload, BookOpen, Circle, Trash2, Check, type LucideIcon } from 'lucide-react'
import type { RevisorDeadline, CreateDeadlineInput, DeadlineTyp, DeadlineStatus } from './types'

interface Props {
  deadlines: RevisorDeadline[]
  onCreate: (input: CreateDeadlineInput) => Promise<void>
  onToggle: (id: string, status: 'kommande' | 'slutford') => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const TYP_ICON: Record<DeadlineTyp, LucideIcon> = {
  mote: Calendar,
  deklaration: FileText,
  inlamning: Upload,
  bokslut: BookOpen,
  ovrig: Circle,
}

const TYP_LABEL: Record<DeadlineTyp, string> = {
  mote: 'Möte',
  deklaration: 'Deklaration',
  inlamning: 'Inlämning',
  bokslut: 'Bokslut',
  ovrig: 'Övrigt',
}

const STATUS_COLOR: Record<DeadlineStatus, string> = {
  kommande: 'text-blue-400',
  slutford: 'text-emerald-400',
  forsenad: 'text-red-400',
}

const STATUS_LABEL: Record<DeadlineStatus, string> = {
  kommande: 'Kommande',
  slutford: 'Slutförd',
  forsenad: 'Försenad',
}

export function RevisorDeadlines({ deadlines, onCreate, onToggle, onDelete }: Props) {
  const [adding, setAdding] = useState(false)
  const [titel, setTitel] = useState('')
  const [datum, setDatum] = useState('')
  const [typ, setTyp] = useState<DeadlineTyp>('ovrig')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!titel.trim() || !datum) return
    setSaving(true)
    await onCreate({ titel: titel.trim(), datum, typ })
    setTitel(''); setDatum(''); setTyp('ovrig')
    setSaving(false); setAdding(false)
  }

  async function handleToggle(d: RevisorDeadline) {
    setTogglingId(d.id)
    await onToggle(d.id, d.status === 'slutford' ? 'kommande' : 'slutford')
    setTogglingId(null)
  }

  async function handleDelete(id: string) {
    setDeletingId(id); await onDelete(id); setDeletingId(null)
  }

  const sorted = [...deadlines].sort((a, b) => a.datum.localeCompare(b.datum))

  return (
    <div className="px-8 py-6 border-b border-border">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] uppercase tracking-widest text-muted">Deadlines & Möten</p>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors"
        >
          <Plus size={12} />Ny deadline
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-4 p-3 border border-border rounded-lg bg-elevated">
          <input
            autoFocus
            className="input text-xs"
            placeholder="Titel *"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="date"
              className="input text-xs flex-1"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
            />
            <select
              className="input text-xs text-muted w-40"
              value={typ}
              onChange={(e) => setTyp(e.target.value as DeadlineTyp)}
            >
              {(Object.keys(TYP_LABEL) as DeadlineTyp[]).map((t) => (
                <option key={t} value={t}>{TYP_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !titel.trim() || !datum}
              className="flex-1 rounded-lg bg-fg text-bg px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
            >
              {saving ? 'Sparar...' : 'Lägg till'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-fg transition-colors"
            >
              Avbryt
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="text-xs text-subtle italic">Inga deadlines inlagda.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {sorted.map((d) => {
            const Icon = TYP_ICON[d.typ]
            const done = d.status === 'slutford'
            return (
              <div key={d.id} className="group flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <button
                  onClick={() => handleToggle(d)}
                  disabled={togglingId === d.id}
                  className={`shrink-0 size-4 rounded border flex items-center justify-center transition-colors ${done ? 'bg-emerald-400/20 border-emerald-400/40' : 'border-border hover:border-muted'}`}
                >
                  {done && <Check size={10} className="text-emerald-400" />}
                </button>
                <Icon size={13} className={done ? 'text-subtle' : 'text-muted'} />
                <div className="flex-1 min-w-0">
                  <span className={`text-xs ${done ? 'line-through text-subtle' : 'text-fg'}`}>{d.titel}</span>
                  <span className="text-[11px] text-subtle ml-2">
                    {new Date(d.datum + 'T12:00:00').toLocaleDateString('sv-SE')}
                  </span>
                </div>
                <span className={`text-[10px] shrink-0 uppercase tracking-wider ${STATUS_COLOR[d.status]}`}>
                  {STATUS_LABEL[d.status]}
                </span>
                <button
                  onClick={() => handleDelete(d.id)}
                  disabled={deletingId === d.id}
                  className="p-1 text-subtle hover:text-red-400 opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-all"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
