import { useState, useEffect, useCallback } from 'react'
import { Check, X, Plus, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import type { LedighetGlobal, LedighetStatus, LedighetTyp } from './types'
import { LEDIGHET_TYPER } from './types'

function dagar(r: LedighetGlobal): number {
  return Math.ceil((new Date(r.slutdatum).getTime() - new Date(r.startdatum).getTime()) / 86400000) + 1
}

interface PersonalItem { id: string; namn: string; personal_nummer: string }

function formatDate(d: string) { return new Date(d).toLocaleDateString('sv-SE') }
function currentMånad() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` }

const STATUS_CLASS: Record<LedighetStatus, string> = {
  inskickad: 'bg-amber-400/10 text-amber-400',
  'godkänd': 'bg-emerald-400/10 text-emerald-400',
  nekad: 'bg-red-400/10 text-red-400',
}
const STATUS_LABEL: Record<LedighetStatus, string> = { inskickad: 'Inskickad', 'godkänd': 'Godkänd', nekad: 'Nekad' }

const TYP_CLASS: Record<string, string> = {
  semester: 'bg-emerald-400/10 text-emerald-400',
  sjuk: 'bg-red-400/10 text-red-400',
  VAB: 'bg-amber-400/10 text-amber-400',
}

export function LedighetView() {
  const [rows, setRows] = useState<LedighetGlobal[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<LedighetStatus | 'alla'>('alla')
  const [filterMånad, setFilterMånad] = useState(currentMånad())
  const [actionId, setActionId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sortValue(r: LedighetGlobal, col: string): string | number {
    switch (col) {
      case 'anstalld': return r.personal?.namn ?? ''
      case 'typ': return r.typ ?? ''
      case 'period': return r.startdatum
      case 'dagar': return dagar(r)
      case 'kommentar': return r.kommentar ?? ''
      case 'status': return r.status ?? ''
      default: return ''
    }
  }

  const sortedRows = sortCol ? [...rows].sort((a, b) => {
    const av = sortValue(a, sortCol)
    const bv = sortValue(b, sortCol)
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), 'sv')
    return sortDir === 'asc' ? cmp : -cmp
  }) : rows

  // Add-form state
  const [showForm, setShowForm] = useState(false)
  const [personal, setPersonal] = useState<PersonalItem[]>([])
  const [fPersonal, setFPersonal] = useState('')
  const [fTyp, setFTyp] = useState<LedighetTyp>('semester')
  const [fStart, setFStart] = useState('')
  const [fSlut, setFSlut] = useState('')
  const [fKommentar, setFKommentar] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const filters: { status?: string; manad?: string } = {}
      if (filterStatus !== 'alla') filters.status = filterStatus
      if (filterMånad) filters.manad = filterMånad
      const data = await window.api.invoke('db:personal-ledighet:list-all', filters) as LedighetGlobal[]
      setRows(data)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterMånad])

  useEffect(() => { load() }, [load])

  async function openForm() {
    if (!showForm) {
      const p = await window.api.invoke('db:personal:list') as PersonalItem[]
      setPersonal(p)
      setFPersonal(p[0]?.id ?? '')
    }
    setShowForm((v) => !v)
  }

  async function handleCreate() {
    if (!fPersonal || !fStart || !fSlut) return
    setSaving(true)
    try {
      await window.api.invoke('db:personal-ledighet:create', {
        personal_id: fPersonal, typ: fTyp, startdatum: fStart, slutdatum: fSlut, kommentar: fKommentar || undefined,
      })
      setFStart(''); setFSlut(''); setFKommentar('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove(id: string) {
    setActionId(id)
    try {
      const updated = await window.api.invoke('db:personal-ledighet:approve', id) as LedighetGlobal
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } finally { setActionId(null) }
  }

  async function handleReject(id: string) {
    setActionId(id)
    try {
      const updated = await window.api.invoke('db:personal-ledighet:reject', id) as LedighetGlobal
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } finally { setActionId(null) }
  }

  async function handleDelete(id: string) {
    setActionId(id)
    try {
      await window.api.invoke('db:personal-ledighet:delete', id)
      setRows((prev) => prev.filter((r) => r.id !== id))
    } finally { setActionId(null) }
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmBulk(false)
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
    setConfirmBulk(false)
  }

  async function handleBulkDelete() {
    setDeletingBulk(true)
    try {
      await window.api.invoke('db:personal-ledighet:delete-many', [...selected])
      const idSet = new Set(selected)
      setRows((prev) => prev.filter((r) => !idSet.has(r.id)))
      setSelected(new Set())
      setConfirmBulk(false)
    } finally {
      setDeletingBulk(false)
    }
  }

  const counts = { alla: rows.length } as Record<string, number>
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex gap-1">
          {(['alla', 'inskickad', 'godkänd', 'nekad'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${filterStatus === s ? 'bg-elevated text-fg' : 'text-subtle hover:text-muted'}`}
            >
              {s === 'alla' ? 'Alla' : STATUS_LABEL[s as LedighetStatus]}
              <span className="ml-1.5 text-[10px] opacity-60">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <input type="month" className="input text-xs h-7" value={filterMånad} onChange={(e) => setFilterMånad(e.target.value)} />
          <button
            onClick={openForm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-elevated border border-border text-muted hover:text-fg hover:bg-hover transition-colors"
          >
            <Plus size={12} />
            Ny ansökan
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selected.size} valda</span>
          {confirmBulk ? (
            <>
              <span className="text-xs text-muted">Radera {selected.size} ledigheter?</span>
              <button onClick={handleBulkDelete} disabled={deletingBulk} className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-40 transition-colors">
                {deletingBulk ? '...' : 'Ja, radera'}
              </button>
              <button onClick={() => setConfirmBulk(false)} className="text-xs text-muted hover:text-fg transition-colors">Avbryt</button>
            </>
          ) : (
            <button onClick={() => setConfirmBulk(true)} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
              <Trash2 size={12} /> Radera markerade
            </button>
          )}
          <button onClick={() => { setSelected(new Set()); setConfirmBulk(false) }} className="ml-auto text-xs text-muted hover:text-fg transition-colors">
            Avmarkera alla
          </button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="px-6 py-3 border-b border-border bg-elevated shrink-0">
          <div className="grid grid-cols-6 gap-2">
            <select className="input text-xs text-muted col-span-2" value={fPersonal} onChange={(e) => setFPersonal(e.target.value)}>
              <option value="">Välj anställd...</option>
              {personal.map((p) => <option key={p.id} value={p.id}>{p.namn}</option>)}
            </select>
            <select className="input text-xs text-muted" value={fTyp} onChange={(e) => setFTyp(e.target.value as LedighetTyp)}>
              {LEDIGHET_TYPER.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="date" className="input text-xs" value={fStart} onChange={(e) => setFStart(e.target.value)} placeholder="Från" />
            <input type="date" className="input text-xs" value={fSlut} onChange={(e) => setFSlut(e.target.value)} placeholder="Till" />
            <button
              onClick={handleCreate}
              disabled={!fPersonal || !fStart || !fSlut || saving}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-elevated border border-border text-fg hover:bg-hover disabled:opacity-40 transition-colors"
            >
              <Plus size={12} />
              {saving ? '...' : 'Skapa'}
            </button>
          </div>
          <input className="input text-xs mt-2 w-full" placeholder="Kommentar (valfritt)" value={fKommentar} onChange={(e) => setFKommentar(e.target.value)} />
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <p className="text-xs text-subtle text-center py-10">Laddar...</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-subtle text-center py-10">Ingen ledighet registrerad</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-subtle">
                <th className="pl-6 pr-2 py-2 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-border accent-emerald-400 cursor-pointer" />
                </th>
                {([
                  ['anstalld', 'Anställd', 'left'],
                  ['typ', 'Typ', 'left'],
                  ['period', 'Period', 'left'],
                  ['dagar', 'Dagar', 'right'],
                  ['kommentar', 'Kommentar', 'left'],
                  ['status', 'Status', 'left'],
                ] as [string, string, 'left' | 'right' | 'center'][]).map(([col, label, align]) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-4 py-2 font-medium cursor-pointer select-none hover:text-fg transition-colors group/th"
                  >
                    <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
                      {label}
                      {sortCol === col
                        ? sortDir === 'asc'
                          ? <ArrowUp size={10} className="text-fg shrink-0" />
                          : <ArrowDown size={10} className="text-fg shrink-0" />
                        : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                      }
                    </div>
                  </th>
                ))}
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const days = dagar(r)
                const isSelected = selected.has(r.id)
                return (
                  <tr key={r.id} className={`border-b border-border hover:bg-hover group ${isSelected ? 'bg-elevated' : ''}`}>
                    <td className="pl-6 pr-2 py-2.5">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.id)} className="rounded border-border accent-emerald-400 cursor-pointer" />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-fg">{r.personal?.namn ?? '—'}</span>
                      <span className="text-xs text-subtle ml-2">{r.personal?.personal_nummer}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${TYP_CLASS[r.typ] ?? 'bg-elevated text-muted'}`}>{r.typ}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted text-xs font-mono">{formatDate(r.startdatum)} – {formatDate(r.slutdatum)}</td>
                    <td className="px-4 py-2.5 text-right text-fg font-medium">{days}</td>
                    <td className="px-4 py-2.5 text-xs text-subtle truncate max-w-[160px]">{r.kommentar ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        {r.status === 'inskickad' && (
                          <>
                            <button onClick={() => handleApprove(r.id)} disabled={actionId === r.id} title="Godkänn" className="p-1 rounded text-subtle hover:text-emerald-400 hover:bg-hover disabled:opacity-40 transition-colors">
                              <Check size={13} />
                            </button>
                            <button onClick={() => handleReject(r.id)} disabled={actionId === r.id} title="Neka" className="p-1 rounded text-subtle hover:text-red-400 hover:bg-hover disabled:opacity-40 transition-colors">
                              <X size={13} />
                            </button>
                          </>
                        )}
                        {r.status === 'godkänd' && (
                          <button onClick={() => handleReject(r.id)} disabled={actionId === r.id} title="Ångra" className="p-1 rounded text-subtle hover:text-amber-400 hover:bg-hover disabled:opacity-40 transition-colors">
                            <X size={13} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(r.id)} disabled={actionId === r.id} title="Ta bort" className="p-1 rounded text-subtle hover:text-red-400 hover:bg-hover disabled:opacity-40 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
