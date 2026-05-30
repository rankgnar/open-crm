import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, UserPlus, Upload, ChevronUp, ChevronDown, ChevronsUpDown, CheckCircle2, XCircle, Trash2, ChevronDown as ChevronDownIcon } from 'lucide-react'
import { RefreshButton } from '@/components/RefreshButton'
import type { Personal, PersonalStatusar, CsvImportResult } from './types'
import { FARG_DOT, FARG_TEXT } from './types'

interface Props {
  personal: Personal[]
  statusar: PersonalStatusar[]
  onSelect: (p: Personal) => void
  onNew: () => void
  onStatusChange: (id: string, status: string) => Promise<void>
  onImportCsv: (filePath: string) => Promise<CsvImportResult>
  onDeleteMany: (ids: string[]) => Promise<void>
}

type SortKey = 'personal_nummer' | 'namn' | 'roll' | 'anstallningsdatum' | 'status'
type SortDir = 'asc' | 'desc'

function StatusPicker({ p, statusar, onStatusChange }: { p: Personal; statusar: PersonalStatusar[]; onStatusChange: (id: string, status: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = statusar.find((s) => s.namn === p.status)

  async function handleSelect(e: React.MouseEvent, namn: string) {
    e.stopPropagation()
    setOpen(false)
    if (namn !== p.status) await onStatusChange(p.id, namn)
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="inline-flex items-center gap-1.5 text-xs rounded px-1.5 py-0.5 hover:bg-hover transition-colors"
      >
        <span className={`size-1.5 rounded-full ${FARG_DOT[current?.farg ?? 'muted']}`} />
        <span className={FARG_TEXT[current?.farg ?? 'muted']}>{p.status || '—'}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[140px] bg-elevated border border-border rounded-lg shadow-lg py-1 flex flex-col">
          {statusar.map((s) => (
            <button
              key={s.id}
              onMouseDown={(e) => handleSelect(e, s.namn)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-hover transition-colors text-left"
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

const STORAGE_KEY = 'personal-status-filter'

function StatusCheckboxFilter({ statusar, value, onChange }: { statusar: PersonalStatusar[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(namn: string) {
    onChange(value.includes(namn) ? value.filter((v) => v !== namn) : [...value, namn])
  }

  const label = value.length === 0 ? 'Alla statusar' : value.length === 1 ? value[0] : `${value.length} statusar`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-[30px] px-3 bg-elevated border border-border rounded-md text-xs text-muted hover:text-fg hover:border-muted transition-colors whitespace-nowrap"
      >
        {label}
        <ChevronDownIcon size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[160px] bg-elevated border border-border rounded-lg shadow-lg py-1.5 flex flex-col">
          <button
            className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-hover transition-colors text-left text-muted"
            onClick={() => onChange([])}
          >
            — Alla statusar —
          </button>
          {statusar.map((s) => (
            <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-hover transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={value.includes(s.namn)}
                onChange={() => toggle(s.namn)}
                className="accent-emerald-400"
              />
              <span className={`size-1.5 rounded-full ${FARG_DOT[s.farg]}`} />
              <span className={FARG_TEXT[s.farg]}>{s.namn}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export function PersonalTable({ personal, statusar, onSelect, onNew, onStatusChange, onImportCsv, onDeleteMany }: Props) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
  })
  const [sortKey, setSortKey] = useState<SortKey>('skapad_at' as SortKey)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statusFilter))
  }, [statusFilter])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return personal
      .filter((p) => {
        if (statusFilter.length > 0 && !statusFilter.includes(p.status)) return false
        if (!q) return true
        return (
          p.personal_nummer.toLowerCase().includes(q) ||
          p.namn.toLowerCase().includes(q) ||
          (p.roll ?? '').toLowerCase().includes(q) ||
          (p.email ?? '').toLowerCase().includes(q) ||
          (p.personnummer ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        let av = ''
        let bv = ''
        if (sortKey === 'personal_nummer') { av = a.personal_nummer; bv = b.personal_nummer }
        else if (sortKey === 'namn') { av = a.namn; bv = b.namn }
        else if (sortKey === 'roll') { av = a.roll ?? ''; bv = b.roll ?? '' }
        else if (sortKey === 'anstallningsdatum') { av = a.anstallningsdatum ?? ''; bv = b.anstallningsdatum ?? '' }
        else if (sortKey === 'status') { av = a.status; bv = b.status }
        const cmp = av.localeCompare(bv, 'sv')
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [personal, query, statusFilter, sortKey, sortDir])

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))

  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmBulk(false)
  }

  function toggleAll(e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((p) => p.id)))
    setConfirmBulk(false)
  }

  async function handleBulkDelete() {
    setDeletingBulk(true)
    try {
      await onDeleteMany([...selected])
      setSelected(new Set())
      setConfirmBulk(false)
    } finally {
      setDeletingBulk(false)
    }
  }

  async function handleImport() {
    const file = await window.api.invoke('dialog:open-file') as { filePath: string } | null
    if (!file) return
    setImporting(true)
    try {
      const result = await onImportCsv(file.filePath)
      setImportResult(result)
    } finally {
      setImporting(false)
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown size={12} className="text-subtle" />
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-fg" /> : <ChevronDown size={12} className="text-fg" />
  }

  function formatDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString('sv-SE') : '—'
  }

  function formatLon(p: Personal) {
    if (p.loneform === 'MAN' && p['manadslön']) return `${p['manadslön'].toLocaleString('sv-SE')} kr/mån`
    if (p.loneform === 'TIM' && p['timlön']) return `${p['timlön'].toLocaleString('sv-SE')} kr/h`
    return '—'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            className="w-full bg-elevated border border-border rounded-md pl-8 pr-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:border-muted"
            placeholder="Sök personal..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <StatusCheckboxFilter statusar={statusar} value={statusFilter} onChange={setStatusFilter} />

        <span className="text-xs text-subtle ml-auto">
          {filtered.length} / {personal.length}
        </span>

        <button
          onClick={handleImport}
          disabled={importing}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors disabled:opacity-40"
        >
          <Upload size={11} />{importing ? 'Importerar...' : 'Importera CSV'}
        </button>

        <button
          onClick={onNew}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
        >
          <UserPlus size={11} />Ny anställd
        </button>

        <RefreshButton iconOnly />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selected.size} valda</span>
          {confirmBulk ? (
            <>
              <span className="text-xs text-muted">Radera {selected.size} anställda?</span>
              <button
                onClick={handleBulkDelete}
                disabled={deletingBulk}
                className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-40 transition-colors"
              >
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

      {/* Import result banner */}
      {importResult && (
        <div className="flex items-center gap-4 px-6 py-2 bg-elevated border-b border-border shrink-0 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 size={14} />
            {importResult.importados} importerade
          </span>
          {importResult.omitidos > 0 && (
            <span className="text-amber-400">{importResult.omitidos} hoppades över (dubbletter)</span>
          )}
          {importResult.errores.length > 0 && (
            <span className="flex items-center gap-1.5 text-red-400">
              <XCircle size={14} />
              {importResult.errores.length} fel
            </span>
          )}
          <button onClick={() => setImportResult(null)} className="ml-auto text-subtle hover:text-fg">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted">
            <p className="text-sm">{personal.length === 0 ? 'Inga anställda ännu' : 'Inga resultat'}</p>
            {personal.length === 0 && (
              <button onClick={onNew} className="text-xs text-blue-400 hover:underline">Lägg till första anställda</button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-sidebar z-10">
              <tr className="border-b border-border">
                <th className="pl-6 pr-2 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={() => {}}
                    onClick={toggleAll}
                    className="rounded border-border accent-emerald-400 cursor-pointer"
                  />
                </th>
                {([
                  ['personal_nummer', '#'],
                  ['namn', 'Namn'],
                  ['roll', 'Befattning'],
                  ['anstallningsdatum', 'Anställd'],
                  [null, 'Lön'],
                  ['status', 'Status'],
                ] as [SortKey | null, string][]).map(([key, label]) => (
                  <th
                    key={label}
                    className={`text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted font-medium whitespace-nowrap ${key ? 'cursor-pointer hover:text-fg select-none' : ''}`}
                    onClick={key ? () => handleSort(key) : undefined}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      {key && <SortIcon col={key} />}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted font-medium text-left">Typ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isSelected = selected.has(p.id)
                return (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className={`border-b border-border hover:bg-hover cursor-pointer transition-colors ${isSelected ? 'bg-elevated' : ''}`}
                >
                  <td className="pl-6 pr-2 py-3" onClick={(e) => toggleSelect(e, p.id)}>
                    <input type="checkbox" checked={isSelected} onChange={() => {}} className="rounded border-border accent-emerald-400 cursor-pointer" />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-subtle">{p.personal_nummer}</td>
                  <td className="px-4 py-3 font-medium text-fg">{p.namn}</td>
                  <td className="px-4 py-3 text-muted">{p.roll ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(p.anstallningsdatum)}</td>
                  <td className="px-4 py-3 text-muted">{formatLon(p)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <StatusPicker p={p} statusar={statusar} onStatusChange={onStatusChange} />
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{p.personaltyp ?? '—'}</td>
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
