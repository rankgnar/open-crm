import { useState, useEffect } from 'react'
import { X, Plus, Trash2, ChevronRight } from 'lucide-react'
import type { FaktureringSnapshot } from './types'
import type { ForslagWithProjekt } from '@/sections/forslag/types'
import type { Kund } from '@/sections/kunder/types'
import { useAppConfig } from '@/context/AppConfig'
import { SelectField } from '@/components/SelectField'

interface Etapp {
  pct: number
  beskrivning: string
  forfall_date: string
}

interface Totals {
  totalNetto: number
  totalArbete: number
  rotEligible: number
  totalMaterial: number
  totalUE: number
}

interface Props {
  onDone: (snapshot: FaktureringSnapshot) => void
  onCancel: () => void
}

const DEFAULT_ETAPPER: Etapp[] = [
  { pct: 30, beskrivning: 'Vid start', forfall_date: '' },
  { pct: 40, beskrivning: 'Vid halvtid', forfall_date: '' },
  { pct: 30, beskrivning: 'Vid slutfört arbete', forfall_date: '' },
]

function round2(n: number) { return Math.round(n * 100) / 100 }

export function FaktureringWizard({ onDone, onCancel }: Props) {
  const { formatCurrency } = useAppConfig()

  // Step 1 state
  const [kunder, setKunder] = useState<Kund[]>([])
  const [forslag, setForslag] = useState<ForslagWithProjekt[]>([])
  const [selectedKundId, setSelectedKundId] = useState('')
  const [selectedForslagId, setSelectedForslagId] = useState('')
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loadingTotals, setLoadingTotals] = useState(false)

  // Step 2 state
  const [etapper, setEtapper] = useState<Etapp[]>(DEFAULT_ETAPPER)

  // Global state
  const [step, setStep] = useState<1 | 2>(1)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      window.api.invoke('db:kunder:list') as Promise<Kund[]>,
      window.api.invoke('db:forslag:list') as Promise<ForslagWithProjekt[]>,
    ]).then(([k, f]) => {
      setKunder(k)
      setForslag(f)
    })
  }, [])

  const selectedKund = kunder.find((k) => k.id === selectedKundId)
  const filteredForslag = selectedKund
    ? forslag.filter((f) => f.projekt.kunder.namn === selectedKund.namn)
    : forslag

  useEffect(() => {
    if (!selectedForslagId) { setTotals(null); return }
    setLoadingTotals(true)
    window.api.invoke('db:forslag:get-totals', selectedForslagId)
      .then((t) => setTotals(t as Totals))
      .finally(() => setLoadingTotals(false))
  }, [selectedForslagId])

  function updateEtapp(i: number, patch: Partial<Etapp>) {
    setEtapper((prev) => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e))
  }

  function removeEtapp(i: number) {
    setEtapper((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addEtapp() {
    setEtapper((prev) => [...prev, { pct: 0, beskrivning: '', forfall_date: '' }])
  }

  const totalPct = etapper.reduce((s, e) => s + (e.pct || 0), 0)
  const pctOk = totalPct === 100

  async function handleCreate() {
    if (!selectedForslagId || !pctOk) return
    setCreating(true)
    setError('')
    try {
      const snapshot = await window.api.invoke('db:fakturering:generate', selectedForslagId, etapper) as FaktureringSnapshot
      onDone(snapshot)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setCreating(false)
    }
  }

  const selectedForslag = forslag.find((f) => f.id === selectedForslagId)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-muted text-sm">Fakturering</span>
          <span className="text-subtle">/</span>
          <span className="text-fg text-sm font-medium">Ny plan</span>
          {step === 2 && (
            <>
              <ChevronRight size={14} className="text-subtle" />
              <span className="text-fg text-sm font-medium">Betalningsplan</span>
            </>
          )}
        </div>
        <button onClick={onCancel} className="text-muted hover:text-fg transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Step 1 — Välj offert */}
      {step === 1 && (
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 border-r border-border px-8 py-6 flex flex-col gap-5">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted mb-3">Välj offert</p>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted">Kund</label>
                  <SelectField
                    value={selectedKundId}
                    onChange={(v) => { setSelectedKundId(v); setSelectedForslagId('') }}
                    placeholder="Alla kunder"
                    options={kunder.map((k) => ({ value: k.id, label: k.namn }))}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted">Förslag / Offert</label>
                  <SelectField
                    value={selectedForslagId}
                    onChange={setSelectedForslagId}
                    placeholder="Välj förslag..."
                    searchable
                    options={filteredForslag.map((f) => ({ value: f.id, label: `${f.forslag_nummer} — ${f.titel} (${f.projekt?.kunder?.namn ?? '—'})` }))}
                  />
                </div>
              </div>
            </div>

            {selectedForslag && (
              <div className="mt-2">
                <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Detaljer</p>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Projekt</span>
                    <span className="text-fg">{selectedForslag.projekt?.namn ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Status</span>
                    <span className="text-fg">{selectedForslag.status}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: totals */}
          <div className="flex-1 px-8 py-6 flex flex-col gap-4">
            {!selectedForslagId ? (
              <p className="text-sm text-subtle mt-8 text-center">Välj ett förslag för att se totaler</p>
            ) : loadingTotals ? (
              <p className="text-sm text-muted mt-8 text-center">Beräknar...</p>
            ) : totals ? (
              <>
                <p className="text-[11px] uppercase tracking-widest text-muted">Förslag totaler</p>
                <div className="flex flex-col gap-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Arbete</span>
                    <span className="font-mono text-fg">{formatCurrency(totals.totalArbete)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Material</span>
                    <span className="font-mono text-fg">{formatCurrency(totals.totalMaterial)}</span>
                  </div>
                  {totals.totalUE > 0 && (
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted">Underentreprenörer</span>
                      <span className="font-mono text-fg">{formatCurrency(totals.totalUE)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5 border-b border-border font-semibold">
                    <span className="text-fg">Totalt netto</span>
                    <span className="font-mono text-fg">{formatCurrency(totals.totalNetto)}</span>
                  </div>
                  {totals.rotEligible > 0 && (
                    <div className="flex justify-between py-1 text-emerald-400">
                      <span>ROT-berättigat arbete</span>
                      <span className="font-mono">{formatCurrency(totals.rotEligible)}</span>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Step 2 — Betalningsplan */}
      {step === 2 && totals && (
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] uppercase tracking-widest text-muted">Betalningsplan</p>
            <div className={`text-xs font-mono font-medium px-2 py-0.5 rounded ${pctOk ? 'text-emerald-400 bg-emerald-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
              {totalPct}% av 100%
            </div>
          </div>

          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-2 text-[10px] uppercase tracking-wider text-muted font-medium w-20">%</th>
                <th className="text-left pb-2 text-[10px] uppercase tracking-wider text-muted font-medium">Beskrivning</th>
                <th className="text-left pb-2 text-[10px] uppercase tracking-wider text-muted font-medium w-36">Förfallodatum</th>
                <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-muted font-medium w-28">Netto</th>
                {totals.rotEligible > 0 && (
                  <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-muted font-medium w-28">ROT-avdrag</th>
                )}
                <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-muted font-medium w-28">Att betala</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {etapper.map((e, i) => {
                const pct = (e.pct || 0) / 100
                const netto = round2(totals.totalNetto * pct)
                // ROT = 30% of arbete-eligible INKL moms (Skatteverket-konvention),
                // applied as a tax credit AFTER the full moms is calculated.
                const rot = round2(Math.min(totals.rotEligible * pct * 1.25 * 0.3, 50000))
                const attBetala = round2(netto * 1.25 - rot)
                return (
                  <tr key={i} className="border-b border-border/50 group">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0" max="100" step="1"
                          className="input text-xs py-1 px-2 w-16 text-right font-mono"
                          value={e.pct}
                          onChange={(ev) => updateEtapp(i, { pct: parseFloat(ev.target.value) || 0 })}
                        />
                        <span className="text-muted">%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        className="input text-xs py-1 px-2 w-full"
                        placeholder="t.ex. Vid start"
                        value={e.beskrivning}
                        onChange={(ev) => updateEtapp(i, { beskrivning: ev.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="date"
                        className="input text-xs py-1 px-2 w-full"
                        value={e.forfall_date}
                        onChange={(ev) => updateEtapp(i, { forfall_date: ev.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-fg">{formatCurrency(netto)}</td>
                    {totals.rotEligible > 0 && (
                      <td className="py-2 pr-3 text-right font-mono text-emerald-400">−{formatCurrency(rot)}</td>
                    )}
                    <td className="py-2 pr-3 text-right font-mono text-fg font-semibold">{formatCurrency(attBetala)}</td>
                    <td className="py-2">
                      <button
                        onClick={() => removeEtapp(i)}
                        className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <button onClick={addEtapp} className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors mb-6">
            <Plus size={12} />Lägg till etapp
          </button>

          {!pctOk && (
            <p className="text-xs text-amber-400 mb-3">Procenten måste summera till exakt 100% ({totalPct}% nu).</p>
          )}
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

          {/* ── Desglose completo ─────────────────────────────────────────── */}
          <div className="border-t border-border pt-6 flex flex-col gap-6">

            {/* Förslag base data */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted font-medium mb-3">Underlag från förslaget</p>
              <div className="grid grid-cols-2 gap-x-16 gap-y-1.5 text-xs max-w-lg">
                <span className="text-muted">Arbete (totalt)</span>
                <span className="font-mono text-fg text-right">{formatCurrency(totals.totalArbete)}</span>
                {totals.rotEligible > 0 && <>
                  <span className="text-subtle pl-3">varav ROT-berättigat</span>
                  <span className="font-mono text-emerald-400 text-right">{formatCurrency(totals.rotEligible)}</span>
                  <span className="text-subtle pl-3">varav ej ROT</span>
                  <span className="font-mono text-muted text-right">{formatCurrency(totals.totalArbete - totals.rotEligible)}</span>
                </>}
                <span className="text-muted">Material</span>
                <span className="font-mono text-fg text-right">{formatCurrency(totals.totalMaterial)}</span>
                {totals.totalUE > 0 && <>
                  <span className="text-muted">Underentreprenörer</span>
                  <span className="font-mono text-fg text-right">{formatCurrency(totals.totalUE)}</span>
                </>}
                <span className="text-fg font-semibold border-t border-border pt-1.5 mt-0.5">Totalt netto</span>
                <span className="font-mono text-fg font-semibold text-right border-t border-border pt-1.5 mt-0.5">{formatCurrency(totals.totalNetto)}</span>
              </div>
            </div>

            {/* ROT-beräkning */}
            {totals.rotEligible > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-medium mb-3">ROT-avdrag — beräkningsgrund</p>
                <div className="grid grid-cols-2 gap-x-16 gap-y-1.5 text-xs max-w-lg">
                  <span className="text-muted">ROT-berättigat underlag</span>
                  <span className="font-mono text-fg text-right">{formatCurrency(totals.rotEligible)}</span>
                  <span className="text-muted">ROT-procent</span>
                  <span className="font-mono text-fg text-right">30 %</span>
                  <span className="text-muted">Max ROT-avdrag (tak)</span>
                  <span className="font-mono text-fg text-right">{formatCurrency(50000)}</span>
                  <span className="text-emerald-400 font-semibold border-t border-border pt-1.5 mt-0.5">Totalt ROT-avdrag</span>
                  <span className="font-mono text-emerald-400 font-semibold text-right border-t border-border pt-1.5 mt-0.5">
                    −{formatCurrency(Math.min(totals.rotEligible * 1.25 * 0.3, 50000))}
                  </span>
                </div>
              </div>
            )}

            {/* Per-faktura tabell */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted font-medium mb-3">Beräkning per faktura</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 text-[10px] uppercase tracking-wider text-muted font-medium">Etapp</th>
                    <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-muted font-medium w-12">%</th>
                    <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-muted font-medium w-28">Netto</th>
                    {totals.rotEligible > 0 && <>
                      <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-muted font-medium w-28">ROT-arbete</th>
                      <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-emerald-400/70 font-medium w-28">ROT-avdrag</th>
                      <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-muted font-medium w-28">Netto e. ROT</th>
                    </>}
                    <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-muted font-medium w-24">Moms 25%</th>
                    <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-muted font-medium w-28">Att betala</th>
                  </tr>
                </thead>
                <tbody>
                  {etapper.map((e, i) => {
                    const pct = (e.pct || 0) / 100
                    const netto = round2(totals.totalNetto * pct)               // exkl moms
                    const rotArbete = round2(totals.rotEligible * pct)          // arbete eligible exkl moms
                    // ROT is 30% of arbete inkl moms — full moms is still charged on labour + material.
                    const rot = round2(Math.min(rotArbete * 1.25 * 0.3, 50000))
                    const moms = round2(netto * 0.25)                           // moms on full netto
                    const totalInklMoms = round2(netto + moms)
                    const attBetala = round2(totalInklMoms - rot)
                    // Kept for legacy table cell that some users may still expect.
                    const nettoEfterRot = totalInklMoms
                    return (
                      <tr key={i} className="border-b border-border/40">
                        <td className="py-2 text-fg">{i + 1}. {e.beskrivning || '—'}</td>
                        <td className="py-2 text-right font-mono text-muted">{e.pct}%</td>
                        <td className="py-2 text-right font-mono text-fg">{formatCurrency(netto)}</td>
                        {totals.rotEligible > 0 && <>
                          <td className="py-2 text-right font-mono text-muted">{formatCurrency(rotArbete)}</td>
                          <td className="py-2 text-right font-mono text-emerald-400">−{formatCurrency(rot)}</td>
                          <td className="py-2 text-right font-mono text-fg">{formatCurrency(nettoEfterRot)}</td>
                        </>}
                        <td className="py-2 text-right font-mono text-muted">{formatCurrency(moms)}</td>
                        <td className="py-2 text-right font-mono text-fg font-semibold">{formatCurrency(attBetala)}</td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  {(() => {
                    const totalNetto = round2(etapper.reduce((s, e) => s + totals.totalNetto * (e.pct || 0) / 100, 0))
                    const totalRotArbete = round2(etapper.reduce((s, e) => s + totals.rotEligible * (e.pct || 0) / 100, 0))
                    // ROT is 30% of arbete INKL moms (per row, capped at 50000 each — same per-row cap as the
                    // header summary), summed across etapper.
                    const totalRot = round2(etapper.reduce(
                      (s, e) => s + Math.min(totals.rotEligible * (e.pct || 0) / 100 * 1.25 * 0.3, 50000),
                      0,
                    ))
                    const totalMoms = round2(totalNetto * 0.25)
                    const totalInklMoms = round2(totalNetto + totalMoms)
                    const totalAtt = round2(totalInklMoms - totalRot)
                    const totalNettoEfter = totalInklMoms
                    return (
                      <tr className="border-t-2 border-border bg-hover/30 font-semibold">
                        <td className="py-2.5 text-fg">Totalt</td>
                        <td className="py-2.5 text-right font-mono text-muted">{totalPct}%</td>
                        <td className="py-2.5 text-right font-mono text-fg">{formatCurrency(totalNetto)}</td>
                        {totals.rotEligible > 0 && <>
                          <td className="py-2.5 text-right font-mono text-muted">{formatCurrency(totalRotArbete)}</td>
                          <td className="py-2.5 text-right font-mono text-emerald-400">−{formatCurrency(totalRot)}</td>
                          <td className="py-2.5 text-right font-mono text-fg">{formatCurrency(totalNettoEfter)}</td>
                        </>}
                        <td className="py-2.5 text-right font-mono text-muted">{formatCurrency(totalMoms)}</td>
                        <td className="py-2.5 text-right font-mono text-fg">{formatCurrency(totalAtt)}</td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-8 py-4 border-t border-border bg-sidebar shrink-0">
        <button
          onClick={step === 1 ? onCancel : () => setStep(1)}
          className="text-sm text-muted hover:text-fg transition-colors"
        >
          {step === 1 ? 'Avbryt' : '← Tillbaka'}
        </button>

        {step === 1 ? (
          <button
            disabled={!selectedForslagId || !totals || loadingTotals}
            onClick={() => setStep(2)}
            className="rounded-lg bg-fg text-bg px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            Nästa →
          </button>
        ) : (
          <button
            disabled={!pctOk || creating}
            onClick={handleCreate}
            className="rounded-lg bg-fg text-bg px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {creating ? 'Sparar...' : `Spara fakturering (${etapper.length} etapper)`}
          </button>
        )}
      </div>
    </div>
  )
}
