import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { ForslagWithProjekt, CreateForslagInput, ForslagStatusar } from './types'
import type { ProjektWithKund } from '@/sections/projekt/types'
import type { FasMall } from '@/sections/installningar/types'
import { useAppConfig } from '@/context/AppConfig'
import { SelectField } from '@/components/SelectField'

interface Props {
  projekt: ProjektWithKund[]
  statusar: ForslagStatusar[]
  initial?: ForslagWithProjekt
  initialProjektId?: string
  onSubmit: (data: CreateForslagInput, mallId?: string) => Promise<void>
  onCancel: () => void
}

function defaultGiltigTill(dagar: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dagar)
  return d.toISOString().slice(0, 10)
}

export function ForslagForm({ projekt, statusar, initial, initialProjektId, onSubmit, onCancel }: Props) {
  const isEdit = !!initial
  const { config } = useAppConfig()

  const [forslagNummer, setForslagNummer] = useState(initial?.forslag_nummer ?? '')
  const [previewNummer, setPreviewNummer] = useState<string | null>(null)
  const [titel, setTitel] = useState(initial?.titel ?? '')
  const [projektId, setProjektId] = useState(initial?.projekt_id ?? initialProjektId ?? '')
  const [status, setStatus] = useState<string>(initial?.status ?? '')
  const [giltigTill, setGiltigTill] = useState(initial?.giltig_till ?? (isEdit ? '' : defaultGiltigTill(config?.forslag_std_giltig_dagar ?? 30)))
  const [momsProcent, setMomsProcent] = useState(initial?.moms_procent?.toString() ?? (isEdit ? '25' : (config?.forslag_std_moms_procent?.toString() ?? '25')))
  const [sammanfattning, setSammanfattning] = useState(initial?.sammanfattning ?? '')
  const [mallId, setMallId] = useState('')
  const [mallar, setMallar] = useState<FasMall[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isEdit) return
    window.api.invoke('db:forslag:preview-nummer').then((n) => setPreviewNummer(n as string)).catch(() => {})
    window.api.invoke('db:fas-mallar:list').then((d) => setMallar(d as FasMall[]))
  }, [isEdit])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projektId) { setError('Välj ett projekt'); return }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        forslag_nummer: forslagNummer.trim() || undefined,
        projekt_id: projektId,
        titel: titel.trim(),
        status,
        giltig_till: giltigTill || undefined,
        moms_procent: parseFloat(momsProcent) || 25,
        sammanfattning: sammanfattning.trim() || undefined
      }, mallId || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Förslag</span>
          <span className="text-subtle">/</span>
          <span className="text-fg font-medium">{isEdit ? `${initial.forslag_nummer} — ${initial.titel}` : 'Nytt förslag'}</span>
        </div>
        <button type="button" onClick={onCancel} className="text-muted hover:text-fg transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 border-r border-border px-8 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">
                Förslagsnummer
                {!isEdit && previewNummer && <span className="ml-2 normal-case tracking-normal font-normal text-subtle">→ {previewNummer}</span>}
              </label>
              <input className="input font-mono" value={forslagNummer} onChange={(e) => setForslagNummer(e.target.value)} placeholder={previewNummer ?? 'Auto-genererat'} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Status</label>
              <SelectField
                value={status}
                onChange={setStatus}
                options={statusar.map((s) => ({ value: s.namn, label: s.namn }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Titel *</label>
            <input className="input" required value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Titel på förslaget" />
          </div>

          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[11px] uppercase tracking-wider text-muted">Sammanfattning</label>
            <textarea className="input resize-none flex-1" rows={5} value={sammanfattning} onChange={(e) => setSammanfattning(e.target.value)} placeholder="Kort beskrivning av förslaget..." />
          </div>
        </div>

        <div className="flex-1 px-8 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Projekt *</label>
            <SelectField
              value={projektId}
              onChange={setProjektId}
              placeholder="Välj projekt..."
              searchable
              options={projekt.map((p) => ({ value: p.id, label: `${p.projekt_nummer} — ${p.namn} (${p.kunder.namn})` }))}
            />
          </div>

          {!isEdit && mallar.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Projekttyp</label>
              <SelectField
                value={mallId}
                onChange={setMallId}
                placeholder="Ingen mall (tom)"
                options={mallar.map((m) => ({ value: m.id, label: m.namn }))}
              />
              {mallId && (
                <p className="text-[11px] text-subtle">Faser och subfaser skapas automatiskt från mallen.</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Giltig till</label>
            <input type="date" className="input" value={giltigTill} onChange={(e) => setGiltigTill(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Moms (%)</label>
            <input type="number" min="0" max="100" step="1" className="input" value={momsProcent} onChange={(e) => setMomsProcent(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-8 py-4 border-t border-border bg-sidebar shrink-0">
        <span className="text-xs text-red-400">{error ?? ''}</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-fg transition-colors">Avbryt</button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-fg text-bg px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
            {submitting ? 'Sparar...' : isEdit ? 'Spara ändringar' : 'Skapa förslag'}
          </button>
        </div>
      </div>
    </form>
  )
}
