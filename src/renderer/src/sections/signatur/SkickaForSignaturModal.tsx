import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { DokumentTyp, EpostMall, SignaturLank } from './types'
import { SelectField } from '@/components/SelectField'

export interface BifogaOption {
  id:       string
  label:    string
  // Lazily generates the attachment when the user submits with the box checked.
  // Returning a Buffer-as-base64 keeps the IPC contract simple.
  generate: () => Promise<{ filnamn: string; data_base64: string }>
}

export interface TitelOptions {
  titel1: string
  titel2?: string
}

interface Props {
  dokument_typ:   DokumentTyp
  dokument_id:    string
  initialEmail?:  string
  kund_namn?:     string
  bifogaOptions?: BifogaOption[]
  titelOptions?:  TitelOptions
  onClose:        () => void
  onSent:         (link: SignaturLank, extras?: { titel?: string; sammanfattad?: boolean; splitPdf?: boolean }) => void
}

const EXPIRY_OPTIONS = [
  { label: '7 dagar', days: 7 },
  { label: '14 dagar', days: 14 },
  { label: '30 dagar', days: 30 },
  { label: '60 dagar', days: 60 },
  { label: 'Ingen utgång', days: 0 },
]

export function SkickaForSignaturModal({ dokument_typ, dokument_id, initialEmail, kund_namn, bifogaOptions, titelOptions, onClose, onSent }: Props) {
  const [email, setEmail] = useState(initialEmail ?? '')
  const [days, setDays] = useState(30)
  const [mallar, setMallar] = useState<EpostMall[]>([])
  const [mallId, setMallId] = useState<string | null>(null)
  const [meddelande, setMeddelande] = useState('')
  const [enabledBifoga, setEnabledBifoga] = useState<Set<string>>(() => new Set())
  const [titel, setTitel] = useState(titelOptions?.titel1 ?? '')
  const [sammanfattad, setSammanfattad] = useState(false)
  const [splitPdf, setSplitPdf] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const showTitelPicker = !!titelOptions?.titel2

  useEffect(() => {
    void (async () => {
      const all = await window.api.invoke('db:epost-mallar:list') as EpostMall[]
      const suf = dokument_typ === 'fritt' ? 'dokument' : dokument_typ
      const filtered = (all ?? []).filter(m =>
        m.system_kod === `signatur_begaran_${suf}` ||
        (m.system_kod ?? '').startsWith(`signatur_begaran_${suf}_`)
      )
      setMallar(filtered)
      const def = await window.api.invoke('db:signatur-lank:get-default-mall', dokument_typ) as string | null
      const resolvedId = def ?? filtered[0]?.id ?? null
      setMallId(resolvedId)
      const mall = filtered.find(m => m.id === resolvedId)
      if (mall?.meddelande_standard) {
        setMeddelande(mall.meddelande_standard.replace(/\{\{kund_namn\}\}/g, kund_namn ?? ''))
      }
    })()
  }, [dokument_typ, kund_namn])

  async function handleSend() {
    setError('')
    if (!email.includes('@')) { setError('Ange en giltig e-postadress'); return }
    if (mallar.length === 0) {
      const suf = dokument_typ === 'fritt' ? 'dokument' : dokument_typ
      setError(`Ingen mall med system_kod 'signatur_begaran_${suf}' finns. Kontrollera Inställningar → E-post mallar.`)
      return
    }
    setSending(true)
    try {
      // Generate any attachments the user has opted into. Run sequentially
      // so a slow PDF render doesn't block the UI on parallel work that
      // shares the printToPDF BrowserWindow in the main process.
      const bilagor: { filnamn: string; data_base64: string }[] = []
      for (const opt of bifogaOptions ?? []) {
        if (enabledBifoga.has(opt.id)) {
          bilagor.push(await opt.generate())
        }
      }

      const link = await window.api.invoke('db:signatur-lank:create', {
        dokument_typ,
        dokument_id,
        kund_email: email.trim(),
        giltig_dagar: days,
        meddelande: meddelande.trim() || undefined,
        mall_id: mallId ?? undefined,
        bilagor: bilagor.length > 0 ? bilagor : undefined,
      }) as SignaturLank
      onSent(link, {
        ...(showTitelPicker ? { titel: titel || titelOptions?.titel1 } : {}),
        ...(sammanfattad ? { sammanfattad: true } : {}),
        ...(splitPdf ? { splitPdf: true } : {}),
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar">
          <h2 className="text-sm font-medium text-fg">Skicka för signatur</h2>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {showTitelPicker && titelOptions && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Titel</label>
              <div className="flex flex-col gap-1.5">
                {[titelOptions.titel1, titelOptions.titel2!].map(t => (
                  <label key={t} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${titel === t ? 'border-emerald-400/60 bg-emerald-400/5' : 'border-border hover:border-subtle'}`}>
                    <input
                      type="radio"
                      name="signatur-titel"
                      checked={titel === t}
                      onChange={() => setTitel(t)}
                      className="accent-emerald-400"
                    />
                    <span className="text-sm text-fg">{t}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Kundens e-post</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kund@exempel.se"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Giltighet</label>
              <SelectField
                value={String(days)}
                onChange={(v) => setDays(parseInt(v, 10))}
                options={EXPIRY_OPTIONS.map((o) => ({ value: String(o.days), label: o.label }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">E-post-mall</label>
              <SelectField
                value={mallId ?? ''}
                onChange={(v) => {
                  setMallId(v || null)
                  const mall = mallar.find(m => m.id === v)
                  if (mall?.meddelande_standard) {
                    setMeddelande(mall.meddelande_standard.replace(/\{\{kund_namn\}\}/g, kund_namn ?? ''))
                  } else {
                    setMeddelande('')
                  }
                }}
                placeholder={mallar.length === 0 ? '— ingen tillgänglig —' : undefined}
                options={mallar.map((m) => ({ value: m.id, label: m.namn }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Personligt meddelande (valfritt)</label>
            <textarea
              className="input min-h-[80px] resize-none"
              rows={3}
              value={meddelande}
              onChange={(e) => setMeddelande(e.target.value)}
              placeholder="Skrivs ut i e-posten via {{meddelande}} om mallen använder det."
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-border bg-sidebar">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {(bifogaOptions ?? []).map(opt => {
              const checked = enabledBifoga.has(opt.id)
              return (
                <label key={opt.id} className={`flex items-center gap-2 text-xs transition-colors cursor-pointer select-none ${checked ? 'text-emerald-400 font-medium' : 'text-muted hover:text-fg'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setEnabledBifoga(prev => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(opt.id); else next.delete(opt.id)
                        return next
                      })
                    }}
                    className="w-4 h-4 accent-emerald-400"
                  />
                  <span>{opt.label}</span>
                </label>
              )
            })}
            <label className={`flex items-center gap-2 text-xs transition-colors cursor-pointer select-none ${sammanfattad ? 'text-emerald-400 font-medium' : 'text-muted hover:text-fg'}`}>
              <input
                type="checkbox"
                checked={sammanfattad}
                onChange={(e) => setSammanfattad(e.target.checked)}
                className="w-4 h-4 accent-emerald-400"
              />
              <span>Dölj raddetaljer</span>
            </label>
            <label className={`flex items-center gap-2 text-xs transition-colors cursor-pointer select-none ${splitPdf ? 'text-emerald-400 font-medium' : 'text-muted hover:text-fg'}`}>
              <input
                type="checkbox"
                checked={splitPdf}
                onChange={(e) => setSplitPdf(e.target.checked)}
                className="w-4 h-4 accent-emerald-400"
              />
              <span>Dela upp i 2 PDF (offert + spec)</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm text-muted hover:text-fg transition-colors px-3 py-1.5">
              Avbryt
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !email.includes('@')}
              className="flex items-center gap-1.5 rounded-md bg-emerald-400 text-bg px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              {sending && <Loader2 size={12} className="animate-spin" />}
              {sending ? 'Skickar…' : 'Skicka'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
