import { Plus, Search, X, Trash2, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, Check, Globe, Copy } from 'lucide-react'
import { RefreshButton } from '@/components/RefreshButton'
import { KundPopover } from '@/components/KundPopover'
import { useRef, useState, useEffect } from 'react'
import type { ProjektWithKund, ProjektStatusar } from './types'
import { FARG_DOT, FARG_TEXT } from './types'
import { WorkflowTriggerInline } from '@/components/WorkflowTriggerInline'


interface Props {
  projekt: ProjektWithKund[]
  statusar: ProjektStatusar[]
  fragSummary: Record<string, string>
  forslagSummary: Record<string, { status: string; farg: string; forslag_nummer: string }>
  onSelect: (p: ProjektWithKund) => void
  onNew: () => void
  onDuplicate?: () => void
  onStatusChange: (id: string, status: string) => Promise<void>
  onStatusChangeMany: (ids: string[], status: string) => Promise<void>
  onDeleteMany: (ids: string[]) => Promise<void>
}

function StatusPicker({ projekt, statusar, onStatusChange }: { projekt: ProjektWithKund; statusar: ProjektStatusar[]; onStatusChange: (id: string, status: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = statusar.find((s) => s.namn === projekt.status)

  async function handleSelect(e: React.MouseEvent, namn: string) {
    e.stopPropagation()
    setOpen(false)
    if (namn !== projekt.status) await onStatusChange(projekt.id, namn)
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false) }}
        className="inline-flex items-center gap-1.5 text-xs rounded px-1.5 py-0.5 hover:bg-hover transition-colors"
      >
        <span className={`size-1.5 rounded-full ${FARG_DOT[current?.farg ?? 'muted']}`} />
        <span className={FARG_TEXT[current?.farg ?? 'muted']}>{projekt.status || '—'}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[130px] bg-elevated border border-border rounded-lg shadow-lg py-1 flex flex-col">
          {statusar.map((s) => (
            <button
              key={s.id}
              onMouseDown={(e) => handleSelect(e, s.namn)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-hover transition-colors text-left ${s.namn === projekt.status ? 'opacity-40 cursor-default' : ''}`}
            >
              <span className={`size-1.5 rounded-full ${FARG_DOT[s.farg]}`} />
              <span className={FARG_TEXT[s.farg]}>{s.namn}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


const FRAG_STATUS_FARG: Record<string, string> = {
  besvarat: 'text-emerald-400',
  skickat:  'text-blue-400',
  utkast:   'text-muted',
}
const FRAG_STATUS_DOT: Record<string, string> = {
  besvarat: 'bg-emerald-400',
  skickat:  'bg-blue-400',
  utkast:   'bg-muted',
}
const FRAG_STATUS_LABEL: Record<string, string> = {
  besvarat: 'Besvarat',
  skickat:  'Skickat',
  utkast:   'Utkast',
}


function StatusSelect({ value, onChange, statusar }: { value: string[]; onChange: (v: string[]) => void; statusar: ProjektStatusar[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function toggle(namn: string) {
    const next = value.includes(namn) ? value.filter(v => v !== namn) : [...value, namn]
    onChange(next)
  }

  const label = value.length === 0
    ? 'Alla statusar'
    : value.length === 1
      ? value[0]
      : `${value.length} statusar`

  const hasSelection = value.length > 0

  return (
    <div ref={ref} className="relative w-48 shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 bg-elevated border border-border rounded-lg px-3 py-2 text-sm outline-none hover:border-fg/30 transition-colors"
      >
        <span className={`truncate ${hasSelection ? 'text-fg' : 'text-subtle'}`}>
          {label}
        </span>
        <ChevronDown size={12} className="text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-elevated border border-border rounded-lg shadow-xl flex flex-col overflow-hidden">
          <div className="max-h-64 overflow-auto py-1">
            {hasSelection && (
              <button
                type="button"
                onClick={() => { onChange([]); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs text-subtle hover:bg-hover transition-colors"
              >
                — Alla statusar —
              </button>
            )}
            {statusar.map(s => {
              const checked = value.includes(s.namn)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.namn)}
                  className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs hover:bg-hover transition-colors ${checked ? 'text-fg font-medium' : 'text-muted'}`}
                >
                  <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-border bg-bg'}`}>
                    {checked && <Check size={9} className="text-white" />}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${FARG_DOT[s.farg]}`} />
                  <span className="truncate">{s.namn}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function ProjektTable({ projekt, statusar, fragSummary, forslagSummary, onSelect, onNew, onDuplicate, onStatusChange, onStatusChangeMany, onDeleteMany }: Props) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('projekt-status-filter')
      return saved ? (JSON.parse(saved) as string[]) : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    localStorage.setItem('projekt-status-filter', JSON.stringify(statusFilter))
  }, [statusFilter])
const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [savingBulkStatus, setSavingBulkStatus] = useState(false)
  const [confirmRowId, setConfirmRowId] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<string | null>(() => localStorage.getItem('projekt-sort-col') || null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => (localStorage.getItem('projekt-sort-dir') as 'asc' | 'desc') || 'asc')

  function handleSort(col: string) {
    if (sortCol === col) {
      const next = sortDir === 'asc' ? 'desc' : 'asc'
      setSortDir(next)
      localStorage.setItem('projekt-sort-dir', next)
    } else {
      setSortCol(col)
      setSortDir('asc')
      localStorage.setItem('projekt-sort-col', col)
      localStorage.setItem('projekt-sort-dir', 'asc')
    }
  }

  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmBulk(false)
  }

  const filtered = projekt.filter((p) => {
    const q = query.toLowerCase()
    const matchesQuery = !q || [p.projekt_nummer, p.namn, p.kunder.namn, p.kunder.kundnummer, p.arbetsplats_stad]
      .some((v) => v?.toLowerCase().includes(q))
    return matchesQuery && (statusFilter.length === 0 || statusFilter.includes(p.status))
  })

  const sorted = sortCol ? [...filtered].sort((a, b) => {
    const vals: Record<string, string | null | number> = {
      projekt_nummer: a.projekt_nummer, namn: a.namn, kund: a.kunder.namn,
      status: a.status,
    }
    const bvals: Record<string, string | null | number> = {
      projekt_nummer: b.projekt_nummer, namn: b.namn, kund: b.kunder.namn,
      status: b.status,
    }
    const av = String(vals[sortCol] ?? ''), bv = String(bvals[sortCol] ?? '')
    const cmp = av.localeCompare(bv, 'sv')
    return sortDir === 'asc' ? cmp : -cmp
  }) : filtered

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))

  function toggleAll(e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((p) => p.id)))
    setConfirmBulk(false)
  }

  async function handleBulkStatusChange(status: string) {
    setSavingBulkStatus(true)
    try {
      await onStatusChangeMany([...selected], status)
      setSelected(new Set()); setConfirmBulk(false)
    } finally { setSavingBulkStatus(false) }
  }

  async function handleBulkDelete() {
    setDeletingBulk(true)
    try {
      await onDeleteMany([...selected])
      setSelected(new Set()); setConfirmBulk(false)
    } finally { setDeletingBulk(false) }
  }

  async function handleRowDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await onDeleteMany([id])
    setConfirmRowId(null)
  }

  const isFiltering = query !== '' || statusFilter.length > 0

  const COLS: [string, string][] = [
    ['projekt_nummer', 'Nr'],
    ['kund', 'Kund'],
    ['namn', 'Projektnamn'],
    ['status', 'Status'],
  ]

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2.5 shrink-0">
          <h1 className="text-base font-semibold text-fg">Projekt</h1>
          <span className="text-xs text-muted bg-elevated border border-border rounded-full px-2 py-0.5">
            {isFiltering ? `${filtered.length} / ${projekt.length}` : projekt.length}
          </span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök nr, namn, kund..."
            className="input w-full pl-8 pr-7 text-sm"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-fg transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
        <StatusSelect value={statusFilter} onChange={setStatusFilter} statusar={statusar} />
<div className="ml-auto flex items-center gap-2 shrink-0">
          <WorkflowTriggerInline
            seccion="projekt"
            context={selected.size === 1 ? { projekt_id: [...selected][0] } : {}}
          />
          <RefreshButton iconOnly />
          {onDuplicate && (
            <button onClick={onDuplicate} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
              <Copy size={11} />Duplicera
            </button>
          )}
          <button onClick={onNew} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
            <Plus size={11} />Nytt projekt
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selected.size} valda</span>
          <BulkStatusPicker statusar={statusar} saving={savingBulkStatus} onPick={handleBulkStatusChange} />
          {confirmBulk ? (
            <>
              <span className="text-xs text-muted">Radera {selected.size} projekt?</span>
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

      {projekt.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted text-sm">Inga projekt ännu. Skapa ett nytt projekt för att börja.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted text-sm">Inga projekt matchar sökningen.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sidebar z-10">
              <tr className="border-b border-border text-left">
                <th className="w-10" />
                <th className="pl-4 pr-2 py-2.5 w-8">
                  <input type="checkbox" checked={allFilteredSelected} onChange={() => {}} onClick={toggleAll}
                    className="rounded border-border accent-emerald-400 cursor-pointer" />
                </th>
                {COLS.slice(0, 2).map(([col, label]) => (
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
                <th className="w-8" />
                {COLS.slice(2).map(([col, label]) => (
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
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted select-none">Offert</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted select-none">Formulär</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const isSelected = selected.has(p.id)
                const isConfirmRow = confirmRowId === p.id
                return (
                  <tr key={p.id} onClick={() => onSelect(p)}
                    className={`border-b border-border hover:bg-hover cursor-pointer transition-colors group ${isSelected ? 'bg-elevated' : ''}`}
                  >
                    <td className="pl-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {isConfirmRow ? (
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => handleRowDelete(e, p.id)} className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors">Ja</button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmRowId(null) }} className="text-xs text-muted hover:text-fg transition-colors">Nej</button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setConfirmRowId(p.id) }}
                          className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                    <td className="pl-4 pr-2 py-3" onClick={(e) => toggleSelect(e, p.id)}>
                      <input type="checkbox" checked={isSelected} onChange={() => {}} className="rounded border-border accent-emerald-400 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap">{p.projekt_nummer ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <span className="font-mono text-xs text-muted">{p.kunder.kundnummer}</span>
                      <span className="ml-2"><KundPopover kund={p.kunder} /></span>
                    </td>
                    <td className="px-2 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                      {p.kunder.webbadress ? (
                        <button
                          onClick={() => window.api.invoke('shell:open-external', p.kunder.webbadress!)}
                          className="text-muted hover:text-fg transition-colors"
                          title={p.kunder.webbadress}
                        >
                          <Globe size={13} />
                        </button>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-medium text-fg whitespace-nowrap">{p.namn}</td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <StatusPicker projekt={p} statusar={statusar} onStatusChange={onStatusChange} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {forslagSummary[p.id] ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className={`size-1.5 rounded-full shrink-0 ${FARG_DOT[forslagSummary[p.id].farg as keyof typeof FARG_DOT] ?? 'bg-muted'}`} />
                          <span className={FARG_TEXT[forslagSummary[p.id].farg as keyof typeof FARG_TEXT] ?? 'text-muted'}>
                            {forslagSummary[p.id].status}
                          </span>
                        </span>
                      ) : <span className="text-subtle text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fragSummary[p.id] ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs ${FRAG_STATUS_FARG[fragSummary[p.id]] ?? 'text-muted'}`}>
                          <span className={`size-1.5 rounded-full shrink-0 ${FRAG_STATUS_DOT[fragSummary[p.id]] ?? 'bg-muted'}`} />
                          {FRAG_STATUS_LABEL[fragSummary[p.id]] ?? fragSummary[p.id]}
                        </span>
                      ) : <span className="text-subtle text-xs">—</span>}
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


function BulkStatusPicker({ statusar, saving, onPick }: {
  statusar: ProjektStatusar[]
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

