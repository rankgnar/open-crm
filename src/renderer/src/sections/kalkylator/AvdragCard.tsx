import { Trash2 } from 'lucide-react'
import type { DeductionRow } from './types'
import { WindowIcon } from './WindowIcons'
import { parseNum } from './kalkylator-utils'

interface Props {
  row: DeductionRow
  onChange: (row: DeductionRow) => void
  onRemove: () => void
}

function fmtArea(m2: number): string {
  return m2.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function AvdragCard({ row, onChange, onRemove }: Props) {
  const factor = row.shape === 'rectangle' ? 1 : 0.5
  const baseArea = factor * row.width * row.height / 1_000_000
  const totalArea = baseArea * row.quantity

  return (
    <div className="group bg-elevated border border-border rounded-lg px-4 py-3 flex items-center gap-3 hover:border-hover transition-colors">
      {/* Icon */}
      <div className="shrink-0 text-muted w-8 flex items-center justify-center">
        <WindowIcon type={row.icon} size={26} />
      </div>

      {/* Description */}
      <input
        type="text"
        value={row.description}
        onChange={e => onChange({ ...row, description: e.target.value })}
        placeholder="Beskrivning"
        className="input w-28 text-sm shrink-0"
      />

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-subtle">B</span>
        <input
          type="number"
          min="0"
          step="1"
          value={row.width || ''}
          onChange={e => onChange({ ...row, width: parseNum(e.target.value) })}
          className="input w-20 text-sm text-right"
        />
        <span className="text-xs text-subtle">mm</span>
      </div>

      <span className="text-muted text-xs shrink-0">×</span>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-subtle">H</span>
        <input
          type="number"
          min="0"
          step="1"
          value={row.height || ''}
          onChange={e => onChange({ ...row, height: parseNum(e.target.value) })}
          className="input w-20 text-sm text-right"
        />
        <span className="text-xs text-subtle">mm</span>
      </div>

      {/* Quantity control */}
      <div className="flex items-center gap-1 shrink-0 ml-1">
        <button
          onClick={() => onChange({ ...row, quantity: Math.max(1, row.quantity - 1) })}
          className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted hover:text-fg hover:bg-hover transition-colors text-sm"
        >
          −
        </button>
        <span className="text-sm text-fg font-medium w-5 text-center tabular-nums">{row.quantity}</span>
        <button
          onClick={() => onChange({ ...row, quantity: row.quantity + 1 })}
          className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted hover:text-fg hover:bg-hover transition-colors text-sm"
        >
          +
        </button>
        <span className="text-xs text-subtle ml-0.5">st</span>
      </div>

      {/* Area */}
      <div className="ml-auto shrink-0 text-xs font-medium tabular-nums text-red-400 whitespace-nowrap">
        − {fmtArea(totalArea)} m²
      </div>

      <button
        onClick={onRemove}
        className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded text-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
