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
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold text-fg">Kostnader</h1>
        <span className="text-xs text-muted bg-elevated border border-border rounded-full px-2 py-0.5">
          {projekt.length}
        </span>
        <RefreshButton className="ml-auto" />
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
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted">Nr</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted">Projekt</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted">Kund</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted text-right">Budget</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted text-right">Utfall</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted text-right">Diff</th>
              </tr>
            </thead>
            <tbody>
              {projekt.map((p) => {
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
                    <td className="px-4 py-3 text-muted text-xs">{p.kunder.namn}</td>
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
