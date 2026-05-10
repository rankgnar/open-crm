import { useState, useEffect } from 'react'
import { Zap, ListOrdered } from 'lucide-react'
import type { WorkflowTrigger } from '../sections/installningar/types'
import { RunTriggerModal } from './RunTriggerModal'

interface Props {
  seccion: string
  context: Record<string, unknown>
}

export function WorkflowTriggerInline({ seccion, context }: Props) {
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>([])
  const [activeTrigger, setActiveTrigger] = useState<WorkflowTrigger | null>(null)

  useEffect(() => {
    window.api.invoke('db:workflow-triggers:list', seccion)
      .then(data => setTriggers(data as WorkflowTrigger[]))
      .catch(() => setTriggers([]))
  }, [seccion])

  if (triggers.length === 0) return null

  return (
    <>
      <div className="flex items-center gap-1.5 pl-2 border-l border-border">
        <Zap size={11} className="text-subtle shrink-0" />
        {triggers.map(trigger => {
          const isSeq = Boolean(trigger.sequence_id || trigger.sequence_ids)
          return (
            <button
              key={trigger.id}
              onClick={() => setActiveTrigger(trigger)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-elevated border border-border rounded text-xs text-muted hover:text-fg hover:border-subtle transition-colors"
            >
              {isSeq ? <ListOrdered size={11} className="shrink-0" /> : null}
              {trigger.etikett}
            </button>
          )
        })}
      </div>

      {activeTrigger && (
        <RunTriggerModal
          trigger={activeTrigger}
          seccion={seccion}
          context={context}
          mode="fresh"
          resumable={null}
          onClose={() => setActiveTrigger(null)}
        />
      )}
    </>
  )
}
