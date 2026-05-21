import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { RefreshButton } from '@/components/RefreshButton'
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, X, MapPin, Link,
  Check, CheckCircle2, Circle, Clock, Trash2, FolderOpen, Paperclip, File, FileText, Image as ImageIcon, LayoutList, Pencil, Download,
  MoreHorizontal, Share2, Eraser, Palette, Mail,
} from 'lucide-react'
import type { Kalender, KalenderDokument, KalenderEvent, KalenderVy, NyttEventForm } from './types'
import { buildKalenderDagHtml } from '@/pdf/buildKalenderDagHtml'

const DAGAR = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']
const DAGAR_FULL = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag']
const MANADER = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
]

const LOKAL_FARG = '#6366f1'

const VY_LABELS: Record<KalenderVy, string> = {
  '6manad': '6 månader', '3manad': '3 månader', manad: '1 månad',
  '3vecka': '3 veckor', '2vecka': '2 veckor', vecka: '1 vecka', dag: '1 dag',
}

const PROJEKT_FARGER = [
  '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16',
  '#14b8a6', '#a855f7', '#fb923c', '#4ade80',
]

const KUND_FARGER = [
  '#60a5fa', '#f472b6', '#34d399', '#fbbf24',
  '#a78bfa', '#fb7185', '#2dd4bf', '#facc15',
  '#818cf8', '#e879f9', '#38bdf8', '#a3e635',
]

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
  '#f97316', '#ec4899', '#84cc16', '#14b8a6', '#a855f7', '#fb923c',
]

const TIME_BANDS = [
  { id: 'natt',  label: 'Natt',   start: 0,  end: 6,  color: '#818cf8', dropHour: 0  },
  { id: 'morg',  label: 'Morgon', start: 6,  end: 12, color: '#fbbf24', dropHour: 8  },
  { id: 'midd',  label: 'Middag', start: 12, end: 14, color: '#34d399', dropHour: 12 },
  { id: 'eftm',  label: 'Eftm',   start: 14, end: 20, color: '#fb923c', dropHour: 14 },
  { id: 'kvall', label: 'Kväll',  start: 20, end: 24, color: '#a78bfa', dropHour: 20 },
] as const

function getProjektFarg(projektId: string, alleProjekt: ProjektRef[]): string {
  const projekt = alleProjekt.find(p => p.id === projektId)
  if (projekt?.kalender_farg) return projekt.kalender_farg
  const idx = alleProjekt.findIndex(p => p.id === projektId)
  return idx >= 0 ? PROJEKT_FARGER[idx % PROJEKT_FARGER.length] : LOKAL_FARG
}

function getKundFarg(kundId: string, kunder: KundRef[]): string {
  const kund = kunder.find(k => k.id === kundId)
  if (kund?.kalender_farg) return kund.kalender_farg
  const idx = kunder.findIndex(k => k.id === kundId)
  return idx >= 0 ? KUND_FARGER[idx % KUND_FARGER.length] : LOKAL_FARG
}

const EMPTY_FORM: NyttEventForm = {
  titel: '',
  beskrivning: '',
  plats: '',
  url: '',
  start: '',
  slut: '',
  hel_dag: false,
  kund_id: '',
  projekt_id: '',
  kalender_id: '',
  personal_id: '',
}

interface KundRef { id: string; namn: string; kalender_farg?: string | null }
interface ProjektRef { id: string; namn: string; projekt_nummer: string; kund_id: string; kalender_farg?: string | null }
interface AnstaelldRef { id: string; namn: string; status: string }

type IcsFilter =
  | { kalender_id: string }
  | { kund_id: string }
  | { projekt_id: string }
  | { lokal: true }
interface StagedFile { filePath: string; fileName: string; mimeType: string; size: number }

function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const days: Date[] = []
  for (let i = -startOffset; i < lastDay.getDate(); i++) {
    days.push(new Date(year, month, i + 1))
  }
  while (days.length % 7 !== 0) {
    const prev = days[days.length - 1]
    const next = new Date(prev)
    next.setDate(prev.getDate() + 1)
    days.push(next)
  }
  return days
}

function getWeekDays(anchor: Date): Date[] {
  const day = (anchor.getDay() + 6) % 7
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isSameDag(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function eventsPaDag(events: KalenderEvent[], dag: Date): KalenderEvent[] {
  return events.filter(e => {
    const start = new Date(e.start)
    const slut = new Date(e.slut)
    return (start <= dag && dag <= slut) || isSameDag(start, dag)
  })
}

function formatTid(iso: string): string {
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
}

function getVeckonummer(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseDateInput(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ─── EventPill ───────────────────────────────────────────────────────────────

function EventPill({
  event, onClick, onDragStart, selected,
}: {
  event: KalenderEvent
  onClick: (e: KalenderEvent) => void
  onDragStart?: (e: KalenderEvent) => void
  selected?: boolean
}) {
  return (
    <button
      draggable={!!onDragStart}
      onDragStart={ev => {
        ev.stopPropagation()
        ev.dataTransfer.effectAllowed = 'move'
        onDragStart?.(event)
      }}
      onClick={ev => { ev.stopPropagation(); onClick(event) }}
      title={event.titel}
      className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] truncate leading-snug transition-opacity hover:opacity-80 ${onDragStart ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${event.slutford ? 'line-through opacity-50' : ''}`}
      style={{
        backgroundColor: selected ? `${event.farg}55` : `${event.farg}25`,
        color: event.farg,
        borderLeft: `2px solid ${event.farg}`,
        boxShadow: selected ? `0 0 0 2px ${event.farg}` : undefined,
      }}
    >
      {!event.hel_dag && <span className="opacity-70 mr-1">{formatTid(event.start)}</span>}
      {event.titel}
    </button>
  )
}

// ─── MultiVeckaGrid ──────────────────────────────────────────────────────────

function MultiVeckaGrid({
  anchor, numVeckor, events, valtDag, onValjDag, onValjEvent, onDragStart, onDrop, selectedIds,
}: {
  anchor: Date; numVeckor: number; events: KalenderEvent[]
  valtDag: Date | null; onValjDag: (d: Date) => void; onValjEvent: (e: KalenderEvent) => void
  onDragStart?: (e: KalenderEvent) => void
  onDrop: (dag: Date, bandHour?: number) => void
  selectedIds: Set<string>
}) {
  const idag = new Date()
  const days = useMemo(() => {
    const monday = getWeekDays(anchor)[0]
    return Array.from({ length: numVeckor * 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i); return d
    })
  }, [anchor, numVeckor])

  const veckor = useMemo(() => {
    const rows: Date[][] = []
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7))
    return rows
  }, [days])

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <div className="flex border-b border-border sticky top-0 bg-bg z-10 shrink-0">
        <div className="w-8 shrink-0 border-r border-border/40" />
        <div className="flex-1 grid grid-cols-7">
          {DAGAR.map(d => (
            <div key={d} className="py-2 text-center text-[11px] uppercase tracking-widest text-muted">{d}</div>
          ))}
        </div>
      </div>
      {veckor.map((vecka, wi) => (
        <div key={wi} className="flex border-b border-border flex-1 min-h-[80px]">
          <div className="w-8 shrink-0 border-r border-border/40 flex items-start justify-center pt-1.5">
            <span className="text-[10px] font-mono text-amber-400/70">{getVeckonummer(vecka[0])}</span>
          </div>
          <div className="flex-1 grid grid-cols-7">
            {vecka.map((dag, di) => {
              const erIdag = isSameDag(dag, idag)
              const erVald = valtDag ? isSameDag(dag, valtDag) : false
              const dagEvents = eventsPaDag(events, dag)
              return (
                <div
                  key={di}
                  onClick={() => onValjDag(dag)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => onDrop(dag)}
                  className={`border-r border-border/40 p-1 flex flex-col cursor-pointer transition-colors min-h-[160px] ${erVald ? 'bg-hover' : 'hover:bg-hover/40'}`}
                  style={erIdag && !erVald ? { backgroundColor: 'rgb(59 130 246 / 0.04)' } : undefined}
                >
                  <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full shrink-0 self-start
                    ${erIdag ? 'bg-blue-500 text-white font-semibold' : 'text-muted'}`}
                  >{dag.getDate()}</span>
                  {dagEvents.filter(e => e.hel_dag).map(e => (
                    <EventPill key={e.id} event={e} onClick={onValjEvent} onDragStart={onDragStart} selected={selectedIds.has(e.id)} />
                  ))}
                  {TIME_BANDS.map((band, gi) => {
                    const bandEvents = dagEvents.filter(e => {
                      if (e.hel_dag) return false
                      const h = new Date(e.start).getHours()
                      return h >= band.start && h < band.end
                    }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                    return (
                      <div
                        key={band.id}
                        className={`flex-1 flex flex-col gap-0.5 pt-1 pb-0.5 ${gi > 0 ? 'border-t border-border/50' : ''}`}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.stopPropagation(); e.preventDefault(); onDrop(dag, band.dropHour) }}
                      >
                        <span className="text-[8px] uppercase tracking-widest leading-none px-0.5 mb-0.5 text-muted">{band.label}</span>
                        {bandEvents.slice(0, 3).map(e => (
                          <EventPill key={e.id} event={e} onClick={onValjEvent} onDragStart={onDragStart} selected={selectedIds.has(e.id)} />
                        ))}
                        {bandEvents.length > 3 && <span className="text-[10px] text-muted px-0.5">+{bandEvents.length - 3}</span>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── ManadGrid ───────────────────────────────────────────────────────────────

function d0(date: Date): Date { const d = new Date(date); d.setHours(0, 0, 0, 0); return d }

function veckaSpan(e: KalenderEvent, vecka: Date[]): { startCol: number; endCol: number; visarTitel: boolean } {
  const eStart = d0(new Date(e.start))
  const eSlut  = d0(new Date(e.slut))
  const wStart = d0(vecka[0])
  const wSlut  = d0(vecka[6])
  const effStart = eStart < wStart ? wStart : eStart
  const effSlut  = eSlut  > wSlut  ? wSlut  : eSlut
  const startCol = vecka.findIndex(d => d0(d).getTime() === effStart.getTime())
  const endCol   = vecka.findIndex(d => d0(d).getTime() === effSlut.getTime())
  return {
    startCol: startCol >= 0 ? startCol : 0,
    endCol:   endCol   >= 0 ? endCol   : 6,
    visarTitel: eStart.getTime() >= wStart.getTime(),
  }
}

function ManadGrid({
  ar, manad, events, valtDag, onValjDag, onValjEvent, onDragStart, onDrop, selectedIds,
}: {
  ar: number; manad: number; events: KalenderEvent[]
  valtDag: Date | null; onValjDag: (d: Date) => void; onValjEvent: (e: KalenderEvent) => void
  onDragStart?: (e: KalenderEvent) => void
  onDrop: (dag: Date) => void
  selectedIds: Set<string>
}) {
  const idag = new Date()
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const dagar = useMemo(() => getMonthGrid(ar, manad), [ar, manad])
  const veckor = useMemo(() => {
    const rows: Date[][] = []
    for (let i = 0; i < dagar.length; i += 7) rows.push(dagar.slice(i, i + 7))
    return rows
  }, [dagar])

  // Separate multi-day events (span more than 1 day) from single-day
  const multiDagEvents = useMemo(() =>
    events.filter(e => !isSameDag(new Date(e.start), new Date(e.slut))),
    [events]
  )
  const enDagEvents = useMemo(() =>
    events.filter(e => isSameDag(new Date(e.start), new Date(e.slut))),
    [events]
  )

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Header */}
      <div className="flex border-b border-border sticky top-0 bg-bg z-10 shrink-0">
        <div className="w-8 shrink-0 border-r border-border/40" />
        <div className="flex-1 grid grid-cols-7">
          {DAGAR.map(d => (
            <div key={d} className="py-2 text-center text-[11px] uppercase tracking-widest text-muted">{d}</div>
          ))}
        </div>
      </div>

      {veckor.map((vecka, wi) => {
        const wStart = d0(vecka[0])
        const wSlut  = d0(vecka[6])

        // Multi-day events visible in this week
        const veckaMultiDag = multiDagEvents.filter(e => {
          const s = d0(new Date(e.start)); const sl = d0(new Date(e.slut))
          return s <= wSlut && sl >= wStart
        })

        return (
          <div key={wi} className="flex border-b border-border flex-1 min-h-[80px]">
            {/* Week number */}
            <div className="w-8 shrink-0 border-r border-border/40 flex items-start justify-center pt-1.5">
              <span className="text-[10px] font-mono text-amber-400/70">{getVeckonummer(vecka[0])}</span>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              {/* ── Multi-day event bars ── */}
              {veckaMultiDag.length > 0 && (
                <div
                  className="grid grid-cols-7 shrink-0"
                  style={{ gridTemplateRows: `repeat(${veckaMultiDag.length}, 18px)`, paddingTop: 2, paddingBottom: 2, gap: '2px 0' }}
                >
                  {veckaMultiDag.map((e, lane) => {
                    const { startCol, endCol, visarTitel } = veckaSpan(e, vecka)
                    const roundedL = visarTitel ? 'rounded-l' : ''
                    const roundedR = d0(new Date(e.slut)) <= wSlut ? 'rounded-r' : ''
                    const erVald = selectedIds.has(e.id)
                    return (
                      <button
                        key={e.id}
                        onClick={ev => { ev.stopPropagation(); onValjEvent(e) }}
                        title={e.titel}
                        style={{
                          gridColumn: `${startCol + 1} / ${endCol + 2}`,
                          gridRow: lane + 1,
                          backgroundColor: erVald ? `${e.farg}55` : `${e.farg}28`,
                          color: e.farg,
                          borderLeft: visarTitel ? `2px solid ${e.farg}` : 'none',
                          marginLeft: startCol === 0 && !visarTitel ? 0 : 2,
                          marginRight: endCol === 6 ? 0 : 2,
                          boxShadow: erVald ? `0 0 0 2px ${e.farg}` : undefined,
                        }}
                        className={`text-[10px] px-1.5 leading-[18px] text-left hover:opacity-80 transition-opacity overflow-hidden flex items-center gap-1 ${roundedL} ${roundedR} ${e.slutford ? 'line-through opacity-50' : ''}`}
                      >
                        {visarTitel && e.fas_id && <LayoutList size={9} className="shrink-0 opacity-70" />}
                        <span className="truncate">{visarTitel ? e.titel : ''}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* ── Single-day cells ── */}
              <div className="flex-1 grid grid-cols-7">
                {vecka.map((dag, i) => {
                  const erDennaManad = dag.getMonth() === manad
                  const erIdag = isSameDag(dag, idag)
                  const erVald = valtDag ? isSameDag(dag, valtDag) : false
                  const dagEvents = enDagEvents.filter(e => isSameDag(new Date(e.start), dag))
                  const dagKey = dag.toDateString()
                  const erDragOver = dragOverKey === dagKey
                  return (
                    <div
                      key={i}
                      onClick={() => onValjDag(dag)}
                      onDragEnter={e => { e.preventDefault(); setDragOverKey(dagKey) }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverKey(null) }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); setDragOverKey(null); onDrop(dag) }}
                      className={`border-r border-border p-1 flex flex-col gap-0.5 cursor-pointer transition-colors overflow-hidden
                        ${erDragOver ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/30' : erVald ? 'bg-hover' : 'hover:bg-hover/50'}
                        ${i === 6 ? 'border-r-0' : ''}`}
                    >
                      <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full shrink-0 self-start
                        ${erIdag ? 'bg-blue-500 text-white font-semibold' : erDennaManad ? 'text-fg' : 'text-subtle'}`}
                      >
                        {dag.getDate()}
                      </span>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {dagEvents.slice(0, 3).map(e => (
                          <EventPill key={e.id} event={e} onClick={onValjEvent} onDragStart={onDragStart} selected={selectedIds.has(e.id)} />
                        ))}
                        {dagEvents.length > 3 && (
                          <span className="text-[10px] text-muted px-1">+{dagEvents.length - 3} till</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Overlap layout ──────────────────────────────────────────────────────────

function assignOverlapLayout(events: KalenderEvent[]): Map<string, { left: number; width: number }> {
  if (events.length === 0) return new Map()

  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  const result = new Map<string, { left: number; width: number }>()

  // Group into clusters of overlapping events
  const clusters: KalenderEvent[][] = []
  let cluster: KalenderEvent[] = []
  let clusterEnd = 0

  for (const ev of sorted) {
    const start = new Date(ev.start).getTime()
    const end = new Date(ev.slut).getTime()
    if (cluster.length === 0 || start < clusterEnd) {
      cluster.push(ev)
      clusterEnd = Math.max(clusterEnd, end)
    } else {
      clusters.push(cluster)
      cluster = [ev]
      clusterEnd = end
    }
  }
  if (cluster.length > 0) clusters.push(cluster)

  for (const grp of clusters) {
    const cols: KalenderEvent[][] = []
    for (const ev of grp) {
      const startT = new Date(ev.start).getTime()
      let placed = false
      for (let c = 0; c < cols.length; c++) {
        if (new Date(cols[c][cols[c].length - 1].slut).getTime() <= startT) {
          cols[c].push(ev)
          placed = true
          break
        }
      }
      if (!placed) cols.push([ev])
    }
    const n = cols.length
    cols.forEach((col, ci) => {
      col.forEach(ev => result.set(ev.id, { left: ci / n, width: 1 / n }))
    })
  }

  return result
}

// ─── VeckaGrid ───────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 60

function VeckaGrid({
  anchor, events, onValjEvent, onValjDag, onDragStart, onDrop, onResize, selectedIds,
}: {
  anchor: Date; events: KalenderEvent[]
  onValjEvent: (e: KalenderEvent) => void; onValjDag: (d: Date, withTime?: boolean) => void
  onDragStart?: (e: KalenderEvent) => void
  onDrop: (dag: Date, withTime: boolean) => void
  onResize?: (e: KalenderEvent, newSlut: Date) => void
  selectedIds: Set<string>
}) {
  const idag = new Date()
  const vecka = useMemo(() => getWeekDays(anchor), [anchor])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [nuTid, setNuTid] = useState(new Date())
  const [scrollbarW, setScrollbarW] = useState(0)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const grabOffsetY = useRef(0)
  const draggingVeckaEvent = useRef<KalenderEvent | null>(null)
  const [dragPreview, setDragPreview] = useState<{
    dayIdx: number; topPx: number; heightPx: number; farg: string
  } | null>(null)
  const resizeRef = useRef<{ event: KalenderEvent; startY: number; initialHeightPx: number; currentHeightPx: number } | null>(null)
  const [resizePreview, setResizePreview] = useState<{ id: string; heightPx: number } | null>(null)
  const resizeCleanupRef = useRef<(() => void) | null>(null)

  function startResize(ev: React.MouseEvent, e: KalenderEvent) {
    if (!onResize) return
    ev.stopPropagation()
    ev.preventDefault()
    const start = new Date(e.start)
    const slut = new Date(e.slut)
    const initialHeightPx = Math.max((slut.getTime() - start.getTime()) / 3_600_000 * HOUR_HEIGHT, 22)
    resizeRef.current = { event: e, startY: ev.clientY, initialHeightPx, currentHeightPx: initialHeightPx }
    setResizePreview({ id: e.id, heightPx: initialHeightPx })

    const onMove = (mev: MouseEvent) => {
      if (!resizeRef.current) return
      const dy = mev.clientY - resizeRef.current.startY
      const snapStep = HOUR_HEIGHT / 4
      const minHeight = snapStep
      const newRaw = resizeRef.current.initialHeightPx + dy
      const snapped = Math.max(minHeight, Math.round(newRaw / snapStep) * snapStep)
      resizeRef.current.currentHeightPx = snapped
      setResizePreview({ id: resizeRef.current.event.id, heightPx: snapped })
    }
    const onUp = () => {
      if (resizeRef.current) {
        const ev2 = resizeRef.current.event
        const minutes = Math.round(resizeRef.current.currentHeightPx / HOUR_HEIGHT * 60 / 15) * 15
        const newSlut = new Date(ev2.start)
        newSlut.setMinutes(newSlut.getMinutes() + Math.max(15, minutes))
        onResize(ev2, newSlut)
      }
      resizeRef.current = null
      setResizePreview(null)
      resizeCleanupRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    const cleanup = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      resizeRef.current = null
      setResizePreview(null)
    }
    resizeCleanupRef.current = cleanup
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date()
      scrollRef.current.scrollTop = Math.max(0, (now.getHours() - 1) * HOUR_HEIGHT)
    }
  }, [anchor])

  useEffect(() => {
    const timer = setInterval(() => setNuTid(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    function measure() {
      if (scrollRef.current)
        setScrollbarW(scrollRef.current.offsetWidth - scrollRef.current.clientWidth)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const onBlur = () => {
      resizeCleanupRef.current?.()
      resizeCleanupRef.current = null
      draggingVeckaEvent.current = null
      setDragPreview(null)
      setDragOverKey(null)
    }
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('blur', onBlur)
      resizeCleanupRef.current?.()
    }
  }, [])

  const helDagEvents = useMemo(() =>
    events.filter(e => e.hel_dag || !isSameDag(new Date(e.start), new Date(e.slut))),
    [events]
  )
  const tidEvents = useMemo(() =>
    events.filter(e => !e.hel_dag && isSameDag(new Date(e.start), new Date(e.slut))),
    [events]
  )

  const overlapLayout = useMemo(() => {
    const map = new Map<string, { left: number; width: number }>()
    vecka.forEach(dag => {
      const dayEvs = tidEvents.filter(e => isSameDag(new Date(e.start), dag))
      assignOverlapLayout(dayEvs).forEach((v, k) => map.set(k, v))
    })
    return map
  }, [tidEvents, vecka])

  function calcDropTime(ev: React.DragEvent<HTMLDivElement>): { hours: number; minutes: number } {
    const rect = ev.currentTarget.getBoundingClientRect()
    const relY = ev.clientY - rect.top - grabOffsetY.current
    const clamped = Math.max(0, Math.min(relY, 24 * HOUR_HEIGHT - 1))
    const totalMinutes = Math.round((clamped / HOUR_HEIGHT) * 60 / 15) * 15
    const clampedMinutes = Math.min(totalMinutes, 23 * 60 + 45)
    return { hours: Math.floor(clampedMinutes / 60), minutes: clampedMinutes % 60 }
  }

  function calcClickTime(ev: React.MouseEvent<HTMLDivElement>): { hours: number; minutes: number } {
    const rect = ev.currentTarget.getBoundingClientRect()
    const relY = ev.clientY - rect.top
    const clamped = Math.max(0, Math.min(relY, 24 * HOUR_HEIGHT - 1))
    const totalMinutes = Math.round((clamped / HOUR_HEIGHT) * 60 / 15) * 15
    const clampedMinutes = Math.min(totalMinutes, 23 * 60 + 45)
    return { hours: Math.floor(clampedMinutes / 60), minutes: clampedMinutes % 60 }
  }

  const nuTop = (nuTid.getHours() + nuTid.getMinutes() / 60) * HOUR_HEIGHT

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-border shrink-0 bg-sidebar" style={{ paddingRight: scrollbarW }}>
        <div className="w-14 shrink-0 border-r border-border/40" />
        {vecka.map((dag, i) => {
          const erIdag = isSameDag(dag, idag)
          return (
            <div
              key={i}
              onClick={() => onValjDag(dag)}
              className={`flex-1 py-2 text-center cursor-pointer hover:bg-hover/50 transition-colors ${i < 6 ? 'border-r border-border' : ''}`}
            >
              <span className="text-[11px] uppercase tracking-widest text-muted block">{DAGAR[i]}</span>
              <span className={`text-sm w-7 h-7 flex items-center justify-center rounded-full mx-auto mt-0.5
                ${erIdag ? 'bg-blue-500 text-white font-semibold' : 'text-fg'}`}
              >
                {dag.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* All-day row — only when needed */}
      {helDagEvents.length > 0 && (
        <div className="flex border-b border-border shrink-0" style={{ paddingRight: scrollbarW }}>
          <div className="w-14 shrink-0 border-r border-border/40 flex items-center justify-end pr-2">
            <span className="text-[9px] uppercase tracking-widest text-subtle">Heldag</span>
          </div>
          {vecka.map((dag, i) => {
            const dagHelDag = helDagEvents.filter(e => {
              const s = new Date(e.start); const sl = new Date(e.slut)
              return isSameDag(s, dag) || (s <= dag && dag <= sl)
            })
            return (
              <div key={i} className={`flex-1 p-1 min-h-[28px] flex flex-col gap-0.5 ${i < 6 ? 'border-r border-border' : ''}`}>
                {dagHelDag.map(e => <EventPill key={e.id} event={e} onClick={onValjEvent} selected={selectedIds.has(e.id)} />)}
              </div>
            )
          })}
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ height: `${24 * HOUR_HEIGHT}px` }}>

          {/* Hour labels */}
          <div className="w-14 shrink-0 border-r border-border/40 relative select-none">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-subtle leading-none"
                style={{ top: `${h * HOUR_HEIGHT - 6}px` }}
              >
                {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {vecka.map((dag, i) => {
            const erIdag = isSameDag(dag, idag)
            const dagTidEvents = tidEvents.filter(e => isSameDag(new Date(e.start), dag))
            const dagKey = dag.toDateString()
            const erDragOver = dragOverKey === dagKey
            return (
              <div
                key={i}
                onClick={(ev) => {
                  const { hours, minutes } = calcClickTime(ev)
                  const d = new Date(dag)
                  d.setHours(hours, minutes, 0, 0)
                  onValjDag(d, true)
                }}
                onDragEnter={e => { e.preventDefault(); setDragOverKey(dagKey) }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverKey(null)
                    setDragPreview(null)
                  }
                }}
                onDragOver={ev => {
                  ev.preventDefault()
                  setDragOverKey(dagKey)
                  if (!draggingVeckaEvent.current) return
                  const { hours, minutes } = calcDropTime(ev)
                  const durationMs = new Date(draggingVeckaEvent.current.slut).getTime() - new Date(draggingVeckaEvent.current.start).getTime()
                  setDragPreview({
                    dayIdx: i,
                    topPx: (hours + minutes / 60) * HOUR_HEIGHT,
                    heightPx: Math.max(durationMs / 3_600_000 * HOUR_HEIGHT, 22),
                    farg: draggingVeckaEvent.current.farg,
                  })
                }}
                onDrop={ev => {
                  ev.preventDefault()
                  setDragOverKey(null)
                  setDragPreview(null)
                  if (draggingVeckaEvent.current) {
                    const { hours, minutes } = calcDropTime(ev)
                    const dropDate = new Date(dag)
                    dropDate.setHours(hours, minutes, 0, 0)
                    onDrop(dropDate, true)
                  } else {
                    onDrop(dag, false)
                  }
                  draggingVeckaEvent.current = null
                }}
                className={`flex-1 relative cursor-pointer ${i < 6 ? 'border-r border-border' : ''}`}
                style={{
                  backgroundColor: erDragOver
                    ? 'rgb(59 130 246 / 0.10)'
                    : erIdag
                      ? 'rgb(59 130 246 / 0.04)'
                      : undefined,
                  outline: erDragOver ? '1px solid rgb(59 130 246 / 0.3)' : undefined,
                  outlineOffset: '-1px',
                }}
              >
                {/* Hour lines */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/30 pointer-events-none"
                    style={{ top: `${h * HOUR_HEIGHT}px` }} />
                ))}
                {/* Half-hour lines */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={`hh${h}`} className="absolute inset-x-0 border-t border-border/15 pointer-events-none"
                    style={{ top: `${h * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
                ))}

                {/* Current time indicator */}
                {erIdag && (
                  <div className="absolute inset-x-0 z-10 pointer-events-none flex items-center"
                    style={{ top: `${nuTop}px` }}>
                    <div className="w-2 h-2 rounded-full bg-red-400 shrink-0 -ml-1" />
                    <div className="flex-1 h-px bg-red-400" />
                  </div>
                )}

                {/* Drag preview ghost */}
                {dragPreview?.dayIdx === i && (
                  <div
                    className="absolute left-0.5 right-0.5 rounded pointer-events-none"
                    style={{
                      top: `${dragPreview.topPx}px`,
                      height: `${dragPreview.heightPx}px`,
                      backgroundColor: `${dragPreview.farg}15`,
                      border: `1px dashed ${dragPreview.farg}`,
                    }}
                  />
                )}

                {/* Events */}
                {dagTidEvents.map(e => {
                  const start = new Date(e.start)
                  const slut = new Date(e.slut)
                  const top = (start.getHours() + start.getMinutes() / 60) * HOUR_HEIGHT
                  const durationH = (slut.getTime() - start.getTime()) / (1000 * 60 * 60)
                  const baseHeight = Math.max(durationH * HOUR_HEIGHT, 22)
                  const height = resizePreview?.id === e.id ? resizePreview.heightPx : baseHeight
                  const { left, width } = overlapLayout.get(e.id) ?? { left: 0, width: 1 }
                  const erVald = selectedIds.has(e.id)
                  const resizable = !!onResize
                  return (
                    <div
                      key={e.id}
                      className="absolute group"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `calc(${left * 100}% + 2px)`,
                        width: `calc(${width * 100}% - 4px)`,
                      }}
                    >
                      <button
                        draggable={!!onDragStart}
                        onDragStart={ev => {
                          if (!onDragStart) return
                          ev.stopPropagation()
                          ev.dataTransfer.effectAllowed = 'move'
                          grabOffsetY.current = ev.nativeEvent.offsetY
                          draggingVeckaEvent.current = e
                          onDragStart(e)
                        }}
                        onDragEnd={() => {
                          draggingVeckaEvent.current = null
                          setDragPreview(null)
                        }}
                        onClick={ev => { ev.stopPropagation(); onValjEvent(e) }}
                        className={`absolute inset-0 rounded px-1.5 py-0.5 text-left overflow-hidden hover:opacity-80 transition-opacity ${onDragStart ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${e.slutford ? 'line-through opacity-50' : ''}`}
                        style={{
                          backgroundColor: erVald ? `${e.farg}55` : `${e.farg}22`,
                          color: e.farg,
                          borderLeft: `2px solid ${e.farg}`,
                          boxShadow: erVald ? `0 0 0 2px ${e.farg}` : undefined,
                        }}
                      >
                        <span className="text-[11px] font-medium leading-tight block truncate">{e.titel}</span>
                        {height > 36 && (
                          <span className="text-[10px] opacity-70">{formatTid(e.start)} – {formatTid(e.slut)}</span>
                        )}
                      </button>
                      {resizable && (
                        <div
                          onMouseDown={ev => startResize(ev, e)}
                          onClick={ev => ev.stopPropagation()}
                          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ backgroundColor: e.farg }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── DagGrid ─────────────────────────────────────────────────────────────────

function DagGrid({
  anchor, events, onValjEvent, onValjDag, onDragStart, onDrop, onResize, selectedIds,
}: {
  anchor: Date; events: KalenderEvent[]
  onValjEvent: (e: KalenderEvent) => void; onValjDag: (d: Date, withTime?: boolean) => void
  onDragStart?: (e: KalenderEvent) => void
  onDrop: (dag: Date, withTime: boolean) => void
  onResize?: (e: KalenderEvent, newSlut: Date) => void
  selectedIds: Set<string>
}) {
  const idag = new Date()
  const dag = useMemo(() => {
    const d = new Date(anchor)
    d.setHours(0, 0, 0, 0)
    return d
  }, [anchor])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [nuTid, setNuTid] = useState(new Date())
  const [scrollbarW, setScrollbarW] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const grabOffsetY = useRef(0)
  const draggingEvent = useRef<KalenderEvent | null>(null)
  const [dragPreview, setDragPreview] = useState<{ topPx: number; heightPx: number; farg: string } | null>(null)
  const resizeRef = useRef<{ event: KalenderEvent; startY: number; initialHeightPx: number; currentHeightPx: number } | null>(null)
  const [resizePreview, setResizePreview] = useState<{ id: string; heightPx: number } | null>(null)
  const resizeCleanupRef = useRef<(() => void) | null>(null)

  function startResize(ev: React.MouseEvent, e: KalenderEvent) {
    if (!onResize) return
    ev.stopPropagation()
    ev.preventDefault()
    const start = new Date(e.start)
    const slut = new Date(e.slut)
    const initialHeightPx = Math.max((slut.getTime() - start.getTime()) / 3_600_000 * HOUR_HEIGHT, 22)
    resizeRef.current = { event: e, startY: ev.clientY, initialHeightPx, currentHeightPx: initialHeightPx }
    setResizePreview({ id: e.id, heightPx: initialHeightPx })

    const onMove = (mev: MouseEvent) => {
      if (!resizeRef.current) return
      const dy = mev.clientY - resizeRef.current.startY
      const snapStep = HOUR_HEIGHT / 4
      const minHeight = snapStep
      const newRaw = resizeRef.current.initialHeightPx + dy
      const snapped = Math.max(minHeight, Math.round(newRaw / snapStep) * snapStep)
      resizeRef.current.currentHeightPx = snapped
      setResizePreview({ id: resizeRef.current.event.id, heightPx: snapped })
    }
    const onUp = () => {
      if (resizeRef.current) {
        const ev2 = resizeRef.current.event
        const minutes = Math.round(resizeRef.current.currentHeightPx / HOUR_HEIGHT * 60 / 15) * 15
        const newSlut = new Date(ev2.start)
        newSlut.setMinutes(newSlut.getMinutes() + Math.max(15, minutes))
        onResize(ev2, newSlut)
      }
      resizeRef.current = null
      setResizePreview(null)
      resizeCleanupRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    const cleanup = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      resizeRef.current = null
      setResizePreview(null)
    }
    resizeCleanupRef.current = cleanup
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date()
      scrollRef.current.scrollTop = Math.max(0, (now.getHours() - 1) * HOUR_HEIGHT)
    }
  }, [anchor])

  useEffect(() => {
    const timer = setInterval(() => setNuTid(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    function measure() {
      if (scrollRef.current)
        setScrollbarW(scrollRef.current.offsetWidth - scrollRef.current.clientWidth)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const onBlur = () => {
      resizeCleanupRef.current?.()
      resizeCleanupRef.current = null
      draggingEvent.current = null
      setDragPreview(null)
      setDragOver(false)
    }
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('blur', onBlur)
      resizeCleanupRef.current?.()
    }
  }, [])

  const helDagEvents = useMemo(() =>
    events.filter(e => {
      const s = new Date(e.start); const sl = new Date(e.slut)
      return isSameDag(s, dag) || (e.hel_dag && s <= dag && dag <= sl)
    }).filter(e => e.hel_dag || !isSameDag(new Date(e.start), new Date(e.slut))),
    [events, dag]
  )
  const tidEvents = useMemo(() =>
    events.filter(e => !e.hel_dag && isSameDag(new Date(e.start), dag)),
    [events, dag]
  )

  const overlapLayout = useMemo(() => assignOverlapLayout(tidEvents), [tidEvents])

  function calcDropTime(ev: React.DragEvent<HTMLDivElement>): { hours: number; minutes: number } {
    const rect = ev.currentTarget.getBoundingClientRect()
    const relY = ev.clientY - rect.top - grabOffsetY.current
    const clamped = Math.max(0, Math.min(relY, 24 * HOUR_HEIGHT - 1))
    const totalMinutes = Math.round((clamped / HOUR_HEIGHT) * 60 / 15) * 15
    const clampedMinutes = Math.min(totalMinutes, 23 * 60 + 45)
    return { hours: Math.floor(clampedMinutes / 60), minutes: clampedMinutes % 60 }
  }

  function calcClickTime(ev: React.MouseEvent<HTMLDivElement>): { hours: number; minutes: number } {
    const rect = ev.currentTarget.getBoundingClientRect()
    const relY = ev.clientY - rect.top
    const clamped = Math.max(0, Math.min(relY, 24 * HOUR_HEIGHT - 1))
    const totalMinutes = Math.round((clamped / HOUR_HEIGHT) * 60 / 15) * 15
    const clampedMinutes = Math.min(totalMinutes, 23 * 60 + 45)
    return { hours: Math.floor(clampedMinutes / 60), minutes: clampedMinutes % 60 }
  }

  const erIdag = isSameDag(dag, idag)
  const nuTop = (nuTid.getHours() + nuTid.getMinutes() / 60) * HOUR_HEIGHT
  const dagIdx = (dag.getDay() + 6) % 7

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-border shrink-0 bg-sidebar" style={{ paddingRight: scrollbarW }}>
        <div className="w-14 shrink-0 border-r border-border/40" />
        <div className="flex-1 py-3 px-4 flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-widest text-muted">{DAGAR_FULL[dagIdx]}</span>
          <span className={`text-sm w-7 h-7 flex items-center justify-center rounded-full font-semibold
            ${erIdag ? 'bg-blue-500 text-white' : 'text-fg'}`}
          >
            {dag.getDate()}
          </span>
          {tidEvents.length > 0 && (
            <span className="text-[10px] text-subtle ml-auto">{tidEvents.length} händelse{tidEvents.length !== 1 ? 'r' : ''}</span>
          )}
        </div>
      </div>

      {/* All-day row */}
      {helDagEvents.length > 0 && (
        <div className="flex border-b border-border shrink-0" style={{ paddingRight: scrollbarW }}>
          <div className="w-14 shrink-0 border-r border-border/40 flex items-center justify-end pr-2">
            <span className="text-[9px] uppercase tracking-widest text-subtle">Heldag</span>
          </div>
          <div className="flex-1 p-1 flex flex-col gap-0.5">
            {helDagEvents.map(e => <EventPill key={e.id} event={e} onClick={onValjEvent} selected={selectedIds.has(e.id)} />)}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ height: `${24 * HOUR_HEIGHT}px` }}>

          {/* Hour labels */}
          <div className="w-14 shrink-0 border-r border-border/40 relative select-none">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-subtle leading-none"
                style={{ top: `${h * HOUR_HEIGHT - 6}px` }}
              >
                {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>

          {/* Single day column */}
          <div
            onClick={(ev) => {
              const { hours, minutes } = calcClickTime(ev)
              const d = new Date(dag)
              d.setHours(hours, minutes, 0, 0)
              onValjDag(d, true)
            }}
            onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOver(false)
                setDragPreview(null)
              }
            }}
            onDragOver={ev => {
              ev.preventDefault()
              setDragOver(true)
              if (!draggingEvent.current) return
              const { hours, minutes } = calcDropTime(ev)
              const durationMs = new Date(draggingEvent.current.slut).getTime() - new Date(draggingEvent.current.start).getTime()
              setDragPreview({
                topPx: (hours + minutes / 60) * HOUR_HEIGHT,
                heightPx: Math.max(durationMs / 3_600_000 * HOUR_HEIGHT, 22),
                farg: draggingEvent.current.farg,
              })
            }}
            onDrop={ev => {
              ev.preventDefault()
              setDragOver(false)
              setDragPreview(null)
              if (draggingEvent.current) {
                const { hours, minutes } = calcDropTime(ev)
                const dropDate = new Date(dag)
                dropDate.setHours(hours, minutes, 0, 0)
                onDrop(dropDate, true)
              } else {
                onDrop(dag, false)
              }
              draggingEvent.current = null
            }}
            className="flex-1 relative cursor-pointer"
            style={{
              backgroundColor: dragOver
                ? 'rgb(59 130 246 / 0.10)'
                : erIdag
                  ? 'rgb(59 130 246 / 0.04)'
                  : undefined,
              outline: dragOver ? '1px solid rgb(59 130 246 / 0.3)' : undefined,
              outlineOffset: '-1px',
            }}
          >
            {/* Hour lines */}
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="absolute inset-x-0 border-t border-border/30 pointer-events-none"
                style={{ top: `${h * HOUR_HEIGHT}px` }} />
            ))}
            {/* Half-hour lines */}
            {Array.from({ length: 24 }, (_, h) => (
              <div key={`hh${h}`} className="absolute inset-x-0 border-t border-border/15 pointer-events-none"
                style={{ top: `${h * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
            ))}

            {/* Current time indicator */}
            {erIdag && (
              <div className="absolute inset-x-0 z-10 pointer-events-none flex items-center"
                style={{ top: `${nuTop}px` }}>
                <div className="w-2 h-2 rounded-full bg-red-400 shrink-0 -ml-1" />
                <div className="flex-1 h-px bg-red-400" />
              </div>
            )}

            {/* Drag preview ghost */}
            {dragPreview && (
              <div
                className="absolute left-0.5 right-0.5 rounded pointer-events-none"
                style={{
                  top: `${dragPreview.topPx}px`,
                  height: `${dragPreview.heightPx}px`,
                  backgroundColor: `${dragPreview.farg}15`,
                  border: `1px dashed ${dragPreview.farg}`,
                }}
              />
            )}

            {/* Events */}
            {tidEvents.map(e => {
              const start = new Date(e.start)
              const slut = new Date(e.slut)
              const top = (start.getHours() + start.getMinutes() / 60) * HOUR_HEIGHT
              const durationH = (slut.getTime() - start.getTime()) / (1000 * 60 * 60)
              const baseHeight = Math.max(durationH * HOUR_HEIGHT, 22)
              const height = resizePreview?.id === e.id ? resizePreview.heightPx : baseHeight
              const { left, width } = overlapLayout.get(e.id) ?? { left: 0, width: 1 }
              const erVald = selectedIds.has(e.id)
              const resizable = !!onResize
              return (
                <div
                  key={e.id}
                  className="absolute group"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    left: `calc(${left * 100}% + 2px)`,
                    width: `calc(${width * 100}% - 4px)`,
                  }}
                >
                  <button
                    draggable={!!onDragStart}
                    onDragStart={ev => {
                      if (!onDragStart) return
                      ev.stopPropagation()
                      ev.dataTransfer.effectAllowed = 'move'
                      grabOffsetY.current = ev.nativeEvent.offsetY
                      draggingEvent.current = e
                      onDragStart(e)
                    }}
                    onDragEnd={() => {
                      draggingEvent.current = null
                      setDragPreview(null)
                    }}
                    onClick={ev => { ev.stopPropagation(); onValjEvent(e) }}
                    className={`absolute inset-0 rounded px-1.5 py-0.5 text-left overflow-hidden hover:opacity-80 transition-opacity ${onDragStart ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${e.slutford ? 'line-through opacity-50' : ''}`}
                    style={{
                      backgroundColor: erVald ? `${e.farg}55` : `${e.farg}22`,
                      color: e.farg,
                      borderLeft: `2px solid ${e.farg}`,
                      boxShadow: erVald ? `0 0 0 2px ${e.farg}` : undefined,
                    }}
                  >
                    <span className="text-[11px] font-medium leading-tight block truncate">{e.titel}</span>
                    {height > 36 && (
                      <span className="text-[10px] opacity-70">{formatTid(e.start)} – {formatTid(e.slut)}</span>
                    )}
                  </button>
                  {resizable && (
                    <div
                      onMouseDown={ev => startResize(ev, e)}
                      onClick={ev => ev.stopPropagation()}
                      className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: e.farg }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SearchableSelect ────────────────────────────────────────────────────────

interface SearchableSelectOption {
  id: string
  label: string
  hint?: string
}

function SearchableSelect({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: SearchableSelectOption[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (!open) { setQuery(''); return }
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        ref.current && !ref.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleToggle() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(v => !v)
  }

  const filtered = query
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.hint ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : options

  const selected = options.find(o => o.id === value)

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-2 bg-elevated border border-border rounded-lg px-3 py-2 text-sm outline-none hover:border-fg/30 transition-colors"
      >
        <span className={`truncate ${selected ? 'text-fg' : 'text-subtle'}`}>
          {selected ? (
            <>
              {selected.hint && <span className="text-muted mr-1.5 font-mono text-xs">{selected.hint}</span>}
              <span>{selected.label}</span>
            </>
          ) : placeholder}
        </span>
        <ChevronDown size={12} className="text-muted shrink-0" />
      </button>

      {open && dropPos && (
        <div
          ref={ref}
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
          className="bg-elevated border border-border rounded-lg shadow-xl flex flex-col overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Sök…"
              className="w-full bg-transparent text-xs text-fg outline-none placeholder:text-subtle"
            />
          </div>
          <div className="max-h-64 overflow-auto py-1">
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs text-subtle hover:bg-hover transition-colors"
              >
                — Rensa val —
              </button>
            )}
            {filtered.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onChange(o.id); setOpen(false) }}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 text-xs hover:bg-hover transition-colors ${o.id === value ? 'text-fg font-medium bg-hover/50' : 'text-muted'}`}
              >
                {o.hint && <span className="text-subtle font-mono text-[11px] shrink-0">{o.hint}</span>}
                <span className="truncate">{o.label}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-subtle">Inga träffar</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TaskForm ────────────────────────────────────────────────────────────────

function TaskForm({
  onSpara, onStang, onAddFile, kunder, projekt, kalendrar, anstallda, initialStart, initialSlut,
}: {
  onSpara: (data: NyttEventForm, files: StagedFile[]) => Promise<void>
  onStang: () => void
  onAddFile: () => Promise<StagedFile | null>
  kunder: KundRef[]
  projekt: ProjektRef[]
  kalendrar: Kalender[]
  anstallda: AnstaelldRef[]
  initialStart: string
  initialSlut: string
}) {
  type Kopplingstyp = 'ingen' | 'kund' | 'projekt' | 'kalender' | 'anstalld'

  const [form, setForm] = useState<NyttEventForm>({
    ...EMPTY_FORM,
    start: initialStart,
    slut: initialSlut,
  })
  const [koppling, setKoppling] = useState<Kopplingstyp>('ingen')
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)

  function handleKoppling(typ: Kopplingstyp) {
    setKoppling(typ)
    if (typ === 'kund') {
      setForm(f => ({ ...f, projekt_id: '', kalender_id: '', personal_id: '' }))
    } else if (typ === 'projekt') {
      setForm(f => ({ ...f, kund_id: '', kalender_id: '', personal_id: '' }))
    } else if (typ === 'kalender') {
      setForm(f => ({ ...f, kund_id: '', projekt_id: '', personal_id: '' }))
    } else if (typ === 'anstalld') {
      setForm(f => ({ ...f, kund_id: '', projekt_id: '', kalender_id: '' }))
    } else {
      setForm(f => ({ ...f, kund_id: '', projekt_id: '', kalender_id: '', personal_id: '' }))
    }
  }

  async function handleAddFile() {
    const file = await onAddFile()
    if (file) setStagedFiles(fs => [...fs, file])
  }

  async function handleSubmit() {
    if (!form.titel || !form.start || !form.slut) return
    setSparar(true)
    setFel(null)
    try {
      await onSpara(form, stagedFiles)
    } catch (e) {
      setSparar(false)
      setFel(e instanceof Error ? e.message : 'Fel vid sparande')
    }
  }

  const KOPPLING_PILLS: { typ: Kopplingstyp; label: string }[] = [
    { typ: 'ingen', label: 'Ingen' },
    { typ: 'kund', label: 'Kund' },
    { typ: 'projekt', label: 'Projekt' },
    ...(kalendrar.length > 0 ? [{ typ: 'kalender' as const, label: 'Kalender' }] : []),
    ...(anstallda.length > 0 ? [{ typ: 'anstalld' as const, label: 'Anställd' }] : []),
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-medium text-fg">Ny task</span>
        <button onClick={onStang} className="p-1 rounded text-muted hover:text-fg hover:bg-hover">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-auto flex flex-col gap-4 px-4 py-4">
        {fel && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{fel}</div>}

        <input
          type="text"
          value={form.titel}
          onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
          placeholder="Titel"
          className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-fg/30 placeholder:text-subtle font-medium"
        />

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="hel_dag"
            checked={form.hel_dag}
            onChange={e => setForm(f => ({ ...f, hel_dag: e.target.checked }))}
            className="accent-blue-400"
          />
          <label htmlFor="hel_dag" className="text-sm text-fg">Heldag</label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-widest text-muted">Start</label>
            <input
              type={form.hel_dag ? 'date' : 'datetime-local'}
              value={form.start}
              onChange={e => setForm(f => ({ ...f, start: e.target.value }))}
              className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-widest text-muted">Slut</label>
            <input
              type={form.hel_dag ? 'date' : 'datetime-local'}
              value={form.slut}
              onChange={e => setForm(f => ({ ...f, slut: e.target.value }))}
              className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30"
            />
          </div>
        </div>

        {!form.hel_dag && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-widest text-muted">Längd</label>
            <div className="flex gap-1">
              {[15, 30, 45, 60].map(min => {
                const startDate = form.start ? new Date(form.start) : null
                const slutDate = form.slut ? new Date(form.slut) : null
                const aktiv = startDate && slutDate
                  && Math.round((slutDate.getTime() - startDate.getTime()) / 60000) === min
                return (
                  <button
                    key={min}
                    type="button"
                    onClick={() => {
                      if (!form.start) return
                      const s = new Date(form.start)
                      const e = new Date(s)
                      e.setMinutes(e.getMinutes() + min)
                      setForm(f => ({ ...f, slut: toLocalDatetimeInput(e) }))
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      aktiv
                        ? 'bg-elevated border-fg/30 text-fg'
                        : 'border-border text-muted hover:text-fg hover:bg-hover'
                    }`}
                  >
                    {min} min
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted">Koppling</label>
          <div className="flex gap-1">
            {KOPPLING_PILLS.map(({ typ, label }) => (
              <button
                key={typ}
                type="button"
                onClick={() => handleKoppling(typ)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  koppling === typ
                    ? 'bg-elevated border-fg/30 text-fg'
                    : 'border-border text-muted hover:text-fg hover:bg-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {koppling === 'kund' && (
          <>
            <SearchableSelect
              value={form.kund_id}
              onChange={v => setForm(f => ({ ...f, kund_id: v, projekt_id: '' }))}
              options={kunder.map(k => ({ id: k.id, label: k.namn }))}
              placeholder="— Välj kund —"
            />
            {form.kund_id && (() => {
              const kundProjekt = projekt.filter(p => p.kund_id === form.kund_id)
              if (kundProjekt.length === 0) return null
              return (
                <SearchableSelect
                  value={form.projekt_id}
                  onChange={v => setForm(f => ({ ...f, projekt_id: v }))}
                  options={kundProjekt.map(p => ({ id: p.id, label: p.namn, hint: p.projekt_nummer }))}
                  placeholder="— Koppla till projekt (valfritt) —"
                />
              )
            })()}
          </>
        )}

        {koppling === 'projekt' && (
          <SearchableSelect
            value={form.projekt_id}
            onChange={v => setForm(f => ({ ...f, projekt_id: v }))}
            options={projekt.map(p => ({ id: p.id, label: p.namn, hint: p.projekt_nummer }))}
            placeholder="— Välj projekt —"
          />
        )}

        {koppling === 'kalender' && (
          <SearchableSelect
            value={form.kalender_id}
            onChange={v => setForm(f => ({ ...f, kalender_id: v }))}
            options={kalendrar.map(k => ({ id: k.id, label: k.namn }))}
            placeholder="— Välj kalender —"
          />
        )}

        {koppling === 'anstalld' && (
          <SearchableSelect
            value={form.personal_id}
            onChange={v => setForm(f => ({ ...f, personal_id: v }))}
            options={anstallda.map(p => ({ id: p.id, label: p.namn }))}
            placeholder="— Välj anställd —"
          />
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted">Plats</label>
          <input
            type="text"
            value={form.plats}
            onChange={e => setForm(f => ({ ...f, plats: e.target.value }))}
            placeholder="Adress eller plats"
            className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30 placeholder:text-subtle"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted">URL</label>
          <input
            type="text"
            value={form.url}
            onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            placeholder="https://"
            className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30 placeholder:text-subtle"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted">Beskrivning</label>
          <textarea
            value={form.beskrivning}
            onChange={e => setForm(f => ({ ...f, beskrivning: e.target.value }))}
            rows={3}
            className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-fg/30 resize-none placeholder:text-subtle"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase tracking-widest text-muted">Bilagor</label>
            <button
              type="button"
              onClick={() => void handleAddFile()}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors"
            >
              <Paperclip size={11} /> Lägg till
            </button>
          </div>
          {stagedFiles.length > 0 && (
            <div className="flex flex-col gap-1">
              {stagedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <DokumentIkon mimeType={f.mimeType} />
                  <span className="flex-1 text-xs text-fg truncate" title={f.fileName}>{f.fileName}</span>
                  <span className="text-[10px] text-subtle shrink-0">{formatStorlek(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => setStagedFiles(fs => fs.filter((_, j) => j !== i))}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted hover:text-red-400 transition-all"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0 flex items-center gap-2">
        <button
          onClick={() => void handleSubmit()}
          disabled={!form.titel || !form.start || !form.slut || sparar}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Check size={14} /> {sparar ? 'Sparar…' : 'Spara'}
        </button>
        <button onClick={onStang} className="text-sm text-muted hover:text-fg px-3 py-1.5 rounded-lg hover:bg-hover transition-colors">
          Avbryt
        </button>
      </div>
    </div>
  )
}

// ─── Dokument helpers ────────────────────────────────────────────────────────

function formatStorlek(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DokumentIkon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <ImageIcon size={14} className="text-muted shrink-0" />
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return <FileText size={14} className="text-muted shrink-0" />
  return <File size={14} className="text-muted shrink-0" />
}

// ─── TaskDetail ──────────────────────────────────────────────────────────────

interface EventPatch {
  id: string
  titel: string
  hel_dag: boolean
  start: string
  slut: string
  plats: string
  url: string
  beskrivning: string
}

function TaskDetail({
  event, onStang, onTabort, projektNamn, dokument, onUpload, onOpenDokument, onDeleteDokument, onRedigera, onToggleSlutford, onOpenEpost, onColorChange,
}: {
  event: KalenderEvent
  onStang: () => void
  onTabort: (id: string) => void
  projektNamn: string | null
  dokument: KalenderDokument[]
  onUpload: () => Promise<void>
  onOpenDokument: (storagePath: string) => Promise<void>
  onDeleteDokument: (id: string, storagePath: string) => Promise<void>
  onRedigera: () => void
  onToggleSlutford: (id: string, slutford: boolean) => Promise<void>
  onOpenEpost?: () => void
  onColorChange: (id: string, farg: string) => void
}) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const kalenderEtikett = event.fas_id ? 'Tidplan' : projektNamn ?? 'Lokal kalender'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowColorPicker(p => !p)}
            className="size-2.5 rounded-full shrink-0 hover:ring-2 hover:ring-offset-1 hover:ring-offset-bg transition-all"
            style={{ backgroundColor: event.farg }}
            title="Byt färg"
          />
          <span className="text-[11px] text-muted uppercase tracking-widest">{kalenderEtikett}</span>
        </div>
        <div className="flex items-center gap-1">
          {event.epost_ref && onOpenEpost && (
            <button
              onClick={onOpenEpost}
              className="p-1 rounded text-blue-400 hover:text-blue-300 hover:bg-hover"
              title="Öppna länkat e-postmeddelande"
            >
              <Mail size={13} />
            </button>
          )}
          <button
            onClick={() => void onToggleSlutford(event.id, !event.slutford)}
            className={`p-1 rounded hover:bg-hover ${event.slutford ? 'text-emerald-400' : 'text-muted hover:text-fg'}`}
            title={event.slutford ? 'Markera som ej slutförd' : 'Markera som slutförd'}
          >
            {event.slutford ? <CheckCircle2 size={14} /> : <Circle size={14} />}
          </button>
          <button
            onClick={onRedigera}
            className="p-1 rounded text-muted hover:text-fg hover:bg-hover"
            title="Redigera"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onTabort(event.id)}
            className="p-1 rounded text-muted hover:text-red-400 hover:bg-hover"
            title="Ta bort"
          >
            <Trash2 size={13} />
          </button>
          <button onClick={onStang} className="p-1 rounded text-muted hover:text-fg hover:bg-hover">
            <X size={14} />
          </button>
        </div>
      </div>

      {showColorPicker && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-border shrink-0 bg-elevated">
          {PALETTE.map(c => (
            <button
              key={c}
              onClick={() => { onColorChange(event.id, c); setShowColorPicker(false) }}
              className="size-5 rounded-full transition-all"
              style={{
                backgroundColor: c,
                outline: c === event.farg ? `2px solid ${c}` : undefined,
                outlineOffset: c === event.farg ? '2px' : undefined,
              }}
            />
          ))}
          <input
            type="color"
            value={event.farg}
            onChange={e => { onColorChange(event.id, e.target.value); setShowColorPicker(false) }}
            className="size-5 rounded cursor-pointer border-0 bg-transparent p-0"
            title="Anpassad färg"
          />
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 py-4 flex flex-col gap-4">
        <h3 className={`text-base font-semibold leading-snug ${event.slutford ? 'text-muted line-through' : 'text-fg'}`}>{event.titel}</h3>

        <div className="flex items-start gap-2.5 text-sm text-muted">
          <Clock size={14} className="shrink-0 mt-0.5" />
          <div>
            {event.hel_dag ? (
              <span>{formatDatum(event.start)}</span>
            ) : (
              <>
                <span>{formatDatum(event.start)}</span>
                <span className="text-fg ml-1">{formatTid(event.start)} – {formatTid(event.slut)}</span>
              </>
            )}
          </div>
        </div>

        {projektNamn && (
          <div className="flex items-start gap-2.5 text-sm">
            <FolderOpen size={14} className="text-muted shrink-0 mt-0.5" />
            <span className="text-fg">{projektNamn}</span>
          </div>
        )}

        {event.plats && (
          <div className="flex items-start gap-2.5 text-sm">
            <MapPin size={14} className="text-muted shrink-0 mt-0.5" />
            <span className="text-fg">{event.plats}</span>
          </div>
        )}

        {event.url && (
          <div className="flex items-start gap-2.5 text-sm">
            <Link size={14} className="text-muted shrink-0 mt-0.5" />
            <a
              href={event.url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline truncate"
              onClick={e => { e.stopPropagation() }}
            >
              {event.url}
            </a>
          </div>
        )}

        {event.beskrivning && (
          <div className="text-sm text-muted whitespace-pre-wrap leading-relaxed border-t border-border pt-3 mt-1">
            {event.beskrivning}
          </div>
        )}

        {event.epost_ref && (
          <div className="border-t border-border pt-3 mt-1">
            <span className="text-[11px] uppercase tracking-widest text-muted block mb-2">Länkat e-postmeddelande</span>
            <button
              onClick={onOpenEpost}
              className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-elevated border border-border hover:border-blue-400/40 hover:bg-blue-400/5 transition-colors group"
            >
              <Mail size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-fg truncate group-hover:text-blue-400 transition-colors">{event.epost_ref.amne || '(Inget ämne)'}</p>
                <p className="text-[11px] text-muted truncate">{event.epost_ref.fran_namn || event.epost_ref.fran_adress}</p>
              </div>
            </button>
          </div>
        )}

        <div className="border-t border-border pt-3 mt-1 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest text-muted">Bilagor</span>
            <button
              onClick={() => void onUpload()}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors"
            >
              <Paperclip size={11} /> Lägg till
            </button>
          </div>

          {dokument.length === 0 ? (
            <p className="text-xs text-subtle">Inga bilagor</p>
          ) : (
            <div className="flex flex-col gap-1">
              {dokument.map(d => (
                <div key={d.id} className="flex items-center gap-2 group">
                  <DokumentIkon mimeType={d.mime_type} />
                  <button
                    onClick={() => void onOpenDokument(d.storage_path)}
                    className="flex-1 text-left text-xs text-fg hover:text-blue-400 truncate transition-colors"
                    title={d.filnamn}
                  >
                    {d.filnamn}
                  </button>
                  <span className="text-[10px] text-subtle shrink-0">{formatStorlek(d.storlek)}</span>
                  <button
                    onClick={() => void onDeleteDokument(d.id, d.storage_path)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted hover:text-red-400 transition-all"
                    title="Ta bort"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TaskEditForm ────────────────────────────────────────────────────────────

function TaskEditForm({
  event, onSpara, onStang,
}: {
  event: KalenderEvent
  onSpara: (patch: EventPatch) => Promise<void>
  onStang: () => void
}) {
  const [titel, setTitel] = useState(event.titel)
  const [helDag, setHelDag] = useState(event.hel_dag)
  const [start, setStart] = useState(
    event.hel_dag ? event.start.slice(0, 10) : toLocalDatetimeInput(new Date(event.start))
  )
  const [slut, setSlut] = useState(
    event.hel_dag ? event.slut.slice(0, 10) : toLocalDatetimeInput(new Date(event.slut))
  )
  const [plats, setPlats] = useState(event.plats || '')
  const [url, setUrl] = useState(event.url || '')
  const [beskrivning, setBeskrivning] = useState(event.beskrivning || '')
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)

  async function handleSubmit() {
    if (!titel) return
    setSparar(true)
    setFel(null)
    try {
      await onSpara({
        id: event.id,
        titel,
        hel_dag: helDag,
        start: new Date(start).toISOString(),
        slut: new Date(slut).toISOString(),
        plats,
        url,
        beskrivning,
      })
      onStang()
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Fel vid sparande')
    } finally {
      setSparar(false)
    }
  }

  const inputCls = "w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-fg/30 placeholder:text-subtle"
  const labelCls = "text-[11px] uppercase tracking-widest text-muted"

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-medium text-fg">Redigera task</span>
        <button onClick={onStang} className="p-1 rounded text-muted hover:text-fg hover:bg-hover">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-auto flex flex-col gap-4 px-4 py-4">
        {fel && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{fel}</div>}

        {event.fas_id && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">
            <LayoutList size={12} className="shrink-0" />
            Datumsändringar synkroniseras med Tidplan
          </div>
        )}

        <input
          type="text"
          value={titel}
          onChange={e => setTitel(e.target.value)}
          placeholder="Titel"
          className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-fg/30 placeholder:text-subtle font-medium"
        />

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="edit_hel_dag"
            checked={helDag}
            onChange={e => setHelDag(e.target.checked)}
            className="accent-blue-400"
          />
          <label htmlFor="edit_hel_dag" className="text-sm text-fg">Heldag</label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Start</label>
            <input
              type={helDag ? 'date' : 'datetime-local'}
              value={start}
              onChange={e => setStart(e.target.value)}
              className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Slut</label>
            <input
              type={helDag ? 'date' : 'datetime-local'}
              value={slut}
              onChange={e => setSlut(e.target.value)}
              className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30"
            />
          </div>
        </div>

        {!helDag && (
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Längd</label>
            <div className="flex gap-1">
              {[15, 30, 45, 60].map(min => {
                const startDate = start ? new Date(start) : null
                const slutDate = slut ? new Date(slut) : null
                const aktiv = startDate && slutDate
                  && Math.round((slutDate.getTime() - startDate.getTime()) / 60000) === min
                return (
                  <button
                    key={min}
                    type="button"
                    onClick={() => {
                      if (!start) return
                      const s = new Date(start)
                      const e = new Date(s)
                      e.setMinutes(e.getMinutes() + min)
                      setSlut(toLocalDatetimeInput(e))
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      aktiv
                        ? 'bg-elevated border-fg/30 text-fg'
                        : 'border-border text-muted hover:text-fg hover:bg-hover'
                    }`}
                  >
                    {min} min
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Plats</label>
          <input
            type="text"
            value={plats}
            onChange={e => setPlats(e.target.value)}
            placeholder="Adress eller plats"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>URL</label>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Beskrivning</label>
          <textarea
            value={beskrivning}
            onChange={e => setBeskrivning(e.target.value)}
            rows={3}
            className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-fg/30 resize-none placeholder:text-subtle"
          />
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0 flex items-center justify-end gap-2">
        <button
          onClick={onStang}
          className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-fg hover:bg-hover transition-colors"
        >
          Avbryt
        </button>
        <button
          onClick={() => void handleSubmit()}
          disabled={sparar || !titel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
        >
          <Check size={12} /> {sparar ? 'Sparar…' : 'Spara'}
        </button>
      </div>
    </div>
  )
}

// ─── DagPanel ────────────────────────────────────────────────────────────────

function DagPanel({
  dag, events, onValjEvent, onNyttEvent, onStang,
}: {
  dag: Date
  events: KalenderEvent[]
  onValjEvent: (e: KalenderEvent) => void
  onNyttEvent: () => void
  onStang: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-medium text-fg capitalize">
          {dag.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onNyttEvent}
            title="Ny task"
            className="p-1 rounded text-muted hover:text-fg hover:bg-hover transition-colors"
          >
            <Plus size={14} />
          </button>
          <button onClick={onStang} className="p-1 rounded text-muted hover:text-fg hover:bg-hover transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {events.length === 0 ? (
          <p className="px-4 py-4 text-xs text-subtle">Inga tasks den här dagen</p>
        ) : (
          events.map(e => (
            <button
              key={e.id}
              onClick={() => onValjEvent(e)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-hover transition-colors border-b border-border/40"
            >
              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: e.farg }} />
              <span className={`truncate flex-1 text-left ${e.slutford ? 'text-muted line-through' : 'text-fg'}`}>{e.titel}</span>
              {!e.hel_dag && <span className="text-xs text-muted shrink-0">{formatTid(e.start)}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── KalenderSection ─────────────────────────────────────────────────────────

export function KalenderSection({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const [vy, setVy] = useState<KalenderVy>('dag')
  const [anchor, setAnchor] = useState(new Date())
  const [lokalVisas, setLokalVisas] = useState(true)
  const [synligaKunder, setSynligaKunder] = useState<Set<string>>(new Set())
  const [synligaProjekt, setSynligaProjekt] = useState<Set<string>>(new Set())
  const [synligaKalendrar, setSynligaKalendrar] = useState<Set<string>>(new Set())
  const [anstallda, setAnstallda] = useState<AnstaelldRef[]>([])
  const [synligaAnstallda, setSynligaAnstallda] = useState<Set<string>>(new Set())
  const [events, setEvents] = useState<KalenderEvent[]>([])
  const [kunder, setKunder] = useState<KundRef[]>([])
  const [alleProjekt, setAlleProjekt] = useState<ProjektRef[]>([])
  const [kalendrar, setKalendrar] = useState<Kalender[]>([])
  const [menuFor, setMenuFor] = useState<{ typ: 'lokal' | 'kund' | 'projekt' | 'kalender'; id?: string; namn: string; farg: string; rect: DOMRect } | null>(null)
  const [skaparKalender, setSkaparKalender] = useState(false)
  const [redigerarKalender, setRedigerarKalender] = useState<Kalender | null>(null)
  const [shareFor, setShareFor] = useState<{ filter: IcsFilter; calendarName: string } | null>(null)
  const [valtDag, setValtDag] = useState<Date | null>(null)
  const [valtEvent, setValtEvent] = useState<KalenderEvent | null>(null)
  const [valtEventDokument, setValtEventDokument] = useState<KalenderDokument[]>([])
  const [skapar, setSkapar] = useState(false)
  const [redigerarEvent, setRedigerarEvent] = useState<KalenderEvent | null>(null)
  const [formStart, setFormStart] = useState('')
  const [formSlut, setFormSlut] = useState('')
  const [draggingEvent, setDraggingEvent] = useState<KalenderEvent | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [tarBort, setTarBort] = useState(false)
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false)
  const [pdfDatum, setPdfDatum] = useState(() => toDateInput(new Date()))
  const [exporterar, setExporterar] = useState(false)
  const [kalendrarOppen, setKalendrarOppen] = useState(false)
  const [vyDropdownOpen, setVyDropdownOpen] = useState(false)
  const pdfMenuRef = useRef<HTMLDivElement>(null)
  const vyDropdownRef = useRef<HTMLDivElement>(null)

  const synligaEvents = useMemo(() => {
    return events
      .map(e => ({
        ...e,
        farg: e.projekt_id
          ? getProjektFarg(e.projekt_id, alleProjekt)
          : e.kund_id
            ? getKundFarg(e.kund_id, kunder)
            : e.kalender_id
              ? (kalendrar.find(k => k.id === e.kalender_id)?.farg ?? e.farg ?? LOKAL_FARG)
              : (e.farg || LOKAL_FARG),
      }))
      .filter(e => {
        if (e.projekt_id) return synligaProjekt.has(e.projekt_id)
        if (e.kund_id) return synligaKunder.has(e.kund_id)
        if (e.kalender_id) return synligaKalendrar.has(e.kalender_id)
        if (e.personal_id) return synligaAnstallda.has(e.personal_id)
        return lokalVisas
      })
  }, [events, alleProjekt, kunder, kalendrar, lokalVisas, synligaKunder, synligaProjekt, synligaKalendrar, synligaAnstallda])

  const kundMedEvents = useMemo(() => {
    const ids = new Set(events.filter(e => e.kund_id && !e.projekt_id).map(e => e.kund_id!))
    return kunder.filter(k => ids.has(k.id))
  }, [events, kunder])

  const projektMedEvents = useMemo(() => {
    const ids = new Set(events.filter(e => e.projekt_id).map(e => e.projekt_id!))
    return alleProjekt.filter(p => ids.has(p.id))
  }, [events, alleProjekt])

  const anstaelldaMedEvents = useMemo(() => {
    const ids = new Set(
      events.filter(e => e.personal_id && !e.projekt_id && !e.kund_id).map(e => e.personal_id!)
    )
    return anstallda.filter(p => ids.has(p.id))
  }, [events, anstallda])

  const ar = anchor.getFullYear()
  const manad = anchor.getMonth()

  useEffect(() => {
    void hamtaEvents()
    void hamtaKunderOchProjekt()
  }, [])

  useRefreshHandler(useCallback(async () => {
    await Promise.all([hamtaEvents(), hamtaKunderOchProjekt()])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []))

  useEffect(() => {
    const eventId = valtEvent?.id ?? null
    const handler = (): void => {
      void hamtaEvents()
      if (eventId) void hamtaDokument(eventId)
    }
    window.api.on('kalender:changed', handler)
    return () => window.api.off('kalender:changed', handler)
  }, [valtEvent?.id])

  useEffect(() => {
    if (valtEvent) void hamtaDokument(valtEvent.id)
    else setValtEventDokument([])
  }, [valtEvent?.id])

  useEffect(() => {
    if (!pdfMenuOpen) return
    function onClick(e: MouseEvent) {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(e.target as Node)) {
        setPdfMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pdfMenuOpen])

  useEffect(() => {
    if (!vyDropdownOpen) return
    function onClick(e: MouseEvent) {
      if (vyDropdownRef.current && !vyDropdownRef.current.contains(e.target as Node)) {
        setVyDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [vyDropdownOpen])

  async function handleExportPdf() {
    if (exporterar) return
    setExporterar(true)
    try {
      const dag = parseDateInput(pdfDatum)
      const dagsEvents = eventsPaDag(synligaEvents, dag)
      const html = buildKalenderDagHtml(dag, dagsEvents, kunder, alleProjekt)
      await window.api.invoke('pdf:generate-html', {
        html,
        name: `kalender-${pdfDatum}`,
        save: true,
      })
      setPdfMenuOpen(false)
    } finally {
      setExporterar(false)
    }
  }

  async function hamtaEvents() {
    try {
      const data = await window.api.invoke('db:kalender:list') as KalenderEvent[]
      setEvents(data.map(e => ({ ...e, url: e.url || '' })))
    } catch {
      // table not yet created
    }
  }

  async function hamtaKunderOchProjekt() {
    try {
      const [k, p, c, a] = await Promise.all([
        window.api.invoke('db:kunder:list') as Promise<KundRef[]>,
        window.api.invoke('db:projekt:list') as Promise<ProjektRef[]>,
        window.api.invoke('db:kalendrar:list') as Promise<Kalender[]>,
        window.api.invoke('db:personal:list') as Promise<AnstaelldRef[]>,
      ])
      setKunder(k)
      setAlleProjekt(p)
      setKalendrar(c)
      setAnstallda(a.filter(p => p.status !== 'inaktiv'))
      setSynligaKunder(new Set(k.map(ku => ku.id)))
      setSynligaProjekt(new Set(p.map(pr => pr.id)))
      setSynligaKalendrar(new Set(c.map(ka => ka.id)))
      setSynligaAnstallda(new Set(a.map(an => an.id)))
    } catch {
      // ignore
    }
  }

  function toggleKundKalender(kundId: string) {
    setSynligaKunder(prev => {
      const next = new Set(prev)
      if (next.has(kundId)) next.delete(kundId)
      else next.add(kundId)
      return next
    })
  }

  function toggleProjektKalender(projektId: string) {
    setSynligaProjekt(prev => {
      const next = new Set(prev)
      if (next.has(projektId)) next.delete(projektId)
      else next.add(projektId)
      return next
    })
  }

  function toggleManuellKalender(id: string) {
    setSynligaKalendrar(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAnstaelldKalender(personalId: string) {
    setSynligaAnstallda(prev => {
      const next = new Set(prev)
      if (next.has(personalId)) next.delete(personalId)
      else next.add(personalId)
      return next
    })
  }

  async function handleSetKundFarg(kundId: string, farg: string | null) {
    await window.api.invoke('db:kund:set-kalender-farg', kundId, farg)
    setKunder(prev => prev.map(k => k.id === kundId ? { ...k, kalender_farg: farg } : k))
  }

  async function handleSetProjektFarg(projektId: string, farg: string | null) {
    await window.api.invoke('db:projekt:set-kalender-farg', projektId, farg)
    setAlleProjekt(prev => prev.map(p => p.id === projektId ? { ...p, kalender_farg: farg } : p))
  }

  async function handleSparaKalender(input: { id?: string; namn: string; farg: string }) {
    if (input.id) {
      const updated = await window.api.invoke('db:kalendrar:update', input.id, { namn: input.namn, farg: input.farg }) as Kalender
      setKalendrar(prev => prev.map(k => k.id === updated.id ? updated : k))
    } else {
      const created = await window.api.invoke('db:kalendrar:create', { namn: input.namn, farg: input.farg }) as Kalender
      setKalendrar(prev => [...prev, created])
      setSynligaKalendrar(prev => new Set([...prev, created.id]))
    }
  }

  async function handleDeleteKalender(id: string) {
    await window.api.invoke('db:kalendrar:delete', id)
    setKalendrar(prev => prev.filter(k => k.id !== id))
    setSynligaKalendrar(prev => {
      const next = new Set(prev); next.delete(id); return next
    })
  }

  async function handleEmpty(filter: IcsFilter) {
    if ('kalender_id' in filter) await window.api.invoke('db:kalendrar:empty', filter.kalender_id)
    else if ('kund_id' in filter) await window.api.invoke('db:kalender:empty-kund', filter.kund_id)
    else if ('projekt_id' in filter) await window.api.invoke('db:kalender:empty-projekt', filter.projekt_id)
    else await window.api.invoke('db:kalender:empty-lokal')
  }

  async function handleExportIcs(filter: IcsFilter, calendarName: string) {
    await window.api.invoke('db:kalender:export-ics', { filter, calendarName })
  }

  function gaForegaende() {
    const d = new Date(anchor)
    if (vy === '6manad') d.setMonth(d.getMonth() - 6)
    else if (vy === '3manad') d.setMonth(d.getMonth() - 3)
    else if (vy === 'manad') d.setMonth(d.getMonth() - 1)
    else if (vy === '3vecka') d.setDate(d.getDate() - 21)
    else if (vy === '2vecka') d.setDate(d.getDate() - 14)
    else if (vy === 'dag') d.setDate(d.getDate() - 1)
    else d.setDate(d.getDate() - 7)
    setAnchor(d)
  }

  function gaNasta() {
    const d = new Date(anchor)
    if (vy === '6manad') d.setMonth(d.getMonth() + 6)
    else if (vy === '3manad') d.setMonth(d.getMonth() + 3)
    else if (vy === 'manad') d.setMonth(d.getMonth() + 1)
    else if (vy === '3vecka') d.setDate(d.getDate() + 21)
    else if (vy === '2vecka') d.setDate(d.getDate() + 14)
    else if (vy === 'dag') d.setDate(d.getDate() + 1)
    else d.setDate(d.getDate() + 7)
    setAnchor(d)
  }

  function gaIdag() { setAnchor(new Date()) }

  function handleNyttEvent(dag?: Date, useExactTime = false) {
    const now = new Date()
    const start = dag ? new Date(dag) : new Date(now)
    if (!useExactTime) start.setHours(now.getHours(), 0, 0, 0)
    const slut = new Date(start)
    slut.setMinutes(slut.getMinutes() + 60)
    setFormStart(toLocalDatetimeInput(start))
    setFormSlut(toLocalDatetimeInput(slut))
    setValtEvent(null)
    setSkapar(true)
  }

  async function handleSpara(form: NyttEventForm, files: StagedFile[]) {
    const kalender = form.kalender_id ? kalendrar.find(k => k.id === form.kalender_id) : null
    const created = await window.api.invoke('db:kalender:create', {
      titel: form.titel,
      beskrivning: form.beskrivning,
      plats: form.plats,
      url: form.url,
      start: new Date(form.start).toISOString(),
      slut: new Date(form.slut).toISOString(),
      hel_dag: form.hel_dag,
      kund_id: form.kund_id || null,
      projekt_id: form.projekt_id || null,
      kalender_id: form.kalender_id || null,
      personal_id: form.personal_id || null,
      farg: form.projekt_id
        ? getProjektFarg(form.projekt_id, alleProjekt)
        : form.kund_id
          ? getKundFarg(form.kund_id, kunder)
          : kalender
            ? kalender.farg
            : LOKAL_FARG,
    }) as KalenderEvent

    for (const f of files) {
      await window.api.invoke('db:kalender-dokument:upload', {
        eventId: created.id,
        filePath: f.filePath,
        fileName: f.fileName,
        mimeType: f.mimeType,
        size: f.size,
      })
    }

    if (form.projekt_id) {
      const start = new Date(form.start)
      const slut = new Date(form.slut)
      const datumStr = form.hel_dag
        ? formatDatum(start.toISOString())
        : `${formatDatum(start.toISOString())} ${formatTid(start.toISOString())} – ${formatTid(slut.toISOString())}`
      const innehall = [datumStr, form.plats].filter(Boolean).join(' · ')
      await window.api.invoke('db:projekt-anteckningar:create', {
        projekt_id: form.projekt_id,
        titel: `Kalender: ${form.titel}`,
        innehall,
        farg: 'blue',
      }).catch(() => {})
    }

    await hamtaEvents()
    setSkapar(false)
  }

  async function handleAddFileSkapar(): Promise<StagedFile | null> {
    return window.api.invoke('dialog:open-file') as Promise<StagedFile | null>
  }

  async function hamtaDokument(eventId: string) {
    try {
      const data = await window.api.invoke('db:kalender-dokument:list', eventId) as KalenderDokument[]
      setValtEventDokument(data)
    } catch { /* ignore */ }
  }

  async function handleUploadDokument() {
    const file = await window.api.invoke('dialog:open-file') as { filePath: string; fileName: string; mimeType: string; size: number } | null
    if (!file || !valtEvent) return
    await window.api.invoke('db:kalender-dokument:upload', {
      eventId: valtEvent.id,
      filePath: file.filePath,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
    })
    await hamtaDokument(valtEvent.id)
  }

  async function handleOpenDokument(storagePath: string) {
    await window.api.invoke('db:kalender-dokument:open', storagePath)
  }

  async function handleDeleteDokument(id: string, storagePath: string) {
    if (!confirm('Ta bort bilagan?')) return
    await window.api.invoke('db:kalender-dokument:delete', { id, storagePath })
    if (valtEvent) await hamtaDokument(valtEvent.id)
  }

  function handleDragStart(event: KalenderEvent) {
    setDraggingEvent(event)
  }

  function toISODate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  async function handleDrop(dag: Date, withTime = false, bandHour?: number) {
    if (!draggingEvent) return
    const event = draggingEvent
    setDraggingEvent(null)

    const oldStart = new Date(event.start)
    const oldSlut = new Date(event.slut)

    const duration = oldSlut.getTime() - oldStart.getTime()
    const newStart = new Date(dag)
    if (!withTime) newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0)
    if (bandHour !== undefined) newStart.setHours(bandHour, 0, 0, 0)
    if (newStart.getTime() === oldStart.getTime()) return
    const newSlut = new Date(newStart.getTime() + duration)

    await window.api.invoke('db:kalender:update', {
      id: event.id,
      start: newStart.toISOString(),
      slut: newSlut.toISOString(),
    })

    // If this is a tidplan fase event, keep the fase dates in sync
    if (event.fas_id) {
      await window.api.invoke('db:forslag-faser:update', event.fas_id, {
        start_datum: toISODate(newStart),
        slut_datum: toISODate(newSlut),
      })
    }

    const logText = `Från: ${formatDatum(oldStart.toISOString())}\nTill: ${formatDatum(newStart.toISOString())}`

    if (event.projekt_id && !event.fas_id) {
      await window.api.invoke('db:projekt-anteckningar:create', {
        projekt_id: event.projekt_id,
        titel: `Task omplanerad: ${event.titel}`,
        innehall: logText,
        farg: 'amber',
      })
    } else if (event.projekt_id && event.fas_id) {
      await window.api.invoke('db:projekt-anteckningar:create', {
        projekt_id: event.projekt_id,
        titel: `Fas omplanerad: ${event.titel}`,
        innehall: logText,
        farg: 'amber',
      })
    }

    await hamtaEvents()
  }

  async function handleTabort(id: string) {
    if (!confirm('Ta bort task?')) return
    try {
      const ev = events.find(e => e.id === id)
      await window.api.invoke('db:kalender:delete', id)
      if (ev?.projekt_id) {
        await window.api.invoke('db:projekt-aktivitet:create', {
          projekt_id: ev.projekt_id,
          handelse: 'kalender_handelse_borttagen',
          text: `Kalender: "${ev.titel}" borttagen`,
        }).catch(() => {})
      }
      await hamtaEvents()
      setValtEvent(null)
    } catch {
      // error shown via native alert since form is not open
    }
  }

  function aktiveraValjLage() {
    setSelectionMode(true)
    setSelectedIds(new Set())
    setValtEvent(null)
    setValtDag(null)
    setSkapar(false)
  }

  function avbrytValjLage() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  function handleEventKlick(e: KalenderEvent) {
    if (selectionMode) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(e.id)) next.delete(e.id)
        else next.add(e.id)
        return next
      })
    } else {
      setValtEvent(e)
      setSkapar(false)
    }
  }

  async function handleTabortValda() {
    if (selectedIds.size === 0 || tarBort) return
    const ids = Array.from(selectedIds)
    const harTidplan = events.some(e => ids.includes(e.id) && e.fas_id)
    const meddelande = harTidplan
      ? `Ta bort ${ids.length} task(s)?\n\nNågra är synkade från Tidplan — de raderas från kalendern men faserna i Tidplan ändras inte.`
      : `Ta bort ${ids.length} task(s)?`
    if (!confirm(meddelande)) return
    setTarBort(true)
    try {
      await window.api.invoke('db:kalender:delete-many', ids)
      avbrytValjLage()
      await hamtaEvents()
    } finally {
      setTarBort(false)
    }
  }

  async function handleResize(ev: KalenderEvent, newSlut: Date) {
    const slutIso = newSlut.toISOString()
    if (slutIso === ev.slut) return
    setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, slut: slutIso } : e))
    setValtEvent(prev => prev && prev.id === ev.id ? { ...prev, slut: slutIso } : prev)
    try {
      await window.api.invoke('db:kalender:update', { id: ev.id, slut: slutIso })
      if (ev.fas_id) {
        await window.api.invoke('db:forslag-faser:update', ev.fas_id, {
          start_datum: toISODate(new Date(ev.start)),
          slut_datum: toISODate(newSlut),
        })
      }
      await hamtaEvents()
    } catch {
      await hamtaEvents()
    }
  }

  async function handleSparaRedigering(patch: EventPatch) {
    await window.api.invoke('db:kalender:update', patch)

    if (valtEvent?.fas_id) {
      await window.api.invoke('db:forslag-faser:update', valtEvent.fas_id, {
        start_datum: toISODate(new Date(patch.start)),
        slut_datum: toISODate(new Date(patch.slut)),
      })
    }

    setValtEvent(prev => prev ? { ...prev, ...patch } : prev)
    await hamtaEvents()
  }

  async function handleToggleSlutford(id: string, slutford: boolean) {
    await window.api.invoke('db:kalender:toggle-slutford', id, slutford)
    setValtEvent(prev => prev && prev.id === id ? { ...prev, slutford } : prev)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, slutford } : e))
    if (slutford) {
      const ev = events.find(e => e.id === id)
      if (ev?.projekt_id) {
        await window.api.invoke('db:projekt-aktivitet:create', {
          projekt_id: ev.projekt_id,
          handelse: 'kalender_handelse_slutford',
          text: `Kalender: "${ev.titel}" slutförd`,
        }).catch(() => {})
      }
    }
  }

  async function handleColorChange(id: string, farg: string) {
    await window.api.invoke('db:kalender:update', { id, farg })
    setValtEvent(prev => prev && prev.id === id ? { ...prev, farg } : prev)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, farg } : e))
  }

  const panelOppen = valtEvent !== null || valtDag !== null

  const rubrik = vy === 'manad'
    ? `${MANADER[manad]} ${ar}`
    : vy === 'dag'
      ? (() => {
          const dagIdx = (anchor.getDay() + 6) % 7
          return `${DAGAR_FULL[dagIdx]} ${anchor.getDate()} ${MANADER[anchor.getMonth()]} ${anchor.getFullYear()}`
        })()
      : vy === 'vecka'
        ? (() => {
            const vecka = getWeekDays(anchor)
            const forst = vecka[0]
            const sist = vecka[6]
            const vNum = getVeckonummer(forst)
            const datumStr = forst.getMonth() === sist.getMonth()
              ? `${forst.getDate()}–${sist.getDate()} ${MANADER[forst.getMonth()]} ${forst.getFullYear()}`
              : `${forst.getDate()} ${MANADER[forst.getMonth()]} – ${sist.getDate()} ${MANADER[sist.getMonth()]} ${sist.getFullYear()}`
            return `V.${vNum} · ${datumStr}`
          })()
        : (vy === '2vecka' || vy === '3vecka')
          ? (() => {
              const monday = getWeekDays(anchor)[0]
              const numDays = vy === '3vecka' ? 21 : 14
              const sunday = new Date(monday); sunday.setDate(monday.getDate() + numDays - 1)
              const v1 = getVeckonummer(monday)
              const v2 = getVeckonummer(sunday)
              const datumStr = monday.getMonth() === sunday.getMonth()
                ? `${monday.getDate()}–${sunday.getDate()} ${MANADER[monday.getMonth()]} ${monday.getFullYear()}`
                : `${monday.getDate()} ${MANADER[monday.getMonth()]} – ${sunday.getDate()} ${MANADER[sunday.getMonth()]} ${sunday.getFullYear()}`
              return `V.${v1}–V.${v2} · ${datumStr}`
            })()
          : (() => {
              // 3manad or 6manad
              const numMonths = vy === '6manad' ? 6 : 3
              const firstMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
              const lastMonth = new Date(anchor.getFullYear(), anchor.getMonth() + numMonths - 1, 1)
              if (firstMonth.getFullYear() === lastMonth.getFullYear()) {
                return `${MANADER[firstMonth.getMonth()]} – ${MANADER[lastMonth.getMonth()]} ${firstMonth.getFullYear()}`
              }
              return `${MANADER[firstMonth.getMonth()]} ${firstMonth.getFullYear()} – ${MANADER[lastMonth.getMonth()]} ${lastMonth.getFullYear()}`
            })()

  const valtProjektNamn = valtEvent?.projekt_id
    ? (alleProjekt.find(p => p.id === valtEvent.projekt_id)?.namn ?? null)
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex-1 flex items-center gap-3">
          <p className="text-[11px] uppercase tracking-widest text-muted">Kalender</p>
          {selectionMode && (
            <span className="text-[11px] text-muted">{selectedIds.size} markerade</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={gaForegaende}
              aria-label="Föregående"
              className="p-1.5 text-muted hover:text-fg hover:bg-hover rounded transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="min-w-[15rem] text-center select-none px-1 whitespace-nowrap">
              {rubrik.includes(' · ') ? (
                <>
                  <span className="text-[10px] font-mono text-amber-400/70">{rubrik.split(' · ')[0]}</span>
                  <span className="text-muted mx-1.5">·</span>
                  <span className="text-[13px] font-semibold text-fg">{rubrik.split(' · ')[1]}</span>
                </>
              ) : (
                <span className="text-[13px] font-semibold text-fg">{rubrik}</span>
              )}
            </div>
            <button
              onClick={gaNasta}
              aria-label="Nästa"
              className="p-1.5 text-muted hover:text-fg hover:bg-hover rounded transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-end gap-2">
          <button
            onClick={gaIdag}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors whitespace-nowrap"
          >
            Idag
          </button>
          <div ref={vyDropdownRef} className="relative">
            <button
              onClick={() => setVyDropdownOpen(o => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-fg border-b-2 border-emerald-400 transition-colors whitespace-nowrap"
            >
              {VY_LABELS[vy]}
              <ChevronDown size={11} />
            </button>
            {vyDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-elevated border border-border rounded-lg shadow-lg py-1">
                {(Object.entries(VY_LABELS) as [KalenderVy, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setVy(key); setVyDropdownOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-[11px] transition-colors ${vy === key ? 'text-fg bg-hover' : 'text-muted hover:text-fg hover:bg-hover'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div ref={pdfMenuRef} className="relative">
            <button
              onClick={() => setPdfMenuOpen(o => !o)}
              title="Ladda ner dag som PDF"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors whitespace-nowrap"
            >
              <Download size={11} />PDF
            </button>
            {pdfMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-64 bg-elevated border border-border rounded-lg shadow-lg p-3">
                <p className="text-[10px] uppercase tracking-widest text-subtle mb-2">Skriv ut dag</p>
                <input
                  type="date"
                  value={pdfDatum}
                  onChange={e => setPdfDatum(e.target.value)}
                  className="w-full px-2 py-1.5 mb-3 text-xs bg-bg border border-border rounded-md text-fg focus:outline-none focus:border-fg"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setPdfMenuOpen(false)}
                    className="px-3 py-1.5 text-xs text-muted hover:text-fg transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={() => void handleExportPdf()}
                    disabled={exporterar}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-elevated text-fg hover:bg-hover border border-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {exporterar ? 'Genererar…' : 'Ladda ner'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {selectionMode ? (
            <button
              onClick={() => void handleTabortValda()}
              disabled={selectedIds.size === 0 || tarBort}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-red-400 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <Trash2 size={11} />{tarBort ? 'Tar bort…' : 'Ta bort'}
            </button>
          ) : (
            <button
              onClick={() => handleNyttEvent()}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors whitespace-nowrap"
            >
              <Plus size={11} />Ny task
            </button>
          )}
          <button
            onClick={selectionMode ? avbrytValjLage : aktiveraValjLage}
            title="Välj flera för att ta bort"
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${selectionMode ? 'text-emerald-400 bg-hover rounded' : 'text-muted hover:text-fg'}`}
          >
            <Check size={11} />Välj
          </button>
          <RefreshButton iconOnly />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: calendar toggles */}
        {kalendrarOppen ? (
        <nav className="w-80 shrink-0 border-r border-border flex flex-col py-3 gap-3 overflow-y-auto relative bg-sidebar">
          <button
            onClick={() => setKalendrarOppen(false)}
            className="absolute top-2 right-2 p-1 rounded text-muted hover:text-fg hover:bg-hover transition-colors"
            title="Dölj kalendrar"
          >
            <ChevronLeft size={14} />
          </button>
          <div>
            <p className="px-4 mb-1.5 text-[10px] uppercase tracking-widest text-subtle">Lokal</p>
            <SidebarRow
              label="Lokal kalender"
              farg={LOKAL_FARG}
              visible={lokalVisas}
              onToggle={() => setLokalVisas(v => !v)}
              onMenu={(rect) => setMenuFor({ typ: 'lokal', namn: 'Lokal kalender', farg: LOKAL_FARG, rect })}
            />
          </div>

          <div>
            <div className="px-4 mb-1.5 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-subtle">Mina kalendrar</p>
              <button
                onClick={() => setSkaparKalender(true)}
                className="p-0.5 rounded text-muted hover:text-fg hover:bg-hover transition-colors"
                title="Skapa kalender"
              >
                <Plus size={12} />
              </button>
            </div>
            {kalendrar.map(k => (
              <SidebarRow
                key={k.id}
                label={k.namn}
                farg={k.farg}
                visible={synligaKalendrar.has(k.id)}
                onToggle={() => toggleManuellKalender(k.id)}
                onMenu={(rect) => setMenuFor({ typ: 'kalender', id: k.id, namn: k.namn, farg: k.farg, rect })}
              />
            ))}
          </div>

          {kundMedEvents.length > 0 && (
            <div>
              <p className="px-4 mb-1.5 text-[10px] uppercase tracking-widest text-subtle">Kunder</p>
              {kundMedEvents.map(k => {
                const farg = getKundFarg(k.id, kunder)
                const visas = synligaKunder.has(k.id)
                return (
                  <SidebarRow
                    key={k.id}
                    label={k.namn}
                    farg={farg}
                    visible={visas}
                    onToggle={() => toggleKundKalender(k.id)}
                    onMenu={(rect) => setMenuFor({ typ: 'kund', id: k.id, namn: k.namn, farg, rect })}
                  />
                )
              })}
            </div>
          )}

          {projektMedEvents.length > 0 && (
            <div>
              <p className="px-4 mb-1.5 text-[10px] uppercase tracking-widest text-subtle">Projekt</p>
              {projektMedEvents.map(p => {
                const farg = getProjektFarg(p.id, alleProjekt)
                const visas = synligaProjekt.has(p.id)
                return (
                  <SidebarRow
                    key={p.id}
                    label={p.namn}
                    farg={farg}
                    visible={visas}
                    onToggle={() => toggleProjektKalender(p.id)}
                    onMenu={(rect) => setMenuFor({ typ: 'projekt', id: p.id, namn: p.namn, farg, rect })}
                  />
                )
              })}
            </div>
          )}

          {anstaelldaMedEvents.length > 0 && (
            <div>
              <p className="px-4 mb-1.5 text-[10px] uppercase tracking-widest text-subtle">Anställda</p>
              {anstaelldaMedEvents.map(p => {
                const visas = synligaAnstallda.has(p.id)
                return (
                  <SidebarRow
                    key={p.id}
                    label={p.namn}
                    farg="#8b5cf6"
                    visible={visas}
                    onToggle={() => toggleAnstaelldKalender(p.id)}
                    onMenu={() => {}}
                  />
                )
              })}
            </div>
          )}
        </nav>
        ) : (
          <div className="w-10 shrink-0 border-r border-border flex flex-col items-center py-3 bg-sidebar">
            <button
              onClick={() => setKalendrarOppen(true)}
              className="p-1 rounded text-muted hover:text-fg hover:bg-hover transition-colors"
              title="Visa kalendrar"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Center: calendar grid */}
        <div className={`flex flex-col flex-1 min-h-0 min-w-0 ${panelOppen ? 'border-r border-border' : ''}`}>
          {(vy === '6manad' || vy === '3manad') ? (
            <div className="flex flex-col flex-1 overflow-auto">
              {Array.from({ length: vy === '6manad' ? 6 : 3 }, (_, i) => {
                const d = new Date(anchor.getFullYear(), anchor.getMonth() + i, 1)
                return (
                  <div key={i}>
                    <div className="px-6 py-2 border-b border-border bg-sidebar sticky top-0 z-10 shrink-0">
                      <span className="text-[11px] uppercase tracking-widest text-muted">
                        {MANADER[d.getMonth()]} {d.getFullYear()}
                      </span>
                    </div>
                    <ManadGrid
                      ar={d.getFullYear()}
                      manad={d.getMonth()}
                      events={synligaEvents}
                      valtDag={valtDag}
                      onValjDag={dag => { if (!selectionMode) { setValtDag(dag); setValtEvent(null); setSkapar(false) } }}
                      onValjEvent={handleEventKlick}
                      onDragStart={selectionMode ? undefined : handleDragStart}
                      onDrop={dag => void handleDrop(dag)}
                      selectedIds={selectedIds}
                    />
                  </div>
                )
              })}
            </div>
          ) : (vy === '2vecka' || vy === '3vecka') ? (
            <MultiVeckaGrid
              anchor={anchor}
              numVeckor={vy === '3vecka' ? 3 : 2}
              events={synligaEvents}
              valtDag={valtDag}
              onValjDag={dag => { if (!selectionMode) { setValtDag(dag); setValtEvent(null); setSkapar(false) } }}
              onValjEvent={handleEventKlick}
              onDragStart={selectionMode ? undefined : handleDragStart}
              onDrop={(dag, bandHour) => void handleDrop(dag, false, bandHour)}
              selectedIds={selectedIds}
            />
          ) : vy === 'manad' ? (
            <ManadGrid
              ar={ar}
              manad={manad}
              events={synligaEvents}
              valtDag={valtDag}
              onValjDag={dag => {
                if (selectionMode) return
                setValtDag(dag); setValtEvent(null); setSkapar(false)
              }}
              onValjEvent={handleEventKlick}
              onDragStart={selectionMode ? undefined : handleDragStart}
              onDrop={dag => void handleDrop(dag)}
              selectedIds={selectedIds}
            />
          ) : vy === 'dag' ? (
            <DagGrid
              anchor={anchor}
              events={synligaEvents}
              onValjEvent={handleEventKlick}
              onValjDag={(dag, withTime) => {
                if (selectionMode) return
                if (withTime) {
                  handleNyttEvent(dag, true)
                } else {
                  setValtDag(dag); setValtEvent(null); setSkapar(false)
                }
              }}
              onDragStart={selectionMode ? undefined : handleDragStart}
              onDrop={(dag, withTime) => void handleDrop(dag, withTime)}
              onResize={selectionMode ? undefined : (ev, newSlut) => void handleResize(ev, newSlut)}
              selectedIds={selectedIds}
            />
          ) : (
            <VeckaGrid
              anchor={anchor}
              events={synligaEvents}
              onValjEvent={handleEventKlick}
              onValjDag={(dag, withTime) => {
                if (selectionMode) return
                if (withTime) {
                  handleNyttEvent(dag, true)
                } else {
                  setValtDag(dag); setValtEvent(null); setSkapar(false)
                }
              }}
              onDragStart={selectionMode ? undefined : handleDragStart}
              onDrop={(dag, withTime) => void handleDrop(dag, withTime)}
              onResize={selectionMode ? undefined : (ev, newSlut) => void handleResize(ev, newSlut)}
              selectedIds={selectedIds}
            />
          )}

        </div>

        {/* Right panel: detail or day events */}
        {panelOppen && (
          <div className="w-80 shrink-0 overflow-hidden flex flex-col">
            {valtEvent ? (
              <TaskDetail
                event={valtEvent}
                onStang={() => setValtEvent(null)}
                onTabort={(id) => void handleTabort(id)}
                projektNamn={valtProjektNamn}
                dokument={valtEventDokument}
                onUpload={handleUploadDokument}
                onOpenDokument={handleOpenDokument}
                onDeleteDokument={handleDeleteDokument}
                onRedigera={() => setRedigerarEvent(valtEvent)}
                onToggleSlutford={handleToggleSlutford}
                onColorChange={handleColorChange}
                onOpenEpost={valtEvent.epost_ref && onNavigate ? () => {
                  localStorage.setItem('open-crm:pending-email', JSON.stringify(valtEvent.epost_ref))
                  onNavigate('epost')
                } : undefined}
              />
            ) : valtDag ? (
              <DagPanel
                dag={valtDag}
                events={eventsPaDag(synligaEvents, valtDag)}
                onValjEvent={e => { setValtEvent(e); setSkapar(false) }}
                onNyttEvent={() => handleNyttEvent(valtDag)}
                onStang={() => setValtDag(null)}
              />
            ) : null}
          </div>
        )}
      </div>

      {/* Modal: create event */}
      {skapar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSkapar(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-[480px] max-w-[92vw] max-h-[88vh] bg-bg border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            <TaskForm
              key={formStart}
              onSpara={handleSpara}
              onStang={() => setSkapar(false)}
              onAddFile={handleAddFileSkapar}
              kunder={kunder}
              projekt={alleProjekt}
              kalendrar={kalendrar}
              anstallda={anstallda}
              initialStart={formStart}
              initialSlut={formSlut}
            />
          </div>
        </div>
      )}

      {/* Modal: edit event */}
      {redigerarEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setRedigerarEvent(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-[480px] max-w-[92vw] max-h-[88vh] bg-bg border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            <TaskEditForm
              key={redigerarEvent.id}
              event={redigerarEvent}
              onSpara={patch => handleSparaRedigering(patch)}
              onStang={() => setRedigerarEvent(null)}
            />
          </div>
        </div>
      )}

      {menuFor && (
        <KalenderMenu
          target={menuFor}
          allowDelete={menuFor.typ === 'kalender'}
          allowEdit={menuFor.typ === 'kalender' || menuFor.typ === 'kund' || menuFor.typ === 'projekt'}
          allowShare={true}
          onStang={() => setMenuFor(null)}
          onColor={async (farg) => {
            if (menuFor.typ === 'kalender' && menuFor.id) {
              await handleSparaKalender({ id: menuFor.id, namn: menuFor.namn, farg })
            } else if (menuFor.typ === 'kund' && menuFor.id) {
              await handleSetKundFarg(menuFor.id, farg)
            } else if (menuFor.typ === 'projekt' && menuFor.id) {
              await handleSetProjektFarg(menuFor.id, farg)
            }
            setMenuFor(null)
          }}
          onEdit={() => {
            if (menuFor.typ === 'kalender' && menuFor.id) {
              const k = kalendrar.find(k => k.id === menuFor.id)
              if (k) setRedigerarKalender(k)
            }
            setMenuFor(null)
          }}
          onShare={() => {
            const filter: IcsFilter =
              menuFor.typ === 'kalender' ? { kalender_id: menuFor.id! } :
              menuFor.typ === 'kund' ? { kund_id: menuFor.id! } :
              menuFor.typ === 'projekt' ? { projekt_id: menuFor.id! } :
              { lokal: true }
            setShareFor({ filter, calendarName: menuFor.namn })
            setMenuFor(null)
          }}
          onExport={async () => {
            const filter: IcsFilter =
              menuFor.typ === 'kalender' ? { kalender_id: menuFor.id! } :
              menuFor.typ === 'kund' ? { kund_id: menuFor.id! } :
              menuFor.typ === 'projekt' ? { projekt_id: menuFor.id! } :
              { lokal: true }
            await handleExportIcs(filter, menuFor.namn)
            setMenuFor(null)
          }}
          onEmpty={async () => {
            const filter: IcsFilter =
              menuFor.typ === 'kalender' ? { kalender_id: menuFor.id! } :
              menuFor.typ === 'kund' ? { kund_id: menuFor.id! } :
              menuFor.typ === 'projekt' ? { projekt_id: menuFor.id! } :
              { lokal: true }
            if (!window.confirm(`Vill du verkligen radera alla händelser i "${menuFor.namn}"?`)) return
            await handleEmpty(filter)
            setMenuFor(null)
          }}
          onDelete={async () => {
            if (menuFor.typ !== 'kalender' || !menuFor.id) return
            if (!window.confirm(`Vill du ta bort kalendern "${menuFor.namn}"? Händelserna flyttas till Lokal.`)) return
            await handleDeleteKalender(menuFor.id)
            setMenuFor(null)
          }}
        />
      )}

      {(skaparKalender || redigerarKalender) && (
        <KalenderModal
          existing={redigerarKalender}
          onStang={() => { setSkaparKalender(false); setRedigerarKalender(null) }}
          onSpara={async (data) => {
            await handleSparaKalender(data)
            setSkaparKalender(false)
            setRedigerarKalender(null)
          }}
        />
      )}

      {shareFor && (
        <ShareModal
          target={shareFor}
          onStang={() => setShareFor(null)}
          onSkicka={async (till, meddelande) => {
            await window.api.invoke('db:kalender:share-email', { ...shareFor, till, meddelande })
            setShareFor(null)
          }}
        />
      )}
    </div>
  )
}

// ─── SidebarRow ──────────────────────────────────────────────────────────────

function SidebarRow({
  label, farg, visible, onToggle, onMenu,
}: {
  label: string
  farg: string
  visible: boolean
  onToggle: () => void
  onMenu: (rect: DOMRect) => void
}) {
  return (
    <div className="group flex items-center px-4 py-1.5 text-xs text-muted hover:text-fg hover:bg-hover transition-colors">
      <button onClick={onToggle} className="flex items-center gap-2 flex-1 min-w-0">
        <span
          className="size-2.5 rounded-sm shrink-0 transition-opacity"
          style={{ backgroundColor: farg, opacity: visible ? 1 : 0.25 }}
        />
        <span className="truncate text-left">{label}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onMenu((e.currentTarget as HTMLElement).getBoundingClientRect())
        }}
        className="p-0.5 rounded text-subtle hover:text-fg hover:bg-elevated opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        title="Alternativ"
      >
        <MoreHorizontal size={14} />
      </button>
    </div>
  )
}

// ─── KalenderMenu ────────────────────────────────────────────────────────────

function KalenderMenu({
  target, allowDelete, allowEdit, allowShare,
  onStang, onColor, onEdit, onShare, onExport, onEmpty, onDelete,
}: {
  target: { rect: DOMRect; namn: string; farg: string }
  allowDelete: boolean
  allowEdit: boolean
  allowShare: boolean
  onStang: () => void
  onColor: (farg: string) => void
  onEdit: () => void
  onShare: () => void
  onExport: () => void
  onEmpty: () => void
  onDelete: () => void
}) {
  const top = Math.min(target.rect.bottom + 4, window.innerHeight - 360)
  const left = Math.min(target.rect.left, window.innerWidth - 220)
  return (
    <div className="fixed inset-0 z-50" onClick={onStang}>
      <div
        onClick={e => e.stopPropagation()}
        className="absolute w-52 bg-bg border border-border rounded-lg shadow-2xl py-1.5 text-sm"
        style={{ top, left }}
      >
        {allowEdit && (
          <button
            onClick={onEdit}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-fg hover:bg-hover transition-colors"
          >
            <Pencil size={14} className="text-muted" /> Redigera
          </button>
        )}
        {allowShare && (
          <button
            onClick={onShare}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-fg hover:bg-hover transition-colors"
          >
            <Share2 size={14} className="text-muted" /> Dela
          </button>
        )}
        <button
          onClick={onExport}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-fg hover:bg-hover transition-colors"
        >
          <Download size={14} className="text-muted" /> Exportera (.ics)
        </button>
        <button
          onClick={onEmpty}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-fg hover:bg-hover transition-colors"
        >
          <Eraser size={14} className="text-muted" /> Töm
        </button>
        {allowDelete && (
          <button
            onClick={onDelete}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-hover transition-colors"
          >
            <Trash2 size={14} /> Ta bort
          </button>
        )}
        <div className="border-t border-border mt-1.5 pt-2 px-3 pb-1">
          <p className="text-[10px] uppercase tracking-widest text-subtle mb-2 flex items-center gap-1">
            <Palette size={10} /> Färg
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {PALETTE.map(c => (
              <button
                key={c}
                onClick={() => onColor(c)}
                className={`size-5 rounded-sm border ${target.farg === c ? 'border-fg' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <input
            type="color"
            value={target.farg}
            onChange={e => onColor(e.target.value)}
            className="mt-2 w-full h-6 rounded cursor-pointer bg-transparent"
            title="Anpassad färg"
          />
        </div>
      </div>
    </div>
  )
}

// ─── KalenderModal ───────────────────────────────────────────────────────────

function KalenderModal({
  existing, onStang, onSpara,
}: {
  existing: Kalender | null
  onStang: () => void
  onSpara: (data: { id?: string; namn: string; farg: string }) => Promise<void>
}) {
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [farg, setFarg] = useState(existing?.farg ?? PALETTE[0])
  const [sparar, setSparar] = useState(false)

  async function handleSubmit() {
    if (!namn.trim()) return
    setSparar(true)
    try {
      await onSpara({ id: existing?.id, namn: namn.trim(), farg })
    } finally {
      setSparar(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onStang}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-[420px] max-w-[92vw] bg-bg border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-fg">{existing ? 'Redigera kalender' : 'Ny kalender'}</span>
          <button onClick={onStang} className="p-1 rounded text-muted hover:text-fg hover:bg-hover">
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-widest text-muted">Namn</label>
            <input
              autoFocus
              type="text"
              value={namn}
              onChange={e => setNamn(e.target.value)}
              placeholder="T.ex. Personal, Vakter, Semester"
              className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-fg/30 placeholder:text-subtle"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-widest text-muted">Färg</label>
            <div className="grid grid-cols-6 gap-2">
              {PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFarg(c)}
                  className={`size-7 rounded-md border-2 ${farg === c ? 'border-fg' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <input
              type="color"
              value={farg}
              onChange={e => setFarg(e.target.value)}
              className="mt-2 w-full h-8 rounded cursor-pointer bg-transparent"
              title="Anpassad färg"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onStang} className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-fg hover:bg-hover">
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={sparar || !namn.trim()}
            className="px-3 py-1.5 rounded-lg text-sm bg-elevated text-fg hover:bg-hover border border-border disabled:opacity-50"
          >
            {sparar ? 'Sparar…' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ShareModal ──────────────────────────────────────────────────────────────

function ShareModal({
  target, onStang, onSkicka,
}: {
  target: { calendarName: string }
  onStang: () => void
  onSkicka: (till: string, meddelande: string) => Promise<void>
}) {
  const [till, setTill] = useState('')
  const [meddelande, setMeddelande] = useState('')
  const [skickar, setSkickar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)

  async function handleSubmit() {
    if (!till.trim()) return
    setSkickar(true)
    setFel(null)
    try {
      await onSkicka(till.trim(), meddelande.trim())
    } catch (e) {
      setSkickar(false)
      setFel(e instanceof Error ? e.message : 'Fel vid skickning')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onStang}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-[460px] max-w-[92vw] bg-bg border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-fg">Dela {target.calendarName}</span>
          <button onClick={onStang} className="p-1 rounded text-muted hover:text-fg hover:bg-hover">
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4">
          {fel && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{fel}</div>}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-widest text-muted">Mottagare (e-post)</label>
            <input
              autoFocus
              type="email"
              value={till}
              onChange={e => setTill(e.target.value)}
              placeholder="namn@example.com"
              className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-fg/30 placeholder:text-subtle"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-widest text-muted">Meddelande (frivilligt)</label>
            <textarea
              value={meddelande}
              onChange={e => setMeddelande(e.target.value)}
              rows={3}
              className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-fg/30 placeholder:text-subtle resize-none"
            />
          </div>
          <p className="text-xs text-subtle">
            En .ics-fil med kalendern bifogas. Mottagaren kan importera den i Google Calendar, Apple Kalender eller Outlook.
          </p>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onStang} className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-fg hover:bg-hover">
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={skickar || !till.trim()}
            className="px-3 py-1.5 rounded-lg text-sm bg-elevated text-fg hover:bg-hover border border-border disabled:opacity-50"
          >
            {skickar ? 'Skickar…' : 'Skicka'}
          </button>
        </div>
      </div>
    </div>
  )
}
