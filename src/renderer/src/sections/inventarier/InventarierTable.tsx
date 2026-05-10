import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Download, Search } from 'lucide-react'
import { RefreshButton } from '@/components/RefreshButton'
import type { Inventarie } from './types'

interface Props {
  items: Inventarie[]
  onNew: () => void
  onEdit: (item: Inventarie) => void
  onDelete: (id: string) => Promise<void>
  onDeleteMany: (ids: string[]) => Promise<void>
}

function skickColor(skick: string): string {
  switch (skick) {
    case 'Bra':   return 'text-emerald-400'
    case 'OK':    return 'text-blue-400'
    case 'Dålig': return 'text-amber-400'
    case 'Trasig': return 'text-red-400'
    default: return 'text-muted'
  }
}

export function InventarierTable({ items, onNew, onEdit, onDelete, onDeleteMany }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const visible = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(
      (i) =>
        i.benamning.toLowerCase().includes(q) ||
        i.kategori.toLowerCase().includes(q) ||
        i.tillverkare_modell.toLowerCase().includes(q) ||
        i.placering.toLowerCase().includes(q) ||
        i.serienr.toLowerCase().includes(q),
    )
  }, [items, search])

  const allSelected = visible.length > 0 && visible.every((i) => selected.has(i.id))

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
    setSelected(allSelected ? new Set() : new Set(visible.map((i) => i.id)))
    setConfirmBulk(false)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await onDelete(id)
      setConfirmDelete(null)
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
    } finally {
      setDeleting(false)
    }
  }

  async function handleBulkDelete() {
    setDeleting(true)
    try {
      await onDeleteMany([...selected])
      setSelected(new Set())
      setConfirmBulk(false)
    } finally {
      setDeleting(false)
    }
  }

  function exportCsv() {
    const headers = ['Löpnr', 'Kategori', 'Benämning', 'Tillverkare/Modell', 'Serienr', 'Antal', 'Skick', 'Placering']
    const rows = items.map((i) => [
      i.lopnr, i.kategori, i.benamning, i.tillverkare_modell,
      i.serienr, i.antal, i.skick, i.placering,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventarier-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-fg">Inventarier</h1>
          <span className="text-xs text-subtle">{items.length} poster</span>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            confirmBulk ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Ta bort {selected.size} poster?</span>
                <button
                  className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors disabled:opacity-40"
                  onClick={() => void handleBulkDelete()}
                  disabled={deleting}
                >
                  {deleting ? 'Tar bort...' : 'Bekräfta'}
                </button>
                <button className="text-xs text-muted hover:text-fg" onClick={() => setConfirmBulk(false)}>Avbryt</button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted hover:bg-hover hover:text-fg transition-colors"
                onClick={() => setConfirmBulk(true)}
              >
                <Trash2 size={13} />
                Ta bort {selected.size}
              </button>
            )
          )}
          <button
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted hover:bg-hover hover:text-fg transition-colors"
            onClick={exportCsv}
          >
            <Download size={13} />
            Exportera CSV
          </button>
          <RefreshButton />
          <button
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
            onClick={onNew}
          >
            <Plus size={11} />Ny post
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-2 border-b border-border shrink-0">
        <div className="relative max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök inventarie..."
            className="w-full rounded-lg border border-border bg-elevated pl-8 pr-3 py-1.5 text-xs text-fg outline-none focus:border-emerald-400 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-sidebar z-10 border-b border-border">
            <tr>
              <th className="w-8 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onClick={toggleAll}
                  onChange={() => {}}
                  className="cursor-pointer"
                />
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-muted font-medium w-14">Löpnr</th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-muted font-medium w-32">Kategori</th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-muted font-medium">Namn</th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-muted font-medium">Tillv./Modell</th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-muted font-medium w-28">Serienr</th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-muted font-medium w-14">Antal</th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-muted font-medium w-20">Skick</th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-muted font-medium">Placering</th>
              <th className="px-4 py-2.5 w-20" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted">
                  {search ? 'Inga poster matchar sökningen' : 'Inga inventarieposter ännu — skapa en ny post.'}
                </td>
              </tr>
            ) : (
              visible.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-border hover:bg-hover cursor-pointer ${selected.has(item.id) ? 'bg-hover' : ''}`}
                  onClick={() => onEdit(item)}
                >
                  <td className="px-4" onClick={(e) => toggleSelect(e, item.id)}>
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => {}} className="cursor-pointer" />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-subtle">{item.lopnr}</td>
                  <td className="px-3 py-2.5 text-muted">{item.kategori || '—'}</td>
                  <td className="px-3 py-2.5 text-fg font-medium">{item.benamning || '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{item.tillverkare_modell || '—'}</td>
                  <td className="px-3 py-2.5 text-muted font-mono">{item.serienr || '—'}</td>
                  <td className="px-3 py-2.5 tabular-nums text-fg">{item.antal}</td>
                  <td className={`px-3 py-2.5 font-medium ${skickColor(item.skick)}`}>{item.skick}</td>
                  <td className="px-3 py-2.5 text-muted">{item.placering || '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="p-1 rounded hover:bg-hover text-subtle hover:text-fg transition-colors"
                        onClick={() => onEdit(item)}
                        title="Redigera"
                      >
                        <Pencil size={13} />
                      </button>
                      {confirmDelete === item.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            className="text-red-400 text-[11px] hover:text-red-300 font-medium disabled:opacity-40 transition-colors"
                            onClick={() => void handleDelete(item.id)}
                            disabled={deleting}
                          >
                            {deleting ? '...' : 'Radera'}
                          </button>
                          <button
                            className="text-muted text-[11px] hover:text-fg"
                            onClick={() => setConfirmDelete(null)}
                          >
                            Avbryt
                          </button>
                        </div>
                      ) : (
                        <button
                          className="p-1 rounded hover:bg-hover text-subtle hover:text-red-400 transition-colors"
                          onClick={() => setConfirmDelete(item.id)}
                          title="Ta bort"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
