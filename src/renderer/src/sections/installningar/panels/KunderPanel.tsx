import { useState, useEffect } from 'react'
import { Plus, Trash2, Lock, ToggleRight, ToggleLeft } from 'lucide-react'
import { ConfigField } from './ConfigField'
import { useAppConfig } from '@/context/AppConfig'
import type { KundStatusar } from '@/sections/kunder/types'
import { FARG_DOT, FARG_TEXT } from '@/sections/kunder/types'
import { KunderImportSection } from './KunderImportSection'
import { KlientportalSection } from './KlientportalSection'
import { SelectField } from '@/components/SelectField'

type Farg = KundStatusar['farg']

const FARG_OPTIONS: { value: Farg; dot: string; label: string }[] = [
  { value: 'emerald', dot: 'bg-emerald-400', label: 'Grön' },
  { value: 'blue',    dot: 'bg-blue-400',    label: 'Blå' },
  { value: 'amber',   dot: 'bg-amber-400',   label: 'Gul' },
  { value: 'red',     dot: 'bg-red-400',     label: 'Röd' },
  { value: 'muted',   dot: 'bg-muted',       label: 'Grå' },
]

export function KunderPanel() {
  const { config, updateConfig } = useAppConfig()
  const [statusar, setStatusar] = useState<KundStatusar[]>([])
  const [newNamn, setNewNamn] = useState('')
  const [newFarg, setNewFarg] = useState<Farg>('muted')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savedConfig, setSavedConfig] = useState(false)
  const [numCurrent, setNumCurrent] = useState<number | null>(null)
  const [numInput, setNumInput] = useState('')
  const [numSaving, setNumSaving] = useState(false)
  const [numSaved, setNumSaved] = useState(false)
  const [numError, setNumError] = useState('')

  useEffect(() => {
    window.api.invoke('db:kund-statusar:list').then((d) => setStatusar(d as KundStatusar[]))
    window.api.invoke('db:kunder-nummer:get').then((n) => {
      setNumCurrent(n as number)
      setNumInput(String(n as number))
    })
  }, [])

  async function handleAdd() {
    if (!newNamn.trim()) return
    setSaving(true)
    try {
      const created = await window.api.invoke('db:kund-statusar:create', { namn: newNamn.trim(), farg: newFarg }) as KundStatusar
      setStatusar((prev) => [...prev, created])
      setNewNamn(''); setNewFarg('muted'); setAdding(false)
    } finally { setSaving(false) }
  }

  async function handleUpdateNamn(id: string, namn: string) {
    const updated = await window.api.invoke('db:kund-statusar:update', id, { namn }) as KundStatusar
    setStatusar((prev) => prev.map((s) => s.id === id ? updated : s))
    setEditingId(null)
  }

  async function handleUpdateFarg(id: string, farg: Farg) {
    const updated = await window.api.invoke('db:kund-statusar:update', id, { farg }) as KundStatusar
    setStatusar((prev) => prev.map((s) => s.id === id ? updated : s))
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await window.api.invoke('db:kund-statusar:delete', id)
      setStatusar((prev) => prev.filter((s) => s.id !== id))
    } finally { setDeletingId(null) }
  }

  async function handleSetNummer() {
    const val = parseInt(numInput)
    if (!val || val < 1) { setNumError('Ange ett positivt heltal.'); return }
    setNumSaving(true); setNumError('')
    try {
      const next = await window.api.invoke('db:kunder-nummer:set', val) as number
      setNumCurrent(next); setNumSaved(true); setTimeout(() => setNumSaved(false), 2500)
    } catch (err) {
      setNumError(err instanceof Error ? err.message : 'Fel')
    } finally { setNumSaving(false) }
  }

  async function handleDefaultStatus(v: string) {
    await updateConfig({ kund_std_status: v } as never)
    setSavedConfig(true)
    setTimeout(() => setSavedConfig(false), 2000)
  }

  return (
    <div className="flex h-full min-h-0">

      {/* Left column */}
      <div className="flex flex-col flex-1 border-r border-border overflow-auto">

        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-5">Standardvärden</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <ConfigField label="Standardland" field="kund_std_land" placeholder="Sverige" />
            <ConfigField label="Landskod" field="kund_std_landskod" placeholder="SE" />
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center text-[11px] uppercase tracking-wider text-muted">
                Standardstatus
                {savedConfig && <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] inline-block ml-1.5" />}
              </label>
              <SelectField
                value={config?.kund_std_status ?? ''}
                onChange={handleDefaultStatus}
                options={statusar.map((s) => ({ value: s.namn, label: s.namn }))}
              />
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Kundnummer</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-subtle">
              Nästa: <span className="font-mono text-fg">K-{numCurrent != null ? String(numCurrent).padStart(4, '0') : '…'}</span>
            </span>
            <input
              type="number" min="1" step="1" className="input font-mono w-24 text-sm"
              value={numInput}
              onChange={(e) => setNumInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSetNummer() }}
            />
            <button onClick={handleSetNummer} disabled={numSaving} className="px-3 py-1.5 rounded-lg bg-hover text-fg text-xs font-medium hover:bg-border disabled:opacity-40 transition-colors">
              {numSaving ? '...' : numSaved ? '✓ Sparat' : 'Sätt'}
            </button>
            <button
              onClick={async () => {
                setNumInput('1'); setNumSaving(true); setNumError('')
                try {
                  const next = await window.api.invoke('db:kunder-nummer:set', 1) as number
                  setNumCurrent(next); setNumSaved(true); setTimeout(() => setNumSaved(false), 2500)
                } catch (err) { setNumError(err instanceof Error ? err.message : 'Fel') }
                finally { setNumSaving(false) }
              }}
              disabled={numSaving}
              className="text-xs text-muted hover:text-fg disabled:opacity-40 transition-colors"
            >
              Återställ till 1
            </button>
          </div>
          {numError && <p className="text-xs text-red-400 mt-2">{numError}</p>}
        </div>

        <div className="border-b border-border">
          <KunderImportSection />
        </div>

        <KlientportalSection />

        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-5">Projektavslut</p>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-fg">Skicka feedback-formulär vid projektradering</span>
              <span className="text-xs text-muted">Skickar automatiskt ett formulär till kunden när ett projekt raderas.</span>
            </div>
            <button
              onClick={() => updateConfig({ avslut_feedback_aktiv: !config?.avslut_feedback_aktiv })}
              className="shrink-0 text-muted hover:text-fg transition-colors"
            >
              {config?.avslut_feedback_aktiv
                ? <ToggleRight size={22} className="text-emerald-400" />
                : <ToggleLeft size={22} />
              }
            </button>
          </div>
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
                onDelete={() => handleDelete(s.id)}
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
              autoFocus value={newNamn}
              onChange={(e) => setNewNamn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') { setAdding(false); setNewNamn('') }
              }}
              placeholder="Statusnamn..."
              className="input flex-1 text-sm"
            />
            <button onClick={handleAdd} disabled={saving || !newNamn.trim()} className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-40 font-medium transition-colors shrink-0">
              {saving ? '...' : 'OK'}
            </button>
            <button onClick={() => { setAdding(false); setNewNamn('') }} className="text-xs text-muted hover:text-fg transition-colors shrink-0">✕</button>
          </div>
        )}
      </div>

    </div>
  )
}

interface StatusRowProps {
  status: KundStatusar
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
        <button onClick={() => setConfirmDelete(true)} className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-red-400">
          <Trash2 size={13} />
        </button>
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
            <button key={o.value} title={o.label} onClick={() => { onChange(o.value); setOpen(false) }}
              className={`size-4 rounded-full ${o.dot} transition-transform hover:scale-125 ${value === o.value ? 'ring-2 ring-fg ring-offset-1 ring-offset-elevated' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
