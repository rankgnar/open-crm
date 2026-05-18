import { useState, useMemo, useEffect } from 'react'
import { X, Search, Copy, Check, Loader2 } from 'lucide-react'
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
      <div className="bg-sidebar border border-border rounded-lg w-full max-w-xl flex flex-col shadow-xl overflow-hidden" style={{ maxHeight: '90vh' }}>

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

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 min-h-0 relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-sidebar/80 backdrop-blur-sm">
              <Loader2 size={22} className="text-emerald-400 animate-spin" />
              <p className="text-xs text-muted">Duplicerar projekt och förslag...</p>
            </div>
          )}

          {/* Section 1: Kund */}
          <div className="border-b border-border">
            <div className="px-5 pt-4 pb-3">
              <p className="text-[11px] uppercase tracking-widest text-muted mb-3">
                1. Välj kund
                {selectedKund && (
                  <span className="ml-2 normal-case tracking-normal text-emerald-400 font-normal">
                    — {selectedKund.namn}
                  </span>
                )}
              </p>
              <div className="relative mb-2">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  autoFocus
                  value={kundSearch}
                  onChange={(e) => setKundSearch(e.target.value)}
                  placeholder="Sök kund..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-bg border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="rounded border border-border overflow-hidden" style={{ maxHeight: 160, overflowY: 'auto' }}>
                {filteredKunder.length === 0 ? (
                  <p className="text-xs text-muted text-center py-5">Inga kunder hittades</p>
                ) : (
                  filteredKunder.map((k) => (
                    <button
                      key={k.id}
                      onClick={() => setSelectedKundId(k.id)}
                      className={`w-full text-left px-3 py-2 border-b border-border last:border-b-0 transition-colors hover:bg-hover flex items-center justify-between gap-3 ${selectedKundId === k.id ? 'bg-hover' : ''}`}
                    >
                      <p className="text-xs font-medium text-fg truncate">{k.namn}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-[11px] text-muted">{k.kundnummer}</p>
                        {selectedKundId === k.id && <Check size={11} className="text-emerald-400" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Förslag */}
          <div className="border-b border-border">
            <div className="px-5 pt-4 pb-3">
              <p className="text-[11px] uppercase tracking-widest text-muted mb-3">
                2. Välj förslag att kopiera
                {selectedForslag && (
                  <span className="ml-2 normal-case tracking-normal text-emerald-400 font-normal">
                    — {selectedForslag.forslag_nummer} {selectedForslag.titel}
                  </span>
                )}
              </p>
              <div className="relative mb-2">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  value={forslagSearch}
                  onChange={(e) => setForslagSearch(e.target.value)}
                  placeholder="Sök förslag, titel eller projekt..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-bg border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="rounded border border-border overflow-hidden" style={{ maxHeight: 160, overflowY: 'auto' }}>
                {allForslag.length === 0 ? (
                  <p className="text-xs text-muted text-center py-5">Laddar förslag...</p>
                ) : filteredForslag.length === 0 ? (
                  <p className="text-xs text-muted text-center py-5">Inga förslag hittades</p>
                ) : (
                  filteredForslag.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleSelectForslag(f)}
                      className={`w-full text-left px-3 py-2.5 border-b border-border last:border-b-0 transition-colors hover:bg-hover ${selectedForslag?.id === f.id ? 'bg-hover' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-fg truncate">{f.forslag_nummer} — {f.titel}</p>
                          <p className="text-[11px] text-muted truncate mt-0.5">{f.projekt.kunder.namn} · {f.projekt.projekt_nummer} {f.projekt.namn}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted">{f.status}</span>
                          {selectedForslag?.id === f.id && <Check size={11} className="text-emerald-400" />}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Project name */}
          <div className="px-5 py-4">
            <label className="text-[11px] uppercase tracking-widest text-muted block mb-2">Namn på det nya projektet</label>
            <input
              value={projektNamn}
              onChange={(e) => setProjektNamn(e.target.value)}
              placeholder="Projektnamn..."
              className="w-full px-3 py-1.5 text-xs bg-bg border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-emerald-500"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
          <div>{error && <p className="text-xs text-red-400">{error}</p>}</div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-xs text-muted hover:text-fg transition-colors px-3 py-1.5">
              Avbryt
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/70 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={11} className="animate-spin" /> : <Copy size={11} />}
              {loading ? 'Duplicerar...' : 'Duplicera projekt'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
