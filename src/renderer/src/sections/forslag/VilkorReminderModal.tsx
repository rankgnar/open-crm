import { useState } from 'react'
import { AlertTriangle, Pencil, X } from 'lucide-react'

interface Props {
  villkor: string
  projektId: string
  onVillkorSave: (newVillkor: string) => Promise<void>
  onClose: () => void
  onConfirm: () => void
}

export function VilkorReminderModal({ villkor, onVillkorSave, onClose, onConfirm }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(villkor)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onVillkorSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setDraft(villkor)
    setEditing(false)
  }

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
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wider text-muted">Aktuell villkorstext</label>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors"
                >
                  <Pencil size={11} />
                  Redigera
                </button>
              )}
            </div>

            {editing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={8}
                className="bg-elevated border border-border rounded-sm px-4 py-3 text-sm text-fg outline-none resize-y leading-relaxed placeholder:text-subtle w-full"
                placeholder="Projektspecifika villkor..."
                autoFocus
              />
            ) : (
              <div className="bg-elevated border border-border rounded-md px-3 py-2 max-h-64 overflow-auto">
                {draft.trim()
                  ? <pre className="text-xs text-fg whitespace-pre-wrap font-sans">{draft}</pre>
                  : <p className="text-xs text-subtle italic">Inga villkor satta på projektet — standardtext används.</p>
                }
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border bg-sidebar">
          {editing ? (
            <>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="text-sm text-muted hover:text-fg transition-colors px-3 py-1.5"
              >
                Avbryt
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md border border-emerald-400 text-emerald-400 px-4 py-1.5 text-sm font-medium hover:bg-emerald-400/10 transition-colors disabled:opacity-50"
              >
                {saving ? 'Sparar…' : 'Spara villkor'}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="text-sm text-muted hover:text-fg transition-colors px-3 py-1.5">
                Avbryt — jag vill redigera först
              </button>
              <button
                onClick={onConfirm}
                className="rounded-md bg-emerald-400 text-bg px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Jag har kontrollerat — fortsätt
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
