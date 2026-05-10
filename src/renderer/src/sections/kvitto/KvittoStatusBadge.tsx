import type { KvittoStatus } from './types'

interface Props {
  status: KvittoStatus
}

export function KvittoStatusBadge({ status }: Props) {
  if (status === 'hanterade') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        Hanterade
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-400">
      <span className="size-1.5 rounded-full bg-amber-400" />
      Att hantera
    </span>
  )
}
