import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { CalendarCheck, CalendarDays, CalendarX, ChevronDown, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, RefreshCw, FileDown, Trash2 } from 'lucide-react'
import type { ForslagWithProjekt, ForslagFas, ForslagSubfas, ForslagArbete } from '@/sections/forslag/types'
import type { AppInstallningar, PdfMall } from '@/sections/installningar/types'
import { useAppConfig } from '@/context/AppConfig'
import { useRefreshHandler } from '@/context/RefreshContext'
import { RefreshButton } from '@/components/RefreshButton'
import { buildTidplanHtml } from '@/pdf/buildTidplanHtml'

const DAY_PX = 22
const NAME_COL = 380
const ROW_H = 44
const HDR_MONTH = 22
const HDR_WEEK = 22
const HDR_DAY = 20
const DAY_LABELS = ['S', 'M', 'T', 'O', 'T', 'F', 'L']

function isoWeek(d: Date): number {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7))
  const y1 = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  return Math.ceil((((utc.getTime() - y1.getTime()) / 86400000) + 1) / 7)
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function addWorkingDays(start: Date, n: number, daysPerWeek: number): Date {
  const d = new Date(start)
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    const isWork = (dow >= 1 && dow <= 5) || (daysPerWeek >= 6 && dow === 6) || (daysPerWeek === 7 && dow === 0)
    if (isWork) added++
  }
  return d
}

function buildTimeline(faser: ForslagFas[]): { start: Date; days: Date[] } {
  const strs = faser.flatMap(f => [f.start_datum, f.slut_datum]).filter(Boolean) as string[]
  let s: Date, e: Date
  if (strs.length) {
    const ms = strs.map(x => new Date(x).getTime())
    s = addDays(new Date(Math.min(...ms)), -14)
    e = addDays(new Date(Math.max(...ms)), 21)
  } else {
    const now = new Date()
    s = new Date(now.getFullYear(), now.getMonth(), 1)
    e = addDays(s, 90)
  }
  // Align start to Monday
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7))
  // Align end to Sunday
  const edow = e.getDay()
  if (edow !== 0) e.setDate(e.getDate() + (7 - edow))
  const days: Date[] = []
  const cur = new Date(s)
  while (cur <= e) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
  return { start: s, days }
}

interface GanttProps {
  faser: ForslagFas[]
  subfaserByFas: Record<string, ForslagSubfas[]>
  arbetenBySubfas: Record<string, ForslagArbete[]>
  expandedFaser: Set<string>
  onToggleExpand: (fasId: string) => void
  onSetExpandedAll: (expanded: boolean) => void
  synkadeFaser: Set<string>
  onUpdateFas: (id: string, patch: { start_datum?: string | null; slut_datum?: string | null }) => Promise<void>
  onUpdateArbete: (id: string, antal_timmar: number) => Promise<void>
  onDeleteFas: (fas: ForslagFas) => Promise<void>
  onDesynkaFas: (fas: ForslagFas) => Promise<void>
}

function GanttChart({ faser, subfaserByFas, arbetenBySubfas, expandedFaser, onToggleExpand, onSetExpandedAll, synkadeFaser, onUpdateFas, onUpdateArbete, onDeleteFas, onDesynkaFas }: GanttProps) {
  const { formatCurrency } = useAppConfig()
  const onUpdateArbeteRef = useRef(onUpdateArbete)
  useEffect(() => { onUpdateArbeteRef.current = onUpdateArbete })
  const { start: tStart, days } = useMemo(() => buildTimeline(faser), [faser])
  const onUpdateRef = useRef(onUpdateFas)
  useEffect(() => { onUpdateRef.current = onUpdateFas })

  type DragMode = 'move' | 'resize-start' | 'resize-end'
  const dragRef = useRef<{ fasId: string; startX: number; origStart: string; origSlut: string; mode: DragMode } | null>(null)
  const [dragOffsets, setDragOffsets] = useState<Record<string, { mode: DragMode; delta: number }>>({})

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const todayIdx = daysBetween(tStart, today)

  const monthGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = []
    for (const d of days) {
      const label = d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
      if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, count: 1 })
      else groups[groups.length - 1].count++
    }
    return groups
  }, [days])

  const weekGroups = useMemo(() => {
    const groups: { weekNum: number; count: number; dayOffset: number }[] = []
    let off = 0
    for (const d of days) {
      const wn = isoWeek(d)
      if (!groups.length || groups[groups.length - 1].weekNum !== wn) groups.push({ weekNum: wn, count: 1, dayOffset: off })
      else groups[groups.length - 1].count++
      off++
    }
    return groups
  }, [days])

  function startDrag(e: React.MouseEvent, fas: ForslagFas, mode: DragMode) {
    if (!fas.start_datum || !fas.slut_datum) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { fasId: fas.id, startX: e.clientX, origStart: fas.start_datum, origSlut: fas.slut_datum, mode }
  }

  useEffect(() => {
    function clampDelta(raw: number, mode: DragMode, span: number): number {
      if (mode === 'resize-start') return Math.min(raw, span)
      if (mode === 'resize-end') return Math.max(raw, -span)
      return raw
    }
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return
      const { mode, origStart, origSlut, fasId, startX } = dragRef.current
      const span = daysBetween(new Date(origStart), new Date(origSlut))
      const delta = clampDelta(Math.round((e.clientX - startX) / DAY_PX), mode, span)
      setDragOffsets(p => ({ ...p, [fasId]: { mode, delta } }))
    }
    async function onUp(e: MouseEvent) {
      if (!dragRef.current) return
      const { mode, origStart, origSlut, fasId, startX } = dragRef.current
      const span = daysBetween(new Date(origStart), new Date(origSlut))
      const delta = clampDelta(Math.round((e.clientX - startX) / DAY_PX), mode, span)
      dragRef.current = null
      setDragOffsets(p => { const n = { ...p }; delete n[fasId]; return n })
      if (delta !== 0) {
        const patch: { start_datum?: string; slut_datum?: string } = {}
        if (mode === 'move' || mode === 'resize-start') {
          patch.start_datum = toISO(addDays(new Date(origStart), delta))
        }
        if (mode === 'move' || mode === 'resize-end') {
          patch.slut_datum = toISO(addDays(new Date(origSlut), delta))
        }
        await onUpdateRef.current(fasId, patch)
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [])

  const ganttW = days.length * DAY_PX

  const fasIdsWithSubfaser = faser.filter(f => (subfaserByFas[f.id] ?? []).length > 0).map(f => f.id)
  const allExpanded = fasIdsWithSubfaser.length > 0 && fasIdsWithSubfaser.every(id => expandedFaser.has(id))

  // Weekend red tint + vertical week dividers via repeating gradient
  const bgStripes = [
    `repeating-linear-gradient(90deg, transparent 0px, transparent ${5 * DAY_PX}px, rgba(248,113,113,0.08) ${5 * DAY_PX}px, rgba(248,113,113,0.08) ${7 * DAY_PX}px)`,
    `repeating-linear-gradient(90deg, transparent 0px, transparent ${7 * DAY_PX - 1}px, rgba(148,163,184,0.13) ${7 * DAY_PX - 1}px, rgba(148,163,184,0.13) ${7 * DAY_PX}px)`,
  ].join(', ')

  return (
    <div className="flex-1 overflow-auto">
      <div style={{ minWidth: NAME_COL + ganttW }}>

        {/* Month header */}
        <div className="sticky top-0 z-30 flex bg-sidebar border-b border-border" style={{ height: HDR_MONTH }}>
          <div className="sticky left-0 z-40 bg-sidebar border-r border-border shrink-0" style={{ width: NAME_COL }} />
          {monthGroups.map((mg, i) => (
            <div key={i} className="border-r border-border flex items-center px-2 overflow-hidden shrink-0" style={{ width: mg.count * DAY_PX, height: HDR_MONTH }}>
              <span className="text-[10px] text-muted capitalize tracking-wide truncate">{mg.label}</span>
            </div>
          ))}
        </div>

        {/* Week header */}
        <div className="sticky z-30 flex bg-sidebar border-b border-border" style={{ top: HDR_MONTH, height: HDR_WEEK }}>
          <div className="sticky left-0 z-40 bg-sidebar border-r border-border shrink-0 flex items-center px-3" style={{ width: NAME_COL }}>
            <button
              onClick={() => onSetExpandedAll(!allExpanded)}
              disabled={fasIdsWithSubfaser.length === 0}
              className="flex items-center gap-1 text-[10px] text-muted hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed"
              title={allExpanded ? 'Komprimera alla faser' : 'Expandera alla faser'}
            >
              {allExpanded ? <ChevronsUp size={11} /> : <ChevronsDown size={11} />}
              {allExpanded ? 'Komprimera alla' : 'Expandera alla'}
            </button>
          </div>
          {weekGroups.map((wg, i) => (
            <div key={i} className="border-r border-border flex items-center justify-center overflow-hidden shrink-0" style={{ width: wg.count * DAY_PX, height: HDR_WEEK }}>
              <span className="text-[10px] font-mono text-muted">v{wg.weekNum}</span>
            </div>
          ))}
        </div>

        {/* Day-of-week header */}
        <div className="sticky z-30 flex bg-sidebar border-b border-border" style={{ top: HDR_MONTH + HDR_WEEK, height: HDR_DAY }}>
          <div className="sticky left-0 z-40 bg-sidebar border-r border-border shrink-0" style={{ width: NAME_COL }} />
          {days.map((d, i) => {
            const dow = d.getDay()
            const isWeekend = dow === 0 || dow === 6
            return (
              <div
                key={i}
                className="flex items-center justify-center shrink-0"
                style={{ width: DAY_PX, height: HDR_DAY }}
              >
                <span className={`text-[9px] font-mono ${isWeekend ? 'text-red-400/70' : 'text-subtle'}`}>
                  {DAY_LABELS[dow]}
                </span>
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="relative">
          {/* Background: weekend shading + week grid lines */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ left: NAME_COL, backgroundImage: bgStripes, backgroundSize: `${7 * DAY_PX}px 100%` }}
          />

          {/* Today line */}
          {todayIdx >= 0 && todayIdx < days.length && (
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{ left: NAME_COL + todayIdx * DAY_PX, width: 2, backgroundColor: 'rgba(52,211,153,0.65)' }}
            />
          )}

          {faser.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: 160, paddingLeft: NAME_COL }}>
              <p className="text-sm text-subtle">Inga faser definerade för detta förslag.</p>
            </div>
          ) : (
            faser.map(fas => {
              const drag = dragOffsets[fas.id]
              const startDelta = drag && (drag.mode === 'move' || drag.mode === 'resize-start') ? drag.delta : 0
              const endDelta = drag && (drag.mode === 'move' || drag.mode === 'resize-end') ? drag.delta : 0
              const effStart = fas.start_datum ? addDays(new Date(fas.start_datum), startDelta) : null
              const effSlut = fas.slut_datum ? addDays(new Date(fas.slut_datum), endDelta) : null
              const hasBoth = Boolean(effStart && effSlut)
              const leftPx = effStart ? daysBetween(tStart, effStart) * DAY_PX : 0
              const widthPx = hasBoth ? (daysBetween(effStart!, effSlut!) + 1) * DAY_PX : 0
              const durDays = hasBoth ? daysBetween(effStart!, effSlut!) + 1 : null
              const durLabel = durDays === null ? null : durDays < 7 ? `${durDays}d` : `${Math.ceil(durDays / 7)}v`

              const subfaser = subfaserByFas[fas.id] ?? []
              const hasSubfaser = subfaser.length > 0
              const isExpanded = expandedFaser.has(fas.id)
              const subfasHours = (subId: string) =>
                (arbetenBySubfas[subId] ?? []).reduce((s, a) => s + (a.antal_timmar ?? 0), 0)
              const totalHours = subfaser.reduce((s, x) => s + subfasHours(x.id), 0)

              return (
                <Fragment key={fas.id}>
                <div className="group/row flex border-b border-border hover:bg-hover/60" style={{ height: ROW_H }}>
                  {/* Sticky left: name + date inputs */}
                  <div className="sticky left-0 z-10 bg-bg group-hover/row:bg-hover border-r border-border shrink-0 flex flex-col justify-center px-4" style={{ width: NAME_COL }}>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => hasSubfaser && onToggleExpand(fas.id)}
                        className={`shrink-0 ${hasSubfaser ? 'text-muted hover:text-fg' : 'text-subtle/30 cursor-default'}`}
                        title={hasSubfaser ? (isExpanded ? 'Dölj subfaser' : 'Visa subfaser') : 'Inga subfaser'}
                      >
                        {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                      <span className="text-xs font-medium text-fg truncate">{fas.namn}</span>
                      {synkadeFaser.has(fas.id) && (
                        <>
                          <CalendarCheck size={11} className="text-emerald-400 shrink-0" />
                          <button
                            onClick={() => void onDesynkaFas(fas)}
                            className="opacity-0 group-hover/row:opacity-100 transition-opacity text-muted hover:text-red-400 shrink-0"
                            title="Ta bort fas-händelse från kalendern"
                          >
                            <CalendarX size={11} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => void onDeleteFas(fas)}
                        className="opacity-0 group-hover/row:opacity-100 transition-opacity ml-auto text-muted hover:text-red-400 shrink-0"
                        title="Ta bort fas"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        key={`s-${fas.id}-${fas.start_datum}`}
                        type="date"
                        defaultValue={fas.start_datum ?? ''}
                        onBlur={async (e) => {
                          if (e.target.value !== (fas.start_datum ?? ''))
                            await onUpdateRef.current(fas.id, { start_datum: e.target.value || null })
                        }}
                        className="text-[10px] bg-transparent text-muted font-mono focus:outline-none focus:text-fg"
                        style={{ width: 88 }}
                      />
                      <span className="text-[10px] text-subtle shrink-0">→</span>
                      <input
                        key={`e-${fas.id}-${fas.slut_datum}`}
                        type="date"
                        defaultValue={fas.slut_datum ?? ''}
                        onBlur={async (e) => {
                          if (e.target.value !== (fas.slut_datum ?? ''))
                            await onUpdateRef.current(fas.id, { slut_datum: e.target.value || null })
                        }}
                        className="text-[10px] bg-transparent text-muted font-mono focus:outline-none focus:text-fg"
                        style={{ width: 88 }}
                      />
                    </div>
                  </div>

                  {/* Gantt area */}
                  <div className="relative" style={{ width: ganttW }}>
                    {hasBoth && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 rounded flex items-center justify-start overflow-hidden select-none"
                        style={{
                          left: leftPx,
                          width: Math.max(widthPx, 4),
                          height: 22,
                          background: 'rgba(52,211,153,0.18)',
                          border: '1px solid rgba(52,211,153,0.45)',
                          cursor: 'grab',
                        }}
                        onMouseDown={(e) => startDrag(e, fas, 'move')}
                      >
                        {widthPx >= DAY_PX && durLabel && (
                          <span className="text-[10px] text-emerald-300 font-medium truncate px-2 pointer-events-none">{durLabel}</span>
                        )}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1.5 hover:bg-emerald-400/40"
                          style={{ cursor: 'ew-resize' }}
                          onMouseDown={(e) => startDrag(e, fas, 'resize-start')}
                          title="Ändra startdatum"
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1.5 hover:bg-emerald-400/40"
                          style={{ cursor: 'ew-resize' }}
                          onMouseDown={(e) => startDrag(e, fas, 'resize-end')}
                          title="Ändra slutdatum"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Subfas + arbete rows — proportional segments inside fas range */}
                {isExpanded && subfaser.map((sub, i) => {
                  const subHours = subfasHours(sub.id)
                  const fraction = totalHours > 0
                    ? subHours / totalHours
                    : 1 / subfaser.length
                  const cumFraction = subfaser.slice(0, i).reduce((s, x) => {
                    const xH = subfasHours(x.id)
                    return s + (totalHours > 0 ? xH / totalHours : 1 / subfaser.length)
                  }, 0)
                  const subLeftPx = leftPx + cumFraction * widthPx
                  const subWidthPx = fraction * widthPx
                  const arbeten = arbetenBySubfas[sub.id] ?? []
                  return (
                    <Fragment key={sub.id}>
                      <div className="group/sub flex border-b border-border/50 hover:bg-hover/40" style={{ height: 26 }}>
                        <div className="sticky left-0 z-10 bg-bg/70 group-hover/sub:bg-hover border-r border-border shrink-0 flex items-center pl-9 pr-3" style={{ width: NAME_COL }}>
                          <span className="text-[11px] text-fg/85 font-medium truncate">{sub.namn}</span>
                          {subHours > 0 && (
                            <span className="ml-auto text-[10px] font-mono text-muted shrink-0">{subHours}h</span>
                          )}
                        </div>
                        <div className="relative" style={{ width: ganttW }}>
                          {hasBoth && (
                            <div
                              className="absolute top-1/2 -translate-y-1/2 rounded-sm pointer-events-none"
                              style={{
                                left: subLeftPx,
                                width: Math.max(subWidthPx, 2),
                                height: 8,
                                background: 'rgba(52,211,153,0.32)',
                              }}
                              title={`${sub.namn}${subHours ? ` · ${subHours}h` : ''}`}
                            />
                          )}
                        </div>
                      </div>
                      {arbeten.map((a) => (
                        <div key={a.id} className="group/arb flex border-b border-border/30 hover:bg-hover/40" style={{ height: 22 }}>
                          <div className="sticky left-0 z-10 bg-bg/40 group-hover/arb:bg-hover border-r border-border shrink-0 flex items-center gap-2 pl-12 pr-3" style={{ width: NAME_COL }}>
                            <span className="text-[10px] text-muted truncate flex-1">{a.beskrivning || '—'}</span>
                            <span className="text-[10px] text-subtle truncate shrink-0" style={{ width: 80 }}>{a.yrkesroll || ''}</span>
                            <input
                              key={`a-${a.id}-${a.antal_timmar}`}
                              type="number"
                              min={0}
                              step={0.5}
                              defaultValue={a.antal_timmar}
                              onBlur={async (e) => {
                                const v = parseFloat(e.target.value)
                                if (!isNaN(v) && v !== a.antal_timmar) {
                                  await onUpdateArbeteRef.current(a.id, v)
                                }
                              }}
                              className="text-[10px] bg-transparent text-fg font-mono text-right focus:outline-none focus:bg-elevated rounded px-1 shrink-0"
                              style={{ width: 44 }}
                              title="Timmar"
                            />
                            <span className="text-[10px] font-mono text-subtle text-right shrink-0 tabular-nums" style={{ width: 76 }}>
                              {formatCurrency(a.antal_timmar * a.timpris, 0)}
                            </span>
                          </div>
                          <div className="relative" style={{ width: ganttW }} />
                        </div>
                      ))}
                    </Fragment>
                  )
                })}
                </Fragment>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export function TidplanSection() {
  const { config } = useAppConfig()
  const [forslag, setForslag] = useState<ForslagWithProjekt[]>([])
  const [selected, setSelected] = useState<ForslagWithProjekt | null>(null)
  const [faser, setFaser] = useState<ForslagFas[]>([])
  const [subfaserByFas, setSubfaserByFas] = useState<Record<string, ForslagSubfas[]>>({})
  const [arbetenBySubfas, setArbetenBySubfas] = useState<Record<string, ForslagArbete[]>>({})
  const [expandedFaser, setExpandedFaser] = useState<Set<string>>(new Set())
  const [synkadeFaser, setSynkadeFaser] = useState<Set<string>>(new Set())
  const [forslagListOpen, setForslagListOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [synkar, setSynkar] = useState(false)
  const [exportando, setExportando] = useState(false)
  const faserRef = useRef<ForslagFas[]>([])
  useEffect(() => { faserRef.current = faser }, [faser])

  const reloadForslag = useCallback(async () => {
    const d = await window.api.invoke('db:forslag:list') as ForslagWithProjekt[]
    setForslag(d)
  }, [])

  useEffect(() => { void reloadForslag() }, [reloadForslag])
  useRefreshHandler(useCallback(async () => {
    await reloadForslag()
    if (selected) await selectForslag(selected)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadForslag, selected]))

  async function selectForslag(f: ForslagWithProjekt) {
    setSelected(f)
    setFaser([])
    setSubfaserByFas({})
    setArbetenBySubfas({})
    setExpandedFaser(new Set())
    setSynkadeFaser(new Set())
    setLoading(true)

    const [data, hoursByFas, cfg, synkStatus, subfaser, arbeten] = await Promise.all([
      window.api.invoke('db:forslag-faser:list', f.id) as Promise<ForslagFas[]>,
      window.api.invoke('db:forslag:get-hours-by-fas', f.id) as Promise<Record<string, number>>,
      window.api.invoke('db:installningar:get') as Promise<AppInstallningar>,
      window.api.invoke('db:tidplan:synka-status', f.projekt_id) as Promise<string[]>,
      window.api.invoke('db:forslag-subfaser:list-by-forslag', f.id) as Promise<ForslagSubfas[]>,
      window.api.invoke('db:forslag-arbete:list-by-forslag', f.id) as Promise<ForslagArbete[]>,
    ])

    const timmarPerDag = cfg?.timmar_per_dag ?? 8
    const daysPerWeek = cfg?.arbetsdagar_per_vecka ?? 5

    for (const fas of data) {
      const needsCalc = fas.start_datum && (!fas.slut_datum || fas.slut_datum === fas.start_datum)
      if (needsCalc) {
        const hours = hoursByFas[fas.id] ?? 0
        if (hours > 0) {
          const workDays = Math.max(1, Math.ceil(hours / timmarPerDag))
          fas.slut_datum = toISO(addWorkingDays(new Date(fas.start_datum!), workDays, daysPerWeek))
          window.api.invoke('db:forslag-faser:update', fas.id, { slut_datum: fas.slut_datum })
        }
      }
    }

    const byFas: Record<string, ForslagSubfas[]> = {}
    for (const s of subfaser) {
      if (!byFas[s.fas_id]) byFas[s.fas_id] = []
      byFas[s.fas_id].push(s)
    }
    for (const arr of Object.values(byFas)) arr.sort((a, b) => a.sortering - b.sortering)

    const bySubfas: Record<string, ForslagArbete[]> = {}
    for (const a of arbeten) {
      if (!bySubfas[a.subfas_id]) bySubfas[a.subfas_id] = []
      bySubfas[a.subfas_id].push(a)
    }
    for (const arr of Object.values(bySubfas)) arr.sort((a, b) => a.skapad_at.localeCompare(b.skapad_at))

    setFaser(data)
    setSubfaserByFas(byFas)
    setArbetenBySubfas(bySubfas)
    setSynkadeFaser(new Set(synkStatus))
    setLoading(false)
  }

  const handleUpdateArbete = useCallback(async (id: string, antal_timmar: number) => {
    setArbetenBySubfas(prev => {
      const next: Record<string, ForslagArbete[]> = {}
      for (const [k, arr] of Object.entries(prev)) {
        next[k] = arr.map(a => a.id === id ? { ...a, antal_timmar } : a)
      }
      return next
    })
    try {
      await window.api.invoke('db:forslag-arbete:update', id, { antal_timmar })
    } catch {
      if (selected) {
        const arbeten = await window.api.invoke('db:forslag-arbete:list-by-forslag', selected.id) as ForslagArbete[]
        const bySubfas: Record<string, ForslagArbete[]> = {}
        for (const a of arbeten) {
          if (!bySubfas[a.subfas_id]) bySubfas[a.subfas_id] = []
          bySubfas[a.subfas_id].push(a)
        }
        for (const arr of Object.values(bySubfas)) arr.sort((a, b) => a.skapad_at.localeCompare(b.skapad_at))
        setArbetenBySubfas(bySubfas)
      }
    }
  }, [selected])

  const toggleExpand = useCallback((fasId: string) => {
    setExpandedFaser(prev => {
      const n = new Set(prev)
      if (n.has(fasId)) n.delete(fasId); else n.add(fasId)
      return n
    })
  }, [])

  const handleSetExpandedAll = useCallback((expanded: boolean) => {
    if (!expanded) { setExpandedFaser(new Set()); return }
    const ids = faser.filter(f => (subfaserByFas[f.id] ?? []).length > 0).map(f => f.id)
    setExpandedFaser(new Set(ids))
  }, [faser, subfaserByFas])

  async function handleSynka() {
    if (!selected) return
    setSynkar(true)
    try {
      const fasmed = faserRef.current.filter(f => f.start_datum && f.slut_datum)
      const fanns = synkadeFaser.size > 0
      const result = await window.api.invoke('db:tidplan:synka', {
        projekt_id: selected.projekt_id,
        projekt_nummer: selected.projekt.projekt_nummer,
        faser: fasmed.map(f => ({ id: f.id, namn: f.namn, start_datum: f.start_datum!, slut_datum: f.slut_datum! })),
      }) as string[]
      setSynkadeFaser(new Set(result))
      await window.api.invoke('db:projekt-aktivitet:create', {
        projekt_id: selected.projekt_id,
        handelse: 'tidplan_importerad',
        text: `Tidplan ${fanns ? 'uppdaterad' : 'importerad'} till kalender: ${result.length} ${result.length === 1 ? 'fas' : 'faser'} (${selected.forslag_nummer})`,
      }).catch(() => {})
    } finally {
      setSynkar(false)
    }
  }

  async function handleDesynka() {
    if (!selected) return
    const ok = window.confirm('Ta bort alla fas-händelser från kalendern för detta projekt?')
    if (!ok) return
    setSynkar(true)
    try {
      const antal = synkadeFaser.size
      await window.api.invoke('db:tidplan:desynka', selected.projekt_id)
      setSynkadeFaser(new Set())
      await window.api.invoke('db:projekt-aktivitet:create', {
        projekt_id: selected.projekt_id,
        handelse: 'tidplan_fas_borttagen',
        text: `Tidplan-händelser borttagna från kalender: ${antal} ${antal === 1 ? 'fas' : 'faser'} (${selected.forslag_nummer})`,
      }).catch(() => {})
    } finally {
      setSynkar(false)
    }
  }

  async function handleExportPdf() {
    if (!selected) return
    setExportando(true)
    try {
      let mall: Partial<PdfMall> | null = null
      try {
        mall = await window.api.invoke('db:pdf-mall:get', 'forslag') as PdfMall
      } catch { /* no mall configured, use defaults */ }
      const html = buildTidplanHtml(selected, faserRef.current, mall, config)
      await window.api.invoke('pdf:generate-html', {
        html,
        name: `tidplan-${selected.forslag_nummer}`,
        save: true,
        landscape: true,
      })
    } finally {
      setExportando(false)
    }
  }

  async function handleDeleteForslag(f: ForslagWithProjekt, e: React.MouseEvent) {
    e.stopPropagation()
    const ok = window.confirm(`Ta bort förslag ${f.forslag_nummer} — ${f.titel}?\n\nAlla faser och kalender-händelser tas också bort.`)
    if (!ok) return
    await window.api.invoke('db:tidplan:desynka-forslag', f.id)
    await window.api.invoke('db:forslag:delete', f.id)
    setForslag(prev => prev.filter(x => x.id !== f.id))
    if (selected?.id === f.id) {
      setSelected(null)
      setFaser([])
      setSynkadeFaser(new Set())
    }
  }

  const handleDeleteFas = useCallback(async (fas: ForslagFas) => {
    const ok = window.confirm(`Ta bort fas "${fas.namn}"?\n\nKostnader och kalender-händelse för denna fas tas också bort.`)
    if (!ok) return
    if (synkadeFaser.has(fas.id)) {
      await window.api.invoke('db:tidplan:desynka-fas', fas.id)
    }
    await window.api.invoke('db:forslag-faser:delete', fas.id)
    setFaser(prev => prev.filter(f => f.id !== fas.id))
    setSynkadeFaser(prev => { const n = new Set(prev); n.delete(fas.id); return n })
    if (selected?.projekt_id) {
      await window.api.invoke('db:projekt-aktivitet:create', {
        projekt_id: selected.projekt_id,
        handelse: 'tidplan_fas_borttagen',
        text: `Tidplan-fas borttagen: "${fas.namn}"`,
      }).catch(() => {})
    }
  }, [synkadeFaser, selected])

  const handleDesynkaFas = useCallback(async (fas: ForslagFas) => {
    const ok = window.confirm(`Ta bort fas-händelse "${fas.namn}" från kalendern?`)
    if (!ok) return
    await window.api.invoke('db:tidplan:desynka-fas', fas.id)
    setSynkadeFaser(prev => { const n = new Set(prev); n.delete(fas.id); return n })
  }, [])

  const handleUpdateFas = useCallback(async (id: string, patch: { start_datum?: string | null; slut_datum?: string | null }) => {
    setFaser(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
    try {
      await window.api.invoke('db:forslag-faser:update', id, patch)
      // Auto-sync kalender event if this fas is already synced
      const current = faserRef.current.find(f => f.id === id)
      const merged = { ...current, ...patch }
      if (merged.start_datum && merged.slut_datum) {
        const isSynked = await window.api.invoke('db:tidplan:synka-status',
          forslag.find(f => f.id === current?.forslag_id)?.projekt_id ?? '') as string[]
        if (isSynked.includes(id)) {
          await window.api.invoke('db:tidplan:synka-fas', {
            fas_id: id,
            start_datum: merged.start_datum,
            slut_datum: merged.slut_datum,
          })
        }
      }
    } catch {
      window.api.invoke('db:forslag-faser:list', selected?.id ?? '').then((d) => setFaser(d as ForslagFas[]))
    }
  }, [selected?.id, forslag])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return forslag.filter(f =>
      f.titel.toLowerCase().includes(q) ||
      f.forslag_nummer.toLowerCase().includes(q) ||
      f.projekt.namn.toLowerCase().includes(q) ||
      f.projekt.kunder.namn.toLowerCase().includes(q)
    )
  }, [forslag, search])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <p className="text-[11px] uppercase tracking-widest text-muted">Tidplan</p>
        <RefreshButton />
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left panel — Förslag list (collapsible) */}
        <div className={`shrink-0 border-r border-border flex flex-col transition-[width] duration-150 ${forslagListOpen ? 'w-96' : 'w-9'}`}>
          <div className="px-2 py-2 border-b border-border shrink-0 flex items-center gap-1.5">
            <button
              onClick={() => setForslagListOpen(o => !o)}
              className="text-muted hover:text-fg p-1 shrink-0"
              title={forslagListOpen ? 'Dölj förslagslista' : 'Visa förslagslista'}
            >
              {forslagListOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
            {forslagListOpen && (
              <input
                type="text" placeholder="Sök kund, projekt, förslag..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input flex-1 text-xs"
              />
            )}
          </div>
          {forslagListOpen && (
            <div className="flex-1 overflow-auto">
              {filtered.map((f) => (
                <div
                  key={f.id}
                  className={`group/forslag relative border-b border-border transition-colors ${selected?.id === f.id ? 'bg-hover' : 'hover:bg-hover'}`}
                >
                  <button
                    onClick={() => selectForslag(f)}
                    className="w-full text-left px-4 py-3 pr-9"
                  >
                    <p className="text-xs font-semibold text-fg truncate">{f.projekt.kunder.namn}</p>
                    <p className="text-[11px] text-fg/75 truncate mt-0.5">{f.projekt.namn}</p>
                    <p className="text-[10px] text-muted mt-1 font-mono truncate">{f.forslag_nummer} · {f.titel}</p>
                  </button>
                  <button
                    onClick={(e) => void handleDeleteForslag(f, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/forslag:opacity-100 transition-opacity p-1.5 rounded text-muted hover:text-red-400 hover:bg-bg"
                    title="Ta bort förslag"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="px-4 py-8 text-xs text-subtle text-center">Inga förslag hittades.</p>
              )}
            </div>
          )}
        </div>

        {/* Right panel — Gantt */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-subtle">Välj ett förslag för att visa tidplanen</p>
            </div>
          ) : loading ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-subtle">Laddar...</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-3 border-b border-border shrink-0 flex items-center gap-3">
                <span className="font-mono text-xs text-muted">{selected.forslag_nummer}</span>
                <span className="text-sm font-semibold text-fg">{selected.titel}</span>
                <span className="text-xs text-muted">· {selected.projekt.kunder.namn}</span>
                {todayBadge()}
                <button
                  onClick={() => void handleSynka()}
                  disabled={synkar || faser.filter(f => f.start_datum && f.slut_datum).length === 0}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs border border-border text-muted hover:text-fg hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Lägg till faser i kalendern"
                >
                  {synkar
                    ? <RefreshCw size={11} className="animate-spin" />
                    : <CalendarDays size={11} />}
                  {synkar ? 'Bearbetar…' : synkadeFaser.size > 0 ? 'Uppdatera kalender' : 'Lägg till i kalender'}
                </button>
                {synkadeFaser.size > 0 && (
                  <button
                    onClick={() => void handleDesynka()}
                    disabled={synkar}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs border border-border text-muted hover:text-red-400 hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Ta bort alla fas-händelser från kalendern"
                  >
                    <CalendarX size={11} />
                    Ta bort från kalender
                  </button>
                )}
                <button
                  onClick={() => void handleExportPdf()}
                  disabled={exportando || faser.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs border border-border text-muted hover:text-fg hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Exportera tidplan som PDF"
                >
                  <FileDown size={11} />
                  {exportando ? 'Genererar…' : 'Exportera PDF'}
                </button>
              </div>
              <GanttChart
                faser={faser}
                subfaserByFas={subfaserByFas}
                arbetenBySubfas={arbetenBySubfas}
                expandedFaser={expandedFaser}
                onToggleExpand={toggleExpand}
                onSetExpandedAll={handleSetExpandedAll}
                synkadeFaser={synkadeFaser}
                onUpdateFas={handleUpdateFas}
                onUpdateArbete={handleUpdateArbete}
                onDeleteFas={handleDeleteFas}
                onDesynkaFas={handleDesynkaFas}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function todayBadge() {
  const d = new Date()
  return (
    <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted">
      <span className="size-1.5 rounded-full bg-emerald-400" />
      Idag: {d.toLocaleDateString('sv-SE')} · v{isoWeek(d)}
    </span>
  )
}
