import { useState, useEffect } from 'react'
import { Plus, Trash2, Lock } from 'lucide-react'
import { ConfigField } from './ConfigField'
import type { ForslagStatusar, SmsMall } from '@/sections/forslag/types'
import { FARG_DOT, FARG_TEXT } from '@/sections/forslag/types'

type Farg = ForslagStatusar['farg']

const FARG_OPTIONS: { value: Farg; dot: string; label: string }[] = [
  { value: 'emerald', dot: 'bg-emerald-400', label: 'Grön' },
  { value: 'blue',    dot: 'bg-blue-400',    label: 'Blå' },
  { value: 'amber',   dot: 'bg-amber-400',   label: 'Gul' },
  { value: 'red',     dot: 'bg-red-400',     label: 'Röd' },
  { value: 'muted',   dot: 'bg-muted',       label: 'Grå' },
]

export function ForslagPanel() {
  const [statusar, setStatusar] = useState<ForslagStatusar[]>([])
  const [newNamn, setNewNamn] = useState('')
  const [newFarg, setNewFarg] = useState<Farg>('muted')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [numCurrent, setNumCurrent] = useState<number | null>(null)
  const [numInput, setNumInput] = useState('')
  const [numSaving, setNumSaving] = useState(false)
  const [numSaved, setNumSaved] = useState(false)
  const [numError, setNumError] = useState('')
  const [smsMallar, setSmsMallar] = useState<SmsMall[]>([])
  const [smsAdding, setSmsAdding] = useState(false)
  const [newSmsNamn, setNewSmsNamn] = useState('')
  const [newSmsMeddelande, setNewSmsMeddelande] = useState('')
  const [smsSaving, setSmsSaving] = useState(false)
  const [smsDeletingId, setSmsDeletingId] = useState<string | null>(null)
  const [smsEditingId, setSmsEditingId] = useState<string | null>(null)

  useEffect(() => {
    window.api.invoke('db:forslag-statusar:list').then((d) => setStatusar(d as ForslagStatusar[]))
    window.api.invoke('db:forslag-nummer:get').then((n) => {
      setNumCurrent(n as number)
      setNumInput(String(n as number))
    })
    window.api.invoke('db:sms-mallar:list').then((d) => setSmsMallar(d as SmsMall[]))
  }, [])

  async function handleAdd() {
    if (!newNamn.trim()) return
    setSaving(true)
    try {
      const created = await window.api.invoke('db:forslag-statusar:create', { namn: newNamn.trim(), farg: newFarg }) as ForslagStatusar
      setStatusar((prev) => [...prev, created])
      setNewNamn(''); setNewFarg('muted'); setAdding(false)
    } finally { setSaving(false) }
  }

  async function handleUpdateNamn(id: string, namn: string) {
    const updated = await window.api.invoke('db:forslag-statusar:update', id, { namn }) as ForslagStatusar
    setStatusar((prev) => prev.map((s) => s.id === id ? updated : s))
    setEditingId(null)
  }

  async function handleUpdateFarg(id: string, farg: Farg) {
    const updated = await window.api.invoke('db:forslag-statusar:update', id, { farg }) as ForslagStatusar
    setStatusar((prev) => prev.map((s) => s.id === id ? updated : s))
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await window.api.invoke('db:forslag-statusar:delete', id)
      setStatusar((prev) => prev.filter((s) => s.id !== id))
    } finally { setDeletingId(null) }
  }

  async function handleSetNummer() {
    const val = parseInt(numInput)
    if (!val || val < 1) { setNumError('Ange ett positivt heltal.'); return }
    setNumSaving(true); setNumError('')
    try {
      const next = await window.api.invoke('db:forslag-nummer:set', val) as number
      setNumCurrent(next); setNumSaved(true); setTimeout(() => setNumSaved(false), 2500)
    } catch (err) {
      setNumError(err instanceof Error ? err.message : 'Fel')
    } finally { setNumSaving(false) }
  }

  async function handleAddSms() {
    if (!newSmsNamn.trim()) return
    setSmsSaving(true)
    try {
      const created = await window.api.invoke('db:sms-mallar:create', {
        namn: newSmsNamn.trim(),
        meddelande: newSmsMeddelande.trim(),
      }) as SmsMall
      setSmsMallar((prev) => [...prev, created])
      setNewSmsNamn(''); setNewSmsMeddelande(''); setSmsAdding(false)
    } finally { setSmsSaving(false) }
  }

  async function handleDeleteSms(id: string) {
    setSmsDeletingId(id)
    try {
      await window.api.invoke('db:sms-mallar:delete', id)
      setSmsMallar((prev) => prev.filter((m) => m.id !== id))
    } finally { setSmsDeletingId(null) }
  }

  async function handleUpdateSms(id: string, input: { namn?: string; meddelande?: string }) {
    const updated = await window.api.invoke('db:sms-mallar:update', id, input) as SmsMall
    setSmsMallar((prev) => prev.map((m) => m.id === id ? updated : m))
    setSmsEditingId(null)
  }

  return (
    <div className="flex h-full min-h-0">

      {/* Left column */}
      <div className="flex flex-col flex-1 border-r border-border overflow-auto">

        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-5">Standardvärden</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <ConfigField label="Moms (%)" field="forslag_std_moms_procent" type="number" placeholder="25" />
            <ConfigField label="Giltig (dagar)" field="forslag_std_giltig_dagar" type="number" placeholder="30" />
          </div>
        </div>

        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-5">ROT-avdrag tak</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <ConfigField label="Tak enkel (SEK)" field="rot_avdrag_tak_enkel" type="number" placeholder="50000" suffix="kr" />
            <ConfigField label="Tak med medsökande (SEK)" field="rot_avdrag_tak_dubbel" type="number" placeholder="100000" suffix="kr" />
          </div>
          <p className="mt-3 text-xs text-muted">Standard: 50 000 kr (enkel) / 100 000 kr (med medsökande).</p>
        </div>

        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Förslagsnumrering</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-subtle">
              Nästa: <span className="font-mono text-fg">F-{numCurrent != null ? String(numCurrent).padStart(4, '0') : '…'}</span>
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
                  const next = await window.api.invoke('db:forslag-nummer:set', 1) as number
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

        {/* SMS-mallar */}
        <div className="px-8 py-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] uppercase tracking-widest text-muted">SMS-mallar</p>
            {!smsAdding && (
              <button onClick={() => setSmsAdding(true)} className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors">
                <Plus size={13} />Lägg till
              </button>
            )}
          </div>
          {smsMallar.length === 0 && !smsAdding ? (
            <p className="text-xs text-subtle">Inga SMS-mallar ännu.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden">
              {smsMallar.map((m) => (
                <SmsRow
                  key={m.id}
                  mall={m}
                  isEditing={smsEditingId === m.id}
                  deleting={smsDeletingId === m.id}
                  onStartEdit={() => setSmsEditingId(m.id)}
                  onSave={(namn, meddelande) => handleUpdateSms(m.id, { namn, meddelande })}
                  onCancelEdit={() => setSmsEditingId(null)}
                  onDelete={() => handleDeleteSms(m.id)}
                />
              ))}
            </div>
          )}
          {smsAdding && (
            <div className="mt-3 flex flex-col gap-2 border border-border rounded-lg p-3 bg-elevated">
              <input
                autoFocus value={newSmsNamn}
                onChange={(e) => setNewSmsNamn(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSmsAdding(false); setNewSmsNamn(''); setNewSmsMeddelande('') } }}
                placeholder="Mallnamn…"
                className="input text-sm"
              />
              <textarea
                value={newSmsMeddelande}
                onChange={(e) => setNewSmsMeddelande(e.target.value)}
                rows={4}
                placeholder={`Meddelande… Variabler: {{kund_namn}}, {{projekt_namn}}, {{forslag_nummer}}, {{foretag_namn}}`}
                className="input resize-none text-xs"
              />
              <p className="text-[10px] text-subtle">
                Variabler: <span className="font-mono">{'{{kund_namn}}'}</span>, <span className="font-mono">{'{{projekt_namn}}'}</span>, <span className="font-mono">{'{{forslag_nummer}}'}</span>, <span className="font-mono">{'{{foretag_namn}}'}</span>
              </p>
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => { setSmsAdding(false); setNewSmsNamn(''); setNewSmsMeddelande('') }} className="text-xs text-muted hover:text-fg transition-colors">Avbryt</button>
                <button onClick={handleAddSms} disabled={smsSaving || !newSmsNamn.trim()} className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-40 font-medium transition-colors">
                  {smsSaving ? '…' : 'Spara'}
                </button>
              </div>
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
  status: ForslagStatusar
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

interface SmsRowProps {
  mall: SmsMall
  isEditing: boolean
  deleting: boolean
  onStartEdit: () => void
  onSave: (namn: string, meddelande: string) => void
  onCancelEdit: () => void
  onDelete: () => void
}

function SmsRow({ mall, isEditing, deleting, onStartEdit, onSave, onCancelEdit, onDelete }: SmsRowProps) {
  const [draftNamn, setDraftNamn] = useState(mall.namn)
  const [draftMeddelande, setDraftMeddelande] = useState(mall.meddelande)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (isEditing) { setDraftNamn(mall.namn); setDraftMeddelande(mall.meddelande) }
  }, [isEditing, mall.namn, mall.meddelande])

  return (
    <div className="px-4 py-3 group hover:bg-hover transition-colors">
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <input autoFocus value={draftNamn} onChange={(e) => setDraftNamn(e.target.value)} className="input text-sm" />
          <textarea value={draftMeddelande} onChange={(e) => setDraftMeddelande(e.target.value)} rows={4} className="input resize-none text-xs" />
          <div className="flex items-center gap-2 justify-end">
            <button onClick={onCancelEdit} className="text-xs text-muted hover:text-fg transition-colors">Avbryt</button>
            <button onClick={() => { if (draftNamn.trim()) onSave(draftNamn.trim(), draftMeddelande.trim()) }} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">Spara</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 cursor-text" onDoubleClick={onStartEdit} title="Dubbelklicka för att redigera">
            <p className="text-sm font-medium text-fg truncate">{mall.namn}</p>
            {mall.meddelande && <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{mall.meddelande}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            {confirmDelete ? (
              <>
                <button onClick={onDelete} disabled={deleting} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 font-medium transition-colors">{deleting ? '…' : 'Ja'}</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted hover:text-fg transition-colors">Nej</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-red-400">
                <Trash2 size={13} />
              </button>
            )}
          </div>
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
            <button key={o.value} title={o.label} onClick={() => { onChange(o.value); setOpen(false) }}
              className={`size-4 rounded-full ${o.dot} transition-transform hover:scale-125 ${value === o.value ? 'ring-2 ring-fg ring-offset-1 ring-offset-elevated' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
