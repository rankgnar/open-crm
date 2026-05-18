import { useState, useMemo } from 'react'
import { Tags, X as XIcon, Loader2 } from 'lucide-react'
import type { ForslagArbete, BulkTimprisEntry } from './types'
import type { ArbetsRoll } from '@/sections/installningar/types'

interface Props {
  forslagId: string
  arbete: ForslagArbete[]
  arbetsRoller: ArbetsRoll[]
  onClose: () => void
  onApplied: () => void
}

export function BulkTimprisModal({ forslagId, arbete, arbetsRoller, onClose, onApplied }: Props) {
  const entries = useMemo<BulkTimprisEntry[]>(() => {
    const roleMap = new Map<string, number[]>()
    for (const row of arbete) {
      const key = row.yrkesroll ?? ''
      if (!roleMap.has(key)) roleMap.set(key, [])
      roleMap.get(key)!.push(row.timpris)
    }
    return Array.from(roleMap.entries()).map(([yrkesroll, prices]) => {
      const catalog = arbetsRoller.find((r) => r.namn === yrkesroll)
      return {
        yrkesroll,
        forslagTimpris: prices[0] ?? 0,
        katalogTimpris: catalog?.timpris ?? null,
      }
    })
  }, [arbete, arbetsRoller])

  const [drafts, setDrafts] = useState<Record<string, number>>(
    () => Object.fromEntries(entries.map((e) => [e.yrkesroll, e.forslagTimpris]))
  )
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function syncFromCatalog(yrkesroll: string, katalogTimpris: number) {
    setDrafts((prev) => ({ ...prev, [yrkesroll]: katalogTimpris }))
  }

  async function handleApply() {
    setApplying(true)
    setError(null)
    try {
      const updates = entries
        .filter((e) => drafts[e.yrkesroll] !== e.forslagTimpris)
        .map((e) => ({ yrkesroll: e.yrkesroll, timpris: drafts[e.yrkesroll] ?? e.forslagTimpris }))

      if (updates.length === 0) { onClose(); return }

      await window.api.invoke('db:forslag-arbete:bulk-update-timpris', forslagId, updates)
      onApplied()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fel vid uppdatering')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-bg border border-border rounded-xl shadow-2xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-sidebar rounded-t-xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg">
            <Tags size={13} />
            Uppdatera timpriser
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <XIcon size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-xs text-muted mb-4">
            Ändra timpriset per yrkesroll — alla rader i detta förslag med samma roll uppdateras på en gång.
          </p>

          {entries.length === 0 ? (
            <p className="text-sm text-subtle italic py-4 text-center">Inga arbetskostnadsrader i detta förslag.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted border-b border-border">
                  <th className="text-left pb-2 font-medium">Yrkesroll</th>
                  <th className="text-right pb-2 font-medium">Nuv. pris</th>
                  <th className="text-right pb-2 font-medium text-blue-400">Katalog</th>
                  <th className="text-right pb-2 font-medium pr-1">Nytt pris</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.yrkesroll} className="border-b border-border last:border-0">
                    <td className="py-2 text-fg">{entry.yrkesroll || <span className="text-subtle italic">Ingen roll</span>}</td>
                    <td className="py-2 text-right text-muted font-mono tabular-nums">{entry.forslagTimpris} kr</td>
                    <td className="py-2 text-right text-blue-400 font-mono tabular-nums">
                      {entry.katalogTimpris != null ? `${entry.katalogTimpris} kr` : '—'}
                    </td>
                    <td className="py-1 pl-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={drafts[entry.yrkesroll] ?? entry.forslagTimpris}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [entry.yrkesroll]: Number(e.target.value) }))
                        }
                        className="input text-xs py-0.5 px-1.5 text-right w-24 font-mono"
                      />
                    </td>
                    <td className="py-1 pl-1">
                      {entry.katalogTimpris != null && (
                        <button
                          onClick={() => syncFromCatalog(entry.yrkesroll, entry.katalogTimpris!)}
                          className="text-[10px] text-muted hover:text-blue-400 px-1.5 transition-colors whitespace-nowrap"
                        >
                          Från katalog
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-sidebar rounded-b-xl">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-muted hover:text-fg transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleApply}
            disabled={applying || entries.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-bg hover:bg-emerald-300 transition-colors disabled:opacity-40"
          >
            {applying && <Loader2 size={11} className="animate-spin" />}
            Tillämpa
          </button>
        </div>
      </div>
    </div>
  )
}
