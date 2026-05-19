import { useState, useEffect } from 'react'
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import type { SmsMall, ForslagSmsLog } from './types'
import type { ProjektAnteckning } from '@/sections/projekt/types'

interface SmsForslagPanelProps {
  forslagId: string
  projektId: string
  kund_namn: string
  kund_email: string
  kund_telefon: string
  kund_stad: string
  projekt_namn: string
  forslag_nummer: string
  foretag_namn: string
  foretag_email: string
  foretag_telefon: string
  foretag_webbadress: string
  onNoteCreated: (note: ProjektAnteckning) => void
}

function resolveSmsMall(msg: string, vars: Record<string, string>): string {
  return msg
    .replace(/\{\{kund_namn\}\}/g, vars.kund_namn)
    .replace(/\{\{kund_email\}\}/g, vars.kund_email)
    .replace(/\{\{kund_telefon\}\}/g, vars.kund_telefon)
    .replace(/\{\{kund_stad\}\}/g, vars.kund_stad)
    .replace(/\{\{projekt_namn\}\}/g, vars.projekt_namn)
    .replace(/\{\{forslag_nummer\}\}/g, vars.forslag_nummer)
    .replace(/\{\{foretag_namn\}\}/g, vars.foretag_namn)
    .replace(/\{\{foretag_email\}\}/g, vars.foretag_email)
    .replace(/\{\{foretag_telefon\}\}/g, vars.foretag_telefon)
    .replace(/\{\{foretag_webbadress\}\}/g, vars.foretag_webbadress)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

export function SmsForslagPanel({ forslagId, projektId, kund_namn, kund_email, kund_telefon, kund_stad, projekt_namn, forslag_nummer, foretag_namn, foretag_email, foretag_telefon, foretag_webbadress, onNoteCreated }: SmsForslagPanelProps) {
  const [mallar, setMallar] = useState<SmsMall[]>([])
  const [log, setLog] = useState<ForslagSmsLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    Promise.all([
      window.api.invoke('db:sms-mallar:list'),
      window.api.invoke('db:forslag-sms-log:list', forslagId),
    ]).then(([m, l]) => {
      setMallar((m as SmsMall[]).filter((x) => x.aktiv))
      setLog(l as ForslagSmsLog[])
    }).finally(() => setLoading(false))
  }, [forslagId])

  function handleSelect(id: string) {
    setSelectedId(id)
    if (!id) { setText(''); return }
    const mall = mallar.find((m) => m.id === id)
    if (!mall) return
    setText(resolveSmsMall(mall.meddelande, { kund_namn, kund_email, kund_telefon, kund_stad, projekt_namn, forslag_nummer, foretag_namn, foretag_email, foretag_telefon, foretag_webbadress }))
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleRegistrera() {
    if (!text.trim()) return
    setSaving(true)
    setFeedback(null)
    const mall_namn = mallar.find((m) => m.id === selectedId)?.namn ?? ''
    try {
      const [logEntry, note] = await Promise.all([
        window.api.invoke('db:forslag-sms-log:create', {
          forslag_id: forslagId,
          mall_namn,
          meddelande: text.trim(),
        }) as Promise<ForslagSmsLog>,
        window.api.invoke('db:projekt-anteckningar:create', {
          projekt_id: projektId,
          titel: 'SMS skickat',
          innehall: text.trim(),
          farg: 'blue',
        }) as Promise<ProjektAnteckning>,
      ])
      setLog((prev) => [logEntry, ...prev])
      onNoteCreated(note)
      setFeedback({ kind: 'success', message: 'SMS registrerat.' })
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Log timeline */}
      {log.length > 0 && (
        <div className="border-b border-border overflow-auto" style={{ maxHeight: '45%' }}>
          <div className="px-5 py-3 border-b border-border shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-muted">Skickade meddelanden</p>
          </div>
          <div className="px-5 py-3 flex flex-col gap-0">
            {log.map((entry, i) => {
              const expanded = expandedIds.has(entry.id)
              const isLast = i === log.length - 1
              return (
                <div key={entry.id} className="flex gap-3">
                  {/* Spine */}
                  <div className="flex flex-col items-center shrink-0 pt-1">
                    <div className="size-2 rounded-full bg-blue-400 shrink-0" />
                    {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  {/* Content */}
                  <div className={`flex-1 min-w-0 ${!isLast ? 'pb-4' : 'pb-1'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted">{formatDate(entry.skapad_at)}</p>
                        {entry.mall_namn && (
                          <p className="text-[11px] font-medium text-blue-400 mt-0.5">{entry.mall_namn}</p>
                        )}
                        <p className={`text-xs text-fg mt-0.5 ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                          {entry.meddelande}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleExpand(entry.id)}
                        className="shrink-0 text-muted hover:text-fg transition-colors mt-0.5"
                      >
                        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Compose area */}
      <div className="flex-1 flex flex-col overflow-auto p-5 gap-4">
        {mallar.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <MessageSquare size={20} className="text-muted" />
            <p className="text-xs text-muted text-center">Inga SMS-mallar — lägg till i Inställningar → Förslag</p>
          </div>
        ) : (
          <>
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
                  rows={5}
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
          </>
        )}
      </div>
    </div>
  )
}
