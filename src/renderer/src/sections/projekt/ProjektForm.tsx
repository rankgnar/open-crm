import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { ProjektWithKund, CreateProjektInput, ProjektStatusar } from './types'
import type { Kund } from '@/sections/kunder/types'
import { useAppConfig } from '@/context/AppConfig'
import { SelectField } from '@/components/SelectField'

interface Props {
  kunder: Kund[]
  statusar: ProjektStatusar[]
  initial?: ProjektWithKund
  initialKundId?: string
  onSubmit: (data: CreateProjektInput) => Promise<void>
  onCancel: () => void
}

const CI = 'bg-transparent text-sm text-fg outline-none placeholder:text-subtle w-full'

export function ProjektForm({ kunder, statusar, initial, initialKundId, onSubmit, onCancel }: Props) {
  const isEdit = !!initial
  const { config, formatCurrency } = useAppConfig()
  const takEnkel = config?.rot_avdrag_tak_enkel ?? 50000
  const takDubbel = config?.rot_avdrag_tak_dubbel ?? 100000

  const [projektNummer, setProjektNummer] = useState(initial?.projekt_nummer ?? '')
  const [previewNummer, setPreviewNummer] = useState<string | null>(null)
  const [namn, setNamn] = useState(initial?.namn ?? '')
  const [beskrivning, setBeskrivning] = useState(initial?.beskrivning ?? '')
  const [status, setStatus] = useState<string>(initial?.status ?? '')
  const [kundId, setKundId] = useState(initial?.kund_id ?? initialKundId ?? '')
  const [startdatum, setStartdatum] = useState(initial?.startdatum ?? '')
  const [slutdatum, setSlutdatum] = useState(initial?.slutdatum ?? '')
  const [budgetTotal, setBudgetTotal] = useState(initial?.budget_total?.toString() ?? '0')
  const [arbetsplatsAdress, setArbetsplatsAdress] = useState(initial?.arbetsplats_adress ?? '')
  const [arbetsplatsPostnummer, setArbetsplatsPostnummer] = useState(initial?.arbetsplats_postnummer ?? '')
  const [arbetsplatsSstad, setArbetsplatsSstad] = useState(initial?.arbetsplats_stad ?? '')
  const [rotAvdrag, setRotAvdrag] = useState(initial?.rot_avdrag ?? false)
  const [rotProcent, setRotProcent] = useState(
    initial?.rot_procent?.toString() ?? (isEdit ? '30' : (config?.projekt_std_rot_procent?.toString() ?? '30'))
  )
  const [rotInkluderaMedsokande, setRotInkluderaMedsokande] = useState(initial?.rot_inkludera_medsokande ?? false)
  const [betalningsvillkor, setBetalningsvillkor] = useState(
    initial?.betalningsvillkor ?? (isEdit ? '30 dagar netto' : (config?.projekt_std_betalningsvillkor ?? '30 dagar netto'))
  )
  const [villkor, setVillkor] = useState(
    initial?.villkor ?? (isEdit ? '' : (config?.projekt_std_villkor ?? ''))
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isEdit) return
    window.api.invoke('db:projekt:preview-nummer').then((n) => {
      setPreviewNummer(n as string)
    }).catch(() => {})
  }, [isEdit])

  useEffect(() => {
    if (!status && statusar.length > 0) {
      const inkommen = statusar.find((s) => s.namn === 'Inkommen')
      setStatus(inkommen?.namn ?? statusar[0].namn)
    }
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

  const selectedKund = kunder.find((k) => k.id === kundId)
  const aktivCap = rotInkluderaMedsokande ? takDubbel : takEnkel

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">

      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="flex items-center gap-1.5 text-muted hover:text-fg transition-colors text-sm">
            <ArrowLeft size={14} />
            Projekt
          </button>
          <span className="text-subtle">/</span>
          <span className="text-sm text-fg font-medium">
            {isEdit ? `${initial.projekt_nummer} — ${initial.namn}` : 'Nytt projekt'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">{error}</span>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors disabled:opacity-40"
          >
            {submitting ? 'Sparar...' : isEdit ? 'Spara ändringar' : 'Skapa projekt'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex flex-col">

        {/* Title block */}
        <div className="px-8 py-6 border-b border-border flex items-start gap-4">
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-1.5">Projektnamn *</p>
            <input
              required
              className="w-full text-xl font-semibold bg-transparent text-fg outline-none placeholder:text-subtle"
              value={namn}
              onChange={(e) => setNamn(e.target.value)}
              placeholder="Namn på projektet"
            />
          </div>
          <div className="w-52 shrink-0 pt-5">
            <SelectField
              value={status}
              onChange={setStatus}
              options={statusar.map((s) => ({ value: s.namn, label: s.namn }))}
            />
          </div>
        </div>

        {/* Grunduppgifter */}
        <FS title="Grunduppgifter">
          <FC label={!isEdit && previewNummer ? `Projektnummer → ${previewNummer}` : 'Projektnummer'}>
            <input
              className={`${CI} font-mono`}
              value={projektNummer}
              onChange={(e) => setProjektNummer(e.target.value)}
              placeholder={previewNummer ?? 'Auto-genererat'}
            />
          </FC>
          <FC label="Kund *">
            <SelectField
              value={kundId}
              onChange={(v) => { setKundId(v); if (error === 'Välj en kund') setError(null) }}
              placeholder="Välj kund..."
              searchable
              options={kunder.map((k) => ({ value: k.id, label: `${k.kundnummer} — ${k.namn}` }))}
            />
          </FC>
        </FS>

        {/* Tider & budget */}
        <FS title="Tider & budget" cols={4}>
          <FC label="Startdatum">
            <input type="date" className={CI} value={startdatum} onChange={(e) => setStartdatum(e.target.value)} />
          </FC>
          <FC label="Slutdatum">
            <input type="date" className={CI} value={slutdatum} onChange={(e) => setSlutdatum(e.target.value)} />
          </FC>
          <FC label="Preliminär budget (SEK)">
            <input
              type="number"
              min="0"
              step="1"
              className={`${CI} font-mono`}
              value={budgetTotal}
              onChange={(e) => setBudgetTotal(e.target.value)}
              placeholder="0"
            />
          </FC>
          <FC label="Betalningsvillkor">
            <input
              className={CI}
              value={betalningsvillkor}
              onChange={(e) => setBetalningsvillkor(e.target.value)}
              placeholder="30 dagar netto"
            />
          </FC>
        </FS>

        {/* Arbetsplats */}
        <FS title="Arbetsplats">
          <FC label="Adress">
            <input
              className={CI}
              value={arbetsplatsAdress}
              onChange={(e) => setArbetsplatsAdress(e.target.value)}
              placeholder="Gatuadress"
            />
          </FC>
          <FC label="Postnummer">
            <input
              className={`${CI} font-mono`}
              value={arbetsplatsPostnummer}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, '')
                setArbetsplatsPostnummer(d.length <= 3 ? d : d.slice(0, 3) + ' ' + d.slice(3, 5))
              }}
              placeholder="123 45"
              maxLength={6}
            />
          </FC>
          <FC label="Stad">
            <input
              className={CI}
              value={arbetsplatsSstad}
              onChange={(e) => setArbetsplatsSstad(e.target.value)}
              placeholder="Stad"
            />
          </FC>
        </FS>

        {/* ROT-avdrag */}
        <div className="px-8 py-6 border-b border-border flex flex-col gap-4">
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
          {rotAvdrag && (
            <>
              <div className="grid gap-[1px] bg-border overflow-hidden rounded-sm grid-cols-2">
                <FC label="ROT-procent (%)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    className={`${CI} font-mono`}
                    value={rotProcent}
                    onChange={(e) => setRotProcent(e.target.value)}
                  />
                </FC>
                <FC label="Aktivt tak">
                  <span className="text-sm font-mono text-muted">{formatCurrency(aktivCap, 0)}</span>
                </FC>
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
            </>
          )}
        </div>

        {/* Beskrivning */}
        <div className="px-8 py-6 border-b border-border flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-widest text-muted">Beskrivning</p>
          <textarea
            value={beskrivning}
            onChange={(e) => setBeskrivning(e.target.value)}
            rows={4}
            placeholder="Projektbeskrivning..."
            className="bg-elevated border border-border rounded-sm px-4 py-3 text-sm text-muted outline-none resize-y leading-relaxed placeholder:text-subtle"
          />
        </div>

        {/* Villkor */}
        <div className="px-8 py-6 border-b border-border flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-widest text-muted">Projektvillkor</p>
          <textarea
            value={villkor}
            onChange={(e) => setVillkor(e.target.value)}
            rows={6}
            placeholder="Projektspecifika villkor..."
            className="bg-elevated border border-border rounded-sm px-4 py-3 text-sm text-muted outline-none resize-y leading-relaxed placeholder:text-subtle"
          />
        </div>

      </div>
    </form>
  )
}

function FS({ title, children, cols = 3 }: { title: string; children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const colClass = cols === 4 ? 'grid-cols-4' : cols === 2 ? 'grid-cols-2' : 'grid-cols-3'
  return (
    <div className="px-8 py-6 border-b border-border">
      <p className="text-[11px] uppercase tracking-widest text-muted mb-4">{title}</p>
      <div className={`grid gap-[1px] bg-border overflow-hidden rounded-sm ${colClass}`}>
        {children}
      </div>
    </div>
  )
}

function FC({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 bg-elevated px-4 py-3 ${error ? 'ring-1 ring-inset ring-red-400/40' : ''}`}>
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      {children}
      {error && <span className="text-[10px] text-red-400 mt-0.5">{error}</span>}
    </div>
  )
}
