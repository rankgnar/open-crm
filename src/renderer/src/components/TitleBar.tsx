import { Minus, Square, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Logo } from './Logo'
import { QuickNav } from './QuickNav'

interface TitleBarProps {
  onNavigate?: (section: string) => void
}

export function TitleBar({ onNavigate }: TitleBarProps) {
  return (
    <div className="drag flex items-center h-10 px-4 bg-sidebar border-b border-border flex-shrink-0 relative">
      <Logo className="no-drag" />
      {onNavigate && (
        <div className="no-drag absolute left-1/2 -translate-x-1/2">
          <QuickNav onNavigate={onNavigate} />
        </div>
      )}
      <div className="no-drag flex items-center gap-1 ml-auto">
        <WinButton Icon={Minus} onClick={() => window.api.invoke('window:minimize')} />
        <WinButton Icon={Square} onClick={() => window.api.invoke('window:maximize')} />
        <WinButton Icon={X} onClick={() => window.api.invoke('window:close')} danger />
      </div>
    </div>
  )
}

function WinButton({
  Icon,
  onClick,
  danger
}: {
  Icon: LucideIcon
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`no-drag p-1.5 rounded-md transition-colors ${
        danger ? 'hover:bg-red-500/20 hover:text-red-400' : 'hover:bg-hover'
      } text-muted`}
    >
      <Icon size={12} />
    </button>
  )
}
