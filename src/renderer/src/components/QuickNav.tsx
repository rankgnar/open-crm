import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, Settings, Wrench } from 'lucide-react'
import { NAV_SECTIONS } from '@/nav-sections'

const ALL_SECTIONS = [
  ...NAV_SECTIONS,
  { id: 'installningar', label: 'Inställningar', icon: Settings },
  { id: 'avancerat', label: 'Avancerat', icon: Wrench },
]

interface DropdownPos {
  top: number
  left: number
}

interface Props {
  onNavigate: (section: string) => void
}

export function QuickNav({ onNavigate }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(0)
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const results = query.trim()
    ? ALL_SECTIONS.filter(
        (s) =>
          s.label.toLowerCase().includes(query.toLowerCase()) ||
          s.id.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_SECTIONS

  const navigate = useCallback(
    (id: string) => {
      onNavigate(id)
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    },
    [onNavigate]
  )

  function handleFocus(): void {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left + rect.width / 2 })
    }
    setOpen(true)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      if (results[selected]) navigate(results[selected].id)
    } else if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const dropdown = open ? createPortal(
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)', zIndex: 9999, width: 224 }}
      className="bg-elevated border border-border rounded-lg shadow-lg py-1 max-h-72 overflow-y-auto"
    >
      {results.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-muted">Inga resultat</p>
      ) : (
        results.map((s, i) => (
          <button
            key={s.id}
            onMouseDown={() => navigate(s.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-left transition-colors ${
              i === selected ? 'bg-hover text-fg' : 'text-muted hover:bg-hover hover:text-fg'
            }`}
          >
            <s.icon size={13} className="shrink-0" />
            {s.label}
          </button>
        ))
      )}
    </div>,
    document.body
  ) : null

  return (
    <div ref={containerRef}>
      <div
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 bg-bg border transition-colors w-48 ${
          open ? 'border-border' : 'border-transparent hover:border-border'
        }`}
      >
        <Search size={11} className="shrink-0 text-subtle" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(0)
          }}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Sök... Ctrl+K"
          className="bg-transparent outline-none text-fg placeholder:text-subtle w-full text-[11px]"
        />
      </div>
      {dropdown}
    </div>
  )
}
