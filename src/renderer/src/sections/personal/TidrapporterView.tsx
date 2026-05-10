import { Fragment, useState, useEffect, useCallback } from 'react'
import { Check, X, Plus, Trash2, ChevronDown, Bus, Car, Camera, Coffee, ExternalLink, Languages, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Toggle } from '../../components/Toggle'
import type { TidrapportGlobal, TidrapportBild, TidrapportTyp, TidrapportStatus } from './types'
import { TIDRAPPORT_TYPER } from './types'
import { SelectField } from '@/components/SelectField'

function fmtTime(t: string | null): string { return t ? t.slice(0, 5) : '—' }
function fmtDateTime(d: string): string { return new Date(d).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) }
const TOTAL_COLUMNS = 13
const AUTO_TRANSLATE_KEY = 'tidrapporter.autoTranslate'

const FLAG: Record<string, string> = {
  SV: '🇸🇪', EN: '🇬🇧', PL: '🇵🇱', ES: '🇪🇸', AR: '🇸🇦',
  RO: '🇷🇴', UK: '🇺🇦', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹',
  PT: '🇵🇹', RU: '🇷🇺', NO: '🇳🇴', DA: '🇩🇰', FI: '🇫🇮',
  TR: '🇹🇷', SQ: '🇦🇱', BG: '🇧🇬', HR: '🇭🇷', SR: '🇷🇸',
}
function flagOf(code: string | null): string {
  if (!code) return '🌐'
  return FLAG[code.toUpperCase()] ?? '🌐'
}

interface Projekt { id: string; namn: string; projekt_nummer: string }
interface PersonalItem { id: string; namn: string; personal_nummer: string }

function formatDate(d: string) { return new Date(d).toLocaleDateString('sv-SE') }

const STATUS_LABEL: Record<TidrapportStatus, string> = { inskickad: 'Inskickad', 'godkänd': 'Godkänd', nekad: 'Nekad' }
const STATUS_CLASS: Record<TidrapportStatus, string> = {
  inskickad: 'bg-amber-400/10 text-amber-400',
  'godkänd': 'bg-emerald-400/10 text-emerald-400',
  nekad: 'bg-red-400/10 text-red-400',
}

export function TidrapporterView() {
  const [rows, setRows] = useState<TidrapportGlobal[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<TidrapportStatus | 'alla'>('alla')
  const [filterMånad, setFilterMånad] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [approvingBulk, setApprovingBulk] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [bilderById, setBilderById] = useState<Map<string, TidrapportBild[]>>(new Map())
  const [loadingBilder, setLoadingBilder] = useState<Set<string>>(new Set())
  const [autoTranslate, setAutoTranslate] = useState<boolean>(() => {
    const stored = localStorage.getItem(AUTO_TRANSLATE_KEY)
    return stored === null ? true : stored === 'true'
  })
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set())
  const [translateError, setTranslateError] = useState<Map<string, string>>(new Map())
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sortValue(r: TidrapportGlobal, col: string): string | number {
    switch (col) {
      case 'nr': return r.personal?.personal_nummer ?? ''
      case 'anstalld': return r.personal?.namn ?? ''
      case 'projekt': return r.projekt?.projekt_nummer ?? ''
      case 'datum': return r.datum
      case 'tid': return r.incheckning ?? ''
      case 'paus': return r.paustid_minuter ?? 0
      case 'bilder': return r.bilder_antal ?? 0
      case 'transport': return r.transportmedel ?? ''
      case 'timmar': return r.timmar ?? 0
      case 'beskrivning': return r.beskrivning ?? ''
      case 'status': return r.status ?? ''
      default: return ''
    }
  }

  const sortedRows = sortCol ? [...rows].sort((a, b) => {
    const av = sortValue(a, sortCol)
    const bv = sortValue(b, sortCol)
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), 'sv')
    return sortDir === 'asc' ? cmp : -cmp
  }) : rows

  useEffect(() => {
    localStorage.setItem(AUTO_TRANSLATE_KEY, String(autoTranslate))
  }, [autoTranslate])

  // Add-form state
  const [showForm, setShowForm] = useState(false)
  const [personal, setPersonal] = useState<PersonalItem[]>([])
  const [projekt, setProjekt] = useState<Projekt[]>([])
  const [fPersonal, setFPersonal] = useState('')
  const [fProjekt, setFProjekt] = useState('')
  const [fDatum, setFDatum] = useState(new Date().toISOString().split('T')[0])
  const [fTimmar, setFTimmar] = useState('')
  const [fTyp, setFTyp] = useState<TidrapportTyp>('normal')
  const [fBeskrivning, setFBeskrivning] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const filters: { status?: string; manad?: string } = {}
      if (filterStatus !== 'alla') filters.status = filterStatus
      if (filterMånad) filters.manad = filterMånad
      const data = await window.api.invoke('db:personal-tidrapport:list-all', filters) as TidrapportGlobal[]
      setRows(data)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterMånad])

  useEffect(() => { load() }, [load])

  async function openForm() {
    if (!showForm) {
      const [p, pr] = await Promise.all([
        window.api.invoke('db:personal:list') as Promise<PersonalItem[]>,
        window.api.invoke('db:projekt:list') as Promise<Projekt[]>,
      ])
      setPersonal(p)
      setProjekt(pr.filter((x) => x))
      setFPersonal(p[0]?.id ?? '')
    }
    setShowForm((v) => !v)
  }

  async function handleCreate() {
    if (!fPersonal || !fDatum || !fTimmar) return
    setSaving(true)
    try {
      await window.api.invoke('db:personal-tidrapport:create', {
        personal_id: fPersonal,
        projekt_id: fProjekt || undefined,
        datum: fDatum,
        timmar: parseFloat(fTimmar),
        typ: fTyp,
        beskrivning: fBeskrivning || undefined,
      })
      setFTimmar(''); setFBeskrivning(''); setFProjekt('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove(id: string) {
    setActionId(id)
    try {
      const updated = await window.api.invoke('db:personal-tidrapport:approve', id) as TidrapportGlobal
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)))
      if (updated.projekt_id) {
        const namn = updated.personal?.namn ?? '—'
        await window.api.invoke('db:projekt-aktivitet:create', {
          projekt_id: updated.projekt_id,
          handelse: 'tidrapport_godkand',
          text: `Tidrapport godkänd: ${namn} · ${updated.timmar}h ${updated.datum}`,
        }).catch(() => {})
      }
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(id: string) {
    setActionId(id)
    try {
      const updated = await window.api.invoke('db:personal-tidrapport:reject', id) as TidrapportGlobal
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)))
      if (updated.projekt_id) {
        const namn = updated.personal?.namn ?? '—'
        await window.api.invoke('db:projekt-aktivitet:create', {
          projekt_id: updated.projekt_id,
          handelse: 'tidrapport_avvisad',
          text: `Tidrapport avvisad: ${namn} · ${updated.timmar}h ${updated.datum}`,
        }).catch(() => {})
      }
    } finally {
      setActionId(null)
    }
  }

  async function handleDelete(id: string) {
    setActionId(id)
    try {
      await window.api.invoke('db:personal-tidrapport:delete', id)
      setRows((prev) => prev.filter((r) => r.id !== id))
    } finally {
      setActionId(null)
    }
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmBulk(false)
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
    setConfirmBulk(false)
  }

  async function toggleExpand(r: TidrapportGlobal) {
    const willExpand = !expandedIds.has(r.id)
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(r.id) ? next.delete(r.id) : next.add(r.id)
      return next
    })
    if (!willExpand) return

    if (
      r.bilder_antal > 0 &&
      r.projekt_id &&
      !bilderById.has(r.id) &&
      !loadingBilder.has(r.id)
    ) {
      setLoadingBilder((prev) => new Set(prev).add(r.id))
      try {
        const data = await window.api.invoke('db:personal-tidrapport:bilder', {
          personalId: r.personal_id,
          projektId: r.projekt_id,
          datum: r.datum,
        }) as TidrapportBild[]
        setBilderById((prev) => new Map(prev).set(r.id, data))
      } finally {
        setLoadingBilder((prev) => { const n = new Set(prev); n.delete(r.id); return n })
      }
    }

    if (
      autoTranslate &&
      r.beskrivning?.trim() &&
      !r.beskrivning_oversatt &&
      !translatingIds.has(r.id)
    ) {
      setTranslatingIds((prev) => new Set(prev).add(r.id))
      setTranslateError((prev) => { const n = new Map(prev); n.delete(r.id); return n })
      try {
        const updated = await window.api.invoke('db:personal-tidrapport:translate', r.id) as {
          beskrivning_oversatt: string | null
          beskrivning_sprak: string | null
          beskrivning_oversatt_at: string | null
        }
        setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, ...updated } : x))
      } catch (e) {
        setTranslateError((prev) => new Map(prev).set(r.id, (e as Error).message))
      } finally {
        setTranslatingIds((prev) => { const n = new Set(prev); n.delete(r.id); return n })
      }
    }
  }

  async function handleBulkDelete() {
    setDeletingBulk(true)
    try {
      await window.api.invoke('db:personal-tidrapport:delete-many', [...selected])
      const idSet = new Set(selected)
      setRows((prev) => prev.filter((r) => !idSet.has(r.id)))
      setSelected(new Set())
      setConfirmBulk(false)
    } finally {
      setDeletingBulk(false)
    }
  }

  async function handleBulkApprove() {
    const targets = rows.filter((r) => selected.has(r.id) && r.status === 'inskickad')
    if (targets.length === 0) return
    setApprovingBulk(true)
    try {
      const updates = new Map<string, TidrapportGlobal>()
      for (const r of targets) {
        try {
          const updated = await window.api.invoke('db:personal-tidrapport:approve', r.id) as TidrapportGlobal
          updates.set(r.id, updated)
          if (updated.projekt_id) {
            const namn = updated.personal?.namn ?? '—'
            await window.api.invoke('db:projekt-aktivitet:create', {
              projekt_id: updated.projekt_id,
              handelse: 'tidrapport_godkand',
              text: `Tidrapport godkänd: ${namn} · ${updated.timmar}h ${updated.datum}`,
            }).catch(() => {})
          }
        } catch {
          // ignore individual failures so the rest still process
        }
      }
      setRows((prev) => prev.map((r) => updates.get(r.id) ?? r))
      setSelected(new Set())
    } finally {
      setApprovingBulk(false)
    }
  }

  const inskickadeSelected = rows.filter((r) => selected.has(r.id) && r.status === 'inskickad').length

  const counts = { alla: rows.length } as Record<string, number>
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex gap-1">
          {(['alla', 'inskickad', 'godkänd', 'nekad'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${filterStatus === s ? 'bg-elevated text-fg' : 'text-subtle hover:text-muted'}`}
            >
              {s === 'alla' ? 'Alla' : STATUS_LABEL[s]}
              <span className="ml-1.5 text-[10px] opacity-60">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="inline-flex items-center gap-1.5 h-7 px-2">
            <Toggle
              size="sm"
              checked={autoTranslate}
              onChange={setAutoTranslate}
              title={autoTranslate ? 'Auto-översättning på' : 'Auto-översättning av'}
            />
            <span className="text-[11px] text-muted whitespace-nowrap">Översätt</span>
          </div>
          <input
            type="month"
            className="input text-xs h-7"
            value={filterMånad}
            onChange={(e) => setFilterMånad(e.target.value)}
          />
          <button
            onClick={openForm}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs bg-elevated border border-border text-muted hover:text-fg hover:bg-hover transition-colors whitespace-nowrap"
          >
            <Plus size={12} />
            Ny rad
            <ChevronDown size={10} className={`transition-transform ${showForm ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selected.size} valda</span>
          {inskickadeSelected > 0 && !confirmBulk && (
            <button
              onClick={handleBulkApprove}
              disabled={approvingBulk}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"
            >
              <Check size={12} /> {approvingBulk ? `Godkänner ${inskickadeSelected}...` : `Godkänn ${inskickadeSelected} inskickade`}
            </button>
          )}
          {confirmBulk ? (
            <>
              <span className="text-xs text-muted">Radera {selected.size} tidrapporter?</span>
              <button onClick={handleBulkDelete} disabled={deletingBulk} className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-40 transition-colors">
                {deletingBulk ? '...' : 'Ja, radera'}
              </button>
              <button onClick={() => setConfirmBulk(false)} className="text-xs text-muted hover:text-fg transition-colors">Avbryt</button>
            </>
          ) : (
            <button onClick={() => setConfirmBulk(true)} disabled={approvingBulk} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors">
              <Trash2 size={12} /> Radera markerade
            </button>
          )}
          <button onClick={() => { setSelected(new Set()); setConfirmBulk(false) }} className="ml-auto text-xs text-muted hover:text-fg transition-colors">
            Avmarkera alla
          </button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="px-6 py-3 border-b border-border bg-elevated shrink-0">
          <div className="grid grid-cols-6 gap-2">
            <SelectField
              value={fPersonal}
              onChange={setFPersonal}
              placeholder="Välj anställd..."
              searchable
              className="col-span-2"
              options={personal.map((p) => ({ value: p.id, label: p.namn }))}
            />
            <SelectField
              value={fProjekt}
              onChange={setFProjekt}
              placeholder="Inget projekt"
              searchable
              className="col-span-2"
              options={projekt.map((p) => ({ value: p.id, label: `${p.projekt_nummer} – ${p.namn}` }))}
            />
            <input type="date" className="input text-xs" value={fDatum} onChange={(e) => setFDatum(e.target.value)} />
            <input type="number" min="0.5" step="0.5" className="input text-xs" placeholder="Timmar" value={fTimmar} onChange={(e) => setFTimmar(e.target.value)} />
          </div>
          <div className="grid grid-cols-6 gap-2 mt-2">
            <SelectField
              value={fTyp}
              onChange={(v) => setFTyp(v as TidrapportTyp)}
              options={TIDRAPPORT_TYPER.map((t) => ({ value: t.value, label: t.label }))}
            />
            <input className="input text-xs col-span-4" placeholder="Beskrivning (valfritt)" value={fBeskrivning} onChange={(e) => setFBeskrivning(e.target.value)} />
            <button
              onClick={handleCreate}
              disabled={!fPersonal || !fDatum || !fTimmar || saving}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-elevated border border-border text-fg hover:bg-hover disabled:opacity-40 transition-colors"
            >
              <Plus size={12} />
              {saving ? '...' : 'Skapa'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <p className="text-xs text-subtle text-center py-10">Laddar...</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-subtle text-center py-10">Inga tidrapporter</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-subtle">
                <th className="pl-6 pr-2 py-2 w-8 whitespace-nowrap">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-border accent-emerald-400 cursor-pointer" />
                </th>
                {([
                  ['nr', 'Nr', 'left', 'px-3'],
                  ['anstalld', 'Anställd', 'left', 'px-4'],
                  ['projekt', 'Projekt', 'left', 'px-4'],
                  ['datum', 'Datum', 'left', 'px-4'],
                  ['tid', 'Tid', 'left', 'px-3'],
                  ['paus', 'Paus', 'right', 'px-3'],
                  ['bilder', 'Bilder', 'center', 'px-3'],
                  ['transport', 'Transport', 'center', 'px-3'],
                  ['timmar', 'Timmar', 'right', 'px-4'],
                  ['beskrivning', 'Beskrivning', 'left', 'px-4'],
                  ['status', 'Status', 'left', 'px-4'],
                ] as [string, string, 'left' | 'right' | 'center', string][]).map(([col, label, align, px]) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`${px} py-2 font-medium cursor-pointer select-none hover:text-fg transition-colors group/th ${col === 'beskrivning' ? 'w-full' : 'whitespace-nowrap'}`}
                  >
                    <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
                      {label}
                      {sortCol === col
                        ? sortDir === 'asc'
                          ? <ArrowUp size={10} className="text-fg shrink-0" />
                          : <ArrowDown size={10} className="text-fg shrink-0" />
                        : <ArrowUpDown size={10} className="shrink-0 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                      }
                    </div>
                  </th>
                ))}
                <th className="px-4 py-2 whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const isSelected = selected.has(r.id)
                const isExpanded = expandedIds.has(r.id)
                const bilder = bilderById.get(r.id) ?? []
                const loadingThis = loadingBilder.has(r.id)
                return (
                <Fragment key={r.id}>
                <tr
                  onClick={() => toggleExpand(r)}
                  className={`border-b border-border hover:bg-hover group cursor-pointer ${isSelected ? 'bg-elevated' : ''} ${isExpanded ? 'bg-elevated/40' : ''}`}
                >
                  <td className="pl-6 pr-2 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.id)} className="rounded border-border accent-emerald-400 cursor-pointer" />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-subtle">
                    {r.personal?.personal_nummer ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-fg">
                    {r.personal?.namn ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-muted text-xs whitespace-nowrap">{r.projekt ? `${r.projekt.projekt_nummer} ${r.projekt.namn}` : '—'}</td>
                  <td className="px-4 py-2.5 text-muted font-mono text-xs whitespace-nowrap">{formatDate(r.datum)}</td>
                  <td className="px-3 py-2.5 text-muted font-mono text-xs tabular-nums whitespace-nowrap">
                    {r.incheckning || r.utcheckning ? `${fmtTime(r.incheckning)}–${fmtTime(r.utcheckning)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted text-xs tabular-nums">
                    {r.paustid_minuter > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <Coffee size={11} />
                        {r.paustid_minuter}m
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs">
                    {r.bilder_antal > 0 ? (
                      <span className="inline-flex items-center gap-1 text-blue-400 tabular-nums">
                        <Camera size={11} />
                        {r.bilder_antal}
                      </span>
                    ) : <span className="text-subtle">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.transportmedel === 'firmabil' ? (
                      <span className="inline-flex items-center justify-center text-emerald-400" title="Firmabil"><Car size={13} /></span>
                    ) : r.transportmedel === 'kollektivtrafik' ? (
                      <span className="inline-flex items-center justify-center text-blue-400" title="Kollektivtrafik"><Bus size={13} /></span>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-fg font-medium whitespace-nowrap">
                    {r.timmar.toFixed(1)} h
                    {r.typ !== 'normal' && (
                      <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded ${r.typ === 'övertid' ? 'bg-amber-400/10 text-amber-400' : 'bg-blue-400/10 text-blue-400'}`}>
                        {r.typ}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 max-w-0">
                    {r.beskrivning ? (
                      <span className="text-xs text-muted truncate block" title={r.beskrivning}>
                        {r.beskrivning}
                      </span>
                    ) : <span className="text-xs text-subtle">—</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {r.status === 'inskickad' && (
                        <>
                          <button
                            onClick={() => handleApprove(r.id)}
                            disabled={actionId === r.id}
                            title="Godkänn"
                            className="p-1 rounded text-subtle hover:text-emerald-400 hover:bg-hover disabled:opacity-40 transition-colors"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => handleReject(r.id)}
                            disabled={actionId === r.id}
                            title="Neka"
                            className="p-1 rounded text-subtle hover:text-red-400 hover:bg-hover disabled:opacity-40 transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </>
                      )}
                      {r.status === 'godkänd' && (
                        <button
                          onClick={() => handleReject(r.id)}
                          disabled={actionId === r.id}
                          title="Ångra godkännande"
                          className="p-1 rounded text-subtle hover:text-amber-400 hover:bg-hover disabled:opacity-40 transition-colors"
                        >
                          <X size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={actionId === r.id}
                        title="Ta bort"
                        className="p-1 rounded text-subtle hover:text-red-400 hover:bg-hover disabled:opacity-40 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-border bg-elevated/30">
                    <td colSpan={TOTAL_COLUMNS} className="px-6 py-4">
                      <div className="grid grid-cols-[1fr_auto] gap-6">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-widest text-subtle mb-1">Beskrivning</p>
                          {!r.beskrivning ? (
                            <p className="text-sm text-subtle italic">Ingen beskrivning</p>
                          ) : r.beskrivning_oversatt && r.beskrivning_sprak !== 'SV' ? (
                            <>
                              <p className="text-sm text-fg whitespace-pre-wrap">{r.beskrivning_oversatt}</p>
                              <details className="mt-2 group/orig">
                                <summary className="text-[11px] text-subtle cursor-pointer hover:text-muted inline-flex items-center gap-1.5 list-none">
                                  <span>{flagOf(r.beskrivning_sprak)}</span>
                                  <span>Original ({r.beskrivning_sprak ?? '—'})</span>
                                </summary>
                                <p className="text-xs text-muted whitespace-pre-wrap mt-1.5 pl-5 border-l-2 border-border">
                                  {r.beskrivning}
                                </p>
                              </details>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-fg whitespace-pre-wrap">{r.beskrivning}</p>
                              {translatingIds.has(r.id) && (
                                <p className="text-[11px] text-blue-400 mt-1.5 inline-flex items-center gap-1.5">
                                  <Languages size={11} className="animate-pulse" /> Översätter...
                                </p>
                              )}
                              {translateError.has(r.id) && (
                                <p className="text-[11px] text-red-400 mt-1.5">
                                  {translateError.get(r.id)}
                                </p>
                              )}
                            </>
                          )}
                          <div className="flex items-center gap-5 mt-3 text-[11px] text-subtle">
                            <span>Skapad: {fmtDateTime(r.skapad_at)}</span>
                            {r.godkand_at && <span>Godkänd: {fmtDateTime(r.godkand_at)}</span>}
                          </div>
                        </div>
                        {r.bilder_antal > 0 && (
                          <div className="shrink-0">
                            <p className="text-[10px] uppercase tracking-widest text-subtle mb-2">Bilder ({r.bilder_antal})</p>
                            {loadingThis ? (
                              <p className="text-xs text-subtle">Laddar...</p>
                            ) : (
                              <div className="flex gap-2 flex-wrap max-w-[420px]">
                                {bilder.map((b) => (
                                  <a
                                    key={b.id}
                                    href={b.signed_url ?? '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={b.filnamn}
                                    className="relative size-16 rounded border border-border overflow-hidden bg-bg hover:border-fg transition-colors group/img"
                                  >
                                    {b.signed_url ? (
                                      <img src={b.signed_url} alt={b.filnamn} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-subtle"><Camera size={16} /></div>
                                    )}
                                    <span className="absolute inset-0 flex items-center justify-center bg-bg/70 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                      <ExternalLink size={12} className="text-fg" />
                                    </span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
