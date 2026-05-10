import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { ProjektWithKund, CreateProjektInput, ProjektStatusar, ProjektPrioritet } from './types'
import type { Kund } from '@/sections/kunder/types'
import { useAppConfig } from '@/context/AppConfig'

interface Props {
  kunder: Kund[]
  statusar: ProjektStatusar[]
  initial?: ProjektWithKund
  onSubmit: (data: CreateProjektInput) => Promise<void>
  onCancel: () => void
}

export function ProjektForm({ kunder, statusar, initial, onSubmit, onCancel }: Props) {
  const isEdit = !!initial
  const { config, formatCurrency } = useAppConfig()
  const takEnkel = config?.rot_avdrag_tak_enkel ?? 50000
  const takDubbel = config?.rot_avdrag_tak_dubbel ?? 100000

  const [projektNummer, setProjektNummer] = useState(initial?.projekt_nummer ?? '')
  const [previewNummer, setPreviewNummer] = useState<string | null>(null)
  const [namn, setNamn] = useState(initial?.namn ?? '')
  const [beskrivning, setBeskrivning] = useState(initial?.beskrivning ?? '')
  const [status, setStatus] = useState<string>(initial?.status ?? '')
  const [prioritet, setPrioritet] = useState<ProjektPrioritet>(initial?.prioritet ?? 'parked')
  const [kundId, setKundId] = useState(initial?.kund_id ?? '')
  const [startdatum, setStartdatum] = useState(initial?.startdatum ?? '')
  const [slutdatum, setSlutdatum] = useState(initial?.slutdatum ?? '')
  const [budgetTotal, setBudgetTotal] = useState(initial?.budget_total?.toString() ?? '0')
  const [arbetsplatsAdress, setArbetsplatsAdress] = useState(initial?.arbetsplats_adress ?? '')
  const [arbetsplatsPostnummer, setArbetsplatsPostnummer] = useState(initial?.arbetsplats_postnummer ?? '')
  const [arbetsplatsSstad, setArbetsplatsSstad] = useState(initial?.arbetsplats_stad ?? '')
  const [rotAvdrag, setRotAvdrag] = useState(initial?.rot_avdrag ?? false)
  const [rotProcent, setRotProcent] = useState(initial?.rot_procent?.toString() ?? (isEdit ? '30' : (config?.projekt_std_rot_procent?.toString() ?? '30')))
  const [rotInkluderaMedsokande, setRotInkluderaMedsokande] = useState(initial?.rot_inkludera_medsokande ?? false)
  const [betalningsvillkor, setBetalningsvillkor] = useState(initial?.betalningsvillkor ?? (isEdit ? '30 dagar netto' : (config?.projekt_std_betalningsvillkor ?? '30 dagar netto')))
  const [villkor, setVillkor] = useState(initial?.villkor ?? (isEdit ? '' : (config?.projekt_std_villkor ?? '')))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isEdit) return
    window.api.invoke('db:projekt:preview-nummer').then((n) => {
      setPreviewNummer(n as string)
    }).catch(() => {})
  }, [isEdit])

  useEffect(() => {
    if (!status && statusar.length > 0) setStatus(statusar[0].namn)
  }, [statusar, status])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!kundId) { setError('Välj en kund'); return }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        projekt_nummer: projektNummer.trim() || undefined,
        kund_id: kundId,
        namn: namn.trim(),
        beskrivning: beskrivning.trim() || undefined,
        status,
        prioritet,
        startdatum: startdatum || undefined,
        slutdatum: slutdatum || undefined,
        budget_total: parseFloat(budgetTotal) || 0,
        arbetsplats_adress: arbetsplatsAdress.trim() || undefined,
        arbetsplats_postnummer: arbetsplatsPostnummer.trim() || undefined,
        arbetsplats_stad: arbetsplatsSstad.trim() || undefined,
        rot_avdrag: rotAvdrag,
        rot_procent: rotAvdrag ? parseFloat(rotProcent) || 30 : undefined,
        rot_inkludera_medsokande: rotAvdrag ? rotInkluderaMedsokande : false,
        betalningsvillkor: betalningsvillkor.trim() || undefined,
        villkor: villkor.trim() || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">

      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Projekt</span>
          <span className="text-subtle">/</span>
          <span className="text-fg font-medium">{isEdit ? `${initial.projekt_nummer} — ${initial.namn}` : 'Nytt projekt'}</span>
        </div>
        <button type="button" onClick={onCancel} className="text-muted hover:text-fg transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-1 min-h-0 divide-x divide-border overflow-auto">

        {/* Vänster kolumn */}
        <div className="flex-1 flex flex-col divide-y divide-border">

          <div className="px-8 py-5 flex flex-col gap-4">
            <p className="text-[11px] uppercase tracking-widest text-muted">Grunduppgifter</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted">
                  Projektnummer
                  {!isEdit && previewNummer && <span className="ml-2 normal-case tracking-normal font-normal text-subtle">→ {previewNummer}</span>}
                </label>
                <input
                  className="input font-mono"
                  value={projektNummer}
                  onChange={(e) => setProjektNummer(e.target.value)}
                  placeholder={previewNummer ?? 'Auto-genererat'}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted">Status</label>
                <select className="input text-muted" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {statusar.map((s) => <option key={s.id} value={s.namn}>{s.namn}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Prioritet</label>
              <div className="flex items-center gap-2">
                {([
                  { value: 'high',   label: 'Hög',      active: 'border-red-400 text-red-400 bg-red-400/10' },
                  { value: 'normal', label: 'Normal',   active: 'border-amber-400 text-amber-400 bg-amber-400/10' },
                  { value: 'low',    label: 'Låg',      active: 'border-blue-400 text-blue-400 bg-blue-400/10' },
                  { value: 'parked', label: 'Parkerad', active: 'border-border text-muted bg-elevated' },
                ] as { value: ProjektPrioritet; label: string; active: string }[]).map(({ value, label, active }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPrioritet(value)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${
                      prioritet === value ? active : 'border-border text-muted hover:text-fg hover:bg-hover'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Projektnamn *</label>
              <input className="input" required value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="Namn på projektet" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Beskrivning</label>
              <textarea className="input resize-none" rows={3} value={beskrivning} onChange={(e) => setBeskrivning(e.target.value)} placeholder="Projektbeskrivning..." />
            </div>
          </div>

          <div className="px-8 py-5 flex flex-col gap-4">
            <p className="text-[11px] uppercase tracking-widest text-muted">Villkor</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Betalningsvillkor</label>
              <input className="input" value={betalningsvillkor} onChange={(e) => setBetalningsvillkor(e.target.value)} placeholder="30 dagar netto" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Projektvillkor</label>
              <textarea className="input resize-y" rows={8} style={{ color: 'var(--color-muted)' }} value={villkor} onChange={(e) => setVillkor(e.target.value)} placeholder="Projektspecifika villkor..." />
            </div>
          </div>

        </div>

        {/* Höger kolumn */}
        <div className="flex-1 flex flex-col divide-y divide-border">

          <div className="px-8 py-5 flex flex-col gap-4">
            <p className="text-[11px] uppercase tracking-widest text-muted">Kund &amp; tid</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Kund *</label>
              <select className="input text-muted" required value={kundId} onChange={(e) => setKundId(e.target.value)}>
                <option value="">Välj kund...</option>
                {kunder.map((k) => <option key={k.id} value={k.id}>{k.kundnummer} — {k.namn}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted">Startdatum</label>
                <input type="date" className="input" value={startdatum} onChange={(e) => setStartdatum(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted">Slutdatum</label>
                <input type="date" className="input" value={slutdatum} onChange={(e) => setSlutdatum(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Preliminär budget (SEK)</label>
              <input type="number" min="0" step="1" className="input" value={budgetTotal} onChange={(e) => setBudgetTotal(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="px-8 py-5 flex flex-col gap-4">
            <p className="text-[11px] uppercase tracking-widest text-muted">Arbetsplats</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Adress</label>
              <input className="input" value={arbetsplatsAdress} onChange={(e) => setArbetsplatsAdress(e.target.value)} placeholder="Gatuadress" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted">Postnummer</label>
                <input
                  className="input font-mono"
                  value={arbetsplatsPostnummer}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, '')
                    setArbetsplatsPostnummer(d.length <= 3 ? d : d.slice(0, 3) + ' ' + d.slice(3, 5))
                  }}
                  placeholder="123 45"
                  maxLength={6}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted">Stad</label>
                <input className="input" value={arbetsplatsSstad} onChange={(e) => setArbetsplatsSstad(e.target.value)} placeholder="Stad" />
              </div>
            </div>
          </div>

          <div className="px-8 py-5 flex flex-col gap-4">
            <p className="text-[11px] uppercase tracking-widest text-muted">ROT-avdrag</p>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rotAvdrag}
                onChange={(e) => { setRotAvdrag(e.target.checked); if (!e.target.checked) setRotInkluderaMedsokande(false) }}
                className="w-4 h-4 accent-emerald-400"
              />
              <span className="text-sm text-fg">Projektet berättigar ROT-avdrag</span>
            </label>
            {rotAvdrag && (() => {
              const selectedKund = kunder.find((k) => k.id === kundId)
              const aktivCap = rotInkluderaMedsokande ? takDubbel : takEnkel
              return (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] uppercase tracking-wider text-muted">ROT-procent (%)</label>
                    <input type="number" min="0" max="100" step="1" className="input" value={rotProcent} onChange={(e) => setRotProcent(e.target.value)} />
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rotInkluderaMedsokande}
                      onChange={(e) => setRotInkluderaMedsokande(e.target.checked)}
                      className="w-4 h-4 accent-emerald-400 mt-0.5"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-fg">
                        Två sökande
                        {selectedKund?.medsokande_namn && (
                          <> — <span className="text-muted">{selectedKund.medsokande_namn}</span></>
                        )}
                      </span>
                      <span className="text-[11px] text-subtle">
                        Höjer taket till {formatCurrency(takDubbel, 0)} (annars {formatCurrency(takEnkel, 0)})
                      </span>
                    </div>
                  </label>
                  <p className="text-[11px] text-subtle">
                    Aktivt tak: <span className="font-mono text-muted">{formatCurrency(aktivCap, 0)}</span>
                  </p>
                </>
              )
            })()}
          </div>

        </div>
      </div>

      <div className="flex items-center justify-between px-8 py-4 border-t border-border bg-sidebar shrink-0">
        <span className="text-xs text-red-400">{error ?? ''}</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-fg transition-colors">
            Avbryt
          </button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-fg text-bg px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
            {submitting ? 'Sparar...' : isEdit ? 'Spara ändringar' : 'Skapa projekt'}
          </button>
        </div>
      </div>
    </form>
  )
}
