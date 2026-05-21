import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, Download, Upload } from 'lucide-react'
import type { Artikel } from '../types'
import { useAppConfig } from '@/context/AppConfig'
import { parseCsv, type ParsedRow } from '../../../utils/csvParsers'

const CSV_HEADERS = ['beskrivning', 'article_number', 'enhet', 'a_pris', 'moms_procent', 'account_number'] as const
const CSV_EXAMPLE = 'Skruv M6x20,10001,st,2.50,25,3001\nGipsskiva 13mm,10002,m2,89,25,3001'
const PREVIEW_COLS = ['beskrivning', 'article_number', 'enhet', 'a_pris'] as const

type ImportInput = { beskrivning: string; article_number?: string; enhet?: string; a_pris?: number; moms_procent?: number; account_number?: number }
type ImpResult = { success: number; errors: Array<{ index: number; message: string }> }

function rowToInput(row: ParsedRow): ImportInput | null {
  if (!row['beskrivning']?.trim()) return null
  const input: ImportInput = { beskrivning: row['beskrivning'].trim() }
  if (row['article_number']?.trim()) input.article_number = row['article_number'].trim()
  if (row['enhet']?.trim()) input.enhet = row['enhet'].trim()
  if (row['a_pris']) { const n = parseFloat(row['a_pris']); if (!isNaN(n)) input.a_pris = n }
  if (row['moms_procent']) { const n = parseFloat(row['moms_procent']); if (!isNaN(n)) input.moms_procent = n }
  if (row['account_number']) { const n = parseInt(row['account_number']); if (!isNaN(n)) input.account_number = n }
  return input
}

function downloadTemplate() {
  const blob = new Blob([CSV_HEADERS.join(',') + '\n' + CSV_EXAMPLE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'artiklar_mall.csv'; a.click()
  URL.revokeObjectURL(url)
}

function InlineText({ value, onSave, placeholder = '' }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  function save() { if (local !== value) onSave(local) }
  return (
    <input
      className="bg-transparent border-b border-transparent hover:border-border focus:border-fg focus:outline-none text-xs px-1 py-0.5 w-full"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') { save(); e.currentTarget.blur() } }}
    />
  )
}

function InlineNum({ value, onSave, suffix = '' }: { value: number; onSave: (v: number) => void; suffix?: string }) {
  const [local, setLocal] = useState(String(value))
  useEffect(() => setLocal(String(value)), [value])
  function save() {
    const n = parseFloat(local) || 0
    if (n !== value) onSave(n)
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="0"
        step="0.01"
        className="bg-transparent border-b border-transparent hover:border-border focus:border-fg focus:outline-none text-xs px-1 py-0.5 w-full text-right font-mono"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') { save(); e.currentTarget.blur() } }}
      />
      {suffix && <span className="text-xs text-muted shrink-0">{suffix}</span>}
    </div>
  )
}

export function ArtikklarPanel() {
  const { config } = useAppConfig()
  const valuta = config?.valuta ?? 'kr'
  const [artiklar, setArtiklar] = useState<Artikel[]>([])

  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [phase, setPhase] = useState<'idle' | 'preview' | 'importing' | 'done'>('idle')
  const [result, setResult] = useState<ImpResult | null>(null)
  const [csvError, setCsvError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.invoke('db:artiklar:list').then((d) => setArtiklar(d as Artikel[]))
  }, [])

  async function handleAdd() {
    const created = await window.api.invoke('db:artiklar:create', { beskrivning: 'Ny artikel' }) as Artikel
    setArtiklar((prev) => [...prev, created])
  }

  async function handleUpdate(id: string, field: keyof Artikel, value: string | number) {
    const updated = await window.api.invoke('db:artiklar:update', id, { [field]: value }) as Artikel
    setArtiklar((prev) => prev.map((a) => a.id === id ? updated : a))
  }

  async function handleDelete(id: string) {
    await window.api.invoke('db:artiklar:delete', id)
    setArtiklar((prev) => prev.filter((a) => a.id !== id))
  }

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setCsvError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const parsed = parseCsv(text)
        if (parsed.length === 0) { setCsvError('Filen är tom eller saknar data.'); return }
        if (!Object.keys(parsed[0]).includes('beskrivning')) { setCsvError('Kolumnen "beskrivning" saknas.'); return }
        setRows(parsed); setPhase('preview')
      } catch { setCsvError('Kunde inte läsa filen.') }
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const inputs = rows.map(rowToInput)
  const valid = inputs.filter(Boolean) as ImportInput[]
  const invalidCount = inputs.filter(r => r === null).length

  async function handleImport() {
    if (valid.length === 0) return
    setPhase('importing')
    try {
      const res = await window.api.invoke('db:artiklar:import-csv', valid) as ImpResult
      setResult(res); setPhase('done')
      window.api.invoke('db:artiklar:list').then((d) => setArtiklar(d as Artikel[]))
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Importfel'); setPhase('preview')
    }
  }

  function resetCsv() {
    setRows([]); setFileName(''); setPhase('idle'); setResult(null); setCsvError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[11px] uppercase tracking-widest text-muted">F-Artiklar</p>
        <div className="flex items-center gap-3">
          <button onClick={downloadTemplate} title="Ladda ned mall" className="text-blue-400 hover:text-blue-300 transition-colors">
            <Download size={13} />
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" id="artiklar-csv-input" />
          <label htmlFor="artiklar-csv-input" title="Importera CSV" className="cursor-pointer text-emerald-400 hover:text-emerald-300 transition-colors">
            <Upload size={13} />
          </label>
          <button onClick={handleAdd} className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors">
            <Plus size={13} /> Ny artikel
          </button>
        </div>
      </div>

      {artiklar.length === 0 ? (
        <p className="text-sm text-muted">Inga artiklar ännu. Artiklar används i fakturarader.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 text-[10px] uppercase tracking-wider text-muted font-medium w-24">Art.nr</th>
                <th className="text-left py-2 pr-3 text-[10px] uppercase tracking-wider text-muted font-medium">Beskrivning</th>
                <th className="text-left py-2 pr-3 text-[10px] uppercase tracking-wider text-muted font-medium w-14">Enhet</th>
                <th className="text-right py-2 pr-3 text-[10px] uppercase tracking-wider text-muted font-medium w-24">À-pris</th>
                <th className="text-right py-2 pr-3 text-[10px] uppercase tracking-wider text-muted font-medium w-16">Moms%</th>
                <th className="text-right py-2 pr-3 text-[10px] uppercase tracking-wider text-muted font-medium w-16">Konto</th>
                <th className="w-6"></th>
              </tr>
            </thead>
            <tbody>
              {artiklar.map((a) => (
                <tr key={a.id} className="border-b border-border group">
                  <td className="py-1.5 pr-3"><InlineText value={a.article_number ?? ''} placeholder="—" onSave={(v) => handleUpdate(a.id, 'article_number', v)} /></td>
                  <td className="py-1.5 pr-3"><InlineText value={a.beskrivning} placeholder="Beskrivning" onSave={(v) => handleUpdate(a.id, 'beskrivning', v)} /></td>
                  <td className="py-1.5 pr-3"><InlineText value={a.enhet} placeholder="st" onSave={(v) => handleUpdate(a.id, 'enhet', v)} /></td>
                  <td className="py-1.5 pr-3"><InlineNum value={a.a_pris} suffix={valuta} onSave={(v) => handleUpdate(a.id, 'a_pris', v)} /></td>
                  <td className="py-1.5 pr-3"><InlineNum value={a.moms_procent} onSave={(v) => handleUpdate(a.id, 'moms_procent', v)} /></td>
                  <td className="py-1.5 pr-3"><InlineNum value={a.account_number} onSave={(v) => handleUpdate(a.id, 'account_number', v)} /></td>
                  <td className="py-1.5">
                    <button onClick={() => handleDelete(a.id)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {csvError && phase === 'idle' && (
        <p className="mt-3 text-xs text-red-400">{csvError}</p>
      )}

      {(phase === 'preview' || phase === 'importing') && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <p className="text-xs text-fg font-mono truncate max-w-[200px]">{fileName}</p>
            <span className="text-xs text-subtle">{valid.length} giltiga</span>
            {invalidCount > 0 && <span className="text-xs text-amber-400">{invalidCount} saknar beskrivning</span>}
            <button onClick={resetCsv} className="ml-auto text-xs text-muted hover:text-fg transition-colors">✕</button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-36 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-elevated border-b border-border">
                  <tr>
                    {PREVIEW_COLS.map(col => (
                      <th key={col} className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wider text-muted font-medium">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, i) => (
                    <tr key={i} className={!row['beskrivning']?.trim() ? 'opacity-40' : ''}>
                      {PREVIEW_COLS.map(col => (
                        <td key={col} className="px-3 py-1.5 text-fg truncate max-w-[120px]">
                          {row[col] || <span className="text-subtle">—</span>}
                        </td>
                      ))}
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
              disabled={valid.length === 0 || phase === 'importing'}
              className="px-3 py-1.5 bg-emerald-400/10 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-400/20 disabled:opacity-40 transition-colors"
            >
              {phase === 'importing' ? 'Importerar...' : `Importera ${valid.length} artiklar`}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-emerald-400">✓ {result.success} importerade</span>
            {result.errors.length > 0 && <span className="text-xs text-red-400">{result.errors.length} fel</span>}
            <button onClick={resetCsv} className="ml-auto text-xs text-muted hover:text-fg transition-colors">Stäng</button>
          </div>
          {result.errors.slice(0, 5).map(e => (
            <p key={e.index} className="text-xs text-red-400 font-mono">Rad {e.index + 1}: {e.message}</p>
          ))}
        </div>
      )}
    </div>
  )
}
