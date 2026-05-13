import type { DeductionRow, VentanaPreset } from './types'
import { WindowIcon } from './WindowIcons'
import { AvdragCard } from './AvdragCard'

interface Props {
  deductions: DeductionRow[]
  presets: VentanaPreset[]
  onUpdate: (deductions: DeductionRow[]) => void
}

export function AvdragSection({ deductions, presets, onUpdate }: Props) {
  const addFromPreset = (preset: VentanaPreset) => {
    const row: DeductionRow = {
      id: crypto.randomUUID(),
      description: preset.name,
      icon: preset.icon,
      shape: 'rectangle',
      width: preset.defaultWidth,
      height: preset.defaultHeight,
      quantity: 1,
    }
    onUpdate([...deductions, row])
  }

  const addTriangle = () => {
    onUpdate([...deductions, {
      id: crypto.randomUUID(),
      description: 'Triangelavdrag',
      icon: 'triangle',
      shape: 'triangle',
      width: 0,
      height: 0,
      quantity: 1,
    }])
  }

  const addTriangleRight = () => {
    onUpdate([...deductions, {
      id: crypto.randomUUID(),
      description: 'Rätvinkat avdrag',
      icon: 'triangle-right',
      shape: 'triangle-right',
      width: 0,
      height: 0,
      quantity: 1,
    }])
  }

  const addCustom = () => {
    onUpdate([...deductions, {
      id: crypto.randomUUID(),
      description: '',
      icon: 'rectangle',
      shape: 'rectangle',
      width: 0,
      height: 0,
      quantity: 1,
    }])
  }

  const updateRow = (id: string, row: DeductionRow) => {
    onUpdate(deductions.map(d => d.id === id ? row : d))
  }

  const removeRow = (id: string) => {
    onUpdate(deductions.filter(d => d.id !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Visual picker */}
      <div className="flex flex-wrap gap-2">
        {presets.map(preset => (
          <button
            key={preset.id}
            onClick={() => addFromPreset(preset)}
            className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-muted hover:text-fg hover:border-hover hover:bg-hover transition-colors min-w-[64px]"
          >
            <WindowIcon type={preset.icon} size={26} />
            <span className="text-[10px] leading-tight text-center">{preset.name}</span>
          </button>
        ))}

        {/* Triangle isosceles */}
        <button
          onClick={addTriangle}
          className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-muted hover:text-fg hover:border-hover hover:bg-hover transition-colors min-w-[64px]"
        >
          <WindowIcon type="triangle" size={26} />
          <span className="text-[10px] leading-tight text-center">Triangel</span>
        </button>

        {/* Triangle right-angle */}
        <button
          onClick={addTriangleRight}
          className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-muted hover:text-fg hover:border-hover hover:bg-hover transition-colors min-w-[64px]"
        >
          <WindowIcon type="triangle-right" size={26} />
          <span className="text-[10px] leading-tight text-center">Triangel 90°</span>
        </button>

        {/* Custom */}
        <button
          onClick={addCustom}
          className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-border text-muted hover:text-fg hover:border-hover hover:bg-hover transition-colors min-w-[64px]"
        >
          <span className="text-lg leading-none font-light">+</span>
          <span className="text-[10px] leading-tight text-center">Anpassat</span>
        </button>
      </div>

      {/* Cards */}
      {deductions.length > 0 && (
        <div className="flex flex-col gap-2">
          {deductions.map(row => (
            <AvdragCard
              key={row.id}
              row={row}
              onChange={updated => updateRow(row.id, updated)}
              onRemove={() => removeRow(row.id)}
            />
          ))}
        </div>
      )}

      {deductions.length === 0 && (
        <p className="text-xs text-subtle italic">Inga avdrag — klicka på ett fönster- eller dörrtyp ovan för att lägga till</p>
      )}
    </div>
  )
}
