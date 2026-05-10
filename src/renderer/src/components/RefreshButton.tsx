import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTriggerRefresh } from '@/context/RefreshContext'

interface Props {
  className?: string
  size?: number
  iconOnly?: boolean
}

export function RefreshButton({ className = '', size = 12, iconOnly = false }: Props): JSX.Element {
  const trigger = useTriggerRefresh()
  const [refreshing, setRefreshing] = useState(false)

  async function handleClick(): Promise<void> {
    setRefreshing(true)
    try {
      await trigger()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={refreshing}
      title="Uppdatera (F5)"
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-fg hover:bg-hover rounded transition-colors disabled:opacity-40 ${className}`}
    >
      <RefreshCw size={size} className={refreshing ? 'animate-spin' : ''} />
      {!iconOnly && 'Uppdatera'}
    </button>
  )
}
