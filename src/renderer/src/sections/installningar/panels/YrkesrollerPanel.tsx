import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, Download, Upload } from 'lucide-react'
import type { ArbetsRoll } from '../types'
import { useAppConfig } from '@/context/AppConfig'
import { parseCsv, type ParsedRow } from '../../../utils/csvParsers'

const CSV_HEADERS = ['namn', 'timpris', 'enhet'] as const
const CSV_EXAMPLE = 'Snickare,650,tim\nElektriker,750,tim\nMålare,580,tim'

type ImportInput = { namn: string; timpris?: number; enhet?: string }
type ImpResult = { success: number; errors: Array<{ index: number; message: string }> }

function rowToInput(row: ParsedRow): ImportInput | null {
  if (!row['namn']?.trim()) return null
  const input: ImportInput = { namn: row['namn'].trim() }
  if (row['timpris']) { const n = parseFloat(row['timpris']); if (!isNaN(n)) input.timpris = n }
  if (row['enhet']?.trim()) input.enhet = row['enhet'].trim()
  return input
}

function downloadTemplate() {
  const blob = new Blob([CSV_HEADERS.join(',') + '\n' + CSV_EXAMPLE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'timpris_mall.csv'; a.click()
  URL.revokeObjectURL(url)
}

function InlineText({ value, onSave, placeholder = '' }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  function save() { if (local !== value) onSave(local) }
  return (
    <input
      className="bg-transparent border-b border-transparent hover:border-border focus:border-fg focus:outline-none text-sm px-1 py-0.5 w-full"
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
        className="bg-transparent border-b border-transparent hover:border-border focus:border-fg focus:outline-none text-sm px-1 py-0.5 w-24 text-right font-mono"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') { save(); e.currentTarget.blur() } }}
      />
      {suffix && <span className="text-xs text-muted">{suffix}</span>}
    </div>
  )
}

export function YrkesrollerPanel() {
  const { config } = useAppConfig()
  const valuta = config?.valuta ?? 'kr'
  const [roller, setRoller] = useState<ArbetsRoll[]>([])

  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [phase, setPhase] = useState<'idle' | 'preview' | 'importing' | 'done'>('idle')
  const [result, setResult] = useState<ImpResult | null>(null)
  const [csvError, setCsvError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.invoke('db:arbets-roller:list').then((d) => setRoller(d as ArbetsRoll[]))
  }, [])

  async function handleAdd() {
    const created = await window.api.invoke('db:arbets-roller:create', { namn: 'Ny roll', timpris: 0 }) as ArbetsRoll
    setRoller((prev) => [...prev, created])
  }

  async function handleUpdate(id: string, field: keyof ArbetsRoll, value: string | number) {
    const updated = await window.api.invoke('db:arbets-roller:update', id, { [field]: value }) as ArbetsRoll
    setRoller((prev) => prev.map((r) => r.id === id ? updated : r))
  }

  async function handleDelete(id: string) {
    await window.api.invoke('db:arbets-roller:delete', id)
    setRoller((prev) => prev.filter((r) => r.id !== id))
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
        if (!Object.keys(parsed[0]).includes('namn')) { setCsvError('Kolumnen "namn" saknas.'); return }
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
      const res = await window.api.invoke('db:arbets-roller:import-csv', valid) as ImpResult
      setResult(res); setPhase('done')
      window.api.invoke('db:arbets-roller:list').then((d) => setRoller(d as ArbetsRoll[]))
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
        <p className="text-[11px] uppercase tracking-widest text-muted">Timpris</p>
        <div className="flex items-center gap-3">
          <button onClick={downloadTemplate} title="Ladda ned mall" className="text-blue-400 hover:text-blue-300 transition-colors">
            <Download size={13} />
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" id="timpris-csv-input" />
          <label htmlFor="timpris-csv-input" title="Importera CSV" className="cursor-pointer text-emerald-400 hover:text-emerald-300 transition-colors">
            <Upload size={13} />
          </label>
          <button onClick={handleAdd} className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors">
            <Plus size={13} /> Ny roll
          </button>
        </div>
      </div>

      {roller.length === 0 ? (
        <p className="text-sm text-muted">Inga roller ännu. Lägg till yrkesroller med standardtimpriser.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-[10px] uppercase tracking-wider text-muted font-medium">Roll</th>
              <th className="text-right py-2 pr-4 text-[10px] uppercase tracking-wider text-muted font-medium w-32">Timpris</th>
              <th className="text-left py-2 pr-4 text-[10px] uppercase tracking-wider text-muted font-medium w-20">Enhet</th>
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody>
            {roller.map((r) => (
              <tr key={r.id} className="border-b border-border group">
                <td className="py-1.5 pr-4">
                  <InlineText value={r.namn} placeholder="Rollnamn" onSave={(v) => handleUpdate(r.id, 'namn', v)} />
                </td>
                <td className="py-1.5 pr-4 text-right">
                  <InlineNum value={r.timpris} suffix={valuta} onSave={(v) => handleUpdate(r.id, 'timpris', v)} />
                </td>
                <td className="py-1.5 pr-4">
                  <InlineText value={r.enhet} placeholder="tim" onSave={(v) => handleUpdate(r.id, 'enhet', v)} />
                </td>
                <td className="py-1.5">
                  <button onClick={() => handleDelete(r.id)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {csvError && phase === 'idle' && (
        <p className="mt-3 text-xs text-red-400">{csvError}</p>
      )}

      {(phase === 'preview' || phase === 'importing') && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <p className="text-xs text-fg font-mono truncate max-w-[200px]">{fileName}</p>
            <span className="text-xs text-subtle">{valid.length} giltiga</span>
            {invalidCount > 0 && <span className="text-xs text-amber-400">{invalidCount} saknar namn</span>}
            <button onClick={resetCsv} className="ml-auto text-xs text-muted hover:text-fg transition-colors">✕</button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-36 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-elevated border-b border-border">
                  <tr>
                    {CSV_HEADERS.map(col => (
                      <th key={col} className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wider text-muted font-medium">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, i) => (
                    <tr key={i} className={!row['namn']?.trim() ? 'opacity-40' : ''}>
                      {CSV_HEADERS.map(col => (
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
              {phase === 'importing' ? 'Importerar...' : `Importera ${valid.length} roller`}
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
