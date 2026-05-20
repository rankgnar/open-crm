import { useEffect, useState } from 'react'
import { X, Send, Loader2, AlertCircle, MessageSquarePlus } from 'lucide-react'

export interface RevisedOpts {
  sammanfattad:  boolean
  splitPdf:      boolean
  bifogaTidplan: boolean
}

interface Props {
  isOpen:         boolean
  onClose:        () => void
  onSubmit:       (meddelande: string, opts: RevisedOpts) => Promise<void>
  senasteAndring?: string
  hasTidplan?:    boolean
  reRendersPdf?:  boolean
}

export function SkickaUppdateradVersionModal({
  isOpen, onClose, onSubmit, senasteAndring, hasTidplan, reRendersPdf,
}: Props) {
  const [meddelande, setMeddelande]       = useState('')
  const [sammanfattad, setSammanfattad]   = useState(false)
  const [splitPdf, setSplitPdf]           = useState(false)
  const [bifogaTidplan, setBifogaTidplan] = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setMeddelande('')
      setSammanfattad(false)
      setSplitPdf(false)
      setBifogaTidplan(false)
      setError(null)
      setSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(meddelande.trim(), { sammanfattad, splitPdf, bifogaTidplan })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-bg border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar">
          <h2 className="text-sm font-medium text-fg">Skicka uppdaterad version</h2>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {senasteAndring && (
            <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-400 mb-1">
                <MessageSquarePlus size={11} />Kundens senaste begäran
              </p>
              <p className="text-sm text-fg whitespace-pre-wrap">{senasteAndring}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">
              Personligt meddelande (valfritt)
            </label>
            <textarea
              className="input min-h-[120px] resize-y"
              rows={5}
              value={meddelande}
              onChange={(e) => setMeddelande(e.target.value)}
              placeholder={'T.ex. “Vi har justerat materialvalet enligt din begäran. Hör gärna av dig om något fortfarande inte stämmer.”'}
            />
            <p className="text-[11px] text-subtle">
              Visas för kunden direkt under sammanfattningen av deras senaste begäran.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-red-400/30 bg-red-400/10 text-xs text-red-400">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-border bg-sidebar">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
            {hasTidplan && (
              <label className={`flex items-center gap-2 text-xs transition-colors cursor-pointer select-none ${bifogaTidplan ? 'text-emerald-400 font-medium' : 'text-muted hover:text-fg'}`}>
                <input
                  type="checkbox"
                  checked={bifogaTidplan}
                  onChange={(e) => setBifogaTidplan(e.target.checked)}
                  className="w-4 h-4 accent-emerald-400"
                />
                <span>Bifoga tidplan</span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onClose} className="text-sm text-muted hover:text-fg transition-colors px-3 py-1.5">
              Avbryt
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-400 text-bg px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              {submitting
                ? <><Loader2 size={13} className="animate-spin" />{reRendersPdf ? 'Genererar & skickar…' : 'Skickar…'}</>
                : <><Send size={13} />Skicka uppdaterad version</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
