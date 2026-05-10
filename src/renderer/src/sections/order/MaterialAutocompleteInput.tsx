import { useState, useEffect, useRef } from 'react'
import type { MaterialKatalog } from '@/sections/installningar/types'
import { useAppConfig } from '@/context/AppConfig'

interface Props {
  value: string
  onChange: (text: string) => void
  onSelectMaterial: (material: MaterialKatalog) => void
  placeholder?: string
  className?: string
}

const DEBOUNCE_MS = 250
const MAX_RESULTS = 20

export function MaterialAutocompleteInput({ value, onChange, onSelectMaterial, placeholder, className }: Props) {
  const { formatCurrency } = useAppConfig()
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<MaterialKatalog[]>([])
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const blurTimer = useRef<number | null>(null)

  useEffect(() => {
    const term = value.trim()
    if (term.length < 2) { setResults([]); return }
    setLoading(true)
    const t = window.setTimeout(async () => {
      try {
        const data = await window.api.invoke('db:material-katalog:search', term) as MaterialKatalog[]
        setResults(data.slice(0, MAX_RESULTS))
        setHighlight(0)
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [value])

  function handleFocus() {
    if (blurTimer.current) { window.clearTimeout(blurTimer.current); blurTimer.current = null }
    setOpen(true)
  }

  function handleBlur() {
    blurTimer.current = window.setTimeout(() => setOpen(false), 150)
  }

  function pick(m: MaterialKatalog) {
    onSelectMaterial(m)
    setOpen(false)
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[highlight]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const showDropdown = open && (loading || results.length > 0)

  return (
    <div className="relative">
      <input
        type="text"
        className={className ?? 'input text-xs py-1 px-2 w-full'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKey}
        placeholder={placeholder}
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-72 overflow-auto bg-elevated border border-border rounded-md shadow-lg">
          {loading && results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted">Söker...</div>
          ) : (
            results.map((m, i) => (
              <button
                type="button"
                key={m.id}
                onMouseDown={(e) => { e.preventDefault(); pick(m) }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-3 ${i === highlight ? 'bg-hover' : ''}`}
              >
                <span className="flex-1 truncate text-fg">
                  {m.artikel_nummer && <span className="font-mono text-muted mr-2">{m.artikel_nummer}</span>}
                  {m.namn}
                </span>
                <span className="text-muted shrink-0">{m.enhet ?? 'st'}</span>
                <span className="font-mono text-fg shrink-0 w-24 text-right">{formatCurrency(m.a_pris)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
