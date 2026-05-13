import { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import { ConfigField, ConfigTextarea } from './ConfigField'
import type { ProjektStatusar } from '@/sections/projekt/types'
import { FARG_DOT, FARG_TEXT } from '@/sections/projekt/types'
import { ProjektImportSection } from './ProjektImportSection'

type Farg = ProjektStatusar['farg']

const FARG_OPTIONS: { value: Farg; dot: string; label: string }[] = [
  { value: 'emerald', dot: 'bg-emerald-400', label: 'Grön' },
  { value: 'blue',    dot: 'bg-blue-400',    label: 'Blå' },
  { value: 'amber',   dot: 'bg-amber-400',   label: 'Gul' },
  { value: 'red',     dot: 'bg-red-400',     label: 'Röd' },
  { value: 'muted',   dot: 'bg-muted',       label: 'Grå' },
]

export function ProjektPanel() {
  const [current, setCurrent] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [villkorOpen, setVillkorOpen] = useState(false)

  const [statusar, setStatusar] = useState<ProjektStatusar[]>([])
  const [adding, setAdding] = useState(false)
  const [newNamn, setNewNamn] = useState('')
  const [newFarg, setNewFarg] = useState<Farg>('muted')
  const [statusSaving, setStatusSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    window.api.invoke('db:projekt-nummer:get').then((n) => {
      setCurrent(n as number)
      setInput(String(n as number))
    })
    window.api.invoke('db:projekt-statusar:list').then((d) => setStatusar(d as ProjektStatusar[]))
  }, [])

  async function handleSet() {
    const val = parseInt(input)
    if (!val || val < 1) { setError('Ange ett positivt heltal.'); return }
    setSaving(true); setError('')
    try {
      const next = await window.api.invoke('db:projekt-nummer:set', val) as number
      setCurrent(next); setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fel')
    } finally { setSaving(false) }
  }

  async function handleAddStatus() {
    if (!newNamn.trim()) return
    setStatusSaving(true)
    try {
      const created = await window.api.invoke('db:projekt-statusar:create', { namn: newNamn.trim(), farg: newFarg }) as ProjektStatusar
      setStatusar((prev) => [...prev, created])
      setNewNamn(''); setNewFarg('muted'); setAdding(false)
    } finally { setStatusSaving(false) }
  }

  async function handleUpdateNamn(id: string, namn: string) {
    const updated = await window.api.invoke('db:projekt-statusar:update', id, { namn }) as ProjektStatusar
    setStatusar((prev) => prev.map((s) => s.id === id ? updated : s))
    setEditingId(null)
  }

  async function handleUpdateFarg(id: string, farg: Farg) {
    const updated = await window.api.invoke('db:projekt-statusar:update', id, { farg }) as ProjektStatusar
    setStatusar((prev) => prev.map((s) => s.id === id ? updated : s))
  }

  async function handleDeleteStatus(id: string) {
    setDeletingId(id)
    try {
      await window.api.invoke('db:projekt-statusar:delete', id)
      setStatusar((prev) => prev.filter((s) => s.id !== id))
    } finally { setDeletingId(null) }
  }

  return (
    <div className="flex h-full min-h-0">

      {/* Left column — settings */}
      <div className="flex flex-col gap-0 flex-1 border-r border-border overflow-auto">

        {/* Standardvärden */}
        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-5">Standardvärden</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <ConfigField label="Betalningsvillkor" field="projekt_std_betalningsvillkor" placeholder="30 dagar netto" />
            <ConfigField label="ROT-procent (%)" field="projekt_std_rot_procent" type="number" placeholder="30" />
          </div>
        </div>

        {/* Numerering */}
        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Projektnumrering</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-subtle">
              Nästa: <span className="font-mono text-fg">P-{current != null ? String(current).padStart(4, '0') : '…'}</span>
            </span>
            <input
              type="number" min="1" step="1"
              className="input font-mono w-24 text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSet() }}
            />
            <button onClick={handleSet} disabled={saving} className="px-3 py-1.5 rounded-lg bg-hover text-fg text-xs font-medium hover:bg-border disabled:opacity-40 transition-colors">
              {saving ? '...' : saved ? '✓ Sparat' : 'Sätt'}
            </button>
            <button
              onClick={async () => {
                setInput('1'); setSaving(true); setError('')
                try {
                  const next = await window.api.invoke('db:projekt-nummer:set', 1) as number
                  setCurrent(next); setSaved(true); setTimeout(() => setSaved(false), 2500)
                } catch (err) { setError(err instanceof Error ? err.message : 'Fel') }
                finally { setSaving(false) }
              }}
              disabled={saving}
              className="text-xs text-muted hover:text-fg disabled:opacity-40 transition-colors"
            >
              Återställ till 1
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>

        {/* Import */}
        <div className="border-b border-border">
          <ProjektImportSection />
        </div>

        {/* Villkor — collapsible */}
        <div className="border-b border-border">
          <button
            onClick={() => setVillkorOpen((v) => !v)}
            className="w-full flex items-center justify-between px-8 py-4 hover:bg-hover transition-colors"
          >
            <p className="text-[11px] uppercase tracking-widest text-muted">Standardvillkor</p>
            {villkorOpen ? <ChevronUp size={14} className="text-subtle" /> : <ChevronDown size={14} className="text-subtle" />}
          </button>
          {villkorOpen && (
            <div className="px-8 pb-6">
              <ConfigTextarea
                label=""
                field="projekt_std_villkor"
                placeholder="Betalning sker inom 30 dagar från fakturadatum. Vid försenad betalning debiteras dröjsmålsränta..."
                rows={8}
              />
              <p className="mt-2 text-xs text-subtle">Används som standardtext när ett nytt projekt skapas.</p>
            </div>
          )}
        </div>

      </div>

      {/* Right column — statusar */}
      <div className="w-72 flex flex-col shrink-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <p className="text-[11px] uppercase tracking-widest text-muted">Statusar</p>
          {!adding && (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors">
              <Plus size={13} />Lägg till
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          <div className="flex flex-col divide-y divide-border">
            {statusar.map((s) => (
              <StatusRow
                key={s.id}
                status={s}
                isEditing={editingId === s.id}
                deleting={deletingId === s.id}
                onStartEdit={() => setEditingId(s.id)}
                onSaveNamn={(namn) => handleUpdateNamn(s.id, namn)}
                onCancelEdit={() => setEditingId(null)}
                onFargChange={(farg) => handleUpdateFarg(s.id, farg)}
                onDelete={() => handleDeleteStatus(s.id)}
              />
            ))}

            {statusar.length === 0 && !adding && (
              <p className="px-6 py-8 text-xs text-subtle text-center">Inga statusar än.</p>
            )}
          </div>
        </div>

        {adding && (
          <div className="border-t border-border px-4 py-3 flex items-center gap-2 shrink-0 bg-elevated">
            <ColorPicker value={newFarg} onChange={setNewFarg} />
            <input
              autoFocus
              value={newNamn}
              onChange={(e) => setNewNamn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddStatus()
                if (e.key === 'Escape') { setAdding(false); setNewNamn('') }
              }}
              placeholder="Statusnamn..."
              className="input flex-1 text-sm"
            />
            <button onClick={handleAddStatus} disabled={statusSaving || !newNamn.trim()} className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-40 font-medium transition-colors shrink-0">
              {statusSaving ? '...' : 'OK'}
            </button>
            <button onClick={() => { setAdding(false); setNewNamn('') }} className="text-xs text-muted hover:text-fg transition-colors shrink-0">✕</button>
          </div>
        )}
      </div>

    </div>
  )
}

interface StatusRowProps {
  status: ProjektStatusar
  isEditing: boolean
  deleting: boolean
  onStartEdit: () => void
  onSaveNamn: (namn: string) => void
  onCancelEdit: () => void
  onFargChange: (farg: Farg) => void
  onDelete: () => void
}

function StatusRow({ status, isEditing, deleting, onStartEdit, onSaveNamn, onCancelEdit, onFargChange, onDelete }: StatusRowProps) {
  const [draft, setDraft] = useState(status.namn)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const locked = status.inbyggd

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 group hover:bg-hover transition-colors">
      <ColorPicker value={status.farg} onChange={(f) => onFargChange(f)} />
      {isEditing && !locked ? (
        <input
          autoFocus value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if (draft.trim()) onSaveNamn(draft.trim()); else onCancelEdit() }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) onSaveNamn(draft.trim())
            if (e.key === 'Escape') { setDraft(status.namn); onCancelEdit() }
          }}
          className="input flex-1 text-sm"
        />
      ) : (
        <span
          className={`flex-1 text-sm font-medium select-none ${locked ? 'cursor-default' : 'cursor-text'} ${FARG_TEXT[status.farg]}`}
          onDoubleClick={locked ? undefined : onStartEdit}
          title={locked ? 'Inbyggd status — kan inte byta namn eller tas bort' : 'Dubbelklicka för att redigera'}
        >
          {status.namn}
        </span>
      )}
      {locked ? (
        <Lock size={11} className="ml-auto shrink-0 text-subtle" aria-label="Inbyggd status" />
      ) : confirmDelete ? (
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button onClick={onDelete} disabled={deleting} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 font-medium transition-colors">
            {deleting ? '...' : 'Ja'}
          </button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted hover:text-fg transition-colors">Nej</button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onStartEdit} className="text-muted hover:text-fg transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => setConfirmDelete(true)} className="text-muted hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: Farg; onChange: (f: Farg) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)} className="block">
        <span className={`block size-3.5 rounded-full ${FARG_DOT[value]} transition-transform hover:scale-110`} />
      </button>
      {open && (
        <div className="absolute left-0 top-5 z-10 flex gap-1.5 p-2 bg-elevated border border-border rounded-lg shadow-lg">
          {FARG_OPTIONS.map((o) => (
            <button
              key={o.value}
              title={o.label}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`size-4 rounded-full ${o.dot} transition-transform hover:scale-125 ${value === o.value ? 'ring-2 ring-fg ring-offset-1 ring-offset-elevated' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
