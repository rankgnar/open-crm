import { useState, useMemo, useEffect } from 'react'
import { X, Search, Copy } from 'lucide-react'
import type { ProjektWithKund } from './types'
import type { Kund } from '@/sections/kunder/types'
import type { ForslagWithProjekt } from '@/sections/forslag/types'

interface Props {
  allKunder: Kund[]
  onClose: () => void
  onDuplicated: (newProjekt: ProjektWithKund) => void
}

export function DuplikatProjektModal({ allKunder, onClose, onDuplicated }: Props) {
  const [allForslag, setAllForslag] = useState<ForslagWithProjekt[]>([])
  const [kundSearch, setKundSearch] = useState('')
  const [forslagSearch, setForslagSearch] = useState('')
  const [selectedKundId, setSelectedKundId] = useState('')
  const [selectedForslag, setSelectedForslag] = useState<ForslagWithProjekt | null>(null)
  const [projektNamn, setProjektNamn] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.invoke('db:forslag:list').then((data) => setAllForslag(data as ForslagWithProjekt[]))
  }, [])

  const filteredKunder = useMemo(() => {
    const q = kundSearch.toLowerCase()
    return allKunder.filter(
      (k) => k.namn.toLowerCase().includes(q) || k.kundnummer.toLowerCase().includes(q)
    )
  }, [allKunder, kundSearch])

  const filteredForslag = useMemo(() => {
    const q = forslagSearch.toLowerCase()
    return allForslag.filter(
      (f) =>
        f.forslag_nummer.toLowerCase().includes(q) ||
        f.titel.toLowerCase().includes(q) ||
        f.projekt.namn.toLowerCase().includes(q) ||
        f.projekt.kunder.namn.toLowerCase().includes(q)
    )
  }, [allForslag, forslagSearch])

  function handleSelectForslag(f: ForslagWithProjekt) {
    setSelectedForslag(f)
    if (!projektNamn) setProjektNamn(f.projekt.namn)
  }

  async function handleConfirm() {
    if (!selectedKundId || !selectedForslag || !projektNamn.trim()) return
    setLoading(true)
    setError(null)
    try {
      const newP = await window.api.invoke('db:projekt:duplicate-from-forslag', {
        source_forslag_id: selectedForslag.id,
        target_kund_id: selectedKundId,
        projekt_namn: projektNamn.trim(),
      }) as ProjektWithKund
      onDuplicated(newP)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fel vid duplicering')
      setLoading(false)
    }
  }

  const selectedKund = allKunder.find((k) => k.id === selectedKundId)
  const canConfirm = !!selectedKundId && !!selectedForslag && !!projektNamn.trim() && !loading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-sidebar border border-border rounded-lg w-full max-w-xl flex flex-col shadow-xl" style={{ maxHeight: '85vh' }}>

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

        {/* Row 1: Kund */}
        <div className="flex flex-col border-b border-border" style={{ flex: '1 1 0', minHeight: 0 }}>
          <div className="px-5 pt-4 pb-2.5 shrink-0">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-2.5">
              1. Välj kund
              {selectedKund && <span className="ml-2 normal-case text-emerald-400">— {selectedKund.namn}</span>}
            </p>
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                autoFocus
                value={kundSearch}
                onChange={(e) => setKundSearch(e.target.value)}
                placeholder="Sök kund..."
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-bg border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 180 }}>
            {filteredKunder.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">Inga kunder hittades</p>
            ) : (
              filteredKunder.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setSelectedKundId(k.id)}
                  className={`w-full text-left px-5 py-2.5 border-b border-border last:border-b-0 transition-colors hover:bg-hover ${selectedKundId === k.id ? 'bg-hover' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-fg truncate">{k.namn}</p>
                    <p className="text-[11px] text-muted shrink-0">{k.kundnummer}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Row 2: Förslag */}
        <div className="flex flex-col border-b border-border" style={{ flex: '1 1 0', minHeight: 0 }}>
          <div className="px-5 pt-4 pb-2.5 shrink-0">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-2.5">
              2. Välj förslag att kopiera
              {selectedForslag && <span className="ml-2 normal-case text-emerald-400">— {selectedForslag.forslag_nummer} {selectedForslag.titel}</span>}
            </p>
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                value={forslagSearch}
                onChange={(e) => setForslagSearch(e.target.value)}
                placeholder="Sök förslag, titel eller projekt..."
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-bg border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 180 }}>
            {filteredForslag.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">Inga förslag hittades</p>
            ) : (
              filteredForslag.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleSelectForslag(f)}
                  className={`w-full text-left px-5 py-2.5 border-b border-border last:border-b-0 transition-colors hover:bg-hover ${selectedForslag?.id === f.id ? 'bg-hover' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-fg truncate">{f.forslag_nummer} — {f.titel}</p>
                      <p className="text-[11px] text-muted truncate mt-0.5">{f.projekt.kunder.namn} · {f.projekt.projekt_nummer} {f.projekt.namn}</p>
                    </div>
                    <span className="text-[10px] text-muted shrink-0">{f.status}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Footer: project name + actions */}
        <div className="px-5 py-4 shrink-0 space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted block mb-1.5">Namn på det nya projektet</label>
            <input
              value={projektNamn}
              onChange={(e) => setProjektNamn(e.target.value)}
              placeholder="Projektnamn..."
              className="w-full px-3 py-1.5 text-xs bg-bg border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-emerald-500"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="text-xs text-muted hover:text-fg transition-colors px-3 py-1.5">
              Avbryt
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/70 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Copy size={11} />
              {loading ? 'Duplicerar...' : 'Duplicera projekt'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
