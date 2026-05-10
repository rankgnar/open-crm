import { useState } from 'react'
import { Pencil, Trash2, Send, Check, X as XIcon } from 'lucide-react'
import type { RevisorAnteckning, AnteckningFarg } from './types'
import { ANTECKNING_FARG_DOT } from './types'

interface Props {
  anteckningar: RevisorAnteckning[]
  onAdd: (titel: string, innehall: string, farg: AnteckningFarg) => Promise<void>
  onUpdate: (id: string, titel: string, innehall: string, farg: AnteckningFarg) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const FARG_OPTIONS: { value: AnteckningFarg; dot: string }[] = [
  { value: 'muted',   dot: 'bg-subtle border-subtle' },
  { value: 'emerald', dot: 'bg-emerald-400 border-emerald-400' },
  { value: 'amber',   dot: 'bg-amber-400 border-amber-400' },
  { value: 'red',     dot: 'bg-red-400 border-red-400' },
  { value: 'blue',    dot: 'bg-blue-400 border-blue-400' },
]

function FargPicker({ value, onChange }: { value: AnteckningFarg; onChange: (f: AnteckningFarg) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {FARG_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`size-3 rounded-full border-2 transition-transform ${o.dot} ${value === o.value ? 'scale-125' : 'opacity-50 hover:opacity-100'}`}
        />
      ))}
    </div>
  )
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

export function RevisorAnteckningar({ anteckningar, onAdd, onUpdate, onDelete }: Props) {
  const [nyTitel, setNyTitel] = useState('')
  const [nyInnehall, setNyInnehall] = useState('')
  const [nyFarg, setNyFarg] = useState<AnteckningFarg>('muted')
  const [saving, setSaving] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitel, setEditTitel] = useState('')
  const [editInnehall, setEditInnehall] = useState('')
  const [editFarg, setEditFarg] = useState<AnteckningFarg>('muted')
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!nyTitel.trim()) return
    setSaving(true)
    await onAdd(nyTitel.trim(), nyInnehall.trim(), nyFarg)
    setNyTitel(''); setNyInnehall(''); setNyFarg('muted')
    setSaving(false)
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function startEdit(a: RevisorAnteckning) {
    setEditingId(a.id); setEditTitel(a.titel); setEditInnehall(a.innehall); setEditFarg(a.farg)
    setExpandedIds((prev) => new Set(prev).add(a.id))
  }

  async function saveEdit(id: string) {
    if (!editTitel.trim()) return
    setSavingEditId(id)
    await onUpdate(id, editTitel.trim(), editInnehall.trim(), editFarg)
    setEditingId(null); setSavingEditId(null)
  }

  async function handleDelete(id: string) {
    setDeletingId(id); await onDelete(id); setDeletingId(null)
  }

  const sorted = [...anteckningar].sort((a, b) => new Date(a.skapad_at).getTime() - new Date(b.skapad_at).getTime())

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-subtle text-xs">Inga anteckningar ännu.</p>
          </div>
        ) : (
          <div className="relative py-4">
            <div className="absolute left-[27px] top-0 bottom-0 w-px bg-border" />
            {sorted.map((a) => {
              const expanded = expandedIds.has(a.id)
              const isEditing = editingId === a.id
              return (
                <div key={a.id} className="group relative flex gap-3 px-4 pb-5 last:pb-2">
                  <div className="relative shrink-0 flex flex-col items-center mt-1">
                    <button
                      type="button"
                      onClick={() => setColorPickerId(colorPickerId === a.id ? null : a.id)}
                      className={`relative z-10 size-2.5 rounded-full border-2 transition-transform hover:scale-125 ${ANTECKNING_FARG_DOT[a.farg ?? 'muted']}`}
                    />
                    {colorPickerId === a.id && (
                      <div className="absolute top-4 left-0 z-20 flex items-center gap-1 bg-sidebar border border-border rounded-lg px-2 py-1.5 shadow-lg">
                        {FARG_OPTIONS.map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => { onUpdate(a.id, a.titel, a.innehall, o.value); setColorPickerId(null) }}
                            className={`size-3 rounded-full border-2 transition-transform hover:scale-125 ${o.dot} ${a.farg === o.value ? 'scale-125' : 'opacity-60'}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      {isEditing ? (
                        <input autoFocus className="input flex-1" value={editTitel} onChange={(e) => setEditTitel(e.target.value)} />
                      ) : (
                        <span
                          className="text-xs font-semibold text-fg cursor-pointer hover:text-muted transition-colors leading-relaxed"
                          onClick={() => toggleExpand(a.id)}
                        >
                          {a.titel || '(ingen titel)'}
                        </span>
                      )}
                      <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(a.id)} disabled={savingEditId === a.id} className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors">
                              <Check size={12} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-muted hover:text-fg transition-colors">
                              <XIcon size={12} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(a)} className="p-1 text-subtle hover:text-fg opacity-0 group-hover:opacity-100 transition-all">
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => handleDelete(a.id)} disabled={deletingId === a.id} className="p-1 text-subtle hover:text-red-400 opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-all">
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-subtle mt-0.5">{formatDateTime(a.skapad_at)}</p>
                    {isEditing && <div className="mt-1"><FargPicker value={editFarg} onChange={setEditFarg} /></div>}
                    {isEditing ? (
                      <textarea
                        className="input resize-none w-full mt-2"
                        rows={5}
                        value={editInnehall}
                        onChange={(e) => setEditInnehall(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null) }}
                        placeholder="Innehåll..."
                      />
                    ) : a.innehall ? (
                      <p className="text-xs text-muted mt-1.5 cursor-pointer leading-relaxed" onClick={() => toggleExpand(a.id)}>
                        {expanded ? a.innehall : a.innehall.length > 80 ? a.innehall.slice(0, 80) + '…' : a.innehall}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <form onSubmit={handleAdd} className="border-t border-border p-4 flex flex-col gap-2 shrink-0">
        <input
          className="input text-xs"
          placeholder="Titel *"
          value={nyTitel}
          onChange={(e) => setNyTitel(e.target.value)}
        />
        <FargPicker value={nyFarg} onChange={setNyFarg} />
        <textarea
          className="input resize-none text-xs"
          rows={5}
          placeholder="Innehåll (valfritt)..."
          value={nyInnehall}
          onChange={(e) => setNyInnehall(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving || !nyTitel.trim()}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-fg text-bg px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          <Send size={11} />
          {saving ? 'Sparar...' : 'Lägg till anteckning'}
        </button>
      </form>
    </div>
  )
}
