import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Download, FileText, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react'
import { SelectField } from '@/components/SelectField'
import type { TidrapportGlobal, Personal, LonepostGlobal, PdfSettings } from './types'
import { LONEPOST_TYPER } from './types'

// ─── Column definitions (CSV table) ───────────────────────────────────────────

type ColKey =
  | 'personal_nummer' | 'namn' | 'datum' | 'incheckning' | 'utcheckning'
  | 'paustid_minuter' | 'timmar' | 'typ' | 'projekt_nummer' | 'projekt_namn'
  | 'transportmedel' | 'beskrivning' | 'status'

const ALL_COLS: { key: ColKey; label: string; defaultOn: boolean }[] = [
  { key: 'personal_nummer', label: 'Anst.nr',    defaultOn: true },
  { key: 'namn',            label: 'Namn',        defaultOn: true },
  { key: 'datum',           label: 'Datum',       defaultOn: true },
  { key: 'incheckning',     label: 'In',          defaultOn: true },
  { key: 'utcheckning',     label: 'Ut',          defaultOn: true },
  { key: 'paustid_minuter', label: 'Paus(min)',   defaultOn: true },
  { key: 'timmar',          label: 'Timmar',      defaultOn: true },
  { key: 'typ',             label: 'Typ',         defaultOn: true },
  { key: 'projekt_nummer',  label: 'Proj.nr',     defaultOn: true },
  { key: 'projekt_namn',    label: 'Projekt',     defaultOn: true },
  { key: 'transportmedel',  label: 'Transport',   defaultOn: false },
  { key: 'beskrivning',     label: 'Beskrivning', defaultOn: false },
  { key: 'status',          label: 'Status',      defaultOn: false },
]

const DEFAULT_COLS = new Set<ColKey>(
  ALL_COLS.filter((c) => c.defaultOn).map((c) => c.key)
)

// ─── Types ─────────────────────────────────────────────────────────────────────

interface EmployeeGroup {
  personal: Personal
  tidrapporter: TidrapportGlobal[]
  loneposter: LonepostGlobal[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function currentMonthRange(): { from: string; to: string } {
  const n = new Date()
  const y = n.getFullYear()
  const m = n.getMonth() + 1
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

function cellValue(r: TidrapportGlobal, key: ColKey): string {
  switch (key) {
    case 'personal_nummer': return r.personal?.personal_nummer ?? '—'
    case 'namn':            return r.personal?.namn ?? '—'
    case 'datum':           return new Date(r.datum).toLocaleDateString('sv-SE')
    case 'incheckning':     return r.incheckning ? r.incheckning.slice(0, 5) : '—'
    case 'utcheckning':     return r.utcheckning ? r.utcheckning.slice(0, 5) : '—'
    case 'paustid_minuter': return String(r.paustid_minuter)
    case 'timmar':          return r.timmar.toFixed(2).replace('.', ',')
    case 'typ':             return r.typ
    case 'projekt_nummer':  return r.projekt?.projekt_nummer ?? '—'
    case 'projekt_namn':    return r.projekt?.namn ?? '—'
    case 'transportmedel':  return r.transportmedel ?? '—'
    case 'beskrivning':     return r.beskrivning ?? ''
    case 'status':          return r.status
  }
}

function effectiveTimlon(p: Personal): number | null {
  if (p.loneform === 'TIM' && p.timlön) return p.timlön
  if (p.loneform === 'MAN' && p.manadslön) return Math.round((p.manadslön / 173) * 100) / 100
  return null
}

function lonepostSign(typ: string): 1 | -1 {
  return LONEPOST_TYPER.find((t) => t.value === typ)?.sign ?? 1
}

function filterLoneposterBySettings(posts: LonepostGlobal[], settings: PdfSettings): LonepostGlobal[] {
  return posts.filter((l) => {
    if (l.typ === 'tillägg'     && !settings.showLonepostTillagg)     return false
    if (l.typ === 'traktamente' && !settings.showLonepostTraktamente) return false
    if (l.typ === 'utlägg'      && !settings.showLonepostUtlagg)      return false
    if (l.typ === 'avdrag'      && !settings.showLonepostAvdrag)      return false
    if (l.typ === 'förskott'    && !settings.showLonepostForskott)    return false
    return true
  })
}

function fmt(n: number): string {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function downloadCsv(rows: TidrapportGlobal[], cols: ColKey[], from: string, to: string): void {
  const sep = ';'
  const header = cols.map((k) => ALL_COLS.find((c) => c.key === k)!.label).join(sep)
  const lines = rows.map((r) =>
    cols.map((k) => {
      const v = cellValue(r, k)
      return v.includes(sep) || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"` : v
    }).join(sep)
  )
  const blob = new Blob(['﻿' + [header, ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `timrapport_${from}_${to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const STATUS_OPTIONS = [
  { value: '', label: 'Alla statusar' },
  { value: 'inskickad', label: 'Inskickad' },
  { value: 'godkänd', label: 'Godkänd' },
  { value: 'nekad', label: 'Nekad' },
]

// ─── Print-only PDF component ──────────────────────────────────────────────────

function PrintReport({
  groups, settings, from, to,
}: {
  groups: EmployeeGroup[]
  settings: PdfSettings
  from: string
  to: string
}) {
  const grandTimmar = groups.reduce((s, g) => s + g.tidrapporter.reduce((a, r) => a + r.timmar, 0), 0)
  const grandLonekostnad = groups.reduce((s, g) => {
    const rate = effectiveTimlon(g.personal)
    if (!rate) return s
    return s + g.tidrapporter.reduce((a, r) => a + r.timmar, 0) * rate
  }, 0)
  // Grand totals must also respect type filters
  const grandTillagg = groups.reduce((s, g) =>
    s + filterLoneposterBySettings(g.loneposter, settings).filter((l) => lonepostSign(l.typ) === 1).reduce((a, l) => a + l.belopp, 0), 0)
  const grandAvdrag = groups.reduce((s, g) =>
    s + filterLoneposterBySettings(g.loneposter, settings).filter((l) => lonepostSign(l.typ) === -1).reduce((a, l) => a + l.belopp, 0), 0)

  const tdStyle: React.CSSProperties = { border: '1px solid #ccc', padding: '4px 8px', fontSize: 11, textAlign: 'left', whiteSpace: 'nowrap' }
  const thStyle: React.CSSProperties = { ...tdStyle, background: '#f5f5f5', fontWeight: 600 }

  return (
    <div id="print-report" style={{ fontFamily: 'Arial, sans-serif', color: '#111', background: '#fff', padding: 40, display: 'none' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Timrapport</h1>
        <p style={{ fontSize: 12, color: '#555', margin: '4px 0 0' }}>
          Period: {new Date(from).toLocaleDateString('sv-SE')} – {new Date(to).toLocaleDateString('sv-SE')}
        </p>
        <p style={{ fontSize: 11, color: '#888', margin: '2px 0 0' }}>
          Genererad: {new Date().toLocaleDateString('sv-SE')}
        </p>
      </div>

      <hr style={{ borderColor: '#ddd', marginBottom: 24 }} />

      {/* Per-employee sections */}
      {groups.map((g) => {
        const rate = effectiveTimlon(g.personal)
        const totalTimmar = g.tidrapporter.reduce((s, r) => s + r.timmar, 0)
        const laborCost = rate != null ? totalTimmar * rate : null
        const visibleLoneposter = filterLoneposterBySettings(g.loneposter, settings)
        const tillagg = visibleLoneposter.filter((l) => lonepostSign(l.typ) === 1).reduce((s, l) => s + l.belopp, 0)
        const avdrag = visibleLoneposter.filter((l) => lonepostSign(l.typ) === -1).reduce((s, l) => s + l.belopp, 0)
        const netto = laborCost != null ? laborCost + tillagg - avdrag : null

        return (
          <div key={g.personal.id} style={{ marginBottom: 32, pageBreakInside: 'avoid' }}>
            {/* Employee header */}
            <div style={{ background: '#f0f0f0', padding: '8px 12px', marginBottom: 10, borderRadius: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{g.personal.namn}</span>
              <span style={{ fontSize: 12, color: '#555', marginLeft: 10 }}>{g.personal.personal_nummer}</span>
              {settings.showTimlon && rate != null && (
                <span style={{ fontSize: 11, color: '#555', marginLeft: 16 }}>
                  {g.personal.loneform === 'MAN'
                    ? `Månadslön: ${fmt(g.personal.manadslön!)} kr → ${fmt(rate)} kr/h`
                    : `Timlön: ${fmt(rate)} kr/h`}
                </span>
              )}
            </div>

            {/* Tidrapporter */}
            {settings.showTimrapporter && g.tidrapporter.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#888', marginBottom: 6 }}>Tidrapporter</p>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Datum</th>
                      {settings.showColIn    && <th style={thStyle}>In</th>}
                      {settings.showColIn    && <th style={thStyle}>Ut</th>}
                      {settings.showColPaus  && <th style={thStyle}>Paus(min)</th>}
                      <th style={{ ...thStyle, textAlign: 'right' }}>Timmar</th>
                      {settings.showColTyp     && <th style={thStyle}>Typ</th>}
                      {settings.showColProjekt && <th style={thStyle}>Projekt</th>}
                      {settings.showColTransport   && <th style={thStyle}>Transport</th>}
                      {settings.showColBeskrivning && <th style={{ ...thStyle, maxWidth: 200 }}>Beskrivning</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {g.tidrapporter.map((r) => (
                      <tr key={r.id}>
                        <td style={tdStyle}>{new Date(r.datum).toLocaleDateString('sv-SE')}</td>
                        {settings.showColIn   && <td style={tdStyle}>{r.incheckning ? r.incheckning.slice(0, 5) : '—'}</td>}
                        {settings.showColIn   && <td style={tdStyle}>{r.utcheckning ? r.utcheckning.slice(0, 5) : '—'}</td>}
                        {settings.showColPaus && <td style={{ ...tdStyle, textAlign: 'center' }}>{r.paustid_minuter}</td>}
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.timmar)}</td>
                        {settings.showColTyp     && <td style={tdStyle}>{r.typ}</td>}
                        {settings.showColProjekt && <td style={tdStyle}>{r.projekt ? `${r.projekt.projekt_nummer} – ${r.projekt.namn}` : '—'}</td>}
                        {settings.showColTransport   && <td style={tdStyle}>{r.transportmedel ?? '—'}</td>}
                        {settings.showColBeskrivning && (
                          <td style={{ ...tdStyle, maxWidth: 200, whiteSpace: 'normal' }}>
                            {r.beskrivning_oversatt ?? r.beskrivning ?? ''}
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr>
                      {/* Dynamic colSpan: Datum + optional cols before Timmar */}
                      <td
                        colSpan={1 + (settings.showColIn ? 2 : 0) + (settings.showColPaus ? 1 : 0)}
                        style={{ ...tdStyle, fontWeight: 600 }}
                      >
                        Totalt
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(totalTimmar)}</td>
                      {/* Remaining cols after Timmar */}
                      {((settings.showColTyp ? 1 : 0) + (settings.showColProjekt ? 1 : 0) + (settings.showColTransport ? 1 : 0) + (settings.showColBeskrivning ? 1 : 0)) > 0 && (
                        <td
                          colSpan={(settings.showColTyp ? 1 : 0) + (settings.showColProjekt ? 1 : 0) + (settings.showColTransport ? 1 : 0) + (settings.showColBeskrivning ? 1 : 0)}
                          style={tdStyle}
                        />
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Löneunderlag */}
            {settings.showLoneunderlag && visibleLoneposter.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#888', marginBottom: 6 }}>Löneunderlag</p>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Typ</th>
                      <th style={thStyle}>Beskrivning</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Belopp</th>
                      <th style={thStyle}>Månad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLoneposter.map((l) => (
                      <tr key={l.id}>
                        <td style={tdStyle}>{l.typ.charAt(0).toUpperCase() + l.typ.slice(1)}</td>
                        <td style={tdStyle}>{l.beskrivning}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: lonepostSign(l.typ) === -1 ? '#c00' : '#060' }}>
                          {lonepostSign(l.typ) === -1 ? '–' : '+'} {fmt(l.belopp)} kr
                        </td>
                        <td style={tdStyle}>{l.manad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sammanfattning */}
            {settings.showSammanfattning && (
              <div style={{ background: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 4, padding: '10px 14px', fontSize: 12 }}>
                <p style={{ fontWeight: 600, marginBottom: 6, fontSize: 11, textTransform: 'uppercase', color: '#888' }}>Sammanfattning</p>
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', rowGap: 3 }}>
                  <span style={{ color: '#555' }}>Total timmar:</span>
                  <span style={{ fontWeight: 600 }}>{fmt(totalTimmar)} h</span>
                  {laborCost != null && (
                    <>
                      <span style={{ color: '#555' }}>Lönekostnad ({fmt(rate!)} kr/h):</span>
                      <span style={{ fontWeight: 600 }}>{fmt(laborCost)} kr</span>
                    </>
                  )}
                  {tillagg > 0 && (
                    <>
                      <span style={{ color: '#555' }}>Tillägg / Traktamente / Utlägg:</span>
                      <span style={{ color: '#060', fontWeight: 600 }}>+ {fmt(tillagg)} kr</span>
                    </>
                  )}
                  {avdrag > 0 && (
                    <>
                      <span style={{ color: '#555' }}>Avdrag / Förskott:</span>
                      <span style={{ color: '#c00', fontWeight: 600 }}>– {fmt(avdrag)} kr</span>
                    </>
                  )}
                  {netto != null && (
                    <>
                      <span style={{ color: '#555', fontWeight: 600, borderTop: '1px solid #ddd', paddingTop: 4, marginTop: 2 }}>Nettolönekostnad:</span>
                      <span style={{ fontWeight: 700, borderTop: '1px solid #ddd', paddingTop: 4, marginTop: 2 }}>{fmt(netto)} kr</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Grand total */}
      {groups.length > 1 && (
        <>
          <hr style={{ borderColor: '#999', marginTop: 16, marginBottom: 16 }} />
          <div style={{ background: '#eee', padding: '10px 14px', borderRadius: 4, fontSize: 12 }}>
            <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Totalsammanfattning — {groups.length} anställda</p>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', rowGap: 3 }}>
              <span style={{ color: '#555' }}>Total timmar:</span>
              <span style={{ fontWeight: 600 }}>{fmt(grandTimmar)} h</span>
              {grandLonekostnad > 0 && (
                <>
                  <span style={{ color: '#555' }}>Total lönekostnad:</span>
                  <span style={{ fontWeight: 600 }}>{fmt(grandLonekostnad)} kr</span>
                </>
              )}
              {grandTillagg > 0 && (
                <>
                  <span style={{ color: '#555' }}>Total tillägg:</span>
                  <span style={{ color: '#060', fontWeight: 600 }}>+ {fmt(grandTillagg)} kr</span>
                </>
              )}
              {grandAvdrag > 0 && (
                <>
                  <span style={{ color: '#555' }}>Total avdrag:</span>
                  <span style={{ color: '#c00', fontWeight: 600 }}>– {fmt(grandAvdrag)} kr</span>
                </>
              )}
              <span style={{ fontWeight: 700, borderTop: '1px solid #ccc', paddingTop: 4, marginTop: 2 }}>Nettolönekostnad:</span>
              <span style={{ fontWeight: 700, borderTop: '1px solid #ccc', paddingTop: 4, marginTop: 2 }}>
                {fmt(grandLonekostnad + grandTillagg - grandAvdrag)} kr
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface ReportViewProps {
  pdfSettings: PdfSettings
}

export function ReportView({ pdfSettings }: ReportViewProps) {
  const init = currentMonthRange()
  const [filters, setFilters] = useState({
    from: init.from,
    to: init.to,
    status: 'godkänd',
    personalIds: [] as string[],
  })
  const [rows, setRows] = useState<TidrapportGlobal[]>([])
  const [loneposter, setLoneposter] = useState<LonepostGlobal[]>([])
  const [personal, setPersonal] = useState<Personal[]>([])
  const [selectedCols, setSelectedCols] = useState<Set<ColKey>>(new Set(DEFAULT_COLS))
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [colsOpen, setColsOpen] = useState(false)
  const [empOpen, setEmpOpen] = useState(false)
  const [sortCol, setSortCol] = useState<ColKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const empRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.invoke('db:personal:list').then((data) => setPersonal(data as Personal[]))
  }, [])

  useEffect(() => {
    if (!empOpen) return
    const handler = (e: MouseEvent) => {
      if (!empRef.current?.contains(e.target as Node)) setEmpOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [empOpen])


  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const input: { from: string; to: string; status?: string; personal_ids?: string[] } = {
        from: filters.from,
        to: filters.to,
      }
      if (filters.status) input.status = filters.status
      if (filters.personalIds.length > 0) input.personal_ids = filters.personalIds

      const loneInput: { from: string; to: string; personal_ids?: string[]; includeAllForskott?: boolean } = {
        from: filters.from,
        to: filters.to,
        // When Förskott toggle is on, fetch all förskott regardless of date range
        includeAllForskott: pdfSettings.showLonepostForskott,
      }
      if (filters.personalIds.length > 0) loneInput.personal_ids = filters.personalIds

      const [tidData, loneData] = await Promise.all([
        window.api.invoke('db:personal-tidrapport:report', input) as Promise<TidrapportGlobal[]>,
        window.api.invoke('db:personal-loneposter:report', loneInput) as Promise<LonepostGlobal[]>,
      ])
      setRows(tidData)
      setLoneposter(loneData)
    } finally {
      setLoading(false)
    }
  }, [filters, pdfSettings.showLonepostForskott])

  // Group rows by employee for PDF
  const employeeGroups = useMemo((): EmployeeGroup[] => {
    const personalMap = new Map(personal.map((p) => [p.id, p]))
    const tidByEmp = new Map<string, TidrapportGlobal[]>()
    const lonByEmp = new Map<string, LonepostGlobal[]>()

    for (const r of rows) {
      if (!tidByEmp.has(r.personal_id)) tidByEmp.set(r.personal_id, [])
      tidByEmp.get(r.personal_id)!.push(r)
    }
    for (const l of loneposter) {
      if (!lonByEmp.has(l.personal_id)) lonByEmp.set(l.personal_id, [])
      lonByEmp.get(l.personal_id)!.push(l)
    }

    const allIds = new Set([...tidByEmp.keys(), ...lonByEmp.keys()])
    return [...allIds]
      .map((id) => ({ personal: personalMap.get(id), tidrapporter: tidByEmp.get(id) ?? [], loneposter: lonByEmp.get(id) ?? [] }))
      .filter((g): g is EmployeeGroup => g.personal != null)
  }, [rows, loneposter, personal])

  function toggleEmployee(id: string) {
    setFilters((f) => {
      const next = f.personalIds.includes(id)
        ? f.personalIds.filter((x) => x !== id)
        : [...f.personalIds, id]
      return { ...f, personalIds: next }
    })
  }

  function toggleCol(key: ColKey) {
    setSelectedCols((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function handleSort(key: ColKey) {
    if (sortCol === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

  async function handlePrintPdf() {
    const el = document.getElementById('print-report')
    if (!el) return
    setPdfLoading(true)
    try {
      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Timrapport ${filters.from} – ${filters.to}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, sans-serif; color: #111; background: #fff; }
  @page { margin: 15mm; size: A4; }
  table { page-break-inside: auto; border-collapse: collapse; }
  tr { page-break-inside: avoid; }
  h1, h2, h3, p { margin: 0; padding: 0; }
</style>
</head>
<body>${el.innerHTML}</body>
</html>`
      await window.api.invoke('pdf:generate-html', {
        html,
        name: `timrapport_${filters.from}_${filters.to}`,
        save: true,
      })
    } finally {
      setPdfLoading(false)
    }
  }

  const activeCols = ALL_COLS.filter((c) => selectedCols.has(c.key)).map((c) => c.key)

  const sortedRows = sortCol ? [...rows].sort((a, b) => {
    const av = cellValue(a, sortCol)
    const bv = cellValue(b, sortCol)
    const numA = parseFloat(av.replace(',', '.'))
    const numB = parseFloat(bv.replace(',', '.'))
    const cmp = !isNaN(numA) && !isNaN(numB) ? numA - numB : av.localeCompare(bv, 'sv')
    return sortDir === 'asc' ? cmp : -cmp
  }) : rows

  const totalTimmar = rows.reduce((s, r) => s + r.timmar, 0)
  const totalPaus = rows.reduce((s, r) => s + r.paustid_minuter, 0)
  const visibleLoneposter = filterLoneposterBySettings(loneposter, pdfSettings)
  const totalTillagg = visibleLoneposter.filter((l) => lonepostSign(l.typ) === 1).reduce((s, l) => s + l.belopp, 0)
  const totalAvdrag = visibleLoneposter.filter((l) => lonepostSign(l.typ) === -1).reduce((s, l) => s + l.belopp, 0)
  const hasData = rows.length > 0 || loneposter.length > 0

  return (
    <>
      <PrintReport groups={employeeGroups} settings={pdfSettings} from={filters.from} to={filters.to} />

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
          <p className="text-[11px] uppercase tracking-widest text-muted">Timrapport</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPdf}
              disabled={!hasData || pdfLoading}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs bg-elevated border border-border text-muted hover:text-fg hover:bg-hover disabled:opacity-40 transition-colors"
            >
              <FileText size={12} />
              {pdfLoading ? '...' : 'Ladda ned PDF'}
            </button>
            <button
              onClick={() => downloadCsv(rows, activeCols, filters.from, filters.to)}
              disabled={rows.length === 0}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs bg-elevated border border-border text-muted hover:text-fg hover:bg-hover disabled:opacity-40 transition-colors"
            >
              <Download size={12} />
              CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border bg-sidebar shrink-0 flex-wrap">
          <input
            type="month"
            value={filters.from.slice(0, 7)}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number)
              if (!y || !m) return
              const from = `${y}-${String(m).padStart(2, '0')}-01`
              const lastDay = new Date(y, m, 0).getDate()
              const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
              setFilters((f) => ({ ...f, from, to }))
            }}
            className="input h-7 w-36 !py-0"
          />
          <span className="text-subtle text-[10px] uppercase tracking-widest">o</span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="input h-7 w-36 !py-0"
          />
          <span className="text-subtle text-xs">—</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="input h-7 w-36 !py-0"
          />

          {/* Employee multi-select */}
          <div ref={empRef} className="relative">
            <button
              onClick={() => setEmpOpen((v) => !v)}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs bg-elevated border border-border text-muted hover:text-fg transition-colors"
            >
              {filters.personalIds.length === 0 ? 'Alla anställda' : `${filters.personalIds.length} valda`}
              <ChevronDown size={10} className={`transition-transform ${empOpen ? 'rotate-180' : ''}`} />
            </button>
            {empOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-elevated border border-border rounded-lg shadow-xl w-52 max-h-64 overflow-auto py-1">
                {personal.length === 0 && (
                  <p className="px-3 py-2 text-xs text-subtle">Inga anställda</p>
                )}
                {personal.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted hover:bg-hover cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.personalIds.includes(p.id)}
                      onChange={() => toggleEmployee(p.id)}
                      className="rounded border-border accent-emerald-400"
                    />
                    {p.namn}
                  </label>
                ))}
              </div>
            )}
          </div>

          <SelectField
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={STATUS_OPTIONS}
            className="w-40"
          />

          <button
            onClick={fetchReport}
            disabled={loading}
            className="h-7 px-4 rounded-md text-xs bg-elevated border border-border text-fg hover:bg-hover disabled:opacity-40 transition-colors ml-auto"
          >
            {loading ? '...' : 'Hämta'}
          </button>
        </div>

        {/* Column selector (CSV) */}
        <div className="px-6 py-2 border-b border-border bg-sidebar shrink-0">
          <button
            onClick={() => setColsOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-subtle hover:text-muted transition-colors"
          >
            Kolumner (CSV)
            <ChevronDown size={10} className={`transition-transform ${colsOpen ? 'rotate-180' : ''}`} />
          </button>
          {colsOpen && (
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2">
              {ALL_COLS.map((c) => (
                <label key={c.key} className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCols.has(c.key)}
                    onChange={() => toggleCol(c.key)}
                    className="rounded border-border accent-emerald-400"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Summary bar — always visible, outside overflow-auto */}
        {rows.length > 0 && (
          <div className="flex items-center gap-6 px-6 py-2.5 border-b border-border bg-elevated shrink-0 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-widest text-muted">Total</span>
              <span className="text-sm font-semibold text-fg">{fmt(totalTimmar)} h</span>
              <span className="text-xs text-subtle">({rows.length} rader)</span>
            </div>
            {employeeGroups.length > 1 && (
              <>
                <div className="w-px h-4 bg-border shrink-0" />
                <div className="flex items-center gap-4 flex-wrap">
                  {employeeGroups.map((g) => {
                    const empTimmar = g.tidrapporter.reduce((s, r) => s + r.timmar, 0)
                    return (
                      <div key={g.personal.id} className="flex items-center gap-1.5">
                        <span className="text-xs text-subtle">{g.personal.namn}:</span>
                        <span className="text-xs font-medium text-fg">{fmt(empTimmar)} h</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tables */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <p className="text-xs text-subtle text-center py-10">Laddar...</p>
          ) : !hasData ? (
            <p className="text-xs text-subtle text-center py-10">Välj filter och klicka Hämta</p>
          ) : (
            <>
              {/* Tidrapporter table */}
              {rows.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-sidebar z-10">
                    <tr className="border-b border-border">
                      {activeCols.map((key) => {
                        const isSorted = sortCol === key
                        return (
                          <th
                            key={key}
                            onClick={() => handleSort(key)}
                            className="px-4 py-2 text-left text-[11px] uppercase tracking-wider text-subtle font-medium cursor-pointer select-none hover:text-fg transition-colors whitespace-nowrap"
                          >
                            <span className="flex items-center gap-1">
                              {ALL_COLS.find((c) => c.key === key)!.label}
                              {isSorted && (sortDir === 'asc' ? <ArrowUp size={10} className="text-fg" /> : <ArrowDown size={10} className="text-fg" />)}
                            </span>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r) => (
                      <tr key={r.id} className="border-b border-border hover:bg-hover">
                        {activeCols.map((key) => (
                          <td key={key} className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
                            {cellValue(r, key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-elevated/50">
                      {activeCols.map((key, i) => (
                        <td key={key} className="px-4 py-2.5 text-xs font-medium text-fg whitespace-nowrap">
                          {i === 0
                            ? `${rows.length} rader`
                            : key === 'timmar'
                              ? fmt(totalTimmar)
                              : key === 'paustid_minuter'
                                ? String(totalPaus)
                                : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              )}

              {/* Löneunderlag table */}
              {visibleLoneposter.length > 0 && (
                <div className="border-t-2 border-border mt-0">
                  <div className="px-4 py-2 bg-sidebar border-b border-border">
                    <p className="text-[11px] uppercase tracking-widest text-muted">Löneunderlag ({visibleLoneposter.length} poster)</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-sidebar z-10">
                      <tr className="border-b border-border">
                        <th className="px-4 py-2 text-left text-[11px] uppercase tracking-wider text-subtle font-medium whitespace-nowrap">Anst.nr</th>
                        <th className="px-4 py-2 text-left text-[11px] uppercase tracking-wider text-subtle font-medium whitespace-nowrap">Namn</th>
                        <th className="px-4 py-2 text-left text-[11px] uppercase tracking-wider text-subtle font-medium whitespace-nowrap">Typ</th>
                        <th className="px-4 py-2 text-left text-[11px] uppercase tracking-wider text-subtle font-medium whitespace-nowrap">Beskrivning</th>
                        <th className="px-4 py-2 text-right text-[11px] uppercase tracking-wider text-subtle font-medium whitespace-nowrap">Belopp</th>
                        <th className="px-4 py-2 text-left text-[11px] uppercase tracking-wider text-subtle font-medium whitespace-nowrap">Månad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLoneposter.map((l) => (
                        <tr key={l.id} className="border-b border-border hover:bg-hover">
                          <td className="px-4 py-2.5 text-xs text-muted">{l.personal?.personal_nummer ?? '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-muted">{l.personal?.namn ?? '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-muted capitalize">{l.typ}</td>
                          <td className="px-4 py-2.5 text-xs text-muted">{l.beskrivning}</td>
                          <td className={`px-4 py-2.5 text-xs text-right font-medium ${lonepostSign(l.typ) === -1 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {lonepostSign(l.typ) === -1 ? '–' : '+'} {fmt(l.belopp)} kr
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted">{l.manad}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-elevated/50">
                        <td colSpan={4} className="px-4 py-2.5 text-xs font-medium text-fg">{visibleLoneposter.length} poster</td>
                        <td className="px-4 py-2.5 text-xs text-right font-medium text-fg">
                          <span className="text-emerald-400">+{fmt(totalTillagg)}</span>
                          {' / '}
                          <span className="text-red-400">–{fmt(totalAvdrag)}</span>
                          {' kr'}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {/* Sammanfattning per employee */}
              {employeeGroups.length > 0 && (
                <div className="px-6 py-5 border-t-2 border-border flex flex-col gap-4">
                  {employeeGroups.map((g) => {
                    const rate = effectiveTimlon(g.personal)
                    const empTimmar = g.tidrapporter.reduce((s, r) => s + r.timmar, 0)
                    const laborCost = rate != null ? empTimmar * rate : null
                    const visibleLone = filterLoneposterBySettings(g.loneposter, pdfSettings)
                    const tillagg = visibleLone.filter((l) => lonepostSign(l.typ) === 1).reduce((s, l) => s + l.belopp, 0)
                    const avdrag = visibleLone.filter((l) => lonepostSign(l.typ) === -1).reduce((s, l) => s + l.belopp, 0)
                    const netto = laborCost != null ? laborCost + tillagg - avdrag : null
                    return (
                      <div key={g.personal.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-elevated border-b border-border">
                          <p className="text-[11px] uppercase tracking-widest text-muted">
                            Sammanfattning{employeeGroups.length > 1 ? ` — ${g.personal.namn}` : ''}
                          </p>
                        </div>
                        <div className="px-4 py-3 grid grid-cols-[220px_1fr] gap-y-2 text-xs">
                          <span className="text-muted">Total timmar:</span>
                          <span className="font-semibold text-fg">{fmt(empTimmar)} h</span>
                          {laborCost != null && (
                            <>
                              <span className="text-muted">Lönekostnad ({fmt(rate!)} kr/h):</span>
                              <span className="font-semibold text-fg">{fmt(laborCost)} kr</span>
                            </>
                          )}
                          {tillagg > 0 && (
                            <>
                              <span className="text-muted">Tillägg / Traktamente / Utlägg:</span>
                              <span className="font-semibold text-emerald-400">+ {fmt(tillagg)} kr</span>
                            </>
                          )}
                          {avdrag > 0 && (
                            <>
                              <span className="text-muted">Avdrag / Förskott:</span>
                              <span className="font-semibold text-red-400">– {fmt(avdrag)} kr</span>
                            </>
                          )}
                          {netto != null && (
                            <>
                              <span className="font-semibold text-fg border-t border-border pt-2 mt-1">Nettolönekostnad:</span>
                              <span className="font-semibold text-fg border-t border-border pt-2 mt-1">{fmt(netto)} kr</span>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Grand total when >1 employee */}
                  {employeeGroups.length > 1 && (() => {
                    const grandTimmar = employeeGroups.reduce((s, g) => s + g.tidrapporter.reduce((a, r) => a + r.timmar, 0), 0)
                    const grandLone = employeeGroups.reduce((s, g) => {
                      const rate = effectiveTimlon(g.personal)
                      return rate != null ? s + g.tidrapporter.reduce((a, r) => a + r.timmar, 0) * rate : s
                    }, 0)
                    const grandTillagg = employeeGroups.reduce((s, g) =>
                      s + filterLoneposterBySettings(g.loneposter, pdfSettings).filter((l) => lonepostSign(l.typ) === 1).reduce((a, l) => a + l.belopp, 0), 0)
                    const grandAvdrag = employeeGroups.reduce((s, g) =>
                      s + filterLoneposterBySettings(g.loneposter, pdfSettings).filter((l) => lonepostSign(l.typ) === -1).reduce((a, l) => a + l.belopp, 0), 0)
                    return (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-elevated border-b border-border">
                          <p className="text-[11px] uppercase tracking-widest text-muted">Totalsammanfattning — {employeeGroups.length} anställda</p>
                        </div>
                        <div className="px-4 py-3 grid grid-cols-[220px_1fr] gap-y-2 text-xs">
                          <span className="text-muted">Total timmar:</span>
                          <span className="font-semibold text-fg">{fmt(grandTimmar)} h</span>
                          {grandLone > 0 && (
                            <>
                              <span className="text-muted">Total lönekostnad:</span>
                              <span className="font-semibold text-fg">{fmt(grandLone)} kr</span>
                            </>
                          )}
                          {grandTillagg > 0 && (
                            <>
                              <span className="text-muted">Total tillägg:</span>
                              <span className="font-semibold text-emerald-400">+ {fmt(grandTillagg)} kr</span>
                            </>
                          )}
                          {grandAvdrag > 0 && (
                            <>
                              <span className="text-muted">Total avdrag:</span>
                              <span className="font-semibold text-red-400">– {fmt(grandAvdrag)} kr</span>
                            </>
                          )}
                          <span className="font-semibold text-fg border-t border-border pt-2 mt-1">Nettolönekostnad:</span>
                          <span className="font-semibold text-fg border-t border-border pt-2 mt-1">{fmt(grandLone + grandTillagg - grandAvdrag)} kr</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
