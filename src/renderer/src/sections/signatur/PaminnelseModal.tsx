import { useEffect, useState } from 'react'
import { X, Bell, Loader2, AlertCircle, Mail } from 'lucide-react'

interface Props {
  isOpen:    boolean
  onClose:   () => void
  onSubmit:  (meddelande: string) => Promise<void>
  kund_email: string
}

export function PaminnelseModal({ isOpen, onClose, onSubmit, kund_email }: Props) {
  const [meddelande, setMeddelande] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setMeddelande('')
      setError(null)
      setSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(meddelande.trim())
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
          <h2 className="text-sm font-medium text-fg">Skicka påminnelse</h2>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-elevated">
            <Mail size={13} className="text-muted shrink-0" />
            <span className="text-sm text-fg">{kund_email}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">
              Personligt meddelande (valfritt)
            </label>
            <textarea
              className="input min-h-[120px] resize-y"
              rows={5}
              value={meddelande}
              onChange={(e) => setMeddelande(e.target.value)}
              placeholder={'T.ex. "Vi vill gärna komma igång — hör av dig om du har frågor!"'}
            />
            <p className="text-[11px] text-subtle">
              Visas för kunden under länken i påminnelsemailet.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-red-400/30 bg-red-400/10 text-xs text-red-400">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border bg-sidebar">
          <button onClick={onClose} className="text-sm text-muted hover:text-fg transition-colors px-3 py-1.5">
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-400 text-bg px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {submitting
              ? <><Loader2 size={13} className="animate-spin" />Skickar…</>
              : <><Bell size={13} />Skicka påminnelse</>}
          </button>
        </div>
      </div>
    </div>
  )
}
