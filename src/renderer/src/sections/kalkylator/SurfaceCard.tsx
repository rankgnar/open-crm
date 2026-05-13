import { Copy, Trash2 } from 'lucide-react'
import type { SurfaceRow, TakType } from './types'
import { parseNum } from './kalkylator-utils'

interface Props {
  row: SurfaceRow
  takTyper: TakType[]
  onChange: (row: SurfaceRow) => void
  onDuplicate: () => void
  onRemove: () => void
}

function fmtArea(m2: number): string {
  return m2.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function computeAreaM2(row: SurfaceRow): number {
  const factor = row.shape === 'rectangle' ? 1 : 0.5
  return factor * row.width * row.height / 1_000_000 * row.slopeFactor
}

// SVG shape icons (inline, no external dep)
function RectIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <rect x="1" y="3" width="12" height="8" rx="1" />
    </svg>
  )
}
function TriangleIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinejoin="round">
      <polygon points="7,1 13,13 1,13" />
    </svg>
  )
}
function TriangleRightIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinejoin="round">
      <polygon points="1,13 13,13 1,1" />
      <path d="M1,9 L5,9 L5,13" strokeWidth={1} />
    </svg>
  )
}

export function SurfaceCard({ row, takTyper, onChange, onDuplicate, onRemove }: Props) {
  const areaM2 = computeAreaM2(row)
  const hasSlope = row.slopeFactor !== 1.0
  const baseAreaM2 = hasSlope
    ? (row.shape === 'rectangle' ? 1 : 0.5) * row.width * row.height / 1_000_000
    : null

  const baseDimLabel = row.shape === 'rectangle' ? 'Bredd' : 'Bas'

  return (
    <div className="group bg-elevated border border-border rounded-lg px-4 py-3 flex flex-col gap-2.5 hover:border-hover transition-colors">
      {/* Row 1 — shape toggle + description + area badge + actions */}
      <div className="flex items-center gap-3">
        {/* Shape toggle */}
        <div className="flex rounded border border-border overflow-hidden shrink-0">
          <button
            title="Rektangel"
            onClick={() => onChange({ ...row, shape: 'rectangle' })}
            className={[
              'px-2 py-1.5 transition-colors',
              row.shape === 'rectangle' ? 'bg-sidebar text-fg' : 'text-muted hover:text-fg',
            ].join(' ')}
          >
            <RectIcon active={row.shape === 'rectangle'} />
          </button>
          <button
            title="Triangel (liksidig)"
            onClick={() => onChange({ ...row, shape: 'triangle' })}
            className={[
              'px-2 py-1.5 border-l border-border transition-colors',
              row.shape === 'triangle' ? 'bg-sidebar text-fg' : 'text-muted hover:text-fg',
            ].join(' ')}
          >
            <TriangleIcon active={row.shape === 'triangle'} />
          </button>
          <button
            title="Rätvinklad triangel (90°)"
            onClick={() => onChange({ ...row, shape: 'triangle-right' })}
            className={[
              'px-2 py-1.5 border-l border-border transition-colors',
              row.shape === 'triangle-right' ? 'bg-sidebar text-fg' : 'text-muted hover:text-fg',
            ].join(' ')}
          >
            <TriangleRightIcon active={row.shape === 'triangle-right'} />
          </button>
        </div>

        {/* Description */}
        <input
          type="text"
          value={row.description}
          onChange={e => onChange({ ...row, description: e.target.value })}
          placeholder={row.shape === 'rectangle' ? 'Söderfasad' : 'Takgavel'}
          className="input flex-1 text-sm"
        />

        {/* Area badge */}
        <div className={[
          'shrink-0 flex flex-col items-end px-2.5 py-1 rounded text-xs font-medium tabular-nums',
          areaM2 > 0 ? 'bg-emerald-400/10 text-emerald-400' : 'bg-border text-muted',
        ].join(' ')}>
          <span>{fmtArea(areaM2)} m²</span>
          {baseAreaM2 !== null && (
            <span className="text-[10px] font-normal opacity-70 whitespace-nowrap">
              {fmtArea(baseAreaM2)} × {row.slopeFactor}
            </span>
          )}
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

      {/* Row 2 — dimensions in mm + slope */}
      <div className="flex items-center gap-3 pl-[84px] flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted shrink-0 w-8">{baseDimLabel}</label>
          <input
            type="number"
            min="0"
            step="1"
            value={row.width || ''}
            onChange={e => onChange({ ...row, width: parseNum(e.target.value) })}
            className="input w-24 text-sm text-right"
          />
          <span className="text-xs text-subtle shrink-0">mm</span>
        </div>

        <span className="text-muted text-sm shrink-0">×</span>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted shrink-0">Höjd</label>
          <input
            type="number"
            min="0"
            step="1"
            value={row.height || ''}
            onChange={e => onChange({ ...row, height: parseNum(e.target.value) })}
            className="input w-24 text-sm text-right"
          />
          <span className="text-xs text-subtle shrink-0">mm</span>
        </div>

        {/* Slope */}
        <div className="flex items-center gap-1.5 ml-auto">
          <label className="text-xs text-muted shrink-0">Lutning</label>
          <select
            value={row.slopeFactor}
            onChange={e => onChange({ ...row, slopeFactor: parseFloat(e.target.value) })}
            className={[
              'input text-xs py-1',
              hasSlope ? 'text-amber-400' : 'text-muted',
            ].join(' ')}
          >
            {takTyper.map(t => (
              <option key={t.id} value={t.slopeFactor}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
