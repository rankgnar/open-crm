import { Plus, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { useState } from 'react'
import type { Order, OrderStatus } from './types'
import { useAppConfig } from '@/context/AppConfig'
import { OrderStatusPicker } from './OrderStatusPicker'
import { RefreshButton } from '@/components/RefreshButton'

interface Props {
  ordrar: Order[]
  onSelect: (order: Order) => void
  onNew: () => void
  onSetStatus: (id: string, status: OrderStatus) => Promise<void>
  onDeleteMany: (ids: string[]) => Promise<void>
}

export function OrderTable({ ordrar, onSelect, onNew, onSetStatus, onDeleteMany }: Props) {
  const { formatCurrency } = useAppConfig()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const allSelected = ordrar.length > 0 && ordrar.every((o) => selected.has(o.id))

  const sorted = sortCol ? [...ordrar].sort((a, b) => {
    if (sortCol === 'belopp_total') return sortDir === 'asc' ? a.belopp_total - b.belopp_total : b.belopp_total - a.belopp_total
    const vals: Record<string, string | null | undefined> = {
      order_nummer: a.order_nummer, projekt: a.projekt?.namn, kund_namn: a.kund_namn,
      titel: a.titel, status: a.status, skapad_at: a.skapad_at,
    }
    const bvals: Record<string, string | null | undefined> = {
      order_nummer: b.order_nummer, projekt: b.projekt?.namn, kund_namn: b.kund_namn,
      titel: b.titel, status: b.status, skapad_at: b.skapad_at,
    }
    const av = String(vals[sortCol] ?? ''), bv = String(bvals[sortCol] ?? '')
    const cmp = av.localeCompare(bv, 'sv')
    return sortDir === 'asc' ? cmp : -cmp
  }) : ordrar

  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmBulk(false)
  }

  function toggleAll(e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(allSelected ? new Set() : new Set(ordrar.map((o) => o.id)))
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

  async function handleStatusChange(o: Order, next: OrderStatus) {
    if (next === o.status) return
    if (o.status === 'Godkänd') {
      const ok = confirm(`Ändra status på ${o.order_nummer} från Godkänd till ${next}?\nDetta tar bort signaturen.`)
      if (!ok) return
    }
    try {
      await onSetStatus(o.id, next)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kunde inte ändra status')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <h1 className="text-sm font-medium text-fg">Order</h1>
        <div className="flex items-center gap-2">
          <RefreshButton iconOnly />
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
          >
            <Plus size={12} />Ny order
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selected.size} valda</span>
          {confirmBulk ? (
            <>
              <span className="text-xs text-muted">Radera {selected.size} order?</span>
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

      <div className="flex-1 overflow-auto">
        {ordrar.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted text-sm">
            <p>Inga order ännu</p>
            <p className="text-xs text-subtle mt-1">Skapa en ändringsorder för extra arbete utanför projektets budget</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-sidebar">
              <tr className="border-b border-border">
                <th className="pl-6 pr-2 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => {}}
                    onClick={toggleAll}
                    className="rounded border-border accent-emerald-400 cursor-pointer"
                  />
                </th>
                {([
                  ['order_nummer', 'Nr', 'w-24'],
                  ['projekt', 'Projekt', ''],
                  ['kund_namn', 'Kund', ''],
                  ['titel', 'Titel', ''],
                  ['status', 'Status', 'w-32'],
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
                <th onClick={() => handleSort('belopp_total')}
                  className="text-right px-2 py-3 w-32 text-[10px] uppercase tracking-wider text-muted font-medium cursor-pointer select-none hover:text-fg transition-colors group/th">
                  <div className="flex items-center justify-end gap-1">
                    Total
                    {sortCol === 'belopp_total'
                      ? sortDir === 'asc' ? <ArrowUp size={10} className="text-fg shrink-0" /> : <ArrowDown size={10} className="text-fg shrink-0" />
                      : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                    }
                  </div>
                </th>
                <th onClick={() => handleSort('skapad_at')}
                  className="text-left px-6 py-3 w-32 text-[10px] uppercase tracking-wider text-muted font-medium cursor-pointer select-none hover:text-fg transition-colors group/th">
                  <div className="flex items-center gap-1">
                    Skapad
                    {sortCol === 'skapad_at'
                      ? sortDir === 'asc' ? <ArrowUp size={10} className="text-fg shrink-0" /> : <ArrowDown size={10} className="text-fg shrink-0" />
                      : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                    }
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => {
                const isApproved = o.status === 'Godkänd'
                const isSelected = selected.has(o.id)
                const baseBg = isSelected ? 'bg-elevated' : isApproved ? 'bg-emerald-400/[0.06]' : ''
                return (
                <tr
                  key={o.id}
                  className={`border-b border-border hover:bg-hover cursor-pointer transition-colors ${baseBg}`}
                  onClick={() => onSelect(o)}
                >
                  <td className="pl-6 pr-2 py-2.5" onClick={(e) => toggleSelect(e, o.id)}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-border accent-emerald-400 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-2.5 font-mono text-fg">{o.order_nummer}</td>
                  <td className="px-2 py-2.5 text-fg">{o.projekt?.namn ?? '—'}</td>
                  <td className="px-2 py-2.5 text-muted uppercase">{o.kund_namn}</td>
                  <td className="px-2 py-2.5 text-fg">{o.titel}</td>
                  <td className="px-2 py-2.5">
                    <OrderStatusPicker
                      status={o.status}
                      onChange={(next) => handleStatusChange(o, next)}
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-fg font-semibold">{formatCurrency(o.belopp_total)}</td>
                  <td className="px-6 py-2.5 text-muted">{o.skapad_at.slice(0, 10)}</td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
