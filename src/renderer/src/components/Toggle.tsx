interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  indeterminate?: boolean
  disabled?: boolean
  title?: string
  size?: 'sm' | 'md'
}

const SIZES = {
  sm: { track: 'w-8 h-[18px]', thumb: 'size-3.5', off: 'translate-x-0.5', mid: 'translate-x-[9px]', on: 'translate-x-[15px]' },
  md: { track: 'w-10 h-[22px]', thumb: 'size-4', off: 'translate-x-0.5', mid: 'translate-x-[12px]', on: 'translate-x-[20px]' },
}

export function Toggle({ checked, onChange, indeterminate = false, disabled = false, title, size = 'md' }: Props) {
  const s = SIZES[size]
  const trackBg = indeterminate
    ? 'bg-amber-500/90'
    : checked
      ? 'bg-emerald-500'
      : 'bg-subtle/40'
  const trackBorder = indeterminate || checked ? 'border-transparent' : 'border-border'
  const thumbPos = indeterminate ? s.mid : checked ? s.on : s.off

  return (
    <button
      type="button"
      role="switch"
      aria-checked={indeterminate ? 'mixed' : checked}
      disabled={disabled}
      title={title}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative shrink-0 inline-flex items-center rounded-full border
        transition-colors duration-150 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg
        ${s.track} ${trackBg} ${trackBorder}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'}
      `}
    >
      <span
        className={`
          absolute top-1/2 -translate-y-1/2 ${thumbPos} ${s.thumb}
          rounded-full bg-fg shadow-[0_1px_2px_rgba(0,0,0,0.3)]
          transition-transform duration-150 ease-out
        `}
      />
    </button>
  )
}
