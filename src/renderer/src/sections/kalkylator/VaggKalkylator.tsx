import { Plus } from 'lucide-react'
import type { KalkylatorInput, MaterialLine, VentanaPreset } from './types'
import { SurfaceCard } from './SurfaceCard'
import { AvdragSection } from './AvdragSection'
import { MaterialCard } from './MaterialCard'
import { parseNum } from './kalkylator-utils'

type MaterialPreset = Omit<MaterialLine, 'id'>

const MATERIAL_PRESETS: MaterialPreset[] = [
  { name: 'Gipsskiva',     unit: 'm²', coveragePerM2: 1.08, unitPrice: 0 },
  { name: 'Isolering',     unit: 'm²', coveragePerM2: 1.05, unitPrice: 0 },
  { name: 'Stålreglar 45', unit: 'm',  coveragePerM2: 3.5,  unitPrice: 0 },
  { name: 'Ångspärr',      unit: 'm²', coveragePerM2: 1.1,  unitPrice: 0 },
  { name: 'Skruv 3,5×35',  unit: 'st', coveragePerM2: 20,   unitPrice: 0 },
]

interface Props {
  input: KalkylatorInput
  avdragPresets: VentanaPreset[]
  onUpdate: (input: KalkylatorInput) => void
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <p className="text-[11px] uppercase tracking-widest text-muted font-medium">{title}</p>
      {sub && <span className="text-xs text-subtle">{sub}</span>}
    </div>
  )
}

export function VaggKalkylator({ input, avdragPresets, onUpdate }: Props) {
  const addSurface = (shape: 'rectangle' | 'triangle') => {
    onUpdate({ ...input, surfaces: [...input.surfaces, { id: crypto.randomUUID(), description: '', shape, width: 0, height: 0, slopeFactor: 1.0 }] })
  }
  const updateSurface = (id: string, row: typeof input.surfaces[0]) => {
    onUpdate({ ...input, surfaces: input.surfaces.map(s => s.id === id ? row : s) })
  }
  const duplicateSurface = (id: string) => {
    const src = input.surfaces.find(s => s.id === id); if (!src) return
    const idx = input.surfaces.findIndex(s => s.id === id)
    const copy = { ...src, id: crypto.randomUUID() }
    const next = [...input.surfaces]; next.splice(idx + 1, 0, copy)
    onUpdate({ ...input, surfaces: next })
  }
  const removeSurface = (id: string) => { onUpdate({ ...input, surfaces: input.surfaces.filter(s => s.id !== id) }) }
  const addPreset = (preset: MaterialPreset) => { onUpdate({ ...input, materials: [...input.materials, { id: crypto.randomUUID(), ...preset }] }) }
  const addCustomMaterial = () => { onUpdate({ ...input, materials: [...input.materials, { id: crypto.randomUUID(), name: '', unit: 'm²', coveragePerM2: 1, unitPrice: 0 }] }) }
  const removeMaterial = (id: string) => { onUpdate({ ...input, materials: input.materials.filter(m => m.id !== id) }) }
  const duplicateMaterial = (id: string) => {
    const src = input.materials.find(m => m.id === id); if (!src) return
    const idx = input.materials.findIndex(m => m.id === id)
    const copy = { ...src, id: crypto.randomUUID() }
    const next = [...input.materials]; next.splice(idx + 1, 0, copy)
    onUpdate({ ...input, materials: next })
  }
  const totalSurface = input.surfaces.reduce((s, r) => {
    const factor = r.shape === 'rectangle' ? 1 : 0.5
    return s + factor * r.width * r.height / 1_000_000 * r.slopeFactor
  }, 0)
  const totalDeduction = input.deductions.reduce((s, d) => {
    const factor = d.shape === 'rectangle' ? 1 : 0.5
    return s + factor * d.width * d.height / 1_000_000 * d.quantity
  }, 0)
  const netArea = Math.max(0, totalSurface - totalDeduction)

  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="px-6 py-6">
        <SectionHeader title="Ytor" sub={totalSurface > 0 ? `${totalSurface.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m² brutto` : undefined} />
        {input.surfaces.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {input.surfaces.map(row => (
              <SurfaceCard key={row.id} row={row} takTyper={[]} onChange={updated => updateSurface(row.id, updated)} onDuplicate={() => duplicateSurface(row.id)} onRemove={() => removeSurface(row.id)} />
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => addSurface('rectangle')} className="flex items-center gap-1.5 text-xs text-muted hover:text-fg border border-dashed border-border hover:border-hover rounded px-3 py-1.5 transition-colors"><Plus size={12} /> Rektangel</button>
          <button onClick={() => addSurface('triangle')} className="flex items-center gap-1.5 text-xs text-muted hover:text-fg border border-dashed border-border hover:border-hover rounded px-3 py-1.5 transition-colors"><Plus size={12} /> Triangel</button>
        </div>
      </div>
      <div className="px-6 py-6">
        <SectionHeader title="Avdrag — fönster & dörrar" sub={totalDeduction > 0 ? `−${totalDeduction.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²` : undefined} />
        <AvdragSection deductions={input.deductions} presets={avdragPresets} onUpdate={deductions => onUpdate({ ...input, deductions })} />
      </div>
      <div className="px-6 py-6">
        <SectionHeader title="Material" sub={netArea > 0 ? `nettoarea: ${netArea.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²` : undefined} />
        {input.materials.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {input.materials.map(row => (
              <MaterialCard key={row.id} row={row} netArea={netArea} onChange={updated => onUpdate({ ...input, materials: input.materials.map(m => m.id === updated.id ? updated : m) })} onDuplicate={() => duplicateMaterial(row.id)} onRemove={() => removeMaterial(row.id)} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {MATERIAL_PRESETS.map(p => (<button key={p.name} onClick={() => addPreset(p)} className="text-xs px-2.5 py-1 rounded border border-border text-muted hover:text-fg hover:border-hover transition-colors">+ {p.name}</button>))}
          <button onClick={addCustomMaterial} className="text-xs px-2.5 py-1 rounded border border-dashed border-border text-muted hover:text-fg hover:border-hover transition-colors">+ Anpassat</button>
        </div>
      </div>
      <div className="px-6 py-6">
        <SectionHeader title="Arbete" />
        <div className="flex items-end gap-6 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted">Timmar / m²</label>
            <input type="number" min="0" step="0.01" value={input.laborHoursPerM2 || ''} onChange={e => onUpdate({ ...input, laborHoursPerM2: parseNum(e.target.value) })} className="input w-28 text-sm text-right" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted">Timpris (kr/h)</label>
            <input type="number" min="0" step="1" value={input.laborRate || ''} onChange={e => onUpdate({ ...input, laborRate: parseNum(e.target.value) })} className="input w-28 text-sm text-right" />
          </div>
          {netArea > 0 && (<div className="mb-0.5 text-sm text-muted">= <span className="text-fg font-medium">{(netArea * input.laborHoursPerM2).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span> timmar totalt</div>)}
        </div>
      </div>
    </div>
  )
}
