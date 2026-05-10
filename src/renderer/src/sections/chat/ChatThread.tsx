import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import type { ChatMessage, ChatThreadSummary } from './types'

interface Props {
  thread: ChatThreadSummary
  messages: ChatMessage[]
  onSend: (innehall: string) => Promise<void>
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('sv-SE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function ChatThread({ thread, messages, onSend }: Props) {
  const [innehall, setInnehall] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, thread.personal_id])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const text = innehall.trim()
    if (!text || sending) return
    setError(null)
    setSending(true)
    try {
      await onSend(text)
      setInnehall('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte skicka')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <p className="text-xs uppercase tracking-widest text-muted">Chat med</p>
        <p className="text-sm font-semibold text-fg">{thread.namn}</p>
        {thread.email && <p className="text-xs text-subtle">· {thread.email}</p>}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6">
        {messages.length === 0 ? (
          <p className="text-xs text-subtle text-center py-8">Inga meddelanden ännu.</p>
        ) : (
          <ul className="flex flex-col gap-2 max-w-2xl mx-auto">
            {messages.map((m) => {
              const own = m.fran_admin
              return (
                <li key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                      own
                        ? 'bg-blue-400 text-white rounded-br-sm'
                        : 'bg-elevated text-fg border border-border rounded-bl-sm'
                    }`}
                  >
                    <p>{m.innehall}</p>
                    <p className={`text-[10px] mt-1 tabular-nums ${own ? 'text-white/70' : 'text-subtle'}`}>
                      {formatTime(m.skapad_at)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {error && (
        <div className="px-6 py-2 bg-elevated border-t border-border">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-6 py-3 border-t border-border bg-sidebar shrink-0"
      >
        <textarea
          rows={1}
          className="flex-1 bg-elevated border border-border rounded-2xl px-3.5 py-2.5 text-sm text-fg outline-none resize-none placeholder:text-subtle min-h-[40px] max-h-32"
          placeholder="Skriv ett svar..."
          value={innehall}
          onChange={(e) => setInnehall(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSubmit()
            }
          }}
        />
        <button
          type="submit"
          disabled={!innehall.trim() || sending}
          className="h-10 w-10 shrink-0 rounded-full bg-blue-400 text-white flex items-center justify-center disabled:opacity-45 disabled:cursor-not-allowed"
          aria-label="Skicka"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
