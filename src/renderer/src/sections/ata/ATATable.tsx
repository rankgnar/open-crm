import { Plus, Trash2 } from 'lucide-react'
import { RefreshButton } from '@/components/RefreshButton'
import { useState } from 'react'
import type { ATA, ATAStatus } from './types'
import { useAppConfig } from '@/context/AppConfig'
import { ATAStatusPicker } from './ATAStatusPicker'

interface Props {
  atas: ATA[]
  onSelect: (ata: ATA) => void
  onNew: () => void
  onSetStatus: (id: string, status: ATAStatus) => Promise<void>
  onDeleteMany: (ids: string[]) => Promise<void>
}

export function ATATable({ atas, onSelect, onNew, onSetStatus, onDeleteMany }: Props) {
  const { formatCurrency } = useAppConfig()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)

  const allSelected = atas.length > 0 && atas.every((a) => selected.has(a.id))

  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmBulk(false)
  }

  function toggleAll(e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(allSelected ? new Set() : new Set(atas.map((a) => a.id)))
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

  async function handleStatusChange(a: ATA, next: ATAStatus) {
    if (next === a.status) return
    if (a.status === 'Godkänd') {
      const ok = confirm(`Ändra status på ${a.ata_nummer} från Godkänd till ${next}?\nDetta tar bort signaturen.`)
      if (!ok) return
    }
    try {
      await onSetStatus(a.id, next)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kunde inte ändra status')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <h1 className="text-sm font-medium text-fg">ÄTA</h1>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
          >
            <Plus size={12} />Ny ÄTA
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selected.size} valda</span>
          {confirmBulk ? (
            <>
              <span className="text-xs text-muted">Radera {selected.size} ÄTA?</span>
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
        {atas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted text-sm">
            <p>Inga ÄTA-arbeten ännu</p>
            <p className="text-xs text-subtle mt-1">Skapa ett ÄTA-dokument för ändrings- eller tilläggsarbeten utanför projektets ursprungliga budget</p>
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
                <th className="text-left px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium w-28">Nr</th>
                <th className="text-left px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium">Projekt</th>
                <th className="text-left px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium">Kund</th>
                <th className="text-left px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium">Titel</th>
                <th className="text-left px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium w-32">Status</th>
                <th className="text-right px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium w-32">Total</th>
                <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-muted font-medium w-32">Skapad</th>
              </tr>
            </thead>
            <tbody>
              {atas.map((a) => {
                const isApproved = a.status === 'Godkänd'
                const isSelected = selected.has(a.id)
                const baseBg = isSelected ? 'bg-elevated' : isApproved ? 'bg-emerald-400/[0.06]' : ''
                return (
                <tr
                  key={a.id}
                  className={`border-b border-border hover:bg-hover cursor-pointer transition-colors ${baseBg}`}
                  onClick={() => onSelect(a)}
                >
                  <td className="pl-6 pr-2 py-2.5" onClick={(e) => toggleSelect(e, a.id)}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-border accent-emerald-400 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-2.5 font-mono text-fg">{a.ata_nummer}</td>
                  <td className="px-2 py-2.5 text-fg">{a.projekt?.namn ?? '—'}</td>
                  <td className="px-2 py-2.5 text-muted">{a.kund_namn}</td>
                  <td className="px-2 py-2.5 text-fg">{a.titel}</td>
                  <td className="px-2 py-2.5">
                    <ATAStatusPicker
                      status={a.status}
                      onChange={(next) => handleStatusChange(a, next)}
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-fg font-semibold">{formatCurrency(a.belopp_total)}</td>
                  <td className="px-6 py-2.5 text-muted">{a.skapad_at.slice(0, 10)}</td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
