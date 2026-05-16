import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, Trash2, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import { parseCsv } from '@/utils/csvParsers'
import type { BankTransaktion, BankTransaktionInput, ColumnMapping } from './types'

interface Props {
  onImported: () => void
}

const MAPPING_STORAGE_KEY = 'kassaflode-bank-mapping'

function parseAmount(s: string): number {
  if (!s || s.trim() === '') return NaN
  let clean = s.trim().replace(/ /g, '').replace(/ /g, '')
  // Swedish format: period as thousands sep, comma as decimal — e.g. 1.234,56 → 1234.56
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.')
  }
  return parseFloat(clean)
}

function parseDate(s: string): string {
  if (!s) return ''
  const t = s.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  if (/^\d{4}\/\d{2}\/\d{2}/.test(t)) return t.slice(0, 10).replace(/\//g, '-')
  const m = t.match(/^(\d{2})[/\-.](\d{2})[/\-.](\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return t.slice(0, 10)
}

function autoDetect(headers: string[]): ColumnMapping {
  const lc = headers.map((h) => h.toLowerCase())
  const find = (terms: string[]) => {
    const i = lc.findIndex((h) => terms.some((t) => h.includes(t)))
    return i >= 0 ? headers[i] : ''
  }
  return {
    datum: find(['datum', 'bokföringsdag', 'valutadag', 'dag']),
    beskrivning: find(['beskrivning', 'text', 'mottagare', 'avsändare', 'namn', 'kommentar', 'titel']),
    belopp: find(['belopp']),
    saldo: find(['saldo', 'balans']),
    referens: find(['referens', 'ocr', 'meddelande']),
  }
}

function fmtSEK(n: number): string {
  return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function BanktransaktionerTab({ onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [transactions, setTransactions] = useState<BankTransaktion[]>([])
  const [csvAllRows, setCsvAllRows] = useState<Record<string, string>[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({ datum: '', beskrivning: '', belopp: '', saldo: '', referens: '' })
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadTransactions = useCallback(async () => {
    try {
      const data = (await window.api.invoke('db:bank-transaktioner:list')) as BankTransaktion[]
      setTransactions(data)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fel vid laddning')
    }
  }, [])

  useEffect(() => { void loadTransactions() }, [loadTransactions])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCsv(text)
      if (!rows.length) { setErr('Kunde inte tolka CSV-filen.'); return }
      const headers = Object.keys(rows[0])
      setCsvHeaders(headers)
      setCsvAllRows(rows)
      const saved = localStorage.getItem(MAPPING_STORAGE_KEY)
      let detected = autoDetect(headers)
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ColumnMapping
          const valid = Object.values(parsed).every((v) => !v || headers.includes(v))
          if (valid) detected = parsed
        } catch { /* use auto-detected */ }
      }
      setMapping(detected)
      setImportMsg(null)
      setErr(null)
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  async function handleImport() {
    if (!mapping.datum || !mapping.beskrivning || !mapping.belopp) {
      setErr('Datum, Beskrivning och Belopp måste vara mappade.')
      return
    }
    setImporting(true)
    setErr(null)
    setImportMsg(null)
    try {
      const rows: BankTransaktionInput[] = csvAllRows
        .map((r) => {
          const datum = parseDate(r[mapping.datum] ?? '')
          const beskrivning = (r[mapping.beskrivning] ?? '').trim()
          const belopp = parseAmount(r[mapping.belopp] ?? '')
          const rawSaldo = mapping.saldo ? parseAmount(r[mapping.saldo] ?? '') : NaN
          const saldo = isNaN(rawSaldo) ? null : rawSaldo
          const referens = mapping.referens ? (r[mapping.referens] ?? '').trim() || null : null
          return { datum, beskrivning, belopp, saldo, referens }
        })
        .filter((r) => r.datum && r.beskrivning && !isNaN(r.belopp))

      if (!rows.length) { setErr('Inga giltiga rader hittades.'); return }

      localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mapping))
      await window.api.invoke('db:bank-transaktioner:import-csv', rows)
      setImportMsg(`${rows.length} rader bearbetade — duplicat ignorerades automatiskt.`)
      setCsvAllRows([])
      setCsvHeaders([])
      await loadTransactions()
      onImported()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Okänt fel')
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await window.api.invoke('db:bank-transaktioner:delete', id)
      await loadTransactions()
      onImported()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fel vid borttagning')
    } finally {
      setDeletingId(null)
    }
  }

  const FIELDS: { key: keyof ColumnMapping; label: string }[] = [
    { key: 'datum', label: 'Datum *' },
    { key: 'beskrivning', label: 'Beskrivning *' },
    { key: 'belopp', label: 'Belopp *' },
    { key: 'saldo', label: 'Saldo' },
    { key: 'referens', label: 'Referens' },
  ]

  return (
    <div className="flex flex-col">
      {/* Import zone */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wider text-muted">Importera banktransaktioner</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border text-muted hover:text-fg hover:border-fg/30 transition-colors"
          >
            <Upload size={13} />
            Välj CSV-fil
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
        </div>
        <p className="text-xs text-subtle">Exportera transaktioner från din internetbank och importera CSV-filen. Duplicat ignoreras automatiskt.</p>
      </div>

      {err && (
        <div className="flex items-center gap-2 px-6 py-2.5 text-red-400 text-sm border-b border-border">
          <AlertCircle size={13} />
          {err}
        </div>
      )}
      {importMsg && (
        <div className="px-6 py-2.5 text-emerald-400 text-sm border-b border-border">{importMsg}</div>
      )}

      {/* Column mapping */}
      {csvHeaders.length > 0 && (
        <div className="px-6 py-5 border-b border-border">
          <p className="text-[11px] uppercase tracking-wider text-muted mb-4">Kolumnmappning — {csvAllRows.length} rader</p>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-xs text-muted">{f.label}</label>
                <div className="relative">
                  <select
                    value={mapping[f.key]}
                    onChange={(e) => {
                      const updated = { ...mapping, [f.key]: e.target.value }
                      setMapping(updated)
                    }}
                    className="w-full appearance-none bg-bg border border-border rounded px-2.5 py-1.5 text-sm text-fg pr-7 focus:outline-none focus:border-fg/30"
                  >
                    <option value="">— välj —</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                </div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="mb-4 overflow-auto">
            <p className="text-[11px] text-subtle mb-2">Förhandsgranskning (5 rader)</p>
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  {(['datum', 'beskrivning', 'belopp', 'saldo'] as const).map((k) => (
                    <th key={k} className="text-left py-1 px-2 text-muted font-normal border border-border/50">
                      {mapping[k] || `(${k})`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvAllRows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    <td className="py-1 px-2 border border-border/50 text-muted">{mapping.datum ? row[mapping.datum] ?? '—' : '—'}</td>
                    <td className="py-1 px-2 border border-border/50 text-fg max-w-[220px] truncate">{mapping.beskrivning ? row[mapping.beskrivning] ?? '—' : '—'}</td>
                    <td className="py-1 px-2 border border-border/50 text-fg tabular-nums">{mapping.belopp ? row[mapping.belopp] ?? '—' : '—'}</td>
                    <td className="py-1 px-2 border border-border/50 text-muted tabular-nums">{mapping.saldo ? row[mapping.saldo] ?? '—' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => void handleImport()}
            disabled={importing || !mapping.datum || !mapping.beskrivning || !mapping.belopp}
            className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded bg-fg text-bg font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {importing && <Loader2 size={13} className="animate-spin" />}
            Importera {csvAllRows.length} rader
          </button>
        </div>
      )}

      {/* Transactions list */}
      {transactions.length > 0 ? (
        <div className="overflow-auto">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <p className="text-[11px] uppercase tracking-wider text-muted">{transactions.length} transaktioner</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-6 text-[11px] uppercase tracking-wider text-muted font-normal">Datum</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted font-normal">Beskrivning</th>
                <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted font-normal">Belopp</th>
                <th className="text-right py-3 px-6 text-[11px] uppercase tracking-wider text-muted font-normal">Saldo</th>
                <th className="py-3 px-4 w-10" />
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-border hover:bg-hover transition-colors group">
                  <td className="py-2.5 px-6 text-muted font-mono text-xs">{t.datum?.slice(0, 10)}</td>
                  <td className="py-2.5 px-4 text-fg max-w-xs truncate">{t.beskrivning}</td>
                  <td className={`py-2.5 px-4 text-right tabular-nums font-medium ${(t.belopp ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(t.belopp ?? 0) >= 0 ? '+' : ''}{fmtSEK(t.belopp)}
                  </td>
                  <td className="py-2.5 px-6 text-right tabular-nums text-muted">
                    {t.saldo != null ? fmtSEK(t.saldo) : '—'}
                  </td>
                  <td className="py-2.5 px-4">
                    <button
                      onClick={() => void handleDelete(t.id)}
                      disabled={deletingId === t.id}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Ta bort"
                    >
                      {deletingId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !csvHeaders.length && (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-sm text-muted">Inga banktransaktioner importerade ännu.</p>
            <p className="text-xs text-subtle">Välj en CSV-fil från din bank ovan.</p>
          </div>
        )
      )}
    </div>
  )
}
