import { useState, useEffect, useRef } from 'react'
import { X, Send, Loader2, ChevronDown, ChevronRight, Bot } from 'lucide-react'
import type { AiAssistent, AiChatMessage } from '@/sections/installningar/types'
import type { ForslagFas, ForslagSubfas, ForslagArbete, ForslagMaterial, ForslagUnderentreprenor } from './types'

interface Props {
  fas: ForslagFas
  subfaser: ForslagSubfas[]
  arbeteBySubfas: Record<string, ForslagArbete[]>
  materialBySubfas: Record<string, ForslagMaterial[]>
  ueBySubfas: Record<string, ForslagUnderentreprenor[]>
  onClose: () => void
}

function buildFasContext(
  fas: ForslagFas,
  subfaser: ForslagSubfas[],
  arbeteBySubfas: Record<string, ForslagArbete[]>,
  materialBySubfas: Record<string, ForslagMaterial[]>,
  ueBySubfas: Record<string, ForslagUnderentreprenor[]>
): string {
  const lines: string[] = []
  lines.push('=== AKTUELL FAS ===')
  lines.push(`Fas: ${fas.namn}`)
  if (fas.notat) lines.push(`Notat: ${fas.notat}`)
  lines.push('')
  lines.push('=== SUBFASER ===')

  for (const sf of subfaser) {
    lines.push(`## ${sf.namn}`)
    if (sf.beskrivning) lines.push(`  Beskrivning: ${sf.beskrivning}`)

    const arbete = arbeteBySubfas[sf.id] ?? []
    if (arbete.length > 0) {
      lines.push('  Arbeten:')
      for (const a of arbete) {
        const rot = a.rot_berattigad ? ' [ROT]' : ''
        lines.push(`    - ${a.beskrivning || '—'}: ${a.antal_timmar}h × ${a.timpris}kr (${a.yrkesroll || 'okänd roll'})${rot}`)
      }
    }

    const material = materialBySubfas[sf.id] ?? []
    if (material.length > 0) {
      lines.push('  Material:')
      for (const m of material) {
        const lev = m.leverantor ? ` [${m.leverantor}]` : ''
        lines.push(`    - ${m.beskrivning || '—'}: ${m.antal} ${m.enhet || 'st'} × ${m.a_pris}kr${lev}`)
      }
    }

    const ue = ueBySubfas[sf.id] ?? []
    if (ue.length > 0) {
      lines.push('  Underentreprenörer:')
      for (const u of ue) {
        const mat = u.inkl_material ? ' [inkl. material]' : ''
        lines.push(`    - ${u.namn || '—'}: ${u.kostnad}kr${mat}`)
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}

export function FasChatPanel({ fas, subfaser, arbeteBySubfas, materialBySubfas, ueBySubfas, onClose }: Props) {
  const [assistent, setAssistent] = useState<AiAssistent | null>(null)
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [contextCollapsed, setContextCollapsed] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fasContext = useRef(buildFasContext(fas, subfaser, arbeteBySubfas, materialBySubfas, ueBySubfas))

  useEffect(() => {
    window.api.invoke('ai:asistenter:list').then((list) => {
      const found = (list as AiAssistent[]).find((a) => a.aktiv && a.uppgifter.includes('fas-revisor'))
      setAssistent(found ?? null)
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || !assistent) return
    setInput('')

    const isFirst = messages.length === 0
    const userContent = isFirst
      ? `${fasContext.current}\n\n---\n\n${text}`
      : text

    const nextMessages: AiChatMessage[] = [...messages, { role: 'user', content: userContent }]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const result = await window.api.invoke('ai:chat', {
        assistent_id: assistent.id,
        messages: nextMessages
      }) as string
      setMessages((prev) => [...prev, { role: 'assistant', content: result }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Ett fel uppstod. Försök igen.' }])
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const totalItems = subfaser.reduce((s, sf) => {
    return s + (arbeteBySubfas[sf.id]?.length ?? 0) + (materialBySubfas[sf.id]?.length ?? 0) + (ueBySubfas[sf.id]?.length ?? 0)
  }, 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full z-50 w-[480px] bg-bg border-l border-border shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0 bg-sidebar">
          <Bot size={14} className="text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-fg truncate">Revidera fas</p>
            <p className="text-[10px] text-muted truncate">{fas.namn}</p>
          </div>
          <button onClick={onClose} className="text-subtle hover:text-fg transition-colors shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Context card */}
        <div className="border-b border-border shrink-0">
          <button
            onClick={() => setContextCollapsed((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-hover transition-colors"
          >
            {contextCollapsed ? <ChevronRight size={11} className="text-subtle" /> : <ChevronDown size={11} className="text-subtle" />}
            <span className="text-[10px] uppercase tracking-widest text-muted">{subfaser.length} subfaser · {totalItems} poster</span>
          </button>
          {!contextCollapsed && (
            <div className="px-4 pb-3 max-h-48 overflow-auto">
              <pre className="text-[10px] text-subtle font-mono whitespace-pre-wrap leading-relaxed">{fasContext.current}</pre>
            </div>
          )}
        </div>

        {/* No assistant warning */}
        {!assistent && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center">
              <Bot size={24} className="text-subtle mx-auto mb-2" />
              <p className="text-sm text-muted mb-1">Ingen fas-revisor konfigurerad</p>
              <p className="text-xs text-subtle">Gå till Inställningar → Assistenter och aktivera en assistent med uppgiften <span className="text-fg font-medium">Fas-revisor</span>.</p>
            </div>
          </div>
        )}

        {/* Messages */}
        {assistent && (
          <div className="flex-1 overflow-auto px-4 py-3 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="text-center mt-8">
                <p className="text-xs text-subtle">Skriv ett meddelande för att börja granska fasen.</p>
                <p className="text-[10px] text-subtle mt-1">Kontexten för <span className="text-muted">{fas.namn}</span> skickas automatiskt med ditt första meddelande.</p>
              </div>
            )}
            {messages.map((msg, i) => {
              if (msg.role === 'user') {
                const displayContent = i === 0 && msg.content.includes('=== AKTUELL FAS ===')
                  ? msg.content.split('---\n\n').pop()?.trim() ?? msg.content
                  : msg.content
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] bg-blue-400/10 border border-blue-400/20 rounded-xl px-3 py-2">
                      <p className="text-xs text-fg whitespace-pre-wrap">{displayContent}</p>
                    </div>
                  </div>
                )
              }
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[90%] bg-elevated border border-border rounded-xl px-3 py-2">
                    <p className="text-xs text-fg whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              )
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-elevated border border-border rounded-xl px-3 py-2">
                  <Loader2 size={12} className="text-muted animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        {assistent && (
          <div className="border-t border-border px-3 py-3 shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Skriv ett meddelande… (Enter skickar)"
                rows={2}
                className="flex-1 input text-xs resize-none py-2 px-3 leading-relaxed disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-blue-400/10 border border-blue-400/30 text-blue-400 hover:bg-blue-400/20 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
