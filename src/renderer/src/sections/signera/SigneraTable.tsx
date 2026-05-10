import { useState } from 'react'
import { Plus, FileSignature, Trash2, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import type { SigneraRow } from './types'
import { lankStatus, type LankStatus } from '../signatur/types'

interface Props {
  rader:         SigneraRow[]
  onSelect:      (row: SigneraRow) => void
  onNew:         () => void
  onDeleteMany:  (ids: string[]) => Promise<void>
  onRefresh:     () => Promise<void>
  refreshing?:   boolean
}

const STATUS_LABEL: Record<LankStatus, string> = {
  'väntar':         'Väntar',
  'öppnad':         'Öppnad',
  'ändring begärd': 'Ändring begärd',
  'signerad':       'Signerad',
  'utgången':       'Utgången',
  'återkallad':     'Återkallad',
}

const STATUS_COLOR: Record<LankStatus, string> = {
  'väntar':         'text-amber-400',
  'öppnad':         'text-blue-400',
  'ändring begärd': 'text-amber-400',
  'signerad':       'text-emerald-400',
  'utgången':       'text-muted',
  'återkallad':     'text-red-400',
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('sv-SE')
}

export function SigneraTable({ rader, onSelect, onNew, onDeleteMany, onRefresh, refreshing }: Props) {
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk]   = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [confirmRowId, setConfirmRowId] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const allSelected = rader.length > 0 && rader.every((r) => selected.has(r.lank.id))

  const sorted = sortCol ? [...rader].sort((a, b) => {
    const vals: Record<string, string | null | undefined> = {
      titel: a.dokument?.titel, projekt: a.projekt?.namn, kund: a.kund?.namn,
      email: a.lank.kund_email, status: lankStatus(a.lank), skapad_at: a.lank.skapad_at,
    }
    const bvals: Record<string, string | null | undefined> = {
      titel: b.dokument?.titel, projekt: b.projekt?.namn, kund: b.kund?.namn,
      email: b.lank.kund_email, status: lankStatus(b.lank), skapad_at: b.lank.skapad_at,
    }
    const av = String(vals[sortCol] ?? ''), bv = String(bvals[sortCol] ?? '')
    const cmp = av.localeCompare(bv, 'sv')
    return sortDir === 'asc' ? cmp : -cmp
  }) : rader

  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmBulk(false)
  }

  function toggleAll(e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(allSelected ? new Set() : new Set(rader.map((r) => r.lank.id)))
    setConfirmBulk(false)
  }

  async function handleBulkDelete() {
    setDeletingBulk(true)
    try {
      await onDeleteMany([...selected])
      setSelected(new Set())
      setConfirmBulk(false)
    } finally { setDeletingBulk(false) }
  }

  async function handleRowDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await onDeleteMany([id])
    setConfirmRowId(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <h1 className="text-sm font-medium text-fg">Signera</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { void onRefresh() }}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-fg hover:bg-hover transition-colors disabled:opacity-50"
            title="Uppdatera"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
          >
            <Plus size={12} />Nytt dokument
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selected.size} valda</span>
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

      <div className="flex-1 overflow-auto">
        {rader.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
            <FileSignature size={28} className="text-subtle" />
            <p className="text-sm">Inga dokument skickade för signering ännu</p>
            <p className="text-xs text-subtle">Ladda upp valfri PDF eller bild och skicka den till en kund</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-sidebar">
              <tr className="border-b border-border">
                <th className="pl-4 pr-2 py-3 w-8">
                  <input type="checkbox" checked={allSelected} onChange={() => {}} onClick={toggleAll}
                    className="rounded border-border accent-emerald-400 cursor-pointer" />
                </th>
                {([
                  ['titel', 'Titel', 'px-6', ''],
                  ['projekt', 'Projekt', 'px-2', ''],
                  ['kund', 'Kund', 'px-2', ''],
                  ['email', 'Email', 'px-2', ''],
                  ['status', 'Status', 'px-2', 'w-32'],
                  ['skapad_at', 'Skickad', 'px-6', 'w-32'],
                ] as [string, string, string, string][]).map(([col, label, px, w]) => (
                  <th key={col} onClick={() => handleSort(col)}
                    className={`text-left ${px} py-3 ${w} text-[10px] uppercase tracking-wider text-muted font-medium cursor-pointer select-none hover:text-fg transition-colors group/th`}>
                    <div className="flex items-center gap-1">
                      {label}
                      {sortCol === col
                        ? sortDir === 'asc' ? <ArrowUp size={10} className="text-fg shrink-0" /> : <ArrowDown size={10} className="text-fg shrink-0" />
                        : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                      }
                    </div>
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const st = lankStatus(r.lank)
                const isSelected = selected.has(r.lank.id)
                const isConfirmRow = confirmRowId === r.lank.id
                return (
                  <tr
                    key={r.lank.id}
                    className={`border-b border-border hover:bg-hover cursor-pointer transition-colors group ${isSelected ? 'bg-elevated' : ''}`}
                    onClick={() => onSelect(r)}
                  >
                    <td className="pl-4 pr-2 py-2.5" onClick={(e) => toggleSelect(e, r.lank.id)}>
                      <input type="checkbox" checked={isSelected} onChange={() => {}} className="rounded border-border accent-emerald-400 cursor-pointer" />
                    </td>
                    <td className="px-6 py-2.5 text-fg">{r.dokument?.titel ?? '—'}</td>
                    <td className="px-2 py-2.5 text-muted">{r.projekt?.namn ?? '—'}</td>
                    <td className="px-2 py-2.5 text-muted">{r.kund?.namn ?? '—'}</td>
                    <td className="px-2 py-2.5 text-muted">{r.lank.kund_email}</td>
                    <td className={`px-2 py-2.5 font-medium ${STATUS_COLOR[st]}`}>{STATUS_LABEL[st]}</td>
                    <td className="px-6 py-2.5 text-muted">{fmtDate(r.lank.skapad_at)}</td>
                    <td className="pr-4 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {isConfirmRow ? (
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => handleRowDelete(e, r.lank.id)} className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors">Ja</button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmRowId(null) }} className="text-xs text-muted hover:text-fg transition-colors">Nej</button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setConfirmRowId(r.lank.id) }}
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
        )}
      </div>
    </div>
  )
}
