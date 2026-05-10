import type { ChatThreadSummary } from './types'

interface Props {
  threads: ChatThreadSummary[]
  selectedId: string | null
  onSelect: (personalId: string) => void
}

function initials(namn: string): string {
  return namn
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('sv-SE', { day: '2-digit', month: 'short' })
}

export function ChatList({ threads, selectedId, onSelect }: Props) {
  if (threads.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <p className="text-xs text-subtle text-center">Inga anställda</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col">
      {threads.map((t) => {
        const active = t.personal_id === selectedId
        const hasMessages = t.last_at !== null
        const previewPrefix = t.last_fran_admin ? 'Du: ' : ''
        return (
          <li key={t.personal_id}>
            <button
              onClick={() => onSelect(t.personal_id)}
              className={`w-full flex items-start gap-3 px-4 py-3 border-b border-border text-left transition-colors ${
                active ? 'bg-elevated' : 'hover:bg-hover'
              }`}
            >
              <div className="h-9 w-9 shrink-0 rounded-full bg-elevated border border-border flex items-center justify-center text-xs font-semibold text-fg">
                {initials(t.namn)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-fg truncate">{t.namn}</p>
                  {hasMessages && (
                    <span className="text-[10px] text-subtle tabular-nums shrink-0">
                      {formatTime(t.last_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-xs text-muted truncate">
                    {hasMessages ? `${previewPrefix}${t.last_innehall}` : <span className="text-subtle italic">Inga meddelanden</span>}
                  </p>
                  {t.unread_count > 0 && (
                    <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-400 text-white text-[10px] font-semibold tabular-nums">
                      {t.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
