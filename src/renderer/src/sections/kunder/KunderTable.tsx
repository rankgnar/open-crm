import { useState, useRef, useEffect } from 'react'
import { Plus, Search, X, Trash2, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown } from 'lucide-react'
import type { Kund, KundStatusar, KundProjektCounts, KundForslagCounts } from './types'
import { RefreshButton } from '@/components/RefreshButton'

const FORSLAG_FARG: Record<string, string> = {
  'Accepterat':     'bg-emerald-400',
  'Skickat':        'bg-blue-400',
  'Ändring begärd': 'bg-amber-400',
  'Utkast':         'bg-muted',
  'Avvisat':        'bg-red-400',
}

const FORSLAG_ORDER = ['Accepterat', 'Skickat', 'Ändring begärd', 'Utkast', 'Avvisat']

function ForslagDots({ counts }: { counts: Record<string, number> | undefined }) {
  if (!counts) return <span className="text-subtle">—</span>
  const entries = FORSLAG_ORDER
    .filter((s) => (counts[s] ?? 0) > 0)
    .map((s) => ({ status: s, count: counts[s] }))
  const extra = Object.entries(counts).filter(([s, c]) => c > 0 && !FORSLAG_ORDER.includes(s))
  const all = [...entries, ...extra.map(([s, c]) => ({ status: s, count: c }))]
  if (all.length === 0) return <span className="text-subtle">—</span>
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {all.map(({ status, count }) => (
        <span key={status} className="inline-flex items-center gap-1" title={status}>
          <span className={`size-1.5 rounded-full shrink-0 ${FORSLAG_FARG[status] ?? 'bg-muted'}`} />
          <span className="text-xs text-muted">{count}</span>
        </span>
      ))}
    </div>
  )
}

const FARG_DOT: Record<string, string> = {
  emerald: 'bg-emerald-400',
  blue:    'bg-blue-400',
  amber:   'bg-amber-400',
  red:     'bg-red-400',
  muted:   'bg-muted',
}

const FARG_TEXT: Record<string, string> = {
  emerald: 'text-emerald-400',
  blue:    'text-blue-400',
  amber:   'text-amber-400',
  red:     'text-red-400',
  muted:   'text-muted',
}

interface Props {
  kunder: Kund[]
  statusar: KundStatusar[]
  projektCounts: KundProjektCounts
  forslagCounts: KundForslagCounts
  onSelect: (kund: Kund) => void
  onStatusChange: (id: string, status: string) => Promise<void>
  onStatusChangeMany: (ids: string[], status: string) => Promise<void>
  onDeleteMany: (ids: string[]) => Promise<void>
  onNew: () => void
}


function StatusPicker({ kund, statusar, onStatusChange }: {
  kund: Kund
  statusar: KundStatusar[]
  onStatusChange: (id: string, status: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = statusar.find((s) => s.namn === kund.status)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function pick(e: React.MouseEvent, namn: string) {
    e.stopPropagation()
    if (namn === kund.status) { setOpen(false); return }
    setSaving(true)
    setOpen(false)
    try {
      await onStatusChange(kund.id, namn)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        disabled={saving}
        className="inline-flex items-center gap-1.5 text-xs rounded px-1.5 py-0.5 hover:bg-hover transition-colors disabled:opacity-50"
        title="Ändra status"
      >
        <span className={`size-1.5 rounded-full shrink-0 ${FARG_DOT[current?.farg ?? 'muted']}`} />
        <span className={FARG_TEXT[current?.farg ?? 'muted']}>{kund.status || '—'}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[130px] bg-elevated border border-border rounded-lg shadow-lg overflow-hidden">
          {statusar.map((s) => (
            <button
              key={s.id}
              onClick={(e) => pick(e, s.namn)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-hover transition-colors ${s.namn === kund.status ? 'bg-hover' : ''}`}
            >
              <span className={`size-1.5 rounded-full shrink-0 ${FARG_DOT[s.farg]}`} />
              <span className={FARG_TEXT[s.farg]}>{s.namn}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BulkStatusPicker({ statusar, saving, onPick }: {
  statusar: KundStatusar[]
  saving: boolean
  onPick: (status: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className="flex items-center gap-1 text-xs text-muted hover:text-fg disabled:opacity-40 transition-colors"
      >
        {saving ? '...' : 'Ändra status'} <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[140px] bg-elevated border border-border rounded-lg shadow-lg overflow-hidden">
          {statusar.map((s) => (
            <button
              key={s.id}
              onClick={() => { setOpen(false); onPick(s.namn) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-hover transition-colors"
            >
              <span className={`size-1.5 rounded-full shrink-0 ${FARG_DOT[s.farg]}`} />
              <span className={FARG_TEXT[s.farg]}>{s.namn}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function KunderTable({ kunder, statusar, projektCounts, forslagCounts, onSelect, onStatusChange, onStatusChangeMany, onDeleteMany, onNew }: Props) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [savingBulkStatus, setSavingBulkStatus] = useState(false)
  const [confirmRowId, setConfirmRowId] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmBulk(false)
  }

  const filtered = kunder.filter((k) => {
    const q = query.toLowerCase()
    const matchesQuery = !q || [k.namn, k.kundnummer, k.email, k.telefon, k.stad, k.org_nummer]
      .some((v) => v?.toLowerCase().includes(q))
    return matchesQuery && (!statusFilter || k.status === statusFilter)
  })

  const sorted = sortCol ? [...filtered].sort((a, b) => {
    const vals: Record<string, string | null> = {
      kundnummer: a.kundnummer, namn: a.namn, telefon: a.telefon,
      email: a.email, status: a.status, skapad_at: a.skapad_at,
    }
    const bvals: Record<string, string | null> = {
      kundnummer: b.kundnummer, namn: b.namn, telefon: b.telefon,
      email: b.email, status: b.status, skapad_at: b.skapad_at,
    }
    const av = vals[sortCol] ?? '', bv = bvals[sortCol] ?? ''
    const cmp = av.localeCompare(bv, 'sv')
    return sortDir === 'asc' ? cmp : -cmp
  }) : filtered

  const allFilteredSelected = filtered.length > 0 && filtered.every((k) => selected.has(k.id))

  function toggleAll(e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((k) => k.id)))
    setConfirmBulk(false)
  }

  async function handleBulkDelete() {
    setDeletingBulk(true)
    try {
      await onDeleteMany([...selected])
      setSelected(new Set()); setConfirmBulk(false)
    } finally { setDeletingBulk(false) }
  }

  async function handleBulkStatusChange(status: string) {
    setSavingBulkStatus(true)
    try {
      await onStatusChangeMany([...selected], status)
      setSelected(new Set()); setConfirmBulk(false)
    } finally { setSavingBulkStatus(false) }
  }

  async function handleRowDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await onDeleteMany([id])
    setConfirmRowId(null)
  }

  const isFiltering = query !== '' || statusFilter !== ''

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2.5 shrink-0">
          <h1 className="text-base font-semibold text-fg">Kunder</h1>
          <span className="text-xs text-muted bg-elevated border border-border rounded-full px-2 py-0.5">
            {isFiltering ? `${filtered.length} / ${kunder.length}` : kunder.length}
          </span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök namn, nr, e-post..."
            className="input w-full pl-8 pr-7 text-sm"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-fg transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input text-sm text-muted w-48 shrink-0">
          <option value="">Alla statusar</option>
          {statusar.map((s) => <option key={s.id} value={s.namn}>{s.namn}</option>)}
        </select>
        <RefreshButton className="ml-auto" />
        <button onClick={onNew} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
          <Plus size={11} />Ny kund
        </button>
      </div>

      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selected.size} valda</span>

          {/* Bulk status change */}
          <BulkStatusPicker
            statusar={statusar}
            saving={savingBulkStatus}
            onPick={handleBulkStatusChange}
          />

          {/* Bulk delete */}
          <div className="flex items-center gap-2">
            {confirmBulk ? (
              <>
                <span className="text-xs text-muted">Radera {selected.size}?</span>
                <button onClick={handleBulkDelete} disabled={deletingBulk} className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-40 transition-colors">
                  {deletingBulk ? '...' : 'Ja'}
                </button>
                <button onClick={() => setConfirmBulk(false)} className="text-xs text-muted hover:text-fg transition-colors">Nej</button>
              </>
            ) : (
              <button onClick={() => setConfirmBulk(true)} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                <Trash2 size={12} /> Radera
              </button>
            )}
          </div>

          <button onClick={() => { setSelected(new Set()); setConfirmBulk(false) }} className="ml-auto text-xs text-muted hover:text-fg transition-colors">
            Avmarkera alla
          </button>
        </div>
      )}

      {kunder.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted text-sm">Inga kunder ännu. Skapa en ny kund för att börja.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted text-sm">Inga kunder matchar sökningen.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sidebar z-10">
              <tr className="border-b border-border text-left">
                <th className="pl-4 pr-2 py-2.5 w-8">
                  <input type="checkbox" checked={allFilteredSelected} onChange={() => {}} onClick={toggleAll}
                    className="rounded border-border accent-emerald-400 cursor-pointer" />
                </th>
                {([
                  ['kundnummer', 'Nr'],
                  ['namn', 'Namn'],
                  ['telefon', 'Telefon'],
                  ['email', 'Email'],
                  ['status', 'Status'],
                  ['skapad_at', 'Skapad'],
                ] as [string, string][]).map(([col, label]) => (
                  <th key={col} onClick={() => handleSort(col)}
                    className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted cursor-pointer select-none hover:text-fg transition-colors group/th">
                    <div className="flex items-center gap-1">
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
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted select-none">Projekt</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted select-none">Förslag</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((kund) => {
                const isSelected = selected.has(kund.id)
                const isConfirmRow = confirmRowId === kund.id
                return (
                  <tr key={kund.id} onClick={() => onSelect(kund)}
                    className={`border-b border-border hover:bg-hover cursor-pointer transition-colors group ${isSelected ? 'bg-elevated' : ''}`}
                  >
                    <td className="pl-4 pr-2 py-3" onClick={(e) => toggleSelect(e, kund.id)}>
                      <input type="checkbox" checked={isSelected} onChange={() => {}} className="rounded border-border accent-emerald-400 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap">{kund.kundnummer ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-fg whitespace-nowrap">{kund.namn}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{kund.telefon ?? '—'}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{kund.email ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusPicker kund={kund} statusar={statusar} onStatusChange={onStatusChange} />
                    </td>
                    <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                      {new Date(kund.skapad_at).toLocaleDateString('sv-SE')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {projektCounts[kund.id]
                        ? <span className="font-medium text-fg text-xs">{projektCounts[kund.id]}</span>
                        : <span className="text-subtle text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ForslagDots counts={forslagCounts[kund.id]} />
                    </td>
                    <td className="pr-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {isConfirmRow ? (
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => handleRowDelete(e, kund.id)} className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors">Ja</button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmRowId(null) }} className="text-xs text-muted hover:text-fg transition-colors">Nej</button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setConfirmRowId(kund.id) }}
                          className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
