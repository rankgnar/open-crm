import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, Trash2, AlertTriangle, X, Download, Upload, Settings2 } from 'lucide-react'
import type { MaterialKatalog, Leverantor } from '../types'
import { useAppConfig } from '@/context/AppConfig'
import { parseCsv, type ParsedRow } from '../../../utils/csvParsers'

const PAGE_SIZE = 500

// Fields we can map from any supplier CSV
const MAPPING_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'namn',           label: 'Namn',          required: true },
  { key: 'a_pris',         label: 'Á-pris',        required: true },
  { key: 'artikel_nummer', label: 'Artikelnummer'               },
  { key: 'enhet',          label: 'Enhet'                       },
  { key: 'kategori1',      label: 'Kategori 1'                  },
  { key: 'kategori2',      label: 'Kategori 2'                  },
  { key: 'kategori3',      label: 'Kategori 3'                  },
  { key: 'namn2',          label: 'Namn 2'                      },
]

// Sample CSV using our own template format (for download)
const CSV_TEMPLATE_HEADERS = 'artikel_nummer,namn,namn2,kategori1,kategori2,kategori3,enhet,a_pris'
const CSV_TEMPLATE_ROWS = [
  'ART-001,Betongskruv 6x60mm,,Fästelement,Skruvar,,st,2.50',
  'ART-002,OSB-skiva 22mm 2400x1200,,Träprodukter,Skivor,,st,189.00',
  'ART-003,Gipsskiva 13mm 2700x1200,,Gipsskivor,,,st,95.00',
  'ART-004,Mineralullsskiva 100mm,,Isolering,,,m2,145.00',
  'ART-005,Träskruv 4x40mm förpackning,,Fästelement,Skruvar,,fp,45.00',
].join('\n')

type Phase = 'idle' | 'mapping' | 'preview' | 'importing' | 'done'

type ImportRow = {
  namn: string; a_pris: number
  artikel_nummer?: string | null; enhet?: string | null
  kategori1?: string | null; kategori2?: string | null
  kategori3?: string | null; namn2?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePrice(s: string): number {
  if (!s) return 0
  const cleaned = s.replace(/\s/g, '').replace(/,(?=\d{1,2}$)/, '.')
  return parseFloat(cleaned) || 0
}

function autoDetect(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const { key } of MAPPING_FIELDS) {
    const match = headers.find(h => {
      switch (key) {
        case 'namn':           return /benämning|namn|name|produkt|description|artikel/.test(h)
        case 'a_pris':        return /pris|price|netto|á-pris|a-pris|cost/.test(h)
        case 'artikel_nummer':return /art.*nr|artnr|sku|item.*no|artikelnr/.test(h) || h === 'nr' || h === 'art'
        case 'enhet':         return /enhet|unit/.test(h)
        case 'kategori1':     return /kategori1|kategori$|grupp$|group$|category$/.test(h)
        case 'kategori2':     return /kategori2/.test(h)
        case 'kategori3':     return /kategori3/.test(h)
        case 'namn2':         return /namn2|name2|benämning2/.test(h)
        default:              return h.includes(key)
      }
    })
    if (match) result[key] = match
  }
  return result
}

function applyMappings(csvRows: ParsedRow[], mappings: Record<string, string>): ImportRow[] {
  return csvRows
    .map(row => {
      const get = (key: string) => (mappings[key] ? (row[mappings[key]] ?? '') : '').trim()
      const namn = get('namn')
      if (!namn) return null
      return {
        namn,
        a_pris: parsePrice(get('a_pris')),
        artikel_nummer: get('artikel_nummer') || null,
        enhet: get('enhet') || null,
        kategori1: get('kategori1') || null,
        kategori2: get('kategori2') || null,
        kategori3: get('kategori3') || null,
        namn2: get('namn2') || null,
      }
    })
    .filter(Boolean) as ImportRow[]
}

function downloadTemplate() {
  const content = CSV_TEMPLATE_HEADERS + '\n' + CSV_TEMPLATE_ROWS
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'material_mall.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── Editable cells ────────────────────────────────────────────────────────────

function EditableText({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value)
  if (!editing) return (
    <span className="cursor-text hover:underline decoration-dotted underline-offset-2" onClick={() => { setLocal(value); setEditing(true) }}>
      {value || <span className="text-subtle italic">—</span>}
    </span>
  )
  return (
    <input autoFocus className="input text-xs py-0.5 px-1.5 w-full" value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { onSave(local); setEditing(false) }}
      onKeyDown={(e) => { if (e.key === 'Enter') { onSave(local); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
    />
  )
}

function EditablePrice({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const { formatCurrency } = useAppConfig()
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value.toString())
  if (!editing) return (
    <span className="cursor-text hover:underline decoration-dotted underline-offset-2 font-mono" onClick={() => { setLocal(value.toString()); setEditing(true) }}>
      {formatCurrency(value)}
    </span>
  )
  return (
    <input autoFocus type="number" min="0" step="0.01" className="input text-xs py-0.5 px-1.5 w-24 text-right font-mono ml-auto" value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { onSave(parseFloat(local) || 0); setEditing(false) }}
      onKeyDown={(e) => { if (e.key === 'Enter') { onSave(parseFloat(local) || 0); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
      onFocus={(e) => e.target.select()}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function MaterialKatalogView() {
  const [leverantorer, setLeverantorer] = useState<Leverantor[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selectedLev, setSelectedLev] = useState('')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<MaterialKatalog[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Import state
  const [csvRows, setCsvRows] = useState<ParsedRow[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [csvError, setCsvError] = useState('')
  const [importResult, setImportResult] = useState<{ inserted: number } | null>(null)
  const [onlyWithKatalog, setOnlyWithKatalog] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.invoke('db:leverantorer:list').then((d) => setLeverantorer(d as Leverantor[]))
    refreshCounts()
  }, [])

  function refreshCounts() {
    window.api.invoke('db:material-katalog:count-by-leverantor').then((d) => setCounts(d as Record<string, number>))
  }

  async function load(q: string, lev: string, p: number) {
    setLoading(true); setError('')
    try {
      const levArg = lev || undefined
      const data = q.trim()
        ? await window.api.invoke('db:material-katalog:search', q.trim(), levArg) as MaterialKatalog[]
        : await window.api.invoke('db:material-katalog:list', levArg, p) as MaterialKatalog[]
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fel vid sökning.')
      setRows([])
    } finally { setLoading(false) }
  }

  useEffect(() => { load('', '', 0) }, [])
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => load(query, selectedLev, 0), 200)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query, selectedLev])
  useEffect(() => { load(query, selectedLev, page) }, [page])

  function handleQueryChange(v: string) { setQuery(v); setPage(0) }
  function handleLevChange(v: string) { setSelectedLev(v); setPage(0) }

  async function handleUpdateRow(id: string, patch: { namn?: string; a_pris?: number }) {
    const updated = await window.api.invoke('db:material-katalog:update', id, patch) as MaterialKatalog
    setRows((prev) => prev.map((r) => r.id === id ? updated : r))
  }

  async function handleDeleteRow(id: string) {
    await window.api.invoke('db:material-katalog:delete', id)
    setRows((prev) => prev.filter((r) => r.id !== id))
    refreshCounts()
  }

  async function handleDeleteCatalog(levId: string) {
    setDeleting(true)
    try {
      await window.api.invoke('db:material-katalog:delete-by-leverantor', levId)
      setRows([]); setDeleteConfirm(null); refreshCounts()
    } finally { setDeleting(false) }
  }

  // ── CSV import ────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvError('')
    if (!selectedLev) {
      setCsvError('Välj en leverantör i filtret innan du importerar.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string
        const parsed = parseCsv(text)
        if (parsed.length === 0) { setCsvError('Filen är tom eller saknar data.'); return }
        const headers = Object.keys(parsed[0])
        setCsvRows(parsed)
        setCsvHeaders(headers)

        // Load saved mapping for this supplier
        const saved = await window.api.invoke('db:material-import-config:get', selectedLev) as Record<string, string> | null
        if (saved && Object.keys(saved).length > 0) {
          setMappings(saved)
          setPhase('preview')
        } else {
          setMappings(autoDetect(headers))
          setPhase('mapping')
        }
      } catch { setCsvError('Kunde inte läsa filen.') }
    }
    reader.readAsText(file, 'UTF-8')
  }, [selectedLev])

  const importRows = applyMappings(csvRows, mappings)
  const missingRequired = MAPPING_FIELDS.filter(f => f.required && !mappings[f.key])
  const currentLev = leverantorer.find((l) => l.id === selectedLev)

  async function confirmMapping() {
    if (missingRequired.length > 0) return
    await window.api.invoke('db:material-import-config:save', { leverantor_id: selectedLev, mappings })
    setPhase('preview')
  }

  async function handleImport() {
    if (!selectedLev || importRows.length === 0) return
    setPhase('importing')
    try {
      const res = await window.api.invoke('db:material-katalog:import', selectedLev, importRows) as { inserted: number }
      setImportResult(res); setPhase('done')
      load(query, selectedLev, page)
      refreshCounts()
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Importfel'); setPhase('preview')
    }
  }

  function resetCsv() {
    setCsvRows([]); setCsvHeaders([]); setFileName(''); setPhase('idle')
    setImportResult(null); setCsvError(''); setMappings({})
    if (fileRef.current) fileRef.current.value = ''
  }

  const totalCount = Object.values(counts).reduce((s, n) => s + n, 0)
  const hasNextPage = !query.trim() && rows.length === PAGE_SIZE
  const hasPrevPage = page > 0

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border shrink-0">
        <Search size={14} className="text-subtle shrink-0" />
        <div className="relative flex-1 max-w-xs">
          <input type="text" placeholder="Sök produkt..."
            className="input text-sm py-1.5 pr-7 w-full"
            value={query} onChange={(e) => handleQueryChange(e.target.value)}
          />
          {query && (
            <button onClick={() => handleQueryChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-fg transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
        <select className="input text-sm text-muted w-52 shrink-0" value={selectedLev} onChange={(e) => handleLevChange(e.target.value)}>
          <option value="">Alla leverantörer ({totalCount.toLocaleString('sv-SE')})</option>
          {leverantorer
            .filter(l => !onlyWithKatalog || (counts[l.id] ?? 0) > 0)
            .map((l) => (
              <option key={l.id} value={l.id}>{l.namn} ({(counts[l.id] ?? 0).toLocaleString('sv-SE')})</option>
            ))}
        </select>
        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={onlyWithKatalog}
            onChange={(e) => setOnlyWithKatalog(e.target.checked)}
            className="accent-emerald-400"
          />
          <span className="text-xs text-muted">Bara med katalog</span>
        </label>
        {selectedLev && (counts[selectedLev] ?? 0) > 0 && (
          <button onClick={() => setDeleteConfirm(selectedLev)} className="flex items-center gap-1 text-xs text-subtle hover:text-red-400 transition-colors shrink-0">
            <Trash2 size={12} /> Radera katalog
          </button>
        )}
        <span className="text-xs text-subtle ml-auto shrink-0">
          {loading ? 'Laddar...' : `${rows.length.toLocaleString('sv-SE')} ${query.trim() ? 'träffar' : 'rader'}`}
        </span>
        <button onClick={downloadTemplate} title="Ladda ned mall" className="text-blue-400 hover:text-blue-300 transition-colors shrink-0">
          <Download size={14} />
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFile} className="hidden" id="material-csv-input" />
        <label htmlFor="material-csv-input"
          title={selectedLev ? 'Importera CSV' : 'Välj leverantör först'}
          className={`shrink-0 transition-colors ${selectedLev ? 'cursor-pointer text-emerald-400 hover:text-emerald-300' : 'cursor-not-allowed text-subtle'}`}>
          <Upload size={14} />
        </label>
      </div>

      {csvError && phase === 'idle' && (
        <p className="px-4 py-1.5 text-xs text-red-400 shrink-0">{csvError}</p>
      )}

      {/* Delete catalog confirm */}
      {deleteConfirm && (
        <div className="flex items-center gap-3 px-6 py-2.5 bg-red-400/10 border-b border-red-400/20 shrink-0">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <p className="text-xs text-fg flex-1">
            Radera <strong>{currentLev?.namn}</strong>? {(counts[deleteConfirm] ?? 0).toLocaleString('sv-SE')} produkter tas bort permanent.
          </p>
          <button onClick={() => handleDeleteCatalog(deleteConfirm)} disabled={deleting}
            className="px-3 py-1 text-xs bg-red-400 text-bg rounded hover:bg-red-400/90 disabled:opacity-50 transition-colors">
            {deleting ? 'Raderar...' : 'Ja, radera'}
          </button>
          <button onClick={() => setDeleteConfirm(null)} className="text-xs text-muted hover:text-fg transition-colors">Avbryt</button>
        </div>
      )}

      {/* ── MAPPING phase ─────────────────────────────────────────────────────── */}
      {phase === 'mapping' && (
        <div className="px-6 py-4 border-b border-border bg-elevated shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-fg">{fileName}</p>
              <p className="text-[11px] text-muted mt-0.5">
                Mappa kolumnerna i <strong>{currentLev?.namn}</strong>s CSV till våra fält. Sparas automatiskt.
              </p>
            </div>
            <button onClick={resetCsv} className="text-xs text-muted hover:text-fg transition-colors">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
            {MAPPING_FIELDS.map(({ key, label, required }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[11px] text-muted w-28 shrink-0">
                  {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                </span>
                <select
                  value={mappings[key] ?? ''}
                  onChange={(e) => setMappings(prev => ({ ...prev, [key]: e.target.value }))}
                  className="input text-xs py-1 text-muted flex-1"
                >
                  <option value="">— Ignorera —</option>
                  {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {missingRequired.length > 0 && (
              <p className="text-xs text-red-400">Obligatoriska fält saknas: {missingRequired.map(f => f.label).join(', ')}</p>
            )}
            <button
              onClick={confirmMapping}
              disabled={missingRequired.length > 0}
              className="px-3 py-1.5 bg-emerald-400/10 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-400/20 disabled:opacity-40 transition-colors"
            >
              Spara & förhandsgranska
            </button>
          </div>
        </div>
      )}

      {/* ── PREVIEW / IMPORTING phase ─────────────────────────────────────────── */}
      {(phase === 'preview' || phase === 'importing') && (
        <div className="px-6 py-3 border-b border-border bg-elevated shrink-0 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <p className="text-xs text-fg font-mono truncate max-w-[200px]">{fileName}</p>
            <span className="text-xs text-emerald-400">{importRows.length} rader</span>
            <span className="text-xs text-amber-400">Ersätter befintliga produkter för {currentLev?.namn}</span>
            <button onClick={() => setPhase('mapping')} title="Ändra kolumnmappning" className="text-subtle hover:text-fg transition-colors">
              <Settings2 size={13} />
            </button>
            <button onClick={resetCsv} className="ml-auto text-xs text-muted hover:text-fg transition-colors">✕</button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-28 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-elevated border-b border-border">
                  <tr>
                    {(['namn', 'artikel_nummer', 'kategori1', 'enhet', 'a_pris'] as const).map(col => (
                      <th key={col} className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wider text-muted font-medium">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {importRows.slice(0, 6).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-fg truncate max-w-[160px]">{r.namn}</td>
                      <td className="px-3 py-1.5 text-muted font-mono">{r.artikel_nummer || '—'}</td>
                      <td className="px-3 py-1.5 text-muted">{r.kategori1 || '—'}</td>
                      <td className="px-3 py-1.5 text-muted">{r.enhet || '—'}</td>
                      <td className="px-3 py-1.5 text-muted font-mono">{r.a_pris.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {csvError && <p className="text-xs text-red-400">{csvError}</p>}
            <button
              onClick={handleImport}
              disabled={importRows.length === 0 || phase === 'importing'}
              className="px-3 py-1.5 bg-emerald-400/10 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-400/20 disabled:opacity-40 transition-colors"
            >
              {phase === 'importing' ? 'Importerar...' : `Importera ${importRows.length} produkter`}
            </button>
          </div>
        </div>
      )}

      {/* ── DONE phase ────────────────────────────────────────────────────────── */}
      {phase === 'done' && importResult && (
        <div className="px-6 py-2.5 border-b border-border bg-elevated shrink-0 flex items-center gap-4">
          <span className="text-xs font-medium text-emerald-400">✓ {importResult.inserted.toLocaleString('sv-SE')} produkter importerade</span>
          <button onClick={resetCsv} className="ml-auto text-xs text-muted hover:text-fg transition-colors">Stäng</button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-6 py-2 border-b border-border shrink-0 text-red-400 text-xs">
          <AlertTriangle size={12} />{error}
        </div>
      )}

      {/* Catalog table */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-32 text-muted text-sm">
            {totalCount === 0
              ? 'Katalogen är tom. Välj en leverantör och importera en CSV-fil.'
              : query.trim() ? `Inga träffar för "${query}".` : 'Inga produkter.'}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-sidebar border-b border-border">
              <tr>
                <th className="text-left px-6 py-2 text-[10px] uppercase tracking-wider text-muted font-medium">Namn</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted font-medium">Art.nr</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted font-medium">Kategori</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted font-medium">Enhet</th>
                <th className="text-right px-6 py-2 text-[10px] uppercase tracking-wider text-muted font-medium">Á-pris</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="group border-b border-border/50 hover:bg-hover transition-colors">
                  <td className="px-6 py-1.5 text-fg">
                    <EditableText value={r.namn} onSave={(v) => { if (v && v !== r.namn) handleUpdateRow(r.id, { namn: v }) }} />
                    {r.namn2 && <div className="text-subtle text-[10px]">{r.namn2}</div>}
                  </td>
                  <td className="px-3 py-1.5 text-muted font-mono">{r.artikel_nummer ?? '—'}</td>
                  <td className="px-3 py-1.5 text-muted">{[r.kategori1, r.kategori2, r.kategori3].filter(Boolean).join(' › ') || '—'}</td>
                  <td className="px-3 py-1.5 text-muted">{r.enhet ?? '—'}</td>
                  <td className="px-6 py-1.5 text-right">
                    <EditablePrice value={r.a_pris} onSave={(v) => { if (v !== r.a_pris) handleUpdateRow(r.id, { a_pris: v }) }} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <button onClick={() => handleDeleteRow(r.id)} className="opacity-0 group-hover:opacity-100 text-subtle hover:text-red-400 transition-all p-0.5">
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!query.trim() && (hasPrevPage || hasNextPage) && (
        <div className="flex items-center justify-between px-6 py-2 border-t border-border shrink-0">
          <button onClick={() => setPage((p) => p - 1)} disabled={!hasPrevPage}
            className="flex items-center gap-1 text-xs text-muted hover:text-fg disabled:opacity-30 transition-colors">
            <ChevronLeft size={13} />Föregående
          </button>
          <span className="text-xs text-subtle">Sida {page + 1} — {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + rows.length}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={!hasNextPage}
            className="flex items-center gap-1 text-xs text-muted hover:text-fg disabled:opacity-30 transition-colors">
            Nästa <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
