import type { ReactNode } from 'react'

interface TileProps {
  title: string
  children: ReactNode
  className?: string
  onClick?: () => void
  index?: number
  pulse?: boolean
}

export function Tile({ title, children, className = '', onClick, index = 0, pulse = false }: TileProps) {
  const clickable = !!onClick
  const style = { animationDelay: `${index * 40}ms` }
  return (
    <div
      onClick={onClick}
      style={style}
      className={`ws-tile ${clickable ? 'ws-tile-clickable cursor-pointer' : ''} bg-elevated p-4 flex flex-col ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted font-sans">{title}</span>
        {pulse && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 ws-pulse-dot" />}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  )
}
