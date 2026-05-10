import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  searchable?: boolean
  disabled?: boolean
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder = '—',
  className = '',
  searchable = false,
  disabled = false,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setQuery(''); return }
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find(o => o.value === value)
  const filtered = searchable && query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 bg-elevated border border-border rounded-lg px-3 py-2 text-sm outline-none hover:border-fg/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${selected ? 'text-fg' : 'text-subtle'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={12} className="text-muted shrink-0" />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-elevated border border-border rounded-lg shadow-xl flex flex-col overflow-hidden">
          {searchable && (
            <div className="px-3 py-2 border-b border-border">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Sök…"
                className="w-full bg-transparent text-xs text-fg outline-none placeholder:text-subtle"
              />
            </div>
          )}
          <div className="max-h-64 overflow-auto py-1">
            {filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-hover transition-colors ${o.value === value ? 'text-fg font-medium bg-hover/50' : 'text-muted'}`}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-subtle">Inga träffar</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
