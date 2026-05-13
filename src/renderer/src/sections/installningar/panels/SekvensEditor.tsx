import { useState, useEffect, useRef } from 'react'
import { Trash2, Loader2, Check, ListOrdered, Play, CheckCircle2, XCircle, X, ChevronDown } from 'lucide-react'
import type { WorkflowSequence, Workflow, WorkflowRunResult } from '../types'

interface Props {
  sequence: WorkflowSequence | null
  allWorkflows: Pick<Workflow, 'id' | 'namn'>[]
  onSave: (data: { namn: string; beskrivning: string; workflow_ids: string[] }) => Promise<void>
  onDelete?: () => Promise<void>
  onCancel: () => void
}

type RunState =
  | { kind: 'idle' }
  | { kind: 'running'; done: number; total: number; currentLabel: string }
  | { kind: 'done'; success: boolean; errorMsg?: string }

interface ProjektOption {
  id: string
  namn: string
  projekt_nummer: string
  kunder: { namn: string } | null
}

export function SekvensEditor({ sequence, allWorkflows, onSave, onDelete, onCancel }: Props) {
  const [namn, setNamn] = useState(sequence?.namn ?? '')
  const [beskrivning, setBeskrivning] = useState(sequence?.beskrivning ?? '')
  const [selectedIds, setSelectedIds] = useState<string[]>(sequence?.workflow_ids ?? [])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [runState, setRunState] = useState<RunState>({ kind: 'idle' })
  const [projekter, setProjekter] = useState<ProjektOption[]>([])
  const [runMenuOpen, setRunMenuOpen] = useState(false)
  const namnRef = useRef<HTMLInputElement>(null)
  const runMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setNamn(sequence?.namn ?? '')
    setBeskrivning(sequence?.beskrivning ?? '')
    setSelectedIds(sequence?.workflow_ids ?? [])
    setRunState({ kind: 'idle' })
    setRunMenuOpen(false)
    setTimeout(() => namnRef.current?.focus(), 50)
  }, [sequence?.id])

  useEffect(() => {
    window.api.invoke('db:projekt:list')
      .then(data => setProjekter(data as ProjektOption[]))
      .catch(() => setProjekter([]))
  }, [])

  useEffect(() => {
    if (!runMenuOpen) return
    function onClick(e: MouseEvent) {
      if (runMenuRef.current && !runMenuRef.current.contains(e.target as Node)) {
        setRunMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [runMenuOpen])

  function toggle(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (!namn.trim() || selectedIds.length < 1 || saving) return
    setSaving(true)
    try {
      await onSave({ namn: namn.trim(), beskrivning, workflow_ids: selectedIds })
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

  async function handleRun(projektId: string | null) {
    if (selectedIds.length === 0 || runState.kind === 'running') return
    setRunMenuOpen(false)
    const wfMap = new Map(allWorkflows.map(w => [w.id, w]))
    setRunState({
      kind: 'running',
      done: 0,
      total: selectedIds.length,
      currentLabel: wfMap.get(selectedIds[0])?.namn ?? ''
    })
    let runInput: Record<string, unknown> = projektId ? { projekt_id: projektId } : {}
    let lastResult: WorkflowRunResult | null = null
    try {
      for (let i = 0; i < selectedIds.length; i++) {
        const result = await window.api.invoke('workflow:run', {
          workflow_id: selectedIds[i],
          input: runInput,
          trigger_type: 'manual'
        }) as WorkflowRunResult
        lastResult = result
        if (result.status === 'fel') break
        if (result.output) runInput = { ...runInput, ...result.output }
        const next = wfMap.get(selectedIds[i + 1] ?? '')
        setRunState(prev =>
          prev.kind === 'running'
            ? { ...prev, done: i + 1, currentLabel: next?.namn ?? '' }
            : prev
        )
      }
      setRunState({
        kind: 'done',
        success: lastResult?.status === 'klar',
        errorMsg: lastResult?.error_msg ?? undefined
      })
    } catch (err) {
      setRunState({
        kind: 'done',
        success: false,
        errorMsg: err instanceof Error ? err.message : 'Okänt fel'
      })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-lg bg-violet-400/10 border border-violet-400/20 flex items-center justify-center shrink-0">
          <ListOrdered size={14} className="text-violet-400" />
        </div>
        <input
          ref={namnRef}
          value={namn}
          onChange={e => setNamn(e.target.value)}
          placeholder="Namn på sekvensen..."
          className="flex-1 bg-transparent text-sm font-semibold text-fg focus:outline-none min-w-0"
        />
        <div className="flex items-center gap-2 shrink-0">
          {sequence && (
            <div ref={runMenuRef} className="relative">
              <button
                onClick={() => setRunMenuOpen(o => !o)}
                disabled={selectedIds.length === 0 || runState.kind === 'running' || saving || deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400/10 border border-emerald-400/30 rounded text-xs text-emerald-400 hover:bg-emerald-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Kör sekvensen manuellt"
              >
                {runState.kind === 'running' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                Kör
                <ChevronDown size={11} className={`transition-transform ${runMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {runMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-[32rem] max-h-80 overflow-auto bg-elevated border border-border rounded-lg shadow-lg z-10 py-1">
                  <button
                    onClick={() => handleRun(null)}
                    className="w-full text-left px-3 py-2 text-xs text-fg hover:bg-hover transition-colors"
                  >
                    Utan projekt-kontext
                  </button>
                  {projekter.length > 0 && (
                    <div className="border-t border-border my-1" />
                  )}
                  {projekter.length > 0 && (
                    <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-subtle">
                      Med projekt
                    </p>
                  )}
                  {projekter.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleRun(p.id)}
                      className="w-full text-left px-3 py-1.5 text-xs text-muted hover:text-fg hover:bg-hover transition-colors whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      <span className="text-subtle">{p.projekt_nummer}</span> — {p.namn}
                      {p.kunder?.namn && (
                        <span className="text-subtle uppercase"> · {p.kunder.namn}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={!namn.trim() || selectedIds.length < 1 || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-400/10 border border-violet-400/30 rounded text-xs text-violet-400 hover:bg-violet-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {sequence ? 'Spara' : 'Skapa'}
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

      {/* Run progress banner */}
      {runState.kind === 'running' && (
        <div className="flex items-center gap-3 px-8 py-2.5 border-b border-border bg-emerald-400/5 shrink-0">
          <Loader2 size={13} className="animate-spin text-emerald-400 shrink-0" />
          <span className="text-xs text-fg">
            Kör {Math.min(runState.done + 1, runState.total)} av {runState.total}
            {runState.currentLabel && `: ${runState.currentLabel}`}
          </span>
        </div>
      )}
      {runState.kind === 'done' && (
        <div className={`flex items-center justify-between px-8 py-2.5 border-b border-border shrink-0 ${
          runState.success ? 'bg-emerald-400/5' : 'bg-red-400/5'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {runState.success
              ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              : <XCircle size={13} className="text-red-400 shrink-0" />}
            <span className="text-xs text-fg truncate">
              {runState.success ? 'Sekvensen kördes klart' : `Fel: ${runState.errorMsg ?? 'okänt'}`}
            </span>
          </div>
          <button
            onClick={() => setRunState({ kind: 'idle' })}
            className="p-1 rounded hover:bg-hover text-muted shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto flex flex-col">
        {/* Beskrivning */}
        <div className="px-8 pt-4 pb-3 border-b border-border shrink-0">
          <textarea
            value={beskrivning}
            onChange={e => setBeskrivning(e.target.value)}
            rows={2}
            placeholder="Kort beskrivning..."
            className="w-full bg-transparent text-xs text-muted resize-none focus:outline-none focus:text-fg placeholder:text-subtle transition-colors"
          />
        </div>

        {/* Workflow picker */}
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] uppercase tracking-widest text-muted">Workflows i ordning</p>
            {selectedIds.length > 0 && (
              <span className="text-[10px] text-subtle">{selectedIds.length} valda</span>
            )}
          </div>

          {allWorkflows.length === 0 ? (
            <p className="text-xs text-muted">Inga workflows tillgängliga.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {allWorkflows.map(wf => {
                const idx = selectedIds.indexOf(wf.id)
                const inSeq = idx !== -1
                return (
                  <button
                    key={wf.id}
                    onClick={() => toggle(wf.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-colors text-left border ${
                      inSeq
                        ? 'bg-violet-400/10 border-violet-400/20 text-fg'
                        : 'bg-elevated border-border text-muted hover:text-fg hover:bg-hover'
                    }`}
                  >
                    <span className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-colors ${
                      inSeq
                        ? 'bg-violet-400/20 border-violet-400/40 text-violet-400'
                        : 'border-border text-subtle'
                    }`}>
                      {inSeq ? idx + 1 : ''}
                    </span>
                    <span className="flex-1 truncate">{wf.namn}</span>
                  </button>
                )
              })}
            </div>
          )}

          {selectedIds.length < 1 && (
            <p className="text-[10px] text-subtle mt-3">Välj minst 1 workflow</p>
          )}
        </div>
      </div>
    </div>
  )
}
