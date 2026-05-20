import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Download, Upload, CheckCircle, AlertTriangle, Check } from 'lucide-react'
import type { FasMall, FasMallFas, FasMallSubfas } from '../types'

const CSV_TEMPLATE =
  'fas,subfas\n' +
  'Rivning,Demontera befintligt\n' +
  'Rivning,Avfall & städning\n' +
  'Installation,Rördragning\n' +
  'Installation,Elinstallation\n' +
  'Ytskikt,Kakling\n' +
  'Ytskikt,Målning\n'

function parseCSV(text: string): { fas: string; subfas: string }[] {
  const lines = text.replace(/\r/g, '').trim().split('\n')
  if (lines.length < 2) return []
  return lines.slice(1)
    .map((line) => {
      // Handle quoted fields
      const cols: string[] = []
      let cur = ''
      let inQuote = false
      for (const ch of line) {
        if (ch === '"') { inQuote = !inQuote }
        else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = '' }
        else { cur += ch }
      }
      cols.push(cur.trim())
      return { fas: cols[0] ?? '', subfas: cols[1] ?? '' }
    })
    .filter((r) => r.fas)
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"'
  }
  return val
}

function InlineText({ value, onSave, placeholder = '', doubleClickToEdit = false }: { value: string; onSave: (v: string) => void; placeholder?: string; doubleClickToEdit?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  function save() { if (local !== value) onSave(local); setEditing(false) }

  if (doubleClickToEdit && !editing) {
    return (
      <span
        className="text-sm truncate w-full block"
        onDoubleClick={(e) => { e.stopPropagation(); setLocal(value); setEditing(true) }}
      >
        {value || <span className="text-subtle italic">{placeholder}</span>}
      </span>
    )
  }

  return (
    <input
      autoFocus={doubleClickToEdit}
      className="bg-transparent text-sm text-fg focus:outline-none w-full truncate"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') { save(); e.currentTarget.blur() } if (e.key === 'Escape') setEditing(false) }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

export function FasMallarPanel() {
  const [mallar, setMallar] = useState<FasMall[]>([])
  const [selectedMallId, setSelectedMallId] = useState<string | null>(null)
  const [faserByMall, setFaserByMall] = useState<Record<string, FasMallFas[]>>({})
  const [selectedFasId, setSelectedFasId] = useState<string | null>(null)
  const [subfaserByFas, setSubfaserByFas] = useState<Record<string, FasMallSubfas[]>>({})
  const [checkedFasIds, setCheckedFasIds] = useState<Set<string>>(new Set())
  const [checkedSubfasIds, setCheckedSubfasIds] = useState<Set<string>>(new Set())

  // Import state
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<{ fas: string; subfas: string }[] | null>(null)
  const [importResult, setImportResult] = useState<{ fasCount: number; subfasCount: number } | null>(null)
  const [importError, setImportError] = useState('')

  useEffect(() => {
    window.api.invoke('db:fas-mallar:list').then((d) => setMallar(d as FasMall[]))
  }, [])

  async function selectMall(id: string) {
    setSelectedMallId(id)
    setSelectedFasId(null)
    setCheckedFasIds(new Set())
    setCheckedSubfasIds(new Set())
    setImportPreview(null)
    setImportResult(null)
    setImportError('')
    if (!faserByMall[id]) {
      const faser = await window.api.invoke('db:fas-mall-faser:list', id) as FasMallFas[]
      setFaserByMall((prev) => ({ ...prev, [id]: faser }))
    }
  }

  async function selectFas(id: string) {
    setSelectedFasId(id)
    setCheckedSubfasIds(new Set())
    if (!subfaserByFas[id]) {
      const subfaser = await window.api.invoke('db:fas-mall-subfaser:list', id) as FasMallSubfas[]
      setSubfaserByFas((prev) => ({ ...prev, [id]: subfaser }))
    }
  }

  function toggleFasCheck(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setCheckedFasIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSubfasCheck(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setCheckedSubfasIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleDeleteCheckedFaser() {
    if (!selectedMallId || checkedFasIds.size === 0) return
    const ids = [...checkedFasIds]
    await Promise.all(ids.map((id) => window.api.invoke('db:fas-mall-faser:delete', id)))
    setFaserByMall((prev) => ({
      ...prev,
      [selectedMallId]: (prev[selectedMallId] ?? []).filter((f) => !checkedFasIds.has(f.id))
    }))
    if (selectedFasId && checkedFasIds.has(selectedFasId)) setSelectedFasId(null)
    setCheckedFasIds(new Set())
  }

  async function handleDeleteCheckedSubfaser() {
    if (!selectedFasId || checkedSubfasIds.size === 0) return
    const ids = [...checkedSubfasIds]
    await Promise.all(ids.map((id) => window.api.invoke('db:fas-mall-subfaser:delete', id)))
    setSubfaserByFas((prev) => ({
      ...prev,
      [selectedFasId]: (prev[selectedFasId] ?? []).filter((s) => !checkedSubfasIds.has(s.id))
    }))
    setCheckedSubfasIds(new Set())
  }

  async function handleAddMall() {
    const created = await window.api.invoke('db:fas-mallar:create', { namn: 'Ny mall' }) as FasMall
    setMallar((prev) => [...prev, created])
    await selectMall(created.id)
  }

  async function handleUpdateMall(id: string, namn: string) {
    const updated = await window.api.invoke('db:fas-mallar:update', id, { namn }) as FasMall
    setMallar((prev) => prev.map((m) => m.id === id ? updated : m))
  }

  async function handleDeleteMall(id: string) {
    await window.api.invoke('db:fas-mallar:delete', id)
    setMallar((prev) => prev.filter((m) => m.id !== id))
    if (selectedMallId === id) { setSelectedMallId(null); setSelectedFasId(null) }
  }

  async function handleAddFas() {
    if (!selectedMallId) return
    const created = await window.api.invoke('db:fas-mall-faser:create', { mall_id: selectedMallId, namn: 'Ny fas' }) as FasMallFas
    setFaserByMall((prev) => ({ ...prev, [selectedMallId]: [...(prev[selectedMallId] ?? []), created] }))
    await selectFas(created.id)
  }

  async function handleUpdateFas(id: string, mall_id: string, namn: string) {
    const updated = await window.api.invoke('db:fas-mall-faser:update', id, { namn }) as FasMallFas
    setFaserByMall((prev) => ({ ...prev, [mall_id]: (prev[mall_id] ?? []).map((f) => f.id === id ? updated : f) }))
  }

  async function handleDeleteFas(id: string, mall_id: string) {
    await window.api.invoke('db:fas-mall-faser:delete', id)
    setFaserByMall((prev) => ({ ...prev, [mall_id]: (prev[mall_id] ?? []).filter((f) => f.id !== id) }))
    if (selectedFasId === id) setSelectedFasId(null)
  }

  async function handleAddSubfas() {
    if (!selectedFasId) return
    const created = await window.api.invoke('db:fas-mall-subfaser:create', { fas_id: selectedFasId, namn: 'Ny subfas' }) as FasMallSubfas
    setSubfaserByFas((prev) => ({ ...prev, [selectedFasId]: [...(prev[selectedFasId] ?? []), created] }))
  }

  async function handleUpdateSubfas(id: string, fas_id: string, namn: string) {
    const updated = await window.api.invoke('db:fas-mall-subfaser:update', id, { namn }) as FasMallSubfas
    setSubfaserByFas((prev) => ({ ...prev, [fas_id]: (prev[fas_id] ?? []).map((s) => s.id === id ? updated : s) }))
  }

  async function handleDeleteSubfas(id: string, fas_id: string) {
    await window.api.invoke('db:fas-mall-subfaser:delete', id)
    setSubfaserByFas((prev) => ({ ...prev, [fas_id]: (prev[fas_id] ?? []).filter((s) => s.id !== id) }))
  }

  // ── CSV import ──────────────────────────────────────────────────────────────

  async function handleDownloadMall() {
    if (!selectedMallId) {
      downloadCSV(CSV_TEMPLATE, 'fas_subfas_mall.csv')
      return
    }
    const rows = await window.api.invoke('db:fas-mall:export-csv', selectedMallId) as { fas: string; subfas: string }[]
    if (rows.length === 0) {
      downloadCSV(CSV_TEMPLATE, 'fas_subfas_mall.csv')
      return
    }
    const mallNamn = mallar.find((m) => m.id === selectedMallId)?.namn ?? 'mall'
    const lines = ['fas,subfas', ...rows.map((r) => `${csvEscape(r.fas)},${csvEscape(r.subfas)}`)]
    downloadCSV(lines.join('\n') + '\n', `${mallNamn}.csv`)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setImportError('Filen är tom eller har fel format.')
        return
      }
      setImportPreview(rows)
      setImportError('')
      setImportResult(null)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleConfirmImport() {
    if (!selectedMallId || !importPreview) return
    setImporting(true)
    setImportError('')
    try {
      const result = await window.api.invoke('db:fas-mall:import-csv', selectedMallId, importPreview) as { fasCount: number; subfasCount: number }
      // Reload faser for this mall
      const faser = await window.api.invoke('db:fas-mall-faser:list', selectedMallId) as FasMallFas[]
      setFaserByMall((prev) => ({ ...prev, [selectedMallId]: faser }))
      setSubfaserByFas({})
      setSelectedFasId(null)
      setImportPreview(null)
      setImportResult(result)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import misslyckades.')
    } finally {
      setImporting(false)
    }
  }

  // Summary for preview
  const previewFaser = importPreview
    ? [...new Map(importPreview.map((r) => [r.fas, true])).keys()]
    : []

  const selectedFaser = selectedMallId ? (faserByMall[selectedMallId] ?? []) : []
  const selectedSubfaser = selectedFasId ? (subfaserByFas[selectedFasId] ?? []) : []

  return (
    <div className="flex flex-col h-full">

      {/* Import preview banner */}
      {importPreview && selectedMallId && (
        <div className="flex items-start gap-3 px-5 py-3 bg-amber-400/10 border-b border-amber-400/20 shrink-0">
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-fg font-medium">
              Importera {previewFaser.length} faser, {importPreview.length} rader?
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              Befintliga faser och subfaser för "{mallar.find((m) => m.id === selectedMallId)?.namn}" raderas och ersätts.
            </p>
            <p className="text-[11px] text-subtle mt-1 truncate">
              Faser: {previewFaser.join(' · ')}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleConfirmImport}
              disabled={importing}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
            >
              {importing ? 'Importerar...' : 'Bekräfta'}
            </button>
            <button
              onClick={() => { setImportPreview(null); setImportError('') }}
              className="text-xs text-muted hover:text-fg transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Success banner */}
      {importResult && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-emerald-400/10 border-b border-emerald-400/20 shrink-0">
          <CheckCircle size={13} className="text-emerald-400 shrink-0" />
          <p className="text-xs text-fg flex-1">
            Importerat: <strong>{importResult.fasCount} faser</strong> och <strong>{importResult.subfasCount} subfaser</strong>.
          </p>
          <button onClick={() => setImportResult(null)} className="text-xs text-muted hover:text-fg transition-colors">×</button>
        </div>
      )}

      {/* Error banner */}
      {importError && (
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border shrink-0">
          <AlertTriangle size={13} className="text-red-400 shrink-0" />
          <p className="text-xs text-red-400 flex-1">{importError}</p>
          <button onClick={() => setImportError('')} className="text-xs text-muted hover:text-fg transition-colors">×</button>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />

      <div className="flex flex-1 min-h-0">

        {/* Col 1: Mallar */}
        <div className="w-96 shrink-0 border-r border-border flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted">Mallar</p>
            <button onClick={handleAddMall} className="text-muted hover:text-fg transition-colors"><Plus size={13} /></button>
          </div>
          <div className="flex-1 overflow-auto py-1">
            {mallar.map((m) => (
              <div
                key={m.id}
                onClick={() => selectMall(m.id)}
                className={`group flex items-center justify-between px-4 py-2 cursor-pointer transition-colors ${selectedMallId === m.id ? 'bg-hover text-fg' : 'text-muted hover:bg-hover hover:text-fg'}`}
              >
                <InlineText value={m.namn} placeholder="Mallnamn" doubleClickToEdit onSave={(v) => handleUpdateMall(m.id, v)} />
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteMall(m.id) }}
                  className="opacity-0 group-hover:opacity-100 ml-1 shrink-0 text-muted hover:text-red-400 transition-all"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Col 2: Faser */}
        <div className="w-96 shrink-0 border-r border-border flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted">Faser</p>
            <div className="flex items-center gap-2">
              {checkedFasIds.size > 0 ? (
                <button
                  onClick={handleDeleteCheckedFaser}
                  className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={11} />{checkedFasIds.size}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleDownloadMall}
                    title={selectedMallId ? 'Exportera mall som CSV' : 'Ladda ner CSV-mall'}
                    className="text-muted hover:text-fg transition-colors"
                  >
                    <Download size={13} />
                  </button>
                  {selectedMallId && (
                    <button
                      onClick={() => fileRef.current?.click()}
                      title="Importera CSV"
                      className="text-muted hover:text-fg transition-colors"
                    >
                      <Upload size={13} />
                    </button>
                  )}
                  {selectedMallId && (
                    <button onClick={handleAddFas} className="text-muted hover:text-fg transition-colors"><Plus size={13} /></button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto py-1">
            {!selectedMallId ? (
              <p className="px-4 py-3 text-xs text-subtle">Välj en mall</p>
            ) : selectedFaser.length === 0 ? (
              <div className="px-4 py-3">
                <p className="text-xs text-subtle mb-2">Inga faser ännu.</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
                >
                  <Upload size={11} />Importera CSV
                </button>
              </div>
            ) : selectedFaser.map((f) => (
              <div
                key={f.id}
                onClick={() => selectFas(f.id)}
                className={`group flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors ${selectedFasId === f.id ? 'bg-hover text-fg' : 'text-muted hover:bg-hover hover:text-fg'}`}
              >
                <span
                  onClick={(e) => toggleFasCheck(f.id, e)}
                  className={`shrink-0 w-3 h-3 rounded-[3px] border flex items-center justify-center transition-all cursor-pointer ${checkedFasIds.has(f.id) ? 'bg-emerald-400 border-emerald-400' : 'border-muted bg-transparent hover:border-fg'}`}
                >
                  {checkedFasIds.has(f.id) && <Check size={8} className="text-bg" strokeWidth={3} />}
                </span>
                <InlineText value={f.namn} placeholder="Fasnamn" doubleClickToEdit onSave={(v) => handleUpdateFas(f.id, f.mall_id, v)} />
                {checkedFasIds.size === 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteFas(f.id, f.mall_id) }}
                    className="opacity-0 group-hover:opacity-100 ml-auto shrink-0 text-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Col 3: Subfaser */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted">Subfaser</p>
            {selectedFasId && (
              checkedSubfasIds.size > 0 ? (
                <button
                  onClick={handleDeleteCheckedSubfaser}
                  className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={11} />{checkedSubfasIds.size}
                </button>
              ) : (
                <button onClick={handleAddSubfas} className="text-muted hover:text-fg transition-colors"><Plus size={13} /></button>
              )
            )}
          </div>
          <div className="flex-1 overflow-auto py-1">
            {!selectedFasId ? (
              <p className="px-4 py-3 text-xs text-subtle">Välj en fas</p>
            ) : selectedSubfaser.length === 0 ? (
              <p className="px-4 py-3 text-xs text-subtle">Inga subfaser</p>
            ) : selectedSubfaser.map((s) => (
              <div
                key={s.id}
                className="group flex items-center gap-2 px-4 py-2 text-muted hover:bg-hover hover:text-fg transition-colors"
              >
                <span
                  onClick={(e) => toggleSubfasCheck(s.id, e)}
                  className={`shrink-0 w-3 h-3 rounded-[3px] border flex items-center justify-center transition-all cursor-pointer ${checkedSubfasIds.has(s.id) ? 'bg-emerald-400 border-emerald-400' : 'border-muted bg-transparent hover:border-fg'}`}
                >
                  {checkedSubfasIds.has(s.id) && <Check size={8} className="text-bg" strokeWidth={3} />}
                </span>
                <InlineText value={s.namn} placeholder="Subfasnamn" doubleClickToEdit onSave={(v) => handleUpdateSubfas(s.id, s.fas_id, v)} />
                {checkedSubfasIds.size === 0 && (
                  <button
                    onClick={() => handleDeleteSubfas(s.id, s.fas_id)}
                    className="opacity-0 group-hover:opacity-100 ml-auto shrink-0 text-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
