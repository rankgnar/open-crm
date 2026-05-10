import { useState, useRef } from 'react'
import type { OrderStatus } from './types'
import { STATUS_FARG } from './types'

const EDITABLE_STATUSAR: OrderStatus[] = ['Utkast', 'Skickad', 'Avvisad']

interface Props {
  status: OrderStatus
  onChange: (next: OrderStatus) => Promise<void> | void
  /** When true, click on Godkänd chip triggers onRequestUnlock instead of opening dropdown */
  onRequestUnlock?: () => void
}

export function OrderStatusPicker({ status, onChange, onRequestUnlock }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const farg = STATUS_FARG[status]

  function handleSelect(e: React.MouseEvent, next: OrderStatus) {
    e.stopPropagation()
    setOpen(false)
    if (next !== status) void onChange(next)
  }

  if (status === 'Godkänd') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onRequestUnlock?.() }}
        disabled={!onRequestUnlock}
        className="inline-flex items-center gap-1.5 text-xs rounded px-1.5 py-0.5 hover:bg-hover transition-colors disabled:hover:bg-transparent disabled:cursor-default"
        title={onRequestUnlock ? 'Klicka för att ändra status (signaturen tas bort)' : undefined}
      >
        <span className={`size-1.5 rounded-full ${farg.dot}`} />
        <span className={farg.text}>Godkänd</span>
      </button>
    )
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false) }}
        className="inline-flex items-center gap-1.5 text-xs rounded px-1.5 py-0.5 hover:bg-hover transition-colors"
      >
        <span className={`size-1.5 rounded-full ${farg.dot}`} />
        <span className={farg.text}>{status}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[130px] bg-elevated border border-border rounded-lg shadow-lg py-1 flex flex-col">
          {EDITABLE_STATUSAR.map((s) => {
            const f = STATUS_FARG[s]
            return (
              <button
                key={s}
                onMouseDown={(e) => handleSelect(e, s)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-hover transition-colors text-left ${s === status ? 'opacity-40 cursor-default' : ''}`}
              >
                <span className={`size-1.5 rounded-full ${f.dot}`} />
                <span className={f.text}>{s}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
