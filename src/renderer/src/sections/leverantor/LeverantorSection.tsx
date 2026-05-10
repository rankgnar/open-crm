import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, Search, X, Download, Upload, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'
import type { Leverantor } from '@/sections/installningar/types'
import { FORTNOX_LEVERANTORER } from '@/utils/fortnoxHeaders'
import { parseCsv, type ParsedRow } from '@/utils/csvParsers'
import { useRefreshHandler } from '@/context/RefreshContext'
import { RefreshButton } from '@/components/RefreshButton'

type ImportMode = 'skip' | 'overwrite'
type SortDir = 'asc' | 'desc'

const CSV_HEADERS = ['namn', 'kontaktperson', 'email', 'telefon', 'org_nummer', 'webbadress', 'anteckning'] as const
const CSV_EXAMPLE = 'Byggmax AB,Anna Svensson,anna@byggmax.se,08-123456,556677-8899,https://byggmax.se,Huvudleverantör trä'
const PREVIEW_COLS = ['namn', 'email', 'telefon', 'org_nummer'] as const

const COLS: [keyof Leverantor, string][] = [
  ['namn', 'Namn'],
  ['kontaktperson', 'Kontaktperson'],
  ['email', 'E-post'],
  ['telefon', 'Telefon'],
  ['org_nummer', 'Org.nummer'],
]

type ImportInput = { namn: string; kontaktperson?: string; email?: string; telefon?: string; org_nummer?: string; webbadress?: string; anteckning?: string }
type ImpResult = { success: number; skipped: number; errors: Array<{ index: number; message: string }> }

function rowToInput(row: ParsedRow): ImportInput | null {
  if (!row['namn']?.trim()) return null
  const input: ImportInput = { namn: row['namn'].trim() }
  for (const f of ['kontaktperson', 'email', 'telefon', 'org_nummer', 'webbadress', 'anteckning'] as const) {
    if (row[f]?.trim()) input[f] = row[f].trim()
  }
  return input
}

function downloadTemplate() {
  const blob = new Blob([CSV_HEADERS.join(',') + '\n' + CSV_EXAMPLE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'leverantorer_mall.csv'; a.click()
  URL.revokeObjectURL(url)
}

function Field({ label, value, onSave, placeholder = '' }: { label: string; value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  function save() { if (local !== value) onSave(local) }
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-muted">{label}</label>
      <input
        className="input text-sm"
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') { save(); e.currentTarget.blur() } }}
      />
    </div>
  )
}

export function LeverantorSection() {
  const [leverantorer, setLeverantorer] = useState<Leverantor[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [confirmRowId, setConfirmRowId] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<keyof Leverantor | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [phase, setPhase] = useState<'idle' | 'preview' | 'importing' | 'done'>('idle')
  const [result, setResult] = useState<ImpResult | null>(null)
  const [csvError, setCsvError] = useState('')
  const [importMode, setImportMode] = useState<ImportMode>('skip')
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    const d = await window.api.invoke('db:leverantorer:list') as Leverantor[]
    setLeverantorer(d)
  }, [])

  useEffect(() => { void reload() }, [reload])
  useRefreshHandler(reload)

  function handleSort(col: keyof Leverantor) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmBulk(false)
  }

  const filtered = leverantorer.filter((l) => {
    const q = query.toLowerCase()
    return !q || [l.namn, l.email, l.telefon, l.org_nummer, l.kontaktperson]
      .some((v) => v?.toLowerCase().includes(q))
  })

  const sorted = sortCol ? [...filtered].sort((a, b) => {
    const av = String(a[sortCol] ?? ''), bv = String(b[sortCol] ?? '')
    const cmp = av.localeCompare(bv, 'sv')
    return sortDir === 'asc' ? cmp : -cmp
  }) : filtered

  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id))

  function toggleAll(e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((l) => l.id)))
    setConfirmBulk(false)
  }

  async function handleAdd() {
    const created = await window.api.invoke('db:leverantorer:create', { namn: 'Ny leverantör' }) as Leverantor
    setLeverantorer((prev) => [...prev, created])
    setExpanded(created.id)
  }

  async function handleUpdate(id: string, field: keyof Leverantor, value: string) {
    const updated = await window.api.invoke('db:leverantorer:update', id, { [field]: value }) as Leverantor
    setLeverantorer((prev) => prev.map((l) => l.id === id ? updated : l))
  }

  async function handleDeleteMany(ids: string[]) {
    for (const id of ids) await window.api.invoke('db:leverantorer:delete', id)
    setLeverantorer((prev) => prev.filter((l) => !ids.includes(l.id)))
    if (ids.includes(expanded ?? '')) setExpanded(null)
  }

  async function handleBulkDelete() {
    setDeletingBulk(true)
    try {
      await handleDeleteMany([...selected])
      setSelected(new Set()); setConfirmBulk(false)
    } finally { setDeletingBulk(false) }
  }

  async function handleRowDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await handleDeleteMany([id])
    setConfirmRowId(null)
  }

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setCsvError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const parsed = parseCsv(text, FORTNOX_LEVERANTORER)
        if (parsed.length === 0) { setCsvError('Filen är tom eller saknar data.'); return }
        if (!Object.keys(parsed[0]).includes('namn')) { setCsvError('Kolumnen "namn" saknas.'); return }
        setRows(parsed); setPhase('preview')
      } catch { setCsvError('Kunde inte läsa filen.') }
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const existingNames = new Set(leverantorer.map(l => l.namn.toLowerCase()))
  const inputs = rows.map(rowToInput)
  const valid = inputs.filter(Boolean) as ImportInput[]
  const invalidCount = inputs.filter(r => r === null).length
  const duplicateCount = valid.filter(r => existingNames.has(r.namn.toLowerCase())).length
  const newCount = valid.length - duplicateCount

  async function handleImport() {
    if (valid.length === 0) return
    setPhase('importing')
    try {
      const res = await window.api.invoke('db:leverantorer:import-csv', valid, importMode) as ImpResult
      setResult(res); setPhase('done')
      window.api.invoke('db:leverantorer:list').then((d) => setLeverantorer(d as Leverantor[]))
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Importfel'); setPhase('preview')
    }
  }

  function resetCsv() {
    setRows([]); setFileName(''); setPhase('idle'); setResult(null); setCsvError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const isFiltering = query !== ''

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <h1 className="text-base font-semibold text-fg">Leverantörer</h1>
          <span className="text-xs text-muted bg-elevated border border-border rounded-full px-2 py-0.5">
            {isFiltering ? `${filtered.length} / ${leverantorer.length}` : leverantorer.length}
          </span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök namn, e-post, telefon..."
            className="input w-full pl-8 pr-7 text-sm"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-fg transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <button onClick={downloadTemplate} title="Ladda ned mall" className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
            <Download size={11} />Mall
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" id="leverantorer-csv-input" />
          <label htmlFor="leverantorer-csv-input" title="Importera CSV" className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors cursor-pointer">
            <Upload size={11} />Importera
          </label>
          <RefreshButton />
          <button onClick={handleAdd} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
            <Plus size={11} />Ny leverantör
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selected.size} valda</span>
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
          <button onClick={() => { setSelected(new Set()); setConfirmBulk(false) }} className="ml-auto text-xs text-muted hover:text-fg transition-colors">
            Avmarkera alla
          </button>
        </div>
      )}

      {/* CSV import preview */}
      {(phase === 'preview' || phase === 'importing' || phase === 'done') && (
        <div className="px-6 py-3 border-b border-border bg-elevated shrink-0 flex flex-col gap-2">
          {(phase === 'preview' || phase === 'importing') && (
            <>
              <div className="flex items-center gap-3">
                <p className="text-xs text-fg font-mono truncate max-w-[200px]">{fileName}</p>
                <span className="text-xs text-emerald-400">{newCount} nya</span>
                {duplicateCount > 0 && <span className="text-xs text-amber-400">{duplicateCount} finns redan</span>}
                {invalidCount > 0 && <span className="text-xs text-muted">{invalidCount} saknar namn</span>}
                <button onClick={resetCsv} className="ml-auto text-xs text-muted hover:text-fg transition-colors">✕</button>
              </div>
              {duplicateCount > 0 && (
                <div className="flex items-center gap-4">
                  <span className="text-[10px] uppercase tracking-wider text-muted">Duplicater:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="importMode" value="skip" checked={importMode === 'skip'} onChange={() => setImportMode('skip')} className="accent-emerald-400" />
                    <span className="text-xs text-fg">Hoppa över</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="importMode" value="overwrite" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} className="accent-emerald-400" />
                    <span className="text-xs text-fg">Skriv över</span>
                  </label>
                </div>
              )}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="max-h-32 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-elevated border-b border-border">
                      <tr>
                        {PREVIEW_COLS.map(col => (
                          <th key={col} className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wider text-muted font-medium">{col}</th>
                        ))}
                        <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wider text-muted font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row, i) => {
                        const missing = !row['namn']?.trim()
                        const isDuplicate = !missing && existingNames.has(row['namn'].toLowerCase())
                        return (
                          <tr key={i} className={missing ? 'opacity-40' : ''}>
                            {PREVIEW_COLS.map(col => (
                              <td key={col} className="px-3 py-1.5 text-fg truncate max-w-[120px]">
                                {row[col] || <span className="text-subtle">—</span>}
                              </td>
                            ))}
                            <td className="px-3 py-1.5">
                              {missing ? <span className="text-muted">—</span>
                                : isDuplicate ? <span className="text-amber-400">Finns redan</span>
                                : <span className="text-emerald-400">Ny</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {csvError && <p className="text-xs text-red-400">{csvError}</p>}
                <button
                  onClick={handleImport}
                  disabled={valid.length === 0 || phase === 'importing'}
                  className="px-3 py-1.5 bg-emerald-400/10 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-400/20 disabled:opacity-40 transition-colors"
                >
                  {phase === 'importing' ? 'Importerar...' : importMode === 'skip' ? `Importera ${newCount} nya` : `Importera ${valid.length} leverantörer`}
                </button>
              </div>
            </>
          )}
          {phase === 'done' && result && (
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-emerald-400">✓ {result.success} importerade</span>
              {result.skipped > 0 && <span className="text-xs text-amber-400">{result.skipped} hoppade över</span>}
              {result.errors.length > 0 && <span className="text-xs text-red-400">{result.errors.length} fel</span>}
              <button onClick={resetCsv} className="ml-auto text-xs text-muted hover:text-fg transition-colors">Stäng</button>
            </div>
          )}
        </div>
      )}

      {csvError && phase === 'idle' && (
        <div className="px-6 py-2 shrink-0">
          <p className="text-xs text-red-400">{csvError}</p>
        </div>
      )}

      {/* Table */}
      {leverantorer.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted text-sm">Inga leverantörer ännu.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted text-sm">Inga leverantörer matchar sökningen.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sidebar z-10">
              <tr className="border-b border-border text-left">
                <th className="pl-4 pr-2 py-2.5 w-8">
                  <input type="checkbox" checked={allFilteredSelected} onChange={() => {}} onClick={toggleAll}
                    className="rounded border-border accent-emerald-400 cursor-pointer" />
                </th>
                {COLS.map(([col, label]) => (
                  <th key={col} onClick={() => handleSort(col)}
                    className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted cursor-pointer select-none hover:text-fg transition-colors group/th">
                    <div className="flex items-center gap-1">
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
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => {
                const isSelected = selected.has(l.id)
                const isExpanded = expanded === l.id
                const isConfirmRow = confirmRowId === l.id
                return (
                  <>
                    <tr key={l.id} onClick={() => setExpanded(isExpanded ? null : l.id)}
                      className={`border-b border-border hover:bg-hover cursor-pointer transition-colors group ${isSelected ? 'bg-elevated' : ''} ${isExpanded ? 'bg-hover' : ''}`}
                    >
                      <td className="pl-4 pr-2 py-3" onClick={(e) => toggleSelect(e, l.id)}>
                        <input type="checkbox" checked={isSelected} onChange={() => {}} className="rounded border-border accent-emerald-400 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 font-medium text-fg whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {l.namn || <span className="text-muted italic">Namnlös</span>}
                          {isExpanded ? <ChevronUp size={12} className="text-muted shrink-0" /> : <ChevronDown size={12} className="text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{l.kontaktperson || '—'}</td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{l.email || '—'}</td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{l.telefon || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap">{l.org_nummer || '—'}</td>
                      <td className="pr-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {isConfirmRow ? (
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => handleRowDelete(e, l.id)} className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors">Ja</button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmRowId(null) }} className="text-xs text-muted hover:text-fg transition-colors">Nej</button>
                          </div>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setConfirmRowId(l.id) }}
                            className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${l.id}-edit`} className="border-b border-border bg-sidebar">
                        <td />
                        <td colSpan={5} className="px-4 pb-4 pt-3">
                          <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                            <Field label="Namn" value={l.namn} placeholder="Leverantörens namn" onSave={(v) => handleUpdate(l.id, 'namn', v)} />
                            <Field label="Kontaktperson" value={l.kontaktperson} onSave={(v) => handleUpdate(l.id, 'kontaktperson', v)} />
                            <Field label="Org.nummer" value={l.org_nummer} placeholder="XXXXXX-XXXX" onSave={(v) => handleUpdate(l.id, 'org_nummer', v)} />
                            <Field label="E-post" value={l.email} onSave={(v) => handleUpdate(l.id, 'email', v)} />
                            <Field label="Telefon" value={l.telefon} onSave={(v) => handleUpdate(l.id, 'telefon', v)} />
                            <Field label="Webbadress" value={l.webbadress} placeholder="https://..." onSave={(v) => handleUpdate(l.id, 'webbadress', v)} />
                            <div className="col-span-3">
                              <Field label="Anteckning" value={l.anteckning} onSave={(v) => handleUpdate(l.id, 'anteckning', v)} />
                            </div>
                          </div>
                        </td>
                        <td />
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
