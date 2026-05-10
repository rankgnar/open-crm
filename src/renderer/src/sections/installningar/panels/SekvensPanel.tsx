import { Plus, Loader2, ListOrdered } from 'lucide-react'
import type { WorkflowSequence } from '../types'

interface Props {
  sequences: WorkflowSequence[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  loading: boolean
}

export function SekvensPanel({ sequences, selectedId, onSelect, onCreate, loading }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border shrink-0">
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded text-xs text-fg bg-hover hover:bg-elevated transition-colors"
        >
          <Plus size={13} />
          Ny sekvens
        </button>
      </div>

      <div className="flex-1 overflow-auto py-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="text-muted animate-spin" />
          </div>
        )}

        {!loading && sequences.length === 0 && (
          <p className="px-4 py-6 text-xs text-muted text-center">Inga sekvenser ännu.</p>
        )}

        {sequences.map(seq => (
          <button
            key={seq.id}
            onClick={() => onSelect(seq.id)}
            className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-colors ${
              selectedId === seq.id
                ? 'bg-hover text-fg'
                : 'text-muted hover:text-fg hover:bg-hover'
            }`}
          >
            <ListOrdered size={13} className="shrink-0 text-violet-400" />
            <span className="flex-1 text-xs truncate">{seq.namn}</span>
            <span className="text-[10px] text-subtle shrink-0">{seq.workflow_ids.length} steg</span>
          </button>
        ))}
      </div>
    </div>
  )
}
