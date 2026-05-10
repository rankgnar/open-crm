import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2 } from 'lucide-react'
import type { ForslagArbete, ForslagMaterial, ForslagUnderentreprenor } from './types'
import type { ArbetsRoll, Leverantor, MaterialKatalog } from '@/sections/installningar/types'
import { useAppConfig } from '@/context/AppConfig'

interface Props {
  subfasNamn: string
  catalogPortal?: HTMLDivElement | null
  arbete: ForslagArbete[]
  material: ForslagMaterial[]
  underentreprenorer: ForslagUnderentreprenor[]
  arbetsRoller: ArbetsRoll[]
  onAddArbete: () => Promise<void>
  onUpdateArbete: (id: string, field: string, value: string | number | boolean) => Promise<void>
  onDeleteArbete: (id: string) => Promise<void>
  onAddMaterial: () => Promise<void>
  onUpdateMaterial: (id: string, field: string, value: string | number) => Promise<void>
  onDeleteMaterial: (id: string) => Promise<void>
  onAddUE: () => Promise<void>
  onUpdateUE: (id: string, field: string, value: string | number | boolean) => Promise<void>
  onDeleteUE: (id: string) => Promise<void>
}

function SEKInput({ value, onBlur, suffix = '' }: { value: number; onBlur: (v: number) => void; suffix?: string }) {
  const [local, setLocal] = useState(value.toString())
  useEffect(() => { setLocal(value.toString()) }, [value])
  function save(e: React.SyntheticEvent<HTMLInputElement>) {
    onBlur(parseFloat((e.currentTarget as HTMLInputElement).value) || 0)
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" min="0" step="0.01"
        className="input text-xs py-0.5 px-1.5 text-right w-full"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') { save(e); e.currentTarget.blur() } }}
        onFocus={(e) => e.target.select()}
      />
      {suffix && <span className="text-xs text-muted shrink-0">{suffix}</span>}
    </div>
  )
}

function TextInput({ value, placeholder, onBlur }: { value: string; placeholder?: string; onBlur: (v: string) => void }) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])
  function save(e: React.SyntheticEvent<HTMLInputElement>) { onBlur((e.currentTarget as HTMLInputElement).value) }
  return (
    <input type="text" className="input text-xs py-0.5 px-1.5" placeholder={placeholder}
      value={local} onChange={(e) => setLocal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') { save(e); e.currentTarget.blur() } }}
    />
  )
}

// ── Material row with catalog search ─────────────────────────────────────────

interface MaterialRowProps {
  row: ForslagMaterial
  leverantorer: Leverantor[]
  activeCatalogRowId: string | null
  catalogResults: MaterialKatalog[]
  onUpdate: (field: string, value: string | number) => void
  onDelete: () => void
  onFocusBeskrivning: (rowId: string, levId: string | null, query: string) => void
  onSelectProduct: (rowId: string, product: MaterialKatalog, levNamn: string) => void
  formatCurrency: (n: number, d?: number) => string
  valuta: string
}

function MaterialRow({ row, leverantorer, activeCatalogRowId: _activeCatalogRowId, catalogResults: _catalogResults, onUpdate, onDelete, onFocusBeskrivning, onSelectProduct: _onSelectProduct, formatCurrency, valuta }: MaterialRowProps) {
  const [beskrivning, setBeskrivning] = useState(row.beskrivning)
  useEffect(() => { setBeskrivning(row.beskrivning) }, [row.beskrivning])

  const matchedLev = leverantorer.find((l) => l.namn === row.leverantor)

  function handleLevChange(levNamn: string) {
    onUpdate('leverantor', levNamn)
    // If leverantör changes while beskrivning has text, trigger search
    const lev = leverantorer.find((l) => l.namn === levNamn)
    onFocusBeskrivning(row.id, lev?.id ?? null, beskrivning)
  }

  function handleBeskrivningChange(v: string) {
    setBeskrivning(v)
    onFocusBeskrivning(row.id, matchedLev?.id ?? null, v)
  }

  function handleBeskrivningBlur() {
    if (beskrivning !== row.beskrivning) onUpdate('beskrivning', beskrivning)
    // Don't close catalog on blur — let click on result fire first
  }

  return (
    <tr className="group border-b border-border/40">
      <td className="py-0.5 pr-2">
        {/* Leverantör — select from catalog suppliers or type manually */}
        <select
          className="input text-xs py-1 px-2 text-muted w-full"
          value={row.leverantor}
          onChange={(e) => handleLevChange(e.target.value)}
        >
          <option value="">— Välj —</option>
          {leverantorer.filter((l) => l.aktiv).map((l) => (
            <option key={l.id} value={l.namn}>{l.namn}</option>
          ))}
          {row.leverantor && !leverantorer.find((l) => l.namn === row.leverantor) && (
            <option value={row.leverantor}>{row.leverantor}</option>
          )}
        </select>
      </td>
      <td className="py-0.5 pr-2">
        <input
          type="text"
          className="input text-xs py-1 px-2 w-full"
          placeholder={matchedLev ? 'Sök en katalog...' : 'Beskrivning...'}
          value={beskrivning}
          onChange={(e) => handleBeskrivningChange(e.target.value)}
          onFocus={() => onFocusBeskrivning(row.id, matchedLev?.id ?? null, beskrivning)}
          onBlur={handleBeskrivningBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onUpdate('beskrivning', beskrivning); e.currentTarget.blur() }
            if (e.key === 'Escape') onFocusBeskrivning('', null, '')
          }}
        />
      </td>
      <td className="py-0.5 pr-2">
        <TextInput value={row.enhet} placeholder="st" onBlur={(v) => onUpdate('enhet', v)} />
      </td>
      <td className="py-0.5 pr-2">
        <SEKInput value={row.antal} onBlur={(v) => onUpdate('antal', v)} />
      </td>
      <td className="py-0.5 pr-2">
        <SEKInput value={row.a_pris} suffix={valuta} onBlur={(v) => onUpdate('a_pris', v)} />
      </td>
      <td className="py-1 text-right text-muted pr-2 font-mono">
        {formatCurrency(row.antal * row.a_pris, 0)}
      </td>
      <td className="py-1">
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-subtle hover:text-red-400 transition-all p-0.5">
          <Trash2 size={11} />
        </button>
      </td>
    </tr>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

export function FasEditor({ subfasNamn, catalogPortal, arbete, material, underentreprenorer, arbetsRoller, onAddArbete, onUpdateArbete, onDeleteArbete, onAddMaterial, onUpdateMaterial, onDeleteMaterial, onAddUE, onUpdateUE, onDeleteUE }: Props) {
  const { formatCurrency, config } = useAppConfig()
  const valuta = config?.valuta ?? 'kr'
  const [leverantorer, setLeverantorer] = useState<Leverantor[]>([])
  const [activeCatalogRowId, setActiveCatalogRowId] = useState<string | null>(null)
  const [catalogResults, setCatalogResults] = useState<MaterialKatalog[]>([])
  const [activeLevId, setActiveLevId] = useState<string | null>(null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api.invoke('db:leverantorer:list').then((d) => setLeverantorer(d as Leverantor[]))
  }, [])

  function handleFocusBeskrivning(rowId: string, levId: string | null, query: string) {
    if (!levId) {
      // No leverantör → dismiss catalog
      setActiveCatalogRowId(null)
      setCatalogResults([])
      return
    }
    setActiveCatalogRowId(rowId)
    setActiveLevId(levId)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(async () => {
      const results = await window.api.invoke('db:material-katalog:search', query.trim() || ' ', levId) as MaterialKatalog[]
      setCatalogResults(results.slice(0, 20))
    }, 150)
  }

  function handleSelectProduct(rowId: string, product: MaterialKatalog, levNamn: string) {
    onUpdateMaterial(rowId, 'beskrivning', product.namn)
    onUpdateMaterial(rowId, 'a_pris', product.a_pris)
    onUpdateMaterial(rowId, 'enhet', product.enhet ?? '')
    onUpdateMaterial(rowId, 'leverantor', levNamn)
    setActiveCatalogRowId(null)
    setCatalogResults([])
  }

  const totalArbete = arbete.reduce((s, r) => s + r.antal_timmar * r.timpris, 0)
  const totalMaterial = material.reduce((s, r) => s + r.antal * r.a_pris, 0)
  const totalUE = underentreprenorer.reduce((s, r) => s + r.kostnad, 0)
  const activeLev = leverantorer.find((l) => l.id === activeLevId)

  return (
    <>
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2 border-b border-border shrink-0">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-widest">{subfasNamn}</p>
      </div>

      <div className="flex-1 overflow-auto">

        {/* Arbetskostnad */}
        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted font-medium">Arbetskostnad</p>
            <span className="text-[10px] text-muted">{formatCurrency(totalArbete, 0)}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium pr-2">Beskrivning</th>
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium pr-2 w-28">Yrkesroll</th>
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium pr-2 w-24 text-right">Timmar</th>
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium pr-2 w-28 text-right">Timpris</th>
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium w-24 text-right">Summa</th>
                <th className="pb-1 w-6" />
              </tr>
            </thead>
            <tbody>
              {arbete.map((r) => (
                <tr key={r.id} className="group border-b border-border/40">
                  <td className="py-0.5 pr-2">
                    <TextInput value={r.beskrivning} placeholder="Beskrivning..." onBlur={(v) => onUpdateArbete(r.id, 'beskrivning', v)} />
                  </td>
                  <td className="py-0.5 pr-2">
                    <select
                      value={arbetsRoller.find((ro) => ro.namn === r.yrkesroll) ? r.yrkesroll : ''}
                      onChange={async (e) => {
                        const roll = arbetsRoller.find((ro) => ro.namn === e.target.value)
                        await onUpdateArbete(r.id, 'yrkesroll', e.target.value)
                        if (roll) await onUpdateArbete(r.id, 'timpris', roll.timpris)
                      }}
                      className="input text-xs py-0.5 px-1.5 w-full"
                    >
                      <option value="">— roll —</option>
                      {arbetsRoller.filter((ro) => ro.aktiv).map((ro) => (
                        <option key={ro.id} value={ro.namn}>{ro.namn}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-0.5 pr-2"><SEKInput value={r.antal_timmar} onBlur={(v) => onUpdateArbete(r.id, 'antal_timmar', v)} /></td>
                  <td className="py-0.5 pr-2"><SEKInput value={r.timpris} suffix={valuta} onBlur={(v) => onUpdateArbete(r.id, 'timpris', v)} /></td>
                  <td className="py-0.5 text-right text-muted pr-2 font-mono tabular-nums">{formatCurrency(r.antal_timmar * r.timpris, 0)}</td>
                  <td className="py-0.5">
                    <button onClick={() => onDeleteArbete(r.id)} className="opacity-0 group-hover:opacity-100 text-subtle hover:text-red-400 transition-all p-0.5"><Trash2 size={10} /></button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border/40 cursor-pointer hover:bg-hover/50 transition-colors" onClick={onAddArbete}>
                <td colSpan={6} className="py-1 px-1">
                  <span className="flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-400"><Plus size={10} />Ny rad</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Materialkostnad */}
        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted font-medium">Materialkostnad</p>
            <span className="text-[10px] text-muted">{formatCurrency(totalMaterial, 0)}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium pr-2 w-28">Leverantör</th>
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium pr-2">Beskrivning</th>
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium pr-2 w-16">Enhet</th>
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium pr-2 w-24 text-right">Antal</th>
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium pr-2 w-28 text-right">Á-pris</th>
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium w-24 text-right">Summa</th>
                <th className="pb-1 w-6" />
              </tr>
            </thead>
            <tbody>
              {material.map((r) => (
                <MaterialRow
                  key={r.id}
                  row={r}
                  leverantorer={leverantorer}
                  activeCatalogRowId={activeCatalogRowId}
                  catalogResults={catalogResults}
                  onUpdate={(field, value) => onUpdateMaterial(r.id, field, value)}
                  onDelete={() => onDeleteMaterial(r.id)}
                  onFocusBeskrivning={handleFocusBeskrivning}
                  onSelectProduct={handleSelectProduct}
                  formatCurrency={formatCurrency}
                  valuta={valuta}
                />
              ))}
              <tr className="border-t border-border/40 cursor-pointer hover:bg-hover/50 transition-colors" onClick={onAddMaterial}>
                <td colSpan={7} className="py-1 px-1">
                  <span className="flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-400"><Plus size={10} />Ny rad</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Underentreprenörer */}
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted font-medium">Underentreprenörer</p>
            <span className="text-[10px] text-muted">{formatCurrency(totalUE, 0)}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium pr-2">Typ / Namn</th>
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium pr-2">Beskrivning</th>
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium pr-2 w-20 text-center">Inkl. mat.</th>
                <th className="pb-1 text-[9px] uppercase tracking-wider text-subtle font-medium w-24 text-right">Kostnad</th>
                <th className="pb-1 w-6" />
              </tr>
            </thead>
            <tbody>
              {underentreprenorer.map((r) => (
                <tr key={r.id} className="group border-b border-border/40">
                  <td className="py-0.5 pr-2"><TextInput value={r.namn} placeholder="VVS, EL..." onBlur={(v) => onUpdateUE(r.id, 'namn', v)} /></td>
                  <td className="py-0.5 pr-2"><TextInput value={r.beskrivning} placeholder="Beskrivning..." onBlur={(v) => onUpdateUE(r.id, 'beskrivning', v)} /></td>
                  <td className="py-0.5 pr-2 text-center">
                    <input type="checkbox" checked={r.inkl_material} onChange={(e) => onUpdateUE(r.id, 'inkl_material', e.target.checked)} className="accent-emerald-400" />
                  </td>
                  <td className="py-0.5 text-right pr-2"><SEKInput value={r.kostnad} suffix={valuta} onBlur={(v) => onUpdateUE(r.id, 'kostnad', v)} /></td>
                  <td className="py-0.5">
                    <button onClick={() => onDeleteUE(r.id)} className="opacity-0 group-hover:opacity-100 text-subtle hover:text-red-400 transition-all p-0.5"><Trash2 size={10} /></button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border/40 cursor-pointer hover:bg-hover/50 transition-colors" onClick={onAddUE}>
                <td colSpan={5} className="py-1 px-1">
                  <span className="flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-400"><Plus size={10} />Ny rad</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="h-4 shrink-0" />
    </div>

    {/* Catalog panel — portal to right column or inline fallback */}
    {activeCatalogRowId && catalogResults.length > 0 && (() => {
      const panel = (
        <div className="border-b border-border bg-elevated overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-sidebar">
            <p className="text-[10px] uppercase tracking-widest text-muted font-medium truncate">
              {activeLev?.namn ?? ''} · {catalogResults.length} träffar
            </p>
            <button
              onClick={() => { setActiveCatalogRowId(null); setCatalogResults([]) }}
              className="text-[10px] text-subtle hover:text-fg transition-colors shrink-0 ml-2"
            >× stäng</button>
          </div>
          <div className="overflow-auto" style={{ maxHeight: catalogPortal ? 320 : 200 }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-sidebar">
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-1 text-[9px] uppercase tracking-wider text-subtle font-medium">Namn</th>
                  <th className="text-left px-2 py-1 text-[9px] uppercase tracking-wider text-subtle font-medium w-16">Art.nr</th>
                  <th className="text-right px-3 py-1 text-[9px] uppercase tracking-wider text-subtle font-medium w-20">Á-pris</th>
                </tr>
              </thead>
              <tbody>
                {catalogResults.map((p) => (
                  <tr
                    key={p.id}
                    onMouseDown={() => handleSelectProduct(activeCatalogRowId, p, activeLev?.namn ?? '')}
                    className="border-b border-border/50 hover:bg-hover cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-1 text-fg leading-tight">
                      <span className="block truncate">{p.namn}</span>
                      {p.enhet && <span className="text-[9px] text-subtle">{p.enhet}</span>}
                    </td>
                    <td className="px-2 py-1 text-subtle font-mono text-[9px]">{p.artikel_nummer ?? '—'}</td>
                    <td className="px-3 py-1 text-right font-mono text-fg tabular-nums">{formatCurrency(p.a_pris, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
      return catalogPortal ? createPortal(panel, catalogPortal) : panel
    })()}
    </>
  )
}
