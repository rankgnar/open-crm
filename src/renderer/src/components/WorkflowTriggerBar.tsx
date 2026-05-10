import { useState, useEffect } from 'react'
import { Zap, ListOrdered, RotateCcw, PlayCircle } from 'lucide-react'
import type { WorkflowTrigger, SequenceRun } from '../sections/installningar/types'
import { RunTriggerModal } from './RunTriggerModal'

interface Props {
  seccion: string
  context: Record<string, unknown>
  rightSlot?: React.ReactNode
  onComplete?: () => void
}

interface ActiveRun {
  trigger: WorkflowTrigger
  mode: 'fresh' | 'resume'
  resumable: SequenceRun | null
}

export function WorkflowTriggerBar({ seccion, context, rightSlot, onComplete }: Props) {
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>([])
  const [resumeBySeqId, setResumeBySeqId] = useState<Record<string, SequenceRun>>({})
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null)

  const projektId = typeof context.projekt_id === 'string' ? context.projekt_id : null

  useEffect(() => {
    window.api.invoke('db:workflow-triggers:list', seccion)
      .then(data => setTriggers(data as WorkflowTrigger[]))
  }, [seccion])

  useEffect(() => {
    let cancelled = false
    if (!projektId || triggers.length === 0) {
      setResumeBySeqId({})
      return
    }
    const seqIds = [...new Set(
      triggers.map(t => t.sequence_id).filter((id): id is string => Boolean(id))
    )]
    if (seqIds.length === 0) {
      setResumeBySeqId({})
      return
    }
    Promise.all(
      seqIds.map(async seqId => {
        try {
          const row = await window.api.invoke(
            'db:sequence-runs:find-resumable', seqId, projektId
          ) as SequenceRun | null
          return [seqId, row] as const
        } catch {
          return [seqId, null] as const
        }
      })
    ).then(pairs => {
      if (cancelled) return
      const next: Record<string, SequenceRun> = {}
      for (const [seqId, row] of pairs) if (row) next[seqId] = row
      setResumeBySeqId(next)
    })
    return () => { cancelled = true }
  }, [triggers, projektId])

  async function refreshResumable() {
    if (!projektId) return
    const seqIds = [...new Set(
      triggers.map(t => t.sequence_id).filter((id): id is string => Boolean(id))
    )]
    if (seqIds.length === 0) return
    const pairs = await Promise.all(
      seqIds.map(async seqId => {
        try {
          const row = await window.api.invoke(
            'db:sequence-runs:find-resumable', seqId, projektId
          ) as SequenceRun | null
          return [seqId, row] as const
        } catch {
          return [seqId, null] as const
        }
      })
    )
    const next: Record<string, SequenceRun> = {}
    for (const [seqId, row] of pairs) if (row) next[seqId] = row
    setResumeBySeqId(next)
  }

  function openTrigger(trigger: WorkflowTrigger, mode: 'fresh' | 'resume') {
    const resumable = trigger.sequence_id ? resumeBySeqId[trigger.sequence_id] ?? null : null
    setActiveRun({ trigger, mode, resumable })
  }

  function handleModalClose(refresh?: boolean) {
    setActiveRun(null)
    if (refresh) {
      void refreshResumable()
      onComplete?.()
    }
  }

  if (triggers.length === 0) return null

  return (
    <>
      <div className="px-8 py-3 border-b border-border shrink-0 flex items-center gap-2 flex-wrap">
        <Zap size={11} className="text-subtle shrink-0" />
        {triggers.map(trigger => {
          const isSeq = Boolean(trigger.sequence_id || trigger.sequence_ids)

          const resumable = trigger.sequence_id ? resumeBySeqId[trigger.sequence_id] : null
          const total = trigger.sequence?.workflow_ids?.length ?? trigger.sequence_ids?.length ?? 0

          if (resumable && total > 0) {
            const nextStepLabel = trigger.sequence?.workflows?.[resumable.current_step]?.namn ?? ''
            return (
              <div
                key={trigger.id}
                className="flex items-stretch border border-amber-400/40 rounded overflow-hidden"
                title={`Tidigare körning misslyckades vid steg ${resumable.current_step + 1}/${total}${nextStepLabel ? ` — ${nextStepLabel}` : ''}`}
              >
                <button
                  onClick={() => openTrigger(trigger, 'resume')}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-400/10 text-[11px] text-amber-300 hover:bg-amber-400/20 transition-colors"
                >
                  <PlayCircle size={10} className="shrink-0" />
                  {trigger.etikett} — fortsätt {resumable.current_step + 1}/{total}
                </button>
                <button
                  onClick={() => openTrigger(trigger, 'fresh')}
                  title="Starta om från steg 1"
                  className="flex items-center px-2 bg-elevated text-subtle hover:text-fg hover:bg-hover border-l border-amber-400/30 transition-colors"
                >
                  <RotateCcw size={10} />
                </button>
              </div>
            )
          }

          return (
            <button
              key={trigger.id}
              onClick={() => openTrigger(trigger, 'fresh')}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-elevated border border-border rounded text-[11px] text-muted hover:text-fg hover:border-subtle transition-colors"
            >
              {isSeq ? <ListOrdered size={10} className="shrink-0" /> : null}
              {trigger.etikett}
            </button>
          )
        })}
        {rightSlot && <div className="ml-auto">{rightSlot}</div>}
      </div>

      {activeRun && (
        <RunTriggerModal
          trigger={activeRun.trigger}
          seccion={seccion}
          context={context}
          mode={activeRun.mode}
          resumable={activeRun.resumable}
          onClose={handleModalClose}
        />
      )}
    </>
  )
}
