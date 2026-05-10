import { Plus, Loader2, Zap, ListOrdered } from 'lucide-react'
import type { WorkflowTrigger } from '../types'
import { SECCIONES, SECCION_COLORS } from './trigger-secciones'

interface Props {
  triggers: WorkflowTrigger[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  loading: boolean
}

export function TriggerListPanel({ triggers, selectedId, onSelect, onCreate, loading }: Props) {
  const grouped = SECCIONES.reduce<Record<string, WorkflowTrigger[]>>((acc, s) => {
    const items = triggers.filter(t => t.seccion === s.value)
    if (items.length > 0) acc[s.value] = items
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border shrink-0">
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded text-xs text-fg bg-hover hover:bg-elevated transition-colors"
        >
          <Plus size={13} />
          Ny trigger
        </button>
      </div>

      <div className="flex-1 overflow-auto py-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="text-muted animate-spin" />
          </div>
        )}

        {!loading && triggers.length === 0 && (
          <p className="px-4 py-6 text-xs text-muted text-center">Inga triggers ännu.</p>
        )}

        {Object.entries(grouped).map(([seccion, items]) => {
          const sec = SECCIONES.find(s => s.value === seccion)
          const color = SECCION_COLORS[seccion] ?? 'text-muted'
          return (
            <div key={seccion} className="mb-3">
              <p className={`px-4 mb-1 text-[10px] uppercase tracking-widest ${color}`}>
                {sec?.label ?? seccion}
              </p>
              {items.map(t => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-2 transition-colors ${
                    selectedId === t.id
                      ? 'bg-hover text-fg'
                      : 'text-muted hover:text-fg hover:bg-hover'
                  }`}
                >
                  {t.sequence_id || t.sequence_ids
                    ? <ListOrdered size={11} className="shrink-0 text-violet-400" />
                    : <Zap size={11} className="shrink-0 text-amber-400" />
                  }
                  <span className="flex-1 text-xs truncate">{t.etikett}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
