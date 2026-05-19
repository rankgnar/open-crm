import { useState, useEffect } from 'react'
import { MessageSquare } from 'lucide-react'
import type { SmsMall } from './types'
import type { ProjektAnteckning } from '@/sections/projekt/types'

interface SmsForslagPanelProps {
  projektId: string
  kund_namn: string
  projekt_namn: string
  forslag_nummer: string
  foretag_namn: string
  onNoteCreated: (note: ProjektAnteckning) => void
}

function resolveSmsMall(msg: string, vars: Record<string, string>): string {
  return msg
    .replace(/\{\{kund_namn\}\}/g, vars.kund_namn)
    .replace(/\{\{projekt_namn\}\}/g, vars.projekt_namn)
    .replace(/\{\{forslag_nummer\}\}/g, vars.forslag_nummer)
    .replace(/\{\{foretag_namn\}\}/g, vars.foretag_namn)
}

export function SmsForslagPanel({ projektId, kund_namn, projekt_namn, forslag_nummer, foretag_namn, onNoteCreated }: SmsForslagPanelProps) {
  const [mallar, setMallar] = useState<SmsMall[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    setLoading(true)
    window.api.invoke('db:sms-mallar:list')
      .then((d) => setMallar((d as SmsMall[]).filter((m) => m.aktiv)))
      .finally(() => setLoading(false))
  }, [])

  function handleSelect(id: string) {
    setSelectedId(id)
    if (!id) { setText(''); return }
    const mall = mallar.find((m) => m.id === id)
    if (!mall) return
    setText(resolveSmsMall(mall.meddelande, { kund_namn, projekt_namn, forslag_nummer, foretag_namn }))
  }

  async function handleRegistrera() {
    if (!text.trim()) return
    setSaving(true)
    setFeedback(null)
    try {
      const created = await window.api.invoke('db:projekt-anteckningar:create', {
        projekt_id: projektId,
        titel: 'SMS skickat',
        innehall: text.trim(),
        farg: 'blue',
      }) as ProjektAnteckning
      onNoteCreated(created)
      setFeedback({ kind: 'success', message: 'SMS registrerat som anteckning.' })
      setSelectedId('')
      setText('')
      setTimeout(() => setFeedback(null), 3000)
    } catch (e) {
      setFeedback({ kind: 'error', message: (e as Error).message ?? 'Fel' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-muted">Laddar…</p>
      </div>
    )
  }

  if (mallar.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6">
        <MessageSquare size={20} className="text-muted" />
        <p className="text-xs text-muted text-center">Inga SMS-mallar — lägg till i Inställningar → Förslag</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto p-5 gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] uppercase tracking-widest text-muted">Mall</p>
        <select
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          className="input text-sm"
        >
          <option value="">Välj mall…</option>
          {mallar.map((m) => (
            <option key={m.id} value={m.id}>{m.namn}</option>
          ))}
        </select>
      </div>

      {(selectedId || text) && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-widest text-muted">Meddelande</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="input resize-none text-sm"
            placeholder="Meddelande…"
          />
          <p className="text-[10px] text-muted text-right">{text.length} tecken</p>
        </div>
      )}

      {feedback && (
        <p className={`text-xs font-medium ${feedback.kind === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
          {feedback.message}
        </p>
      )}

      <button
        onClick={handleRegistrera}
        disabled={!text.trim() || saving}
        className="mt-auto px-4 py-2 rounded-lg bg-fg text-bg text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {saving ? 'Sparar…' : 'Registrera'}
      </button>
    </div>
  )
}
