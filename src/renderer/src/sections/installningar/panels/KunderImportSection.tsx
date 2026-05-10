import { useState, useRef, useCallback } from 'react'
import { Download, Upload } from 'lucide-react'
import type { CreateKundInput } from '@/sections/kunder/types'
import { parseCsv, type ParsedRow } from '../../../utils/csvParsers'

const CSV_HEADERS = [
  'namn', 'email', 'telefon', 'telefon_2', 'org_nummer',
  'adress', 'adress_2', 'postnummer', 'stad', 'land', 'landskod',
  'webbadress', 'fax', 'fastighetsbeteckning', 'brf_org_nummer',
  'medsokande_namn', 'medsokande_personnummer', 'status',
] as const

const KNOWN_FIELDS = new Set<string>([...CSV_HEADERS, 'kundnummer'])
const PREVIEW_COLS = ['namn', 'email', 'telefon', 'org_nummer', 'stad']
const CSV_EXAMPLE = 'Anna Andersson,anna@exempel.se,070-1234567,,556677-8899,Storgatan 1,,12345,Stockholm,Sverige,SE,,,,,,,'

type ImpResult = { success: number; errors: Array<{ index: number; message: string }> }

function rowToInput(row: ParsedRow): CreateKundInput | null {
  if (!row['namn']?.trim()) return null
  return Object.fromEntries(
    Object.entries(row).filter(([k, v]) => KNOWN_FIELDS.has(k as never) && v !== '')
  ) as unknown as CreateKundInput
}

function downloadTemplate() {
  const blob = new Blob([CSV_HEADERS.join(',') + '\n' + CSV_EXAMPLE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'kunder_mall.csv'; a.click()
  URL.revokeObjectURL(url)
}

export function KunderImportSection() {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [phase, setPhase] = useState<'idle' | 'preview' | 'importing' | 'done'>('idle')
  const [result, setResult] = useState<ImpResult | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const inputs = rows.map(rowToInput)
  const valid = inputs.filter(Boolean) as CreateKundInput[]
  const invalidCount = inputs.filter(r => r === null).length

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const parsed = parseCsv(text)
        if (parsed.length === 0) { setError('Filen är tom eller saknar data.'); return }
        if (!Object.keys(parsed[0]).includes('namn')) { setError('Kolumnen "namn" saknas i filen.'); return }
        setRows(parsed); setPhase('preview')
      } catch { setError('Kunde inte läsa filen.') }
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  async function handleImport() {
    if (valid.length === 0) return
    setPhase('importing')
    try {
      const res = await window.api.invoke('db:kunder:import-csv', valid) as ImpResult
      setResult(res); setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Importfel'); setPhase('preview')
    }
  }

  function reset() {
    setRows([]); setFileName(''); setPhase('idle'); setResult(null); setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="px-8 py-6">
      <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Importera kunder</p>
      <div className="flex flex-col gap-4">

        <div>
          <p className="text-xs text-subtle mb-2">
            Ladda ner mallen, fyll i dina kunder och importera. Endast <span className="text-fg font-medium">namn</span> är obligatoriskt — kundnummer genereras automatiskt.
          </p>
          <button onClick={downloadTemplate} className="flex items-center gap-2 px-3 py-1.5 bg-hover rounded-lg text-xs text-fg hover:bg-border transition-colors">
            <Download size={12} /> kunder_mall.csv
          </button>
        </div>

        {phase === 'idle' && (
          <div>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" id="kunder-csv-input" />
            <label htmlFor="kunder-csv-input" className="flex items-center gap-2 px-3 py-1.5 bg-hover rounded-lg text-xs text-muted hover:text-fg hover:bg-border cursor-pointer transition-colors w-fit">
              <Upload size={12} /> Välj CSV-fil...
            </label>
            {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
          </div>
        )}

        {phase === 'done' && result && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-emerald-400">✓ {result.success} importerade</span>
              {result.errors.length > 0 && <span className="text-xs text-red-400">{result.errors.length} fel</span>}
              <button onClick={reset} className="ml-auto text-xs text-muted hover:text-fg transition-colors">Importera igen</button>
            </div>
            {result.errors.slice(0, 5).map(e => (
              <p key={e.index} className="text-xs text-red-400 font-mono">Rad {e.index + 1}: {e.message}</p>
            ))}
            {result.errors.length > 5 && <p className="text-xs text-subtle">...och {result.errors.length - 5} fler fel</p>}
          </div>
        )}

        {(phase === 'preview' || phase === 'importing') && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <p className="text-xs text-fg font-mono truncate max-w-[200px]">{fileName}</p>
              <span className="text-xs text-subtle">{valid.length} giltiga</span>
              {invalidCount > 0 && <span className="text-xs text-amber-400">{invalidCount} saknar namn</span>}
              <button onClick={reset} className="ml-auto text-xs text-muted hover:text-fg transition-colors">✕</button>
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
                      <tr key={i} className={!row['namn']?.trim() ? 'opacity-40' : ''}>
                        {PREVIEW_COLS.map(col => (
                          <td key={col} className="px-3 py-1.5 text-fg truncate max-w-[100px]">
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
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                onClick={handleImport}
                disabled={valid.length === 0 || phase === 'importing'}
                className="px-3 py-1.5 bg-emerald-400/10 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-400/20 disabled:opacity-40 transition-colors"
              >
                {phase === 'importing' ? 'Importerar...' : `Importera ${valid.length} kunder`}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
