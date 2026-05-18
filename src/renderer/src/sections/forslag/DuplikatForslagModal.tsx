import { useState, useMemo } from 'react'
import { X, Search, Copy } from 'lucide-react'
import type { ForslagWithProjekt } from './types'
import type { ProjektWithKund } from '@/sections/projekt/types'

interface Props {
  allForslag: ForslagWithProjekt[]
  allProjekt: ProjektWithKund[]
  defaultProjektId?: string
  onClose: () => void
  onDuplicated: (newForslag: ForslagWithProjekt) => void
}

export function DuplikatForslagModal({ allForslag, allProjekt, defaultProjektId, onClose, onDuplicated }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ForslagWithProjekt | null>(null)
  const [titel, setTitel] = useState('')
  const [targetProjektId, setTargetProjektId] = useState(defaultProjektId ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allForslag.filter(
      (f) =>
        f.forslag_nummer.toLowerCase().includes(q) ||
        f.titel.toLowerCase().includes(q) ||
        f.projekt.namn.toLowerCase().includes(q)
    )
  }, [allForslag, search])

  function handleSelect(f: ForslagWithProjekt) {
    setSelected(f)
    setTitel(`Kopia av ${f.titel}`)
  }

  async function handleConfirm() {
    if (!selected || !targetProjektId || !titel.trim()) return
    setLoading(true)
    setError(null)
    try {
      const newF = await window.api.invoke('db:forslag:duplicate', {
        source_id: selected.id,
        target_projekt_id: targetProjektId,
        titel: titel.trim(),
      }) as ForslagWithProjekt
      onDuplicated(newF)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fel vid duplicering')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-sidebar border border-border rounded-lg w-full max-w-xl flex flex-col max-h-[80vh] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Copy size={14} className="text-muted" />
            <span className="text-sm font-semibold text-fg">Duplicera förslag</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sök förslag, titel eller projekt..."
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-bg border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted text-center py-8">Inga förslag hittades</p>
          ) : (
            filtered.map((f) => (
              <button
                key={f.id}
                onClick={() => handleSelect(f)}
                className={`w-full text-left px-5 py-3 border-b border-border last:border-b-0 transition-colors hover:bg-hover ${selected?.id === f.id ? 'bg-hover' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-fg truncate">{f.forslag_nummer} — {f.titel}</p>
                    <p className="text-[11px] text-muted truncate mt-0.5">{f.projekt.projekt_nummer} {f.projekt.namn}</p>
                  </div>
                  <span className="text-[10px] text-muted shrink-0">{f.status}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Config */}
        <div className="px-5 py-4 border-t border-border space-y-3 shrink-0">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted block mb-1.5">Titel på kopian</label>
            <input
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Välj ett förslag ovan..."
              disabled={!selected}
              className="w-full px-3 py-1.5 text-xs bg-bg border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-emerald-500 disabled:opacity-40"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted block mb-1.5">Målprojekt</label>
            <select
              value={targetProjektId}
              onChange={(e) => setTargetProjektId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-bg border border-border rounded text-fg focus:outline-none focus:border-emerald-500"
            >
              <option value="">Välj projekt...</option>
              {allProjekt.map((p) => (
                <option key={p.id} value={p.id}>{p.projekt_nummer} {p.namn}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <button onClick={onClose} className="text-xs text-muted hover:text-fg transition-colors px-3 py-1.5">
            Avbryt
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || !targetProjektId || !titel.trim() || loading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/70 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Copy size={11} />
            {loading ? 'Duplicerar...' : 'Duplicera'}
          </button>
        </div>
      </div>
    </div>
  )
}
