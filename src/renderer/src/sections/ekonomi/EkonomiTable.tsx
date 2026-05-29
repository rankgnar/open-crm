import { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Search, X } from 'lucide-react'
import type { ProjektWithKund } from '@/sections/projekt/types'
import type { EkonomiUtfall } from './types'
import { useAppConfig } from '@/context/AppConfig'
import { RefreshButton } from '@/components/RefreshButton'

interface Props {
  projekt: ProjektWithKund[]
  utfallAll: EkonomiUtfall[]
  onSelect: (p: ProjektWithKund) => void
}

function Semaphore({ utfall, budget }: { utfall: number; budget: number }) {
  if (budget === 0) return <span className="size-2 rounded-full bg-muted inline-block" />
  const pct = utfall / budget
  if (pct > 1) return <span className="size-2 rounded-full bg-red-400 inline-block" title="Över budget" />
  if (pct > 0.8) return <span className="size-2 rounded-full bg-amber-400 inline-block" title="Nära budget" />
  return <span className="size-2 rounded-full bg-emerald-400 inline-block" title="Under budget" />
}

export function EkonomiTable({ projekt, utfallAll, onSelect }: Props) {
  const { formatCurrency } = useAppConfig()
  const fmt = (n: number) => formatCurrency(n, 0)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const statusOptions = useMemo(() => {
    const unique = Array.from(new Set(projekt.map((p) => p.status).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'sv'))
    return unique
  }, [projekt])

  const filteredProj = useMemo(() => {
    const q = search.toLowerCase()
    return projekt.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (!q) return true
      return (
        p.projekt_nummer.toLowerCase().includes(q) ||
        p.namn.toLowerCase().includes(q) ||
        p.kunder.namn.toLowerCase().includes(q)
      )
    })
  }, [projekt, search, statusFilter])

  function handleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sortedProj = sortCol ? [...filteredProj].sort((a, b) => {
    if (sortCol === 'utfall' || sortCol === 'diff') {
      const ua = utfallAll.filter((u) => u.projekt_id === a.id).reduce((s, u) => s + u.belopp, 0)
      const ub = utfallAll.filter((u) => u.projekt_id === b.id).reduce((s, u) => s + u.belopp, 0)
      const va = sortCol === 'diff' ? a.budget_total - ua : ua
      const vb = sortCol === 'diff' ? b.budget_total - ub : ub
      return sortDir === 'asc' ? va - vb : vb - va
    }
    if (sortCol === 'budget_total') return sortDir === 'asc' ? a.budget_total - b.budget_total : b.budget_total - a.budget_total
    const vals: Record<string, string | null> = { projekt_nummer: a.projekt_nummer, namn: a.namn, kund: a.kunder.namn }
    const bvals: Record<string, string | null> = { projekt_nummer: b.projekt_nummer, namn: b.namn, kund: b.kunder.namn }
    const av = vals[sortCol] ?? '', bv = bvals[sortCol] ?? ''
    const cmp = av.localeCompare(bv, 'sv')
    return sortDir === 'asc' ? cmp : -cmp
  }) : filteredProj

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold text-fg">Kostnader</h1>
        <span className="text-xs text-muted bg-elevated border border-border rounded-full px-2 py-0.5">
          {sortedProj.length}{filteredProj.length !== projekt.length && <span className="opacity-50"> / {projekt.length}</span>}
        </span>

        <div className="relative ml-4">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nr, projekt, kund..."
            className="input text-xs py-1.5 pl-7 pr-6 w-48"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-fg transition-colors">
              <X size={11} />
            </button>
          )}
        </div>

        {statusOptions.length > 0 && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-xs py-1.5 px-2 w-36"
          >
            <option value="">Alla statusar</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        <RefreshButton className="ml-auto" iconOnly />
      </div>

      {projekt.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted text-sm">Inga projekt ännu.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sidebar z-10">
              <tr className="border-b border-border text-left">
                <th className="px-6 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted w-6"></th>
                {([
                  ['projekt_nummer', 'Nr'],
                  ['namn', 'Projekt'],
                  ['kund', 'Kund'],
                ] as [string, string][]).map(([col, label]) => (
                  <th key={col} onClick={() => handleSort(col)}
                    className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted cursor-pointer select-none hover:text-fg transition-colors group/th">
                    <div className="flex items-center gap-1">
                      {label}
                      {sortCol === col
                        ? sortDir === 'asc' ? <ArrowUp size={10} className="text-fg shrink-0" /> : <ArrowDown size={10} className="text-fg shrink-0" />
                        : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                      }
                    </div>
                  </th>
                ))}
                {([
                  ['budget_total', 'Budget'],
                  ['utfall', 'Utfall'],
                  ['diff', 'Diff'],
                ] as [string, string][]).map(([col, label]) => (
                  <th key={col} onClick={() => handleSort(col)}
                    className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted text-right cursor-pointer select-none hover:text-fg transition-colors group/th">
                    <div className="flex items-center justify-end gap-1">
                      {label}
                      {sortCol === col
                        ? sortDir === 'asc' ? <ArrowUp size={10} className="text-fg shrink-0" /> : <ArrowDown size={10} className="text-fg shrink-0" />
                        : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                      }
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedProj.map((p) => {
                const utfall = utfallAll.filter((u) => u.projekt_id === p.id).reduce((s, u) => s + u.belopp, 0)
                const diff = p.budget_total - utfall
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelect(p)}
                    className="border-b border-border hover:bg-hover cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3">
                      <Semaphore utfall={utfall} budget={p.budget_total} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{p.projekt_nummer}</td>
                    <td className="px-4 py-3 font-medium text-fg">{p.namn}</td>
                    <td className="px-4 py-3 text-muted text-xs uppercase">{p.kunder.namn}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted">{p.budget_total > 0 ? fmt(p.budget_total) : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted">{utfall > 0 ? fmt(utfall) : '—'}</td>
                    <td className={`px-4 py-3 text-right font-mono text-xs ${diff < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {p.budget_total > 0 || utfall > 0 ? (diff >= 0 ? '+' : '') + fmt(diff) : '—'}
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
