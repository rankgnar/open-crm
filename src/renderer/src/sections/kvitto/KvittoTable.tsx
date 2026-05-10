import { Plus, Paperclip, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { RefreshButton } from '@/components/RefreshButton'
import { useMemo, useState } from 'react'
import type { KvittoListItem, KvittoStatus } from './types'
import { KVITTO_KATEGORIER } from './types'
import { KvittoStatusBadge } from './KvittoStatusBadge'
import { useAppConfig } from '@/context/AppConfig'

type StatusFilter = 'alla' | KvittoStatus

interface Props {
  kvitton: KvittoListItem[]
  onSelect: (k: KvittoListItem) => void
  onNew: () => void
  onDeleteMany: (ids: string[]) => Promise<void>
}

export function KvittoTable({ kvitton, onSelect, onNew, onDeleteMany }: Props) {
  const { formatCurrency } = useAppConfig()
  const [filter, setFilter] = useState<StatusFilter>('alla')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const counts = useMemo(() => ({
    alla: kvitton.length,
    att_hantera: kvitton.filter((k) => k.status === 'att_hantera').length,
    hanterade: kvitton.filter((k) => k.status === 'hanterade').length,
  }), [kvitton])

  const visible = filter === 'alla' ? kvitton : kvitton.filter((k) => k.status === filter)
  const sorted = sortCol ? [...visible].sort((a, b) => {
    if (sortCol === 'belopp') {
      const na = a.belopp ?? 0, nb = b.belopp ?? 0
      return sortDir === 'asc' ? na - nb : nb - na
    }
    const vals: Record<string, string | null> = {
      datum: a.datum, leverantor: a.leverantor, kategori: a.kategori, status: a.status,
    }
    const bvals: Record<string, string | null> = {
      datum: b.datum, leverantor: b.leverantor, kategori: b.kategori, status: b.status,
    }
    const av = vals[sortCol] ?? '', bv = bvals[sortCol] ?? ''
    const cmp = av.localeCompare(bv, 'sv')
    return sortDir === 'asc' ? cmp : -cmp
  }) : visible
  const allVisibleSelected = visible.length > 0 && visible.every((k) => selected.has(k.id))

  function kategoriLabel(value: string | null): string {
    if (!value) return '—'
    return KVITTO_KATEGORIER.find((k) => k.value === value)?.label ?? value
  }

  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
    setConfirmBulk(false)
  }

  function toggleAll(e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((k) => k.id)))
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-fg">Kvitto</h1>
          <div className="flex items-center gap-1">
            {(['alla', 'att_hantera', 'hanterade'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 rounded text-[11px] uppercase tracking-wider transition-colors ${filter === f ? 'bg-hover text-fg' : 'text-muted hover:text-fg hover:bg-hover'}`}
              >
                {f === 'alla' ? 'Alla' : f === 'att_hantera' ? 'Att hantera' : 'Hanterade'}
                <span className="ml-1.5 text-subtle">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton iconOnly />
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
          >
            <Plus size={12} />Nytt kvitto
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selected.size} valda</span>
          {confirmBulk ? (
            <>
              <span className="text-xs text-muted">Radera {selected.size} kvitton?</span>
              <button
                onClick={handleBulkDelete}
                disabled={deletingBulk}
                className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-40 transition-colors"
              >
                {deletingBulk ? '...' : 'Ja, radera'}
              </button>
              <button
                onClick={() => setConfirmBulk(false)}
                className="text-xs text-muted hover:text-fg transition-colors"
              >
                Avbryt
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmBulk(true)}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 size={12} /> Radera markerade
            </button>
          )}
          <button
            onClick={() => { setSelected(new Set()); setConfirmBulk(false) }}
            className="ml-auto text-xs text-muted hover:text-fg transition-colors"
          >
            Avmarkera alla
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted text-sm">
            <p>Inga kvitton {filter !== 'alla' ? `i status "${filter === 'att_hantera' ? 'Att hantera' : 'Hanterade'}"` : 'ännu'}</p>
            <p className="text-xs text-subtle mt-1">Lägg till ett kvitto från en kontantköp eller ladda upp från mobilen</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-sidebar">
              <tr className="border-b border-border">
                <th className="pl-6 pr-2 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={() => {}}
                    onClick={toggleAll}
                    className="rounded border-border accent-emerald-400 cursor-pointer"
                  />
                </th>
                {([
                  ['datum', 'Datum', 'w-28'],
                  ['leverantor', 'Leverantör', ''],
                  ['kategori', 'Kategori', 'w-40'],
                ] as [string, string, string][]).map(([col, label, w]) => (
                  <th key={col} onClick={() => handleSort(col)}
                    className={`text-left px-2 py-3 ${w} text-[10px] uppercase tracking-wider text-muted font-medium cursor-pointer select-none hover:text-fg transition-colors group/th`}>
                    <div className="flex items-center gap-1">
                      {label}
                      {sortCol === col
                        ? sortDir === 'asc' ? <ArrowUp size={10} className="text-fg shrink-0" /> : <ArrowDown size={10} className="text-fg shrink-0" />
                        : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                      }
                    </div>
                  </th>
                ))}
                <th className="text-left px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium select-none">Projekt</th>
                <th onClick={() => handleSort('belopp')}
                  className="text-right px-2 py-3 w-32 text-[10px] uppercase tracking-wider text-muted font-medium cursor-pointer select-none hover:text-fg transition-colors group/th">
                  <div className="flex items-center justify-end gap-1">
                    Belopp
                    {sortCol === 'belopp'
                      ? sortDir === 'asc' ? <ArrowUp size={10} className="text-fg shrink-0" /> : <ArrowDown size={10} className="text-fg shrink-0" />
                      : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                    }
                  </div>
                </th>
                <th onClick={() => handleSort('status')}
                  className="text-left px-2 py-3 w-32 text-[10px] uppercase tracking-wider text-muted font-medium cursor-pointer select-none hover:text-fg transition-colors group/th">
                  <div className="flex items-center gap-1">
                    Status
                    {sortCol === 'status'
                      ? sortDir === 'asc' ? <ArrowUp size={10} className="text-fg shrink-0" /> : <ArrowDown size={10} className="text-fg shrink-0" />
                      : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                    }
                  </div>
                </th>
                <th className="px-6 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((k) => {
                const incomplete = !k.leverantor || k.belopp == null
                const isSelected = selected.has(k.id)
                return (
                  <tr
                    key={k.id}
                    onClick={() => onSelect(k)}
                    className={`border-b border-border hover:bg-hover cursor-pointer transition-colors ${isSelected ? 'bg-elevated' : ''}`}
                  >
                    <td className="pl-6 pr-2 py-2.5" onClick={(e) => toggleSelect(e, k.id)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-border accent-emerald-400 cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-2.5 font-mono text-fg">{k.datum}</td>
                    <td className="px-2 py-2.5">
                      {k.leverantor ? (
                        <span className="text-fg">{k.leverantor}</span>
                      ) : (
                        <span className="text-amber-400 italic">Saknar info</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-muted">{kategoriLabel(k.kategori)}</td>
                    <td className="px-2 py-2.5 text-muted">
                      {k.projekt_nummer ? `${k.projekt_nummer} — ${k.projekt_titel ?? ''}` : '—'}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono font-semibold">
                      {k.belopp != null ? <span className="text-fg">{formatCurrency(k.belopp)}</span> : <span className="text-subtle">—</span>}
                    </td>
                    <td className="px-2 py-2.5"><KvittoStatusBadge status={k.status} /></td>
                    <td className="px-6 py-2.5">
                      {incomplete ? (
                        <span className="text-amber-400" title="Saknar leverantör eller belopp"><Paperclip size={13} /></span>
                      ) : (
                        <span className="text-subtle"><Paperclip size={13} /></span>
                      )}
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
