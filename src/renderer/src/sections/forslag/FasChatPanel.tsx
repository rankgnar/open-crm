import { useState, useEffect, useRef } from 'react'
import { X, Send, Loader2, ChevronDown, ChevronRight, Bot, Trash2, Pencil, CheckCircle, RotateCcw } from 'lucide-react'
import type { AiAssistent, AiChatMessage } from '@/sections/installningar/types'
import type { ForslagFas, ForslagSubfas, ForslagArbete, ForslagMaterial, ForslagUnderentreprenor } from './types'

interface Andring {
  typ: 'uppdatera-arbete' | 'radera-arbete' | 'uppdatera-material' | 'radera-material' | 'uppdatera-ue' | 'radera-ue'
  id: string
  falt?: string
  nytt_varde?: string | number
}

interface AiResponseJson {
  forklaring: string
  andringar: Andring[]
}

interface ChatEntry {
  id?: string
  roll: 'user' | 'assistant'
  innehall: string
  andringar?: Andring[]
  applied?: boolean
}

interface Props {
  fas: ForslagFas
  subfaser: ForslagSubfas[]
  arbeteBySubfas: Record<string, ForslagArbete[]>
  materialBySubfas: Record<string, ForslagMaterial[]>
  ueBySubfas: Record<string, ForslagUnderentreprenor[]>
  onClose: () => void
  onChangesApplied: () => void
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
  lines.push(`Fas: ${fas.namn} (ID: ${fas.id})`)
  if (fas.notat) lines.push(`Notat: ${fas.notat}`)
  lines.push('')
  lines.push('=== SUBFASER ===')

  for (const sf of subfaser) {
    lines.push(`## ${sf.namn} (ID: ${sf.id})`)
    if (sf.beskrivning) lines.push(`  Beskrivning: ${sf.beskrivning}`)

    const arbete = arbeteBySubfas[sf.id] ?? []
    if (arbete.length > 0) {
      lines.push('  Arbeten:')
      for (const a of arbete) {
        const rot = a.rot_berattigad ? ' [ROT]' : ''
        lines.push(`    - ID:${a.id} "${a.beskrivning || 'tom beskrivning'}": ${a.antal_timmar}h × ${a.timpris}kr (${a.yrkesroll || 'okänd roll'})${rot}`)
      }
    }

    const material = materialBySubfas[sf.id] ?? []
    if (material.length > 0) {
      lines.push('  Material:')
      for (const m of material) {
        const lev = m.leverantor ? ` [${m.leverantor}]` : ''
        lines.push(`    - ID:${m.id} "${m.beskrivning || 'tom beskrivning'}": ${m.antal} ${m.enhet || 'st'} × ${m.a_pris}kr${lev}`)
      }
    }

    const ue = ueBySubfas[sf.id] ?? []
    if (ue.length > 0) {
      lines.push('  Underentreprenörer:')
      for (const u of ue) {
        const mat = u.inkl_material ? ' [inkl. material]' : ''
        lines.push(`    - ID:${u.id} "${u.namn || 'okänt'}": ${u.kostnad}kr${mat}`)
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}

function parseAiResponse(raw: string): AiResponseJson | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    if (typeof parsed.forklaring === 'string' && Array.isArray(parsed.andringar)) {
      return parsed as AiResponseJson
    }
    return null
  } catch {
    return null
  }
}

function andringLabel(a: Andring, itemIndex: Record<string, string>): string {
  const name = itemIndex[a.id] ?? a.id.slice(0, 8) + '…'
  if (a.typ === 'radera-arbete' || a.typ === 'radera-material' || a.typ === 'radera-ue') {
    return `Ta bort: "${name}"`
  }
  return `Uppdatera "${name}": ${a.falt} → ${a.nytt_varde}`
}

export function FasChatPanel({ fas, subfaser, arbeteBySubfas, materialBySubfas, ueBySubfas, onClose, onChangesApplied }: Props) {
  const [assistent, setAssistent] = useState<AiAssistent | null>(null)
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState<number | null>(null)
  const [contextCollapsed, setContextCollapsed] = useState(true)
  const [clearing, setClearing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function currentContext() {
    return buildFasContext(fas, subfaser, arbeteBySubfas, materialBySubfas, ueBySubfas)
  }

  const itemIndex: Record<string, string> = {}
  for (const sfs of subfaser) {
    for (const a of arbeteBySubfas[sfs.id] ?? []) itemIndex[a.id] = a.beskrivning || 'tom beskrivning'
    for (const m of materialBySubfas[sfs.id] ?? []) itemIndex[m.id] = m.beskrivning || 'tom beskrivning'
    for (const u of ueBySubfas[sfs.id] ?? []) itemIndex[u.id] = u.namn || 'okänt'
  }

  // Load existing chat history and assistant on mount
  useEffect(() => {
    Promise.all([
      window.api.invoke('ai:asistenter:list'),
      window.api.invoke('db:forslag-fas-chat:list', fas.id)
    ]).then(([list, history]) => {
      const found = (list as AiAssistent[]).find((a) => a.aktiv && a.uppgifter.includes('fas-revisor'))
      setAssistent(found ?? null)
      const rows = history as { id: string; roll: string; innehall: string; andringar: unknown; applied: boolean }[]
      setEntries(rows.map((r) => ({
        id: r.id,
        roll: r.roll as 'user' | 'assistant',
        innehall: r.innehall,
        andringar: r.andringar ? (r.andringar as Andring[]) : undefined,
        applied: r.applied
      })))
    })
  }, [fas.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || !assistent) return
    setInput('')
    setLoading(true)

    try {
      // Save user message to DB
      const savedUser = await window.api.invoke('db:forslag-fas-chat:create', {
        fas_id: fas.id,
        roll: 'user',
        innehall: text
      }) as { id: string } | null

      const newEntries: ChatEntry[] = [...entries, { id: savedUser?.id, roll: 'user', innehall: text }]
      setEntries(newEntries)

      // Always inject current context on the first user message so AI has full phase data
      const ctx = currentContext()
      const messages: AiChatMessage[] = newEntries.map((e, i) => {
        if (e.roll === 'user' && i === 0) {
          return { role: 'user' as const, content: `${ctx}\n\n---\n\n${e.innehall}` }
        }
        return { role: e.roll as 'user' | 'assistant', content: e.innehall }
      })

      const raw = await window.api.invoke('ai:chat', {
        assistent_id: assistent.id,
        messages
      }) as string

      const parsed = parseAiResponse(raw)
      const innehall = parsed ? parsed.forklaring : raw
      const andringar = parsed && parsed.andringar.length > 0 ? parsed.andringar : undefined

      const savedAssistant = await window.api.invoke('db:forslag-fas-chat:create', {
        fas_id: fas.id,
        roll: 'assistant',
        innehall,
        andringar: andringar ?? null
      }) as { id: string } | null

      setEntries((prev) => [...prev, { id: savedAssistant?.id, roll: 'assistant', innehall, andringar }])
    } catch (err) {
      setEntries((prev) => [...prev, { roll: 'assistant', innehall: `Fel: ${err instanceof Error ? err.message : 'Okänt fel. Försök igen.'}` }])
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  async function handleApply(entryIndex: number, entry: ChatEntry, andringar: Andring[]) {
    setApplying(entryIndex)
    try {
      for (const a of andringar) {
        if (a.typ === 'radera-arbete') {
          await window.api.invoke('db:forslag-arbete:delete', a.id)
        } else if (a.typ === 'uppdatera-arbete' && a.falt) {
          await window.api.invoke('db:forslag-arbete:update', a.id, { [a.falt]: a.nytt_varde })
        } else if (a.typ === 'radera-material') {
          await window.api.invoke('db:forslag-material:delete', a.id)
        } else if (a.typ === 'uppdatera-material' && a.falt) {
          await window.api.invoke('db:forslag-material:update', a.id, { [a.falt]: a.nytt_varde })
        } else if (a.typ === 'radera-ue') {
          await window.api.invoke('db:forslag-ue:delete', a.id)
        } else if (a.typ === 'uppdatera-ue' && a.falt) {
          await window.api.invoke('db:forslag-ue:update', a.id, { [a.falt]: a.nytt_varde })
        }
      }
      if (entry.id) await window.api.invoke('db:forslag-fas-chat:mark-applied', entry.id)
      setEntries((prev) => prev.map((e, i) => i === entryIndex ? { ...e, applied: true } : e))
      onChangesApplied()
    } catch (err) {
      setEntries((prev) => [...prev, { roll: 'assistant', innehall: `Fel vid tillämpning: ${err instanceof Error ? err.message : String(err)}` }])
    } finally {
      setApplying(null)
    }
  }

  async function handleClear() {
    setClearing(true)
    await window.api.invoke('db:forslag-fas-chat:clear', fas.id)
    setEntries([])
    setClearing(false)
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
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full z-50 w-[500px] bg-bg border-l border-border shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0 bg-sidebar">
          <Bot size={14} className="text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-fg truncate">Fas-revisor</p>
            <p className="text-[10px] text-muted truncate">{fas.namn}</p>
          </div>
          {entries.length > 0 && (
            <button
              onClick={handleClear}
              disabled={clearing}
              title="Rensa chatthistorik"
              className="text-subtle hover:text-red-400 transition-colors shrink-0"
            >
              <RotateCcw size={12} />
            </button>
          )}
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
              <pre className="text-[10px] text-subtle font-mono whitespace-pre-wrap leading-relaxed">{currentContext()}</pre>
            </div>
          )}
        </div>

        {/* No assistant */}
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
            {entries.length === 0 && (
              <div className="text-center mt-8 px-4">
                <Bot size={20} className="text-subtle mx-auto mb-2" />
                <p className="text-xs text-muted mb-1">Beskriv vad du vill granska eller åtgärda</p>
                <p className="text-[10px] text-subtle">Exempel: "Granska alla arbeten och ta bort onödiga poster" eller "Justera materialmängderna"</p>
              </div>
            )}

            {entries.map((entry, i) => {
              if (entry.roll === 'user') {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] bg-blue-400/10 border border-blue-400/20 rounded-xl px-3 py-2">
                      <p className="text-xs text-fg whitespace-pre-wrap">{entry.innehall}</p>
                    </div>
                  </div>
                )
              }

              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="max-w-[92%] bg-elevated border border-border rounded-xl px-3 py-2">
                    <p className="text-xs text-fg whitespace-pre-wrap leading-relaxed">{entry.innehall}</p>
                  </div>

                  {entry.andringar && entry.andringar.length > 0 && (
                    <div className="max-w-[92%] border border-border rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-sidebar border-b border-border flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-widest text-muted">{entry.andringar.length} föreslagna ändringar</span>
                        {entry.applied && (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                            <CheckCircle size={10} />
                            Tillämpade
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2 flex flex-col gap-1">
                        {entry.andringar.map((a, j) => {
                          const isDelete = a.typ.startsWith('radera')
                          return (
                            <div key={j} className="flex items-start gap-2 text-[11px]">
                              {isDelete
                                ? <Trash2 size={10} className="text-red-400 shrink-0 mt-0.5" />
                                : <Pencil size={10} className="text-amber-400 shrink-0 mt-0.5" />
                              }
                              <span className={`${isDelete ? 'text-muted' : 'text-fg'} leading-tight`}>
                                {andringLabel(a, itemIndex)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      {!entry.applied && (
                        <div className="px-3 py-2 border-t border-border">
                          <button
                            onClick={() => handleApply(i, entry, entry.andringar!)}
                            disabled={applying !== null}
                            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-fg bg-hover hover:bg-hover/80 border border-border rounded-lg py-1.5 transition-colors disabled:opacity-40"
                          >
                            {applying === i
                              ? <><Loader2 size={11} className="animate-spin" />Tillämpar…</>
                              : <>Tillämpa {entry.andringar.length} ändringar</>
                            }
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
                placeholder="Beskriv vad du vill ändra… (Enter skickar)"
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
