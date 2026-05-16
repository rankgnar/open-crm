import { useCallback, useEffect, useState } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { RefreshButton } from '@/components/RefreshButton'
import { ChatList } from './ChatList'
import { ChatThread } from './ChatThread'
import type { ChatMessage, ChatThreadSummary } from './types'

const POLL_MS = 10000

export function ChatSection() {
  const [threads, setThreads] = useState<ChatThreadSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadThreads = useCallback(async () => {
    try {
      const data = await window.api.invoke('db:chat:list-summary') as ChatThreadSummary[]
      setThreads(data)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda chattar')
      setLoading(false)
    }
  }, [])

  const loadThread = useCallback(async (personalId: string) => {
    try {
      const data = await window.api.invoke('db:chat:list-thread', personalId) as ChatMessage[]
      setMessages(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda meddelanden')
    }
  }, [])

  useEffect(() => {
    void loadThreads()
    const id = window.setInterval(() => {
      void loadThreads()
      if (selectedId) void loadThread(selectedId)
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [loadThreads, loadThread, selectedId])

  useRefreshHandler(useCallback(async () => {
    await loadThreads()
    if (selectedId) await loadThread(selectedId)
  }, [loadThreads, loadThread, selectedId]))

  async function handleSelect(personalId: string) {
    setSelectedId(personalId)
    setMessages([])
    await loadThread(personalId)
    try {
      await window.api.invoke('db:chat:mark-read', personalId)
      setThreads((prev) =>
        prev.map((t) => (t.personal_id === personalId ? { ...t, unread_count: 0 } : t)),
      )
    } catch {
      // mark-read is non-critical
    }
  }

  async function handleSend(innehall: string) {
    if (!selectedId) return
    const created = await window.api.invoke('db:chat:send-as-admin', selectedId, innehall) as ChatMessage
    setMessages((prev) => [...prev, created])
    setThreads((prev) =>
      prev.map((t) =>
        t.personal_id === selectedId
          ? { ...t, last_at: created.skapad_at, last_innehall: created.innehall, last_fran_admin: true }
          : t,
      ),
    )
  }

  const selectedThread = threads.find((t) => t.personal_id === selectedId) ?? null

  return (
    <div className="flex h-full">
      <aside className="w-80 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="flex items-start justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Chat</p>
            <p className="text-sm font-semibold text-fg mt-0.5">Anställda</p>
          </div>
          <RefreshButton iconOnly />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-subtle text-center py-8">Laddar...</p>
          ) : error ? (
            <p className="text-xs text-red-400 text-center py-8 px-4">{error}</p>
          ) : (
            <ChatList threads={threads} selectedId={selectedId} onSelect={handleSelect} />
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {selectedThread ? (
          <ChatThread thread={selectedThread} messages={messages} onSend={handleSend} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-subtle">Välj en anställd för att se chatten</p>
          </div>
        )}
      </div>
    </div>
  )
}
