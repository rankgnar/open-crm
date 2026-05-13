import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { ProjektWithKund } from '@/sections/projekt/types'
import type { KalkylatorInput, KalkylatorResult } from './types'

interface Props {
  input: KalkylatorInput
  result: KalkylatorResult
  projekt: ProjektWithKund[]
  onSkapa: (projektId: string, titel: string) => Promise<void>
  onClose: () => void
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function SkapaForslagModal({ input, result, projekt, onSkapa, onClose }: Props) {
  const [selectedProjektId, setSelectedProjektId] = useState(() => projekt[0]?.id ?? '')
  const [titel, setTitel] = useState('Fasadrenovering')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSkapa = async () => {
    if (!selectedProjektId) return
    setLoading(true)
    setError(null)
    try {
      await onSkapa(selectedProjektId, titel)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[420px] bg-sidebar border border-border rounded-lg shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-fg">Skapa Förslag från kalkyl</h3>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted">Projekt</label>
            <select
              value={selectedProjektId}
              onChange={e => setSelectedProjektId(e.target.value)}
              className="input text-sm"
            >
              {projekt.length === 0 && (
                <option value="">Laddar projekt…</option>
              )}
              {projekt.map(p => (
                <option key={p.id} value={p.id}>
                  {p.projekt_nummer} — {p.namn} ({p.kunder.namn})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted">Titel</label>
            <input
              type="text"
              value={titel}
              onChange={e => setTitel(e.target.value)}
              className="input text-sm"
            />
          </div>

          <div className="rounded border border-border bg-elevated px-4 py-3 flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between text-muted">
              <span>Nettoyta</span>
              <span>{result.netArea.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Materialrader</span>
              <span>{input.materials.length} st</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Arbetstimmar</span>
              <span>{round2(result.laborHours).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h</span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="text-sm text-muted hover:text-fg transition-colors px-3 py-1.5"
          >
            Avbryt
          </button>
          <button
            onClick={handleSkapa}
            disabled={loading || !selectedProjektId || !titel.trim()}
            className="flex items-center gap-2 text-sm px-4 py-1.5 rounded bg-elevated border border-border text-fg hover:bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Skapar…' : 'Skapa Förslag'}
          </button>
        </div>
      </div>
    </div>
  )
}
