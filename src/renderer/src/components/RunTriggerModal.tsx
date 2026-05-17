import { useState, useEffect, useRef, useMemo } from 'react'
import {
  X, Play, Loader2, CheckCircle2, XCircle, Clock, PlayCircle, ListOrdered, FileText, ChevronDown,
} from 'lucide-react'
import type {
  WorkflowTrigger,
  WorkflowNode,
  WorkflowRunResult,
  WorkflowProgressEvent,
  WorkflowNodeResult,
  SequenceRun,
} from '../sections/installningar/types'
import { requiredInputsFor } from '../sections/installningar/panels/trigger-secciones'

interface ProjektOption {
  id: string
  namn: string
  projekt_nummer: string
  kunder?: { namn: string } | null
}

interface KundOption {
  id: string
  namn: string
  kundnummer: string
}

interface ForslagOption {
  id: string
  titel: string | null
  forslag_nummer: string
  projekt_id: string
  projekt?: { namn: string; projekt_nummer: string } | null
}

interface FasMallOption {
  id: string
  namn: string
  beskrivning?: string | null
}

interface Props {
  trigger: WorkflowTrigger
  seccion: string
  context: Record<string, unknown>
  mode: 'fresh' | 'resume'
  resumable?: SequenceRun | null
  onClose: (refresh?: boolean) => void
}

type Phase = 'confirm' | 'running' | 'done'

interface SeqStep {
  workflowId: string
  workflowNamn: string
  status: 'väntar' | 'kör' | 'klar' | 'fel'
  nodesDone: number
  errorMsg?: string
}

export function RunTriggerModal({ trigger, seccion, context, mode, resumable, onClose }: Props) {
  const isSequence = Boolean(trigger.sequence_id || trigger.sequence_ids)
  const sectionInputs = requiredInputsFor(seccion)
  const triggerExtraInputs = (trigger.trigger_inputs ?? []) as string[]
  const requiredInputs = [...new Set([...sectionInputs, ...triggerExtraInputs])] as import('../sections/installningar/panels/trigger-secciones').RequiredInput[]
  const inputsNeedingPicker = requiredInputs.filter(k => !context[k])

  const seqWorkflows = useMemo(() => {
    if (trigger.sequence?.workflows && trigger.sequence.workflows.length > 0) return trigger.sequence.workflows
    return trigger.sequence_workflows ?? []
  }, [trigger])
  const seqIds = useMemo(() => {
    if (trigger.sequence?.workflow_ids && trigger.sequence.workflow_ids.length > 0) return trigger.sequence.workflow_ids
    return trigger.sequence_ids ?? []
  }, [trigger])

  const workflowNodes = useMemo(() => {
    const nodes = trigger.workflow?.definition?.nodes ?? []
    return [...nodes].sort((a, b) => a.position - b.position)
  }, [trigger])

  const [phase, setPhase] = useState<Phase>('confirm')
  const [pickedInputs, setPickedInputs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const k of requiredInputs) {
      const v = context[k]
      if (typeof v === 'string') init[k] = v
    }
    return init
  })

  const [projekter, setProjekter] = useState<ProjektOption[] | null>(null)
  const [kunder, setKunder] = useState<KundOption[] | null>(null)
  const [forslagList, setForslagList] = useState<ForslagOption[] | null>(null)
  const [fasMallar, setFasMallar] = useState<FasMallOption[] | null>(null)

  const [nodeStatuses, setNodeStatuses] = useState<Record<string, WorkflowNodeResult>>({})
  const initialStartAt = mode === 'resume' && resumable ? resumable.current_step : 0

  const [seqSteps, setSeqSteps] = useState<SeqStep[]>(() =>
    seqIds.map((id, i) => {
      const wf = seqWorkflows.find(w => w.id === id)
      return {
        workflowId: id,
        workflowNamn: wf?.namn ?? `Workflow ${id.slice(0, 6)}`,
        status: i < initialStartAt ? 'klar' : 'väntar',
        nodesDone: 0,
      }
    })
  )
  const [activeSeqIndex, setActiveSeqIndex] = useState<number>(mode === 'resume' && resumable ? resumable.current_step : 0)

  const [resultSuccess, setResultSuccess] = useState<boolean | null>(null)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  const runIdRef = useRef('')
  const seqIndexRef = useRef(activeSeqIndex)

  useEffect(() => { seqIndexRef.current = activeSeqIndex }, [activeSeqIndex])

  useEffect(() => {
    if (phase !== 'confirm') return
    if (inputsNeedingPicker.includes('projekt_id') && projekter === null) {
      window.api.invoke('db:projekt:list')
        .then(d => setProjekter(d as ProjektOption[]))
        .catch(() => setProjekter([]))
    }
    if (inputsNeedingPicker.includes('kund_id') && kunder === null) {
      window.api.invoke('db:kunder:list')
        .then(d => setKunder(d as KundOption[]))
        .catch(() => setKunder([]))
    }
    if (inputsNeedingPicker.includes('forslag_id') && forslagList === null) {
      window.api.invoke('db:forslag:list')
        .then(d => setForslagList(d as ForslagOption[]))
        .catch(() => setForslagList([]))
    }
    if (inputsNeedingPicker.includes('fas_mall_id') && fasMallar === null) {
      window.api.invoke('db:fas-mallar:list')
        .then(d => setFasMallar(d as FasMallOption[]))
        .catch(() => setFasMallar([]))
    }
  }, [phase, requiredInputs, projekter, kunder, forslagList, fasMallar])

  useEffect(() => {
    if (phase !== 'running') return
    function handler(...args: unknown[]) {
      const ev = args[0] as WorkflowProgressEvent
      if (!runIdRef.current) runIdRef.current = ev.run_id
      if (ev.run_id !== runIdRef.current) return

      setNodeStatuses(prev => ({
        ...prev,
        [ev.node_id]: {
          status: ev.status,
          output: ev.output ?? null,
          error: ev.error ?? null,
          duration_ms: 0,
        },
      }))

      if (isSequence && ev.status === 'klar') {
        const idx = seqIndexRef.current
        setSeqSteps(prev => {
          const next = [...prev]
          if (next[idx]) next[idx] = { ...next[idx], nodesDone: next[idx].nodesDone + 1 }
          return next
        })
      }
    }
    window.api.on('workflow:progress', handler)
    return () => window.api.off('workflow:progress', handler)
  }, [phase, isSequence])

  const allInputsReady = requiredInputs.every(k => Boolean(pickedInputs[k]))

  function buildRunInput(): Record<string, unknown> {
    return { ...context, ...pickedInputs }
  }

  function projektIdForCheckpoint(): string | null {
    const v = pickedInputs.projekt_id ?? context.projekt_id
    return typeof v === 'string' ? v : null
  }

  async function startRun() {
    if (!allInputsReady) return
    setPhase('running')
    setNodeStatuses({})
    setResultSuccess(null)
    setResultMsg(null)
    runIdRef.current = ''

    try {
      if (isSequence) {
        await runSequenceFlow()
      } else if (trigger.workflow_id) {
        await runWorkflowFlow(trigger.workflow_id)
      }
    } catch (err) {
      setResultSuccess(false)
      setResultMsg(err instanceof Error ? err.message : 'Okänt fel')
      setPhase('done')
    }
  }

  async function runWorkflowFlow(workflowId: string) {
    const result = await window.api.invoke('workflow:run', {
      workflow_id: workflowId,
      input: buildRunInput(),
      trigger_type: 'trigger',
    }) as WorkflowRunResult
    setResultSuccess(result.status === 'klar')
    setResultMsg(result.status === 'klar' ? null : (result.error_msg ?? 'Okänt fel'))
    setPhase('done')
  }

  async function runSequenceFlow() {
    const startAt = mode === 'resume' && resumable ? resumable.current_step : 0
    const workflowIds = mode === 'resume' && resumable && resumable.workflow_ids.length > 0
      ? resumable.workflow_ids
      : seqIds
    let runInput: Record<string, unknown> = mode === 'resume' && resumable
      ? { ...resumable.collected_input }
      : buildRunInput()

    let sequenceRunId: string | null = mode === 'resume' && resumable ? resumable.id : null
    const projektId = projektIdForCheckpoint()
    if (!sequenceRunId && trigger.sequence_id && projektId) {
      try {
        if (resumable) {
          await window.api.invoke('db:sequence-runs:cancel', resumable.id).catch(() => {})
        }
        const row = await window.api.invoke('db:sequence-runs:start', {
          sequence_id: trigger.sequence_id,
          trigger_id: trigger.id,
          projekt_id: projektId,
          workflow_ids: workflowIds,
          initial_input: runInput,
        }) as SequenceRun
        sequenceRunId = row.id
      } catch {
        sequenceRunId = null
      }
    }

    let lastResult: WorkflowRunResult | null = null
    let failedIndex: number | null = null

    for (let i = startAt; i < workflowIds.length; i++) {
      setActiveSeqIndex(i)
      seqIndexRef.current = i
      setSeqSteps(prev => {
        const next = [...prev]
        if (next[i]) next[i] = { ...next[i], status: 'kör', nodesDone: 0 }
        return next
      })
      runIdRef.current = ''

      const result = await window.api.invoke('workflow:run', {
        workflow_id: workflowIds[i],
        input: runInput,
        trigger_type: 'trigger',
      }) as WorkflowRunResult
      lastResult = result

      if (result.status === 'fel') {
        failedIndex = i
        setSeqSteps(prev => {
          const next = [...prev]
          if (next[i]) next[i] = { ...next[i], status: 'fel', errorMsg: result.error_msg ?? undefined }
          return next
        })
        break
      }

      setSeqSteps(prev => {
        const next = [...prev]
        if (next[i]) next[i] = { ...next[i], status: 'klar' }
        return next
      })
      if (result.output) runInput = { ...runInput, ...result.output }

      if (sequenceRunId) {
        try {
          await window.api.invoke('db:sequence-runs:advance', {
            id: sequenceRunId,
            next_step: i + 1,
            workflow_run_id: result.run_id,
            collected_input: runInput,
          })
        } catch {
          // Non-fatal: chain itself succeeded.
        }
      }
    }

    const success = lastResult?.status === 'klar' && failedIndex === null

    if (sequenceRunId) {
      try {
        await window.api.invoke('db:sequence-runs:finish', {
          id: sequenceRunId,
          status: success ? 'klar' : 'fel',
          error_step: success ? null : failedIndex,
          error_msg: success ? null : (lastResult?.error_msg ?? null),
        })
      } catch {
        // Silent: UI is the source of truth this turn.
      }
    }

    setResultSuccess(success)
    if (!success) {
      const failedName = failedIndex !== null ? seqSteps[failedIndex]?.workflowNamn : null
      setResultMsg(failedName ? `${failedName}: ${lastResult?.error_msg ?? 'okänt fel'}` : (lastResult?.error_msg ?? 'Okänt fel'))
    }
    setPhase('done')
  }

  function canCloseNow() {
    return phase !== 'running'
  }

  function handleClose() {
    if (!canCloseNow()) return
    onClose(phase === 'done')
  }

  const totalSteps = isSequence ? seqIds.length : workflowNodes.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-elevated border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">

        <div className="flex items-start gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="shrink-0 mt-0.5 text-blue-400">
            {isSequence ? <ListOrdered size={16} /> : <FileText size={16} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-subtle">
              {isSequence ? 'Sekvens' : 'Workflow'} · {totalSteps} {isSequence ? 'steg' : 'noder'}
            </p>
            <p className="text-sm font-semibold text-fg truncate">{trigger.etikett}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={!canCloseNow()}
            className="p-1 rounded hover:bg-hover text-subtle hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-4">

          {phase === 'confirm' && (
            <>
              {inputsNeedingPicker.length > 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted">Kör på</p>
                  {inputsNeedingPicker.includes('projekt_id') && (
                    <ProjektPicker
                      value={pickedInputs.projekt_id ?? ''}
                      onChange={(id) => setPickedInputs(prev => ({ ...prev, projekt_id: id }))}
                      options={projekter}
                    />
                  )}
                  {inputsNeedingPicker.includes('kund_id') && (
                    <KundPicker
                      value={pickedInputs.kund_id ?? ''}
                      onChange={(id) => setPickedInputs(prev => ({ ...prev, kund_id: id }))}
                      options={kunder}
                    />
                  )}
                  {inputsNeedingPicker.includes('forslag_id') && (
                    <ForslagPicker
                      value={pickedInputs.forslag_id ?? ''}
                      onChange={(id) => setPickedInputs(prev => ({ ...prev, forslag_id: id }))}
                      options={forslagList}
                    />
                  )}
                  {inputsNeedingPicker.includes('fas_mall_id') && (
                    <FasMallPicker
                      value={pickedInputs.fas_mall_id ?? ''}
                      onChange={(id) => setPickedInputs(prev => ({ ...prev, fas_mall_id: id }))}
                      options={fasMallar}
                    />
                  )}
                </div>
              )}

              {requiredInputs.length === 0 && (
                <p className="text-xs text-muted">
                  Detta {isSequence ? 'sekvens' : 'workflow'} kräver ingen specifik post.
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] uppercase tracking-widest text-muted">
                  {isSequence ? 'Steg som körs' : 'Noder som körs'}
                </p>
                <div className="flex flex-col gap-1">
                  {isSequence
                    ? seqSteps.map((s, i) => (
                      <div key={s.workflowId} className="flex items-center gap-2 text-xs text-muted px-2.5 py-1.5 rounded border border-border/50">
                        <span className="text-subtle font-mono w-5 text-right">{i + 1}.</span>
                        <span className="flex-1 truncate">{s.workflowNamn}</span>
                      </div>
                    ))
                    : workflowNodes.map((n, i) => (
                      <div key={n.id} className="flex items-center gap-2 text-xs text-muted px-2.5 py-1.5 rounded border border-border/50">
                        <span className="text-subtle font-mono w-5 text-right">{i + 1}.</span>
                        <span className="flex-1 truncate">{n.label}</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              {mode === 'resume' && resumable && (
                <div className="text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded px-3 py-2">
                  Återupptar från steg {resumable.current_step + 1}/{seqIds.length}.
                  {resumable.error_msg && <span className="block mt-1 text-amber-200/80">{resumable.error_msg}</span>}
                </div>
              )}
            </>
          )}

          {(phase === 'running' || phase === 'done') && (
            <div className="flex flex-col gap-1">
              {isSequence
                ? seqSteps.map((s, i) => (
                  <SequenceStepRow
                    key={s.workflowId}
                    step={s}
                    index={i}
                    isActive={phase === 'running' && i === activeSeqIndex}
                  />
                ))
                : workflowNodes.map((n) => (
                  <NodeRow key={n.id} node={n} state={nodeStatuses[n.id]} />
                ))
              }
            </div>
          )}

          {phase === 'done' && resultSuccess && (
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <p className="text-sm text-fg">Klart</p>
            </div>
          )}

          {phase === 'done' && resultSuccess === false && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <XCircle size={18} className="text-red-400 shrink-0" />
                <p className="text-sm font-medium text-fg">Misslyckades</p>
              </div>
              {resultMsg && (
                <p className="text-[11px] text-red-300/90 break-words">{resultMsg}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          {phase === 'confirm' && (
            <>
              <button
                onClick={handleClose}
                className="px-3 py-1.5 text-xs text-muted hover:text-fg transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={startRun}
                disabled={!allInputsReady}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-400/10 border border-blue-400/40 text-blue-300 hover:bg-blue-400/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {mode === 'resume' ? <PlayCircle size={12} /> : <Play size={12} />}
                {mode === 'resume' ? 'Fortsätt' : 'Kör'}
              </button>
            </>
          )}
          {phase === 'running' && (
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <Loader2 size={12} className="animate-spin text-blue-400" />
              Kör...
            </div>
          )}
          {phase === 'done' && (
            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-xs text-muted hover:text-fg transition-colors"
            >
              Stäng
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function NodeRow({ node, state }: { node: WorkflowNode; state?: WorkflowNodeResult }) {
  const status = state?.status ?? 'väntar'
  const isActive = status === 'kör'
  const isDone = status === 'klar'
  const isFailed = status === 'fel'
  return (
    <div className={`rounded-lg border px-3 py-2 transition-all duration-200 ${
      isActive ? 'border-blue-400/40 bg-blue-400/5' :
      isDone   ? 'border-emerald-400/20 bg-emerald-400/[0.03]' :
      isFailed ? 'border-red-400/40 bg-red-400/5' :
      'border-border/40 opacity-50'
    }`}>
      <div className="flex items-center gap-2.5">
        <span className={`shrink-0 ${
          isActive ? 'text-blue-400' :
          isDone   ? 'text-emerald-400' :
          isFailed ? 'text-red-400' :
          'text-subtle'
        }`}>
          {isActive  ? <Loader2 size={12} className="animate-spin" /> :
           isDone    ? <CheckCircle2 size={12} /> :
           isFailed  ? <XCircle size={12} /> :
           <Clock size={12} />}
        </span>
        <p className={`flex-1 text-xs font-medium truncate ${state ? 'text-fg' : 'text-subtle'}`}>
          {node.label}
        </p>
      </div>
      {isFailed && state?.error && (
        <p className="mt-1.5 text-[11px] text-red-300 pl-5">{state.error}</p>
      )}
    </div>
  )
}

function SequenceStepRow({ step, index, isActive }: { step: SeqStep; index: number; isActive: boolean }) {
  const isDone = step.status === 'klar'
  const isFailed = step.status === 'fel'
  return (
    <div className={`rounded-lg border px-3 py-2 transition-all duration-200 ${
      isActive   ? 'border-blue-400/40 bg-blue-400/5' :
      isDone     ? 'border-emerald-400/20 bg-emerald-400/[0.03]' :
      isFailed   ? 'border-red-400/40 bg-red-400/5' :
      'border-border/40 opacity-50'
    }`}>
      <div className="flex items-center gap-2.5">
        <span className="text-subtle font-mono text-[10px] w-5 text-right shrink-0">{index + 1}.</span>
        <span className={`shrink-0 ${
          isActive ? 'text-blue-400' :
          isDone   ? 'text-emerald-400' :
          isFailed ? 'text-red-400' :
          'text-subtle'
        }`}>
          {isActive  ? <Loader2 size={12} className="animate-spin" /> :
           isDone    ? <CheckCircle2 size={12} /> :
           isFailed  ? <XCircle size={12} /> :
           <Clock size={12} />}
        </span>
        <p className={`flex-1 text-xs font-medium truncate ${step.status === 'väntar' ? 'text-subtle' : 'text-fg'}`}>
          {step.workflowNamn}
        </p>
        {isActive && step.nodesDone > 0 && (
          <span className="text-[10px] text-muted shrink-0">{step.nodesDone} klara</span>
        )}
      </div>
      {isFailed && step.errorMsg && (
        <p className="mt-1.5 text-[11px] text-red-300 pl-7 break-words">{step.errorMsg}</p>
      )}
    </div>
  )
}

function ProjektPicker({ value, onChange, options }: { value: string; onChange: (id: string) => void; options: ProjektOption[] | null }) {
  return (
    <PickerCombobox
      label="Projekt"
      value={value}
      onChange={onChange}
      options={options}
      renderItem={(p) => (
        <>
          <span className="text-subtle font-mono">{p.projekt_nummer}</span>
          <span className="text-fg ml-2">{p.namn}</span>
          {p.kunder?.namn && <span className="text-muted ml-2 uppercase">· {p.kunder.namn}</span>}
        </>
      )}
      itemSearch={(p, q) => `${p.projekt_nummer} ${p.namn} ${p.kunder?.namn ?? ''}`.toLowerCase().includes(q)}
      itemSummary={(p) => `${p.projekt_nummer} — ${p.namn}`}
    />
  )
}

function KundPicker({ value, onChange, options }: { value: string; onChange: (id: string) => void; options: KundOption[] | null }) {
  return (
    <PickerCombobox
      label="Kund"
      value={value}
      onChange={onChange}
      options={options}
      renderItem={(k) => (
        <>
          <span className="text-subtle font-mono">{k.kundnummer}</span>
          <span className="text-fg ml-2">{k.namn}</span>
        </>
      )}
      itemSearch={(k, q) => `${k.kundnummer} ${k.namn}`.toLowerCase().includes(q)}
      itemSummary={(k) => `${k.kundnummer} — ${k.namn}`}
    />
  )
}

function ForslagPicker({ value, onChange, options }: { value: string; onChange: (id: string) => void; options: ForslagOption[] | null }) {
  return (
    <PickerCombobox
      label="Förslag"
      value={value}
      onChange={onChange}
      options={options}
      renderItem={(f) => (
        <>
          <span className="text-subtle font-mono">{f.forslag_nummer}</span>
          <span className="text-fg ml-2">{f.titel ?? '(utan titel)'}</span>
          {f.projekt && <span className="text-muted ml-2">· {f.projekt.projekt_nummer}</span>}
        </>
      )}
      itemSearch={(f, q) => `${f.forslag_nummer} ${f.titel ?? ''} ${f.projekt?.projekt_nummer ?? ''}`.toLowerCase().includes(q)}
      itemSummary={(f) => `${f.forslag_nummer}${f.titel ? ` — ${f.titel}` : ''}`}
    />
  )
}

function FasMallPicker({ value, onChange, options }: { value: string; onChange: (id: string) => void; options: FasMallOption[] | null }) {
  return (
    <PickerCombobox
      label="Fas-mall"
      value={value}
      onChange={onChange}
      options={options}
      renderItem={(m) => (
        <>
          <span className="text-fg">{m.namn}</span>
          {m.beskrivning && <span className="text-muted ml-2 truncate">· {m.beskrivning}</span>}
        </>
      )}
      itemSearch={(m, q) => `${m.namn} ${m.beskrivning ?? ''}`.toLowerCase().includes(q)}
      itemSummary={(m) => m.namn}
    />
  )
}

interface PickerProps<T extends { id: string }> {
  label: string
  value: string
  onChange: (id: string) => void
  options: T[] | null
  renderItem: (item: T) => React.ReactNode
  itemSearch: (item: T, q: string) => boolean
  itemSummary: (item: T) => string
}

function PickerCombobox<T extends { id: string }>({
  label, value, onChange, options, renderItem, itemSearch, itemSummary,
}: PickerProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const selected = options?.find(o => o.id === value) ?? null
  const filtered = options
    ? (query.trim() ? options.filter(o => itemSearch(o, query.trim().toLowerCase())) : options).slice(0, 80)
    : []

  return (
    <div ref={containerRef} className="relative">
      <p className="text-[11px] text-muted mb-1">{label}</p>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-bg/50 border border-border rounded text-xs text-fg hover:border-subtle transition-colors"
      >
        <span className="flex-1 text-left truncate">
          {selected ? itemSummary(selected) : <span className="text-subtle">Välj {label.toLowerCase()}...</span>}
        </span>
        <ChevronDown size={12} className="text-subtle shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-elevated border border-border rounded-lg shadow-lg z-10 overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Sök ${label.toLowerCase()}...`}
              className="w-full px-2 py-1.5 bg-bg/50 border border-border rounded text-xs text-fg placeholder-subtle focus:outline-none focus:border-blue-400/40"
            />
          </div>
          <div className="max-h-64 overflow-auto py-1">
            {options === null && (
              <p className="px-3 py-2 text-[11px] text-muted">Laddar...</p>
            )}
            {options && filtered.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-muted">Inga träffar</p>
            )}
            {filtered.map((o) => (
              <button
                key={o.id}
                onClick={() => { onChange(o.id); setOpen(false); setQuery('') }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-hover transition-colors ${o.id === value ? 'bg-blue-400/5' : ''}`}
              >
                {renderItem(o)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
