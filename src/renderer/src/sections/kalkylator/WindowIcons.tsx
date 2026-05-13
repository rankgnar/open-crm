import type { DeductionIconType } from './types'

interface Props {
  type: DeductionIconType
  size?: number
  className?: string
}

export function WindowIcon({ type, size = 24, className = '' }: Props) {
  const props = {
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  }

  switch (type) {
    case 'window-single':
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <rect x="2" y="2" width="20" height="20" rx="1.5" />
          <line x1="12" y1="2" x2="12" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="5" y1="7" x2="9" y2="7" strokeWidth={0.75} />
          <line x1="15" y1="7" x2="19" y2="7" strokeWidth={0.75} />
        </svg>
      )

    case 'window-double':
      return (
        <svg viewBox="0 0 32 24" {...props} width={size * 1.33} height={size}>
          <rect x="1" y="1" width="13" height="22" rx="1.5" />
          <line x1="7.5" y1="1" x2="7.5" y2="23" />
          <line x1="1" y1="12" x2="14" y2="12" />
          <rect x="18" y="1" width="13" height="22" rx="1.5" />
          <line x1="24.5" y1="1" x2="24.5" y2="23" />
          <line x1="18" y1="12" x2="31" y2="12" />
        </svg>
      )

    case 'door':
      return (
        <svg viewBox="0 0 20 28" {...props} width={size * 0.71} height={size}>
          <rect x="1" y="1" width="18" height="26" rx="1.5" />
          <circle cx="14.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
          <path d="M5 4 L5 24" strokeWidth={0.75} />
        </svg>
      )

    case 'door-double':
      return (
        <svg viewBox="0 0 36 28" {...props} width={size * 1.29} height={size}>
          <rect x="1" y="1" width="16" height="26" rx="1.5" />
          <circle cx="14.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
          <path d="M5 4 L5 24" strokeWidth={0.75} />
          <rect x="19" y="1" width="16" height="26" rx="1.5" />
          <circle cx="20.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
          <path d="M31 4 L31 24" strokeWidth={0.75} />
        </svg>
      )

    case 'garage':
      return (
        <svg viewBox="0 0 32 24" {...props} width={size * 1.33} height={size}>
          <rect x="1" y="1" width="30" height="22" rx="1.5" />
          <line x1="5" y1="8" x2="27" y2="8" />
          <line x1="5" y1="13" x2="27" y2="13" />
          <line x1="5" y1="18" x2="27" y2="18" />
          <circle cx="16" cy="21" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      )

    case 'triangle':
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <polygon points="12,2 22,22 2,22" />
        </svg>
      )

    case 'triangle-right':
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <polygon points="2,22 22,22 2,2" />
          <path d="M2,17 L7,17 L7,22" strokeWidth={1} />
        </svg>
      )

    case 'rectangle':
    default:
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <rect x="2" y="5" width="20" height="14" rx="1.5" />
        </svg>
      )
  }
}
