import { Trash2, Copy } from 'lucide-react'
import type { MaterialLine } from './types'
import { parseNum } from './kalkylator-utils'

interface Props {
  row: MaterialLine
  netArea: number
  onChange: (row: MaterialLine) => void
  onDuplicate: () => void
  onRemove: () => void
}

export function MaterialCard({ row, netArea, onChange, onDuplicate, onRemove }: Props) {
  const qty = netArea * row.coveragePerM2
  const total = qty * row.unitPrice

  const fmtQty = (n: number) =>
    n.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <div className="group bg-elevated border border-border rounded-lg px-4 py-3 flex items-center gap-3 hover:border-hover transition-colors">
      {/* Name */}
      <input
        type="text"
        value={row.name}
        onChange={e => onChange({ ...row, name: e.target.value })}
        placeholder="Materialnamn"
        className="input text-sm flex-1 min-w-0"
      />

      {/* Coverage */}
      <input
        type="number"
        min="0"
        step="0.01"
        value={row.coveragePerM2 || ''}
        onChange={e => onChange({ ...row, coveragePerM2: parseNum(e.target.value) })}
        className="input w-20 text-sm text-right shrink-0"
        title="Åtgång per m²"
      />

      {/* Unit selector + unit/m² label */}
      <div className="flex items-center gap-1 shrink-0">
        <select
          value={row.unit}
          onChange={e => onChange({ ...row, unit: e.target.value })}
          className="input text-sm w-16"
        >
          <option value="m²">m²</option>
          <option value="lm">lm</option>
          <option value="m">m</option>
          <option value="st">st</option>
        </select>
        <span className="text-xs text-subtle whitespace-nowrap">/m²</span>
      </div>

      {/* Computed quantity badge */}
      <div className="shrink-0 flex items-center gap-1">
        <span className="text-xs text-subtle">→</span>
        <div className={[
          'px-2 py-0.5 rounded text-xs font-medium tabular-nums whitespace-nowrap',
          qty > 0 ? 'bg-emerald-400/10 text-emerald-400' : 'bg-border text-muted',
        ].join(' ')}>
          {fmtQty(qty)} {row.unit}
        </div>
      </div>

      <span className="text-xs text-subtle shrink-0">×</span>

      {/* Unit price */}
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          min="0"
          step="0.01"
          value={row.unitPrice || ''}
          onChange={e => onChange({ ...row, unitPrice: parseNum(e.target.value) })}
          placeholder="0"
          className="input w-24 text-sm text-right"
        />
        <span className="text-xs text-subtle shrink-0">kr/{row.unit}</span>
      </div>

      {/* Total */}
      <div className="ml-auto shrink-0 text-sm font-medium tabular-nums text-fg whitespace-nowrap">
        {total.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDuplicate}
          title="Duplicera"
          className="p-1.5 rounded text-muted hover:text-fg hover:bg-hover transition-colors"
        >
          <Copy size={13} />
        </button>
        <button
          onClick={onRemove}
          title="Ta bort"
          className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
