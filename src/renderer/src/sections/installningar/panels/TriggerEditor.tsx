import { useState, useEffect } from 'react'
import { Trash2, Loader2, Check, Zap, ListOrdered } from 'lucide-react'
import type { WorkflowTrigger, WorkflowSequence, Workflow } from '../types'
import { SECCIONES } from './trigger-secciones'

type Mode = 'workflow' | 'sequence'

interface Props {
  trigger: WorkflowTrigger | null
  allWorkflows: Pick<Workflow, 'id' | 'namn'>[]
  allSequences: WorkflowSequence[]
  onSave: (data: {
    seccion: string
    etikett: string
    workflow_id: string | null
    sequence_id: string | null
  }) => Promise<void>
  onDelete?: () => Promise<void>
  onCancel: () => void
}

export function TriggerEditor({ trigger, allWorkflows, allSequences, onSave, onDelete, onCancel }: Props) {
  const [seccion, setSeccion] = useState(trigger?.seccion ?? 'projekt')
  const [etikett, setEtikett] = useState(trigger?.etikett ?? '')
  const [mode, setMode] = useState<Mode>(
    trigger?.sequence_id || trigger?.sequence_ids ? 'sequence' : 'workflow'
  )
  const [workflowId, setWorkflowId] = useState<string>(
    trigger?.workflow_id ?? allWorkflows[0]?.id ?? ''
  )
  const [sequenceId, setSequenceId] = useState<string>(
    trigger?.sequence_id ?? allSequences[0]?.id ?? ''
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setSeccion(trigger?.seccion ?? 'projekt')
    setEtikett(trigger?.etikett ?? '')
    setMode(trigger?.sequence_id || trigger?.sequence_ids ? 'sequence' : 'workflow')
    setWorkflowId(trigger?.workflow_id ?? allWorkflows[0]?.id ?? '')
    setSequenceId(trigger?.sequence_id ?? allSequences[0]?.id ?? '')
  }, [trigger?.id])

  // Auto-select first option when lists load
  useEffect(() => {
    if (!workflowId && allWorkflows[0]) setWorkflowId(allWorkflows[0].id)
  }, [allWorkflows])
  useEffect(() => {
    if (!sequenceId && allSequences[0]) setSequenceId(allSequences[0].id)
  }, [allSequences])

  const canSave = etikett.trim().length > 0 &&
    (mode === 'workflow' ? !!workflowId : !!sequenceId)

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await onSave({
        seccion,
        etikett: etikett.trim(),
        workflow_id: mode === 'workflow' ? workflowId : null,
        sequence_id: mode === 'sequence' ? sequenceId : null,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete || deleting) return
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
          <Zap size={14} className="text-amber-400" />
        </div>
        <input
          autoFocus
          value={etikett}
          onChange={e => setEtikett(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="Namn på knappen..."
          className="flex-1 bg-transparent text-sm font-semibold text-fg focus:outline-none min-w-0"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/10 border border-amber-400/30 rounded text-xs text-amber-400 hover:bg-amber-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {trigger ? 'Spara' : 'Skapa'}
          </button>
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded hover:bg-hover text-muted hover:text-red-400 transition-colors"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          )}
          <button onClick={onCancel} className="text-xs text-muted hover:text-fg transition-colors px-2">
            Avbryt
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 flex flex-col gap-6">
        {/* Sektion */}
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted mb-3">Sektion</p>
          <p className="text-xs text-subtle mb-2">Var i appen ska knappen visas?</p>
          <div className="flex flex-wrap gap-2">
            {SECCIONES.map(s => (
              <button
                key={s.value}
                onClick={() => setSeccion(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  seccion === s.value
                    ? 'bg-elevated border-fg/20 text-fg font-medium'
                    : 'border-border text-muted hover:text-fg hover:bg-hover'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode toggle */}
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted mb-3">Kör</p>
          <div className="flex gap-1 p-0.5 bg-elevated border border-border rounded-xl w-fit">
            <button
              onClick={() => setMode('workflow')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs transition-colors ${
                mode === 'workflow' ? 'bg-bg text-fg shadow-sm border border-border' : 'text-muted hover:text-fg'
              }`}
            >
              <Zap size={12} />
              Enskilt workflow
            </button>
            <button
              onClick={() => setMode('sequence')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs transition-colors ${
                mode === 'sequence' ? 'bg-bg text-fg shadow-sm border border-border' : 'text-muted hover:text-fg'
              }`}
            >
              <ListOrdered size={12} />
              Sekvens
            </button>
          </div>
        </div>

        {/* Selector */}
        {mode === 'workflow' ? (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted mb-3">Välj workflow</p>
            {allWorkflows.length === 0 ? (
              <p className="text-xs text-muted">Inga workflows tillgängliga.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-w-md">
                {allWorkflows.map(wf => (
                  <button
                    key={wf.id}
                    onClick={() => setWorkflowId(wf.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs border transition-colors text-left ${
                      workflowId === wf.id
                        ? 'bg-elevated border-fg/20 text-fg'
                        : 'border-border text-muted hover:text-fg hover:bg-hover'
                    }`}
                  >
                    <Zap size={12} className={workflowId === wf.id ? 'text-amber-400' : 'text-subtle'} />
                    <span className="flex-1 truncate">{wf.namn}</span>
                    {workflowId === wf.id && (
                      <span className="w-4 h-4 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                        <Check size={9} className="text-amber-400" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted mb-3">Välj sekvens</p>
            {allSequences.length === 0 ? (
              <p className="text-xs text-muted">Inga sekvenser tillgängliga. Skapa en i fliken Sekvenser.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-w-md">
                {allSequences.map(seq => (
                  <button
                    key={seq.id}
                    onClick={() => setSequenceId(seq.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs border transition-colors text-left ${
                      sequenceId === seq.id
                        ? 'bg-elevated border-fg/20 text-fg'
                        : 'border-border text-muted hover:text-fg hover:bg-hover'
                    }`}
                  >
                    <ListOrdered size={12} className={sequenceId === seq.id ? 'text-violet-400' : 'text-subtle'} />
                    <span className="flex-1 truncate">{seq.namn}</span>
                    <span className="text-[10px] text-subtle shrink-0">{seq.workflow_ids.length} steg</span>
                    {sequenceId === seq.id && (
                      <span className="w-4 h-4 rounded-full bg-violet-400/20 border border-violet-400/40 flex items-center justify-center shrink-0">
                        <Check size={9} className="text-violet-400" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
