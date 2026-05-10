import { AlertTriangle, X } from 'lucide-react'

interface Props {
  villkor: string
  onClose: () => void
  onConfirm: () => void
}

export function VilkorReminderModal({ villkor, onClose, onConfirm }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <h2 className="text-sm font-medium text-fg">Innan du skickar — kontrollera villkor</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Aktuell villkorstext</label>
            <div className="bg-elevated border border-border rounded-md px-3 py-2 max-h-64 overflow-auto">
              {villkor.trim()
                ? <pre className="text-xs text-fg whitespace-pre-wrap font-sans">{villkor}</pre>
                : <p className="text-xs text-subtle italic">Inga villkor satta på projektet — standardtext används.</p>
              }
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border bg-sidebar">
          <button onClick={onClose} className="text-sm text-muted hover:text-fg transition-colors px-3 py-1.5">
            Avbryt — jag vill redigera först
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-emerald-400 text-bg px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Jag har kontrollerat — fortsätt
          </button>
        </div>
      </div>
    </div>
  )
}
