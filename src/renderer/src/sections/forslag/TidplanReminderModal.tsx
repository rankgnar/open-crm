import { AlertTriangle, CalendarCheck, CalendarDays, X } from 'lucide-react'
import type { ForslagFas } from './types'

interface Props {
  faser: ForslagFas[]
  onNavigateTidplan: () => void
  onConfirm: () => void
  onClose: () => void
}

function formatDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString('sv-SE') : '—'
}

export function TidplanReminderModal({ faser, onNavigateTidplan, onConfirm, onClose }: Props) {
  const missingDates = faser.filter((f) => !f.start_datum || !f.slut_datum)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">

        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar">
          <div className="flex items-center gap-2">
            <CalendarCheck size={14} className="text-blue-400" />
            <h2 className="text-sm font-medium text-fg">Kontrollera tidplan</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-xs text-muted">Kontrollera att fasernas datum är korrekta innan förslaget skickas för signering.</p>

          {faser.length === 0 ? (
            <p className="text-sm text-subtle italic">Inga faser tillagda.</p>
          ) : (
            <div className="border border-border rounded-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-elevated">
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted font-medium">Fas</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted font-medium w-28">Start</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted font-medium w-28">Slut</th>
                  </tr>
                </thead>
                <tbody>
                  {faser.map((fas) => {
                    const missing = !fas.start_datum || !fas.slut_datum
                    return (
                      <tr key={fas.id} className={`border-b border-border/50 last:border-0 ${missing ? 'bg-amber-400/5' : ''}`}>
                        <td className="px-3 py-2 text-fg font-medium">{fas.namn}</td>
                        <td className={`px-3 py-2 font-mono ${!fas.start_datum ? 'text-amber-400' : 'text-muted'}`}>{formatDate(fas.start_datum)}</td>
                        <td className={`px-3 py-2 font-mono ${!fas.slut_datum ? 'text-amber-400' : 'text-muted'}`}>{formatDate(fas.slut_datum)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {missingDates.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-400/10 border border-amber-400/30 rounded-md">
              <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-400">
                {missingDates.length === 1 ? '1 fas saknar datum.' : `${missingDates.length} faser saknar datum.`} Öppna tidplanen för att justera.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-sidebar">
          <button onClick={onClose} className="text-sm text-muted hover:text-fg transition-colors px-3 py-1.5">
            Avbryt
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateTidplan}
              className="flex items-center gap-1.5 rounded-md border border-border px-4 py-1.5 text-sm text-muted hover:text-fg hover:border-subtle transition-colors"
            >
              <CalendarDays size={13} />
              Öppna tidplan
            </button>
            <button
              onClick={onConfirm}
              className="rounded-md bg-emerald-400 text-bg px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Tidplan är klar — fortsätt
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
