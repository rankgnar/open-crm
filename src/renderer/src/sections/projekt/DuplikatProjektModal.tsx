import { useState, useMemo } from 'react'
import { X, Search, Copy } from 'lucide-react'
import type { ProjektWithKund } from './types'
import type { Kund } from '@/sections/kunder/types'

interface Props {
  allProjekt: ProjektWithKund[]
  allKunder: Kund[]
  onClose: () => void
  onDuplicated: (newProjekt: ProjektWithKund) => void
}

export function DuplikatProjektModal({ allProjekt, allKunder, onClose, onDuplicated }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ProjektWithKund | null>(null)
  const [namn, setNamn] = useState('')
  const [targetKundId, setTargetKundId] = useState('')
  const [kundSearch, setKundSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredProjekt = useMemo(() => {
    const q = search.toLowerCase()
    return allProjekt.filter(
      (p) =>
        p.projekt_nummer.toLowerCase().includes(q) ||
        p.namn.toLowerCase().includes(q) ||
        p.kunder.namn.toLowerCase().includes(q)
    )
  }, [allProjekt, search])

  const filteredKunder = useMemo(() => {
    const q = kundSearch.toLowerCase()
    return allKunder.filter(
      (k) => k.namn.toLowerCase().includes(q) || k.kundnummer.toLowerCase().includes(q)
    )
  }, [allKunder, kundSearch])

  function handleSelect(p: ProjektWithKund) {
    setSelected(p)
    setNamn(p.namn)
  }

  async function handleConfirm() {
    if (!selected || !targetKundId || !namn.trim()) return
    setLoading(true)
    setError(null)
    try {
      const newP = await window.api.invoke('db:projekt:duplicate', {
        source_projekt_id: selected.id,
        target_kund_id: targetKundId,
        namn: namn.trim(),
      }) as ProjektWithKund
      onDuplicated(newP)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fel vid duplicering')
      setLoading(false)
    }
  }

  const selectedKund = allKunder.find((k) => k.id === targetKundId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-sidebar border border-border rounded-lg w-full max-w-2xl flex flex-col max-h-[85vh] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Copy size={14} className="text-muted" />
            <span className="text-sm font-semibold text-fg">Duplicera projekt</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 divide-x divide-border">
          {/* Left: projekt source */}
          <div className="flex flex-col w-1/2 min-h-0">
            <div className="px-4 py-2.5 border-b border-border shrink-0">
              <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Välj källprojekt</p>
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Sök projekt..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-bg border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {filteredProjekt.length === 0 ? (
                <p className="text-xs text-muted text-center py-8">Inga projekt hittades</p>
              ) : (
                filteredProjekt.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className={`w-full text-left px-4 py-2.5 border-b border-border last:border-b-0 transition-colors hover:bg-hover ${selected?.id === p.id ? 'bg-hover' : ''}`}
                  >
                    <p className="text-xs font-medium text-fg truncate">{p.projekt_nummer} — {p.namn}</p>
                    <p className="text-[11px] text-muted truncate mt-0.5">{p.kunder.namn}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: config */}
          <div className="flex flex-col w-1/2 min-h-0">
            <div className="px-4 py-2.5 border-b border-border shrink-0">
              <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Välj målkund</p>
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  value={kundSearch}
                  onChange={(e) => setKundSearch(e.target.value)}
                  placeholder="Sök kund..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-bg border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {filteredKunder.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setTargetKundId(k.id)}
                  className={`w-full text-left px-4 py-2.5 border-b border-border last:border-b-0 transition-colors hover:bg-hover ${targetKundId === k.id ? 'bg-hover' : ''}`}
                >
                  <p className="text-xs font-medium text-fg truncate">{k.namn}</p>
                  <p className="text-[11px] text-muted">{k.kundnummer}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Config footer */}
        <div className="px-5 py-4 border-t border-border space-y-3 shrink-0">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted block mb-1.5">Namn på det nya projektet</label>
            <input
              value={namn}
              onChange={(e) => setNamn(e.target.value)}
              placeholder={selected ? 'Namn på projektet...' : 'Välj källprojekt först...'}
              disabled={!selected}
              className="w-full px-3 py-1.5 text-xs bg-bg border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-emerald-500 disabled:opacity-40"
            />
          </div>
          {selected && targetKundId && (
            <p className="text-[11px] text-muted">
              Kopierar <span className="text-fg">{selected.projekt_nummer} {selected.namn}</span> med alla förslag till <span className="text-fg">{selectedKund?.namn}</span>
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <button onClick={onClose} className="text-xs text-muted hover:text-fg transition-colors px-3 py-1.5">
            Avbryt
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || !targetKundId || !namn.trim() || loading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/70 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Copy size={11} />
            {loading ? 'Duplicerar...' : 'Duplicera projekt'}
          </button>
        </div>
      </div>
    </div>
  )
}
