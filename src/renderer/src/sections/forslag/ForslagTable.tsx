import { Plus, FileDown, Loader2, Trash2 } from 'lucide-react'
import { RefreshButton } from '@/components/RefreshButton'
import { useRef, useState } from 'react'
import type { ForslagWithProjekt, ForslagStatusar, SignaturSummary } from './types'

const FARG_DOT: Record<string, string> = {
  emerald: 'bg-emerald-400', blue: 'bg-blue-400', amber: 'bg-amber-400', red: 'bg-red-400', muted: 'bg-muted',
}
const FARG_TEXT: Record<string, string> = {
  emerald: 'text-emerald-400', blue: 'text-blue-400', amber: 'text-amber-400', red: 'text-red-400', muted: 'text-muted',
}

interface Props {
  forslag: ForslagWithProjekt[]
  statusar: ForslagStatusar[]
  signingEvents: Record<string, SignaturSummary>
  onSelect: (f: ForslagWithProjekt) => void
  onNew: () => void
  onStatusChange: (id: string, status: string) => Promise<void>
  onExportPdf: (f: ForslagWithProjekt) => Promise<void>
  onDeleteMany: (ids: string[]) => Promise<void>
}

function StatusPicker({ forslag, statusar, onStatusChange }: { forslag: ForslagWithProjekt; statusar: ForslagStatusar[]; onStatusChange: (id: string, status: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = statusar.find((s) => s.namn === forslag.status)

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    setOpen((v) => !v)
  }

  async function handleSelect(e: React.MouseEvent, namn: string) {
    e.stopPropagation()
    setOpen(false)
    if (namn !== forslag.status) await onStatusChange(forslag.id, namn)
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={handleClick}
        onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false) }}
        className="inline-flex items-center gap-1.5 text-xs rounded px-1.5 py-0.5 hover:bg-hover transition-colors"
      >
        <span className={`size-1.5 rounded-full ${FARG_DOT[current?.farg ?? 'muted']}`} />
        <span className={FARG_TEXT[current?.farg ?? 'muted']}>{forslag.status}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[130px] bg-elevated border border-border rounded-lg shadow-lg py-1 flex flex-col">
          {statusar.map((s) => (
            <button
              key={s.id}
              onMouseDown={(e) => handleSelect(e, s.namn)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-hover transition-colors text-left ${s.namn === forslag.status ? 'opacity-40 cursor-default' : ''}`}
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

function fmtSignTs(ts: string): string {
  const d = new Date(ts)
  return `${d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
}

function SigneringLog({ summary }: { summary: SignaturSummary | undefined }) {
  if (!summary) return <span className="text-[11px] text-muted">—</span>

  const events: { label: string; ts: string; colorClass: string }[] = [
    { label: 'Skickat', ts: summary.skapad_at, colorClass: 'text-blue-400' },
  ]

  if (summary.revoked_at) {
    events.push({ label: 'Återkallat', ts: summary.revoked_at, colorClass: 'text-red-400' })
  } else {
    if (summary.oppnad_at) {
      const label = summary.view_count > 1 ? `Öppnat (${summary.view_count}×)` : 'Öppnat'
      events.push({ label, ts: summary.last_oppnad_at ?? summary.oppnad_at, colorClass: 'text-amber-400' })
    }
    if (summary.signerad_at) {
      const label = summary.signerad_namn ? `Signerat av ${summary.signerad_namn}` : 'Signerat'
      events.push({ label, ts: summary.signerad_at, colorClass: 'text-emerald-400' })
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      {events.map((ev, i) => (
        <div key={i} className="flex items-baseline gap-2">
          <span className={`text-[10px] font-medium whitespace-nowrap ${ev.colorClass}`}>{ev.label}</span>
          <span className="text-[10px] text-muted whitespace-nowrap">{fmtSignTs(ev.ts)}</span>
        </div>
      ))}
      {!summary.oppnad_at && !summary.signerad_at && !summary.revoked_at && (
        <span className="text-[10px] text-muted italic">Väntar på signatur...</span>
      )}
    </div>
  )
}

export function ForslagTable({ forslag, statusar, signingEvents, onSelect, onNew, onStatusChange, onExportPdf, onDeleteMany }: Props) {
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)

  const allSelected = forslag.length > 0 && forslag.every((f) => selected.has(f.id))

  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmBulk(false)
  }

  function toggleAll(e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(allSelected ? new Set() : new Set(forslag.map((f) => f.id)))
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

  async function handleExport(e: React.MouseEvent, f: ForslagWithProjekt) {
    e.stopPropagation()
    setExportingId(f.id)
    try { await onExportPdf(f) } finally { setExportingId(null) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-fg">Förslag</h1>
          <span className="text-xs text-muted bg-elevated border border-border rounded-full px-2 py-0.5">
            {forslag.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
          >
            <Plus size={11} />Nytt förslag
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selected.size} valda</span>
          {confirmBulk ? (
            <>
              <span className="text-xs text-muted">Radera {selected.size} förslag?</span>
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

      {forslag.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted text-sm">Inga förslag ännu. Skapa ett nytt förslag för att börja.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sidebar z-10">
              <tr className="border-b border-border text-left">
                <th className="pl-6 pr-2 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => {}}
                    onClick={toggleAll}
                    className="rounded border-border accent-emerald-400 cursor-pointer"
                  />
                </th>
                <th className="px-2 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted">Nr</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted">Kund</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted">Projekt</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted">Signering</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted">Giltig till</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted">Moms</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted">Skapad</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {forslag.map((f) => {
                const isAccepted = f.status === 'accepterat'
                const isSelected = selected.has(f.id)
                const baseBg = isSelected ? 'bg-elevated' : isAccepted ? 'bg-emerald-400/[0.06]' : ''
                return (
                <tr
                  key={f.id}
                  onClick={() => onSelect(f)}
                  className={`group border-b border-border hover:bg-hover cursor-pointer transition-colors ${baseBg}`}
                >
                  <td className="pl-6 pr-2 py-3" onClick={(e) => toggleSelect(e, f.id)}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-border accent-emerald-400 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-3 font-mono text-xs text-muted whitespace-nowrap">{f.forslag_nummer}</td>
                  <td className="px-4 py-3 text-fg whitespace-nowrap">{f.projekt.kunder.namn}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs text-muted">{f.projekt.projekt_nummer}</span>
                    <span className="ml-2 text-fg">{f.projekt.namn}</span>
                  </td>
                  <td className="px-4 py-3"><SigneringLog summary={signingEvents[f.id]} /></td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <StatusPicker forslag={f} statusar={statusar} onStatusChange={onStatusChange} />
                  </td>
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                    {f.giltig_till ? new Date(f.giltig_till).toLocaleDateString('sv-SE') : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{f.moms_procent}%</td>
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                    {new Date(f.skapad_at).toLocaleDateString('sv-SE')}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleExport(e, f)}
                      disabled={exportingId === f.id}
                      title="Exportera PDF"
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-red-400 border border-red-400/40 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                    >
                      {exportingId === f.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <FileDown size={12} />
                      }
                      PDF
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
