import { useState } from 'react'
import { Plus, Search, X, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import type { Kund, KundLastProjekt, KundLastForslag } from './types'
import { RefreshButton } from '@/components/RefreshButton'

const FORSLAG_STATUS_DOT: Record<string, string> = {
  'Accepterat':     'bg-emerald-400',
  'Skickat':        'bg-blue-400',
  'Ändring begärd': 'bg-amber-400',
  'Utkast':         'bg-muted',
  'Avvisat':        'bg-red-400',
}

interface Props {
  kunder: Kund[]
  lastProjekt: KundLastProjekt
  lastForslag: KundLastForslag
  onSelect: (kund: Kund) => void
  onDeleteMany: (ids: string[]) => Promise<void>
  onNew: () => void
  onNavigateProjekt?: (projektId: string) => void
  onNavigateForslag?: (forslagId: string) => void
  onCreateProjekt?: (kundId: string) => void
  onCreateForslag?: (projektId?: string) => void
}

export function KunderTable({ kunder, lastProjekt, lastForslag, onSelect, onDeleteMany, onNew, onNavigateProjekt, onNavigateForslag, onCreateProjekt, onCreateForslag }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
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
    return !q || [k.namn, k.kundnummer, k.email, k.telefon, k.stad, k.org_nummer]
      .some((v) => v?.toLowerCase().includes(q))
  })

  const sorted = sortCol ? [...filtered].sort((a, b) => {
    const vals: Record<string, string | null> = {
      kundnummer: a.kundnummer, namn: a.namn, telefon: a.telefon,
      email: a.email, skapad_at: a.skapad_at,
    }
    const bvals: Record<string, string | null> = {
      kundnummer: b.kundnummer, namn: b.namn, telefon: b.telefon,
      email: b.email, skapad_at: b.skapad_at,
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

  async function handleRowDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await onDeleteMany([id])
    setConfirmRowId(null)
  }

  const isFiltering = query !== ''

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
        <button onClick={onNew} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
          <Plus size={11} />Ny kund
        </button>
        <RefreshButton iconOnly />
      </div>

      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selected.size} valda</span>

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
                    <td className="px-4 py-3 font-medium text-fg whitespace-nowrap uppercase">{kund.namn}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{kund.telefon ?? '—'}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{kund.email ?? '—'}</td>
                    <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                      {new Date(kund.skapad_at).toLocaleDateString('sv-SE')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {lastProjekt[kund.id] ? (
                        <button
                          onClick={() => onNavigateProjekt?.(lastProjekt[kund.id].id)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-elevated hover:bg-hover hover:border-border text-xs text-fg transition-colors max-w-[140px]"
                          title={lastProjekt[kund.id].namn}
                        >
                          <span className="font-mono text-muted shrink-0">{lastProjekt[kund.id].projekt_nummer}</span>
                          <span className="truncate">{lastProjekt[kund.id].namn}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onCreateProjekt?.(kund.id)}
                          className="text-xs text-subtle hover:text-fg transition-colors"
                        >
                          + Projekt
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {lastForslag[kund.id] ? (
                        <button
                          onClick={() => onNavigateForslag?.(lastForslag[kund.id].id)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-elevated hover:bg-hover hover:border-border text-xs text-fg transition-colors max-w-[140px]"
                          title={lastForslag[kund.id].titel}
                        >
                          <span className={`size-1.5 rounded-full shrink-0 ${FORSLAG_STATUS_DOT[lastForslag[kund.id].status] ?? 'bg-muted'}`} />
                          <span className="font-mono text-muted shrink-0">{lastForslag[kund.id].forslag_nummer}</span>
                          <span className="truncate">{lastForslag[kund.id].titel}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onCreateForslag?.(lastProjekt[kund.id]?.id)}
                          className="text-xs text-subtle hover:text-fg transition-colors"
                        >
                          + Förslag
                        </button>
                      )}
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
