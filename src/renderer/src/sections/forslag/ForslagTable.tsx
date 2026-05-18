import { Plus, FileDown, Loader2, Trash2, ArrowUp, ArrowDown, ArrowUpDown, Bell, Copy, ChevronDown, Check } from 'lucide-react'
import { RefreshButton } from '@/components/RefreshButton'
import { KundPopover } from '@/components/KundPopover'
import { useRef, useState, useEffect } from 'react'
import type { ForslagWithProjekt, ForslagStatusar, SignaturSummary } from './types'
import type { ProjektStatusar } from '@/sections/projekt/types'
import { FARG_DOT as PROJEKT_FARG_DOT, FARG_TEXT as PROJEKT_FARG_TEXT } from '@/sections/projekt/types'

const FARG_DOT: Record<string, string> = {
  emerald: 'bg-emerald-400', blue: 'bg-blue-400', amber: 'bg-amber-400', red: 'bg-red-400', muted: 'bg-muted',
}
const FARG_TEXT: Record<string, string> = {
  emerald: 'text-emerald-400', blue: 'text-blue-400', amber: 'text-amber-400', red: 'text-red-400', muted: 'text-muted',
}

interface Props {
  forslag: ForslagWithProjekt[]
  statusar: ForslagStatusar[]
  projektStatusar: ProjektStatusar[]
  signingEvents: Record<string, SignaturSummary>
  onSelect: (f: ForslagWithProjekt) => void
  onNew: () => void
  onDuplicate?: () => void
  onStatusChange: (id: string, status: string) => Promise<void>
  onExportPdf: (f: ForslagWithProjekt) => Promise<void>
  onDeleteMany: (ids: string[]) => Promise<void>
  onClickProjekt?: (projektId: string) => void
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

function PaminnelseCell({ historik }: { historik: { at: string }[] | undefined }) {
  if (!historik || historik.length === 0) return <span className="text-[11px] text-muted">—</span>
  const last = historik[historik.length - 1]
  const d = new Date(last.at)
  const dateStr = `${d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
  return (
    <div className="flex items-center gap-1.5">
      <Bell size={10} className="text-amber-400 shrink-0" />
      <span className="text-[11px] text-amber-400 font-medium whitespace-nowrap">
        {historik.length > 1 ? `${historik.length}×` : '1×'}
      </span>
      <span className="text-[10px] text-muted whitespace-nowrap">{dateStr}</span>
    </div>
  )
}

function ProjektStatusFilter({ value, onChange, statusar }: { value: string[]; onChange: (v: string[]) => void; statusar: ProjektStatusar[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function toggle(namn: string) {
    const next = value.includes(namn) ? value.filter((v) => v !== namn) : [...value, namn]
    onChange(next)
  }

  const label = value.length === 0 ? 'Projektstatus' : value.length === 1 ? value[0] : `${value.length} statusar`
  const hasSelection = value.length > 0

  return (
    <div ref={ref} className="relative w-40 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 bg-elevated border border-border rounded-lg px-3 py-2 text-xs outline-none hover:border-fg/30 transition-colors"
      >
        <span className={`truncate ${hasSelection ? 'text-fg' : 'text-subtle'}`}>{label}</span>
        <ChevronDown size={11} className="text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-elevated border border-border rounded-lg shadow-xl flex flex-col overflow-hidden">
          <div className="max-h-64 overflow-auto py-1">
            {hasSelection && (
              <button
                type="button"
                onClick={() => { onChange([]); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs text-subtle hover:bg-hover transition-colors"
              >
                — Alla —
              </button>
            )}
            {statusar.map((s) => {
              const checked = value.includes(s.namn)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.namn)}
                  className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs hover:bg-hover transition-colors ${checked ? 'text-fg font-medium' : 'text-muted'}`}
                >
                  <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-border bg-bg'}`}>
                    {checked && <Check size={9} className="text-white" />}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PROJEKT_FARG_DOT[s.farg as keyof typeof PROJEKT_FARG_DOT] ?? 'bg-muted'}`} />
                  <span className="truncate">{s.namn}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusSelect({ value, onChange, statusar }: { value: string[]; onChange: (v: string[]) => void; statusar: ForslagStatusar[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function toggle(namn: string) {
    const next = value.includes(namn) ? value.filter((v) => v !== namn) : [...value, namn]
    onChange(next)
  }

  const label = value.length === 0 ? 'Alla statusar' : value.length === 1 ? value[0] : `${value.length} statusar`
  const hasSelection = value.length > 0

  return (
    <div ref={ref} className="relative w-40 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 bg-elevated border border-border rounded-lg px-3 py-2 text-xs outline-none hover:border-fg/30 transition-colors"
      >
        <span className={`truncate ${hasSelection ? 'text-fg' : 'text-subtle'}`}>{label}</span>
        <ChevronDown size={11} className="text-muted shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-elevated border border-border rounded-lg shadow-xl flex flex-col overflow-hidden">
          <div className="max-h-64 overflow-auto py-1">
            {hasSelection && (
              <button
                type="button"
                onClick={() => { onChange([]); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs text-subtle hover:bg-hover transition-colors"
              >
                — Alla statusar —
              </button>
            )}
            {statusar.map((s) => {
              const checked = value.includes(s.namn)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.namn)}
                  className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs hover:bg-hover transition-colors ${checked ? 'text-fg font-medium' : 'text-muted'}`}
                >
                  <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-border bg-bg'}`}>
                    {checked && <Check size={9} className="text-white" />}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${FARG_DOT[s.farg]}`} />
                  <span className="truncate">{s.namn}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function ForslagTable({ forslag, statusar, projektStatusar, signingEvents, onSelect, onNew, onDuplicate, onStatusChange, onExportPdf, onDeleteMany, onClickProjekt }: Props) {
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [sortCol, setSortCol] = useState<string | null>(() => localStorage.getItem('forslag-sort-col') || null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => (localStorage.getItem('forslag-sort-dir') as 'asc' | 'desc') || 'asc')
  const [statusFilter, setStatusFilter] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('forslag-status-filter')
      return saved ? (JSON.parse(saved) as string[]) : []
    } catch { return [] }
  })
  useEffect(() => {
    localStorage.setItem('forslag-status-filter', JSON.stringify(statusFilter))
  }, [statusFilter])

  const [projektFilter, setProjektFilter] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('forslag-projektstatus-filter')
      return saved ? (JSON.parse(saved) as string[]) : []
    } catch { return [] }
  })
  useEffect(() => {
    localStorage.setItem('forslag-projektstatus-filter', JSON.stringify(projektFilter))
  }, [projektFilter])

  function handleSort(col: string) {
    if (sortCol === col) {
      const next = sortDir === 'asc' ? 'desc' : 'asc'
      setSortDir(next)
      localStorage.setItem('forslag-sort-dir', next)
    } else {
      setSortCol(col)
      setSortDir('asc')
      localStorage.setItem('forslag-sort-col', col)
      localStorage.setItem('forslag-sort-dir', 'asc')
    }
  }

  const filteredByProjekt = projektFilter.length > 0 ? forslag.filter((f) => projektFilter.includes(f.projekt.status)) : forslag
  const filtered = statusFilter.length > 0 ? filteredByProjekt.filter((f) => statusFilter.includes(f.status)) : filteredByProjekt

  const allSelected = filtered.length > 0 && filtered.every((f) => selected.has(f.id))

  const sorted = sortCol ? [...filtered].sort((a, b) => {
    const vals: Record<string, string | null> = {
      forslag_nummer: a.forslag_nummer, kund: a.projekt.kunder.namn, projekt: a.projekt.namn,
      projektstatus: a.projekt.status, status: a.status, giltig_till: a.giltig_till, skapad_at: a.skapad_at,
    }
    const bvals: Record<string, string | null> = {
      forslag_nummer: b.forslag_nummer, kund: b.projekt.kunder.namn, projekt: b.projekt.namn,
      projektstatus: b.projekt.status, status: b.status, giltig_till: b.giltig_till, skapad_at: b.skapad_at,
    }
    const av = String(vals[sortCol] ?? ''), bv = String(bvals[sortCol] ?? '')
    const cmp = av.localeCompare(bv, 'sv')
    return sortDir === 'asc' ? cmp : -cmp
  }) : filtered

  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmBulk(false)
  }

  function toggleAll(e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(allSelected ? new Set() : new Set(filtered.map((f) => f.id)))
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
            {filtered.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ProjektStatusFilter value={projektFilter} onChange={setProjektFilter} statusar={projektStatusar} />
          <StatusSelect value={statusFilter} onChange={setStatusFilter} statusar={statusar} />
          <RefreshButton iconOnly />
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
            >
              <Copy size={11} />Duplicera
            </button>
          )}
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted text-sm">Inga förslag matchar filtret.</p>
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
                {([
                  ['forslag_nummer', 'Nr', 'px-2'],
                  ['kund', 'Kund', 'px-4'],
                  ['projekt', 'Projekt', 'px-4'],
                ] as [string, string, string][]).map(([col, label, px]) => (
                  <th key={col} onClick={() => handleSort(col)}
                    className={`${px} py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted cursor-pointer select-none hover:text-fg transition-colors group/th`}>
                    <div className="flex items-center gap-1">
                      {label}
                      {sortCol === col
                        ? sortDir === 'asc' ? <ArrowUp size={10} className="text-fg shrink-0" /> : <ArrowDown size={10} className="text-fg shrink-0" />
                        : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                      }
                    </div>
                  </th>
                ))}
                <th onClick={() => handleSort('projektstatus')}
                  className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted cursor-pointer select-none hover:text-fg transition-colors group/th">
                  <div className="flex items-center gap-1">
                    Projektstatus
                    {sortCol === 'projektstatus'
                      ? sortDir === 'asc' ? <ArrowUp size={10} className="text-fg shrink-0" /> : <ArrowDown size={10} className="text-fg shrink-0" />
                      : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                    }
                  </div>
                </th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted select-none">Signering</th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted select-none">Påminnelse</th>
                {([
                  ['status', 'Status', 'px-4'],
                  ['giltig_till', 'Giltig till', 'px-4'],
                ] as [string, string, string][]).map(([col, label, px]) => (
                  <th key={col} onClick={() => handleSort(col)}
                    className={`${px} py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted cursor-pointer select-none hover:text-fg transition-colors group/th`}>
                    <div className="flex items-center gap-1">
                      {label}
                      {sortCol === col
                        ? sortDir === 'asc' ? <ArrowUp size={10} className="text-fg shrink-0" /> : <ArrowDown size={10} className="text-fg shrink-0" />
                        : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                      }
                    </div>
                  </th>
                ))}
                <th onClick={() => handleSort('skapad_at')}
                  className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted cursor-pointer select-none hover:text-fg transition-colors group/th">
                  <div className="flex items-center gap-1">
                    Skapad
                    {sortCol === 'skapad_at'
                      ? sortDir === 'asc' ? <ArrowUp size={10} className="text-fg shrink-0" /> : <ArrowDown size={10} className="text-fg shrink-0" />
                      : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                    }
                  </div>
                </th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => {
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
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <KundPopover kund={f.projekt.kunder} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <span className="font-mono text-xs text-muted">{f.projekt.projekt_nummer}</span>
                    {onClickProjekt ? (
                      <button
                        onClick={() => onClickProjekt(f.projekt_id)}
                        className="ml-2 text-fg hover:text-emerald-400 hover:underline transition-colors"
                      >
                        {f.projekt.namn}
                      </button>
                    ) : (
                      <span className="ml-2 text-fg">{f.projekt.namn}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(() => {
                      const ps = projektStatusar.find((s) => s.namn === f.projekt.status)
                      const farg = ps?.farg ?? 'muted'
                      return (
                        <div className="inline-flex items-center gap-1.5">
                          <span className={`size-1.5 rounded-full shrink-0 ${PROJEKT_FARG_DOT[farg] ?? 'bg-muted'}`} />
                          <span className={`text-xs ${PROJEKT_FARG_TEXT[farg] ?? 'text-muted'}`}>{f.projekt.status}</span>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3"><SigneringLog summary={signingEvents[f.id]} /></td>
                  <td className="px-4 py-3"><PaminnelseCell historik={signingEvents[f.id]?.paminnelse_historik} /></td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <StatusPicker forslag={f} statusar={statusar} onStatusChange={onStatusChange} />
                  </td>
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                    {f.giltig_till ? new Date(f.giltig_till).toLocaleDateString('sv-SE') : '—'}
                  </td>
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
