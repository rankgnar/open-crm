import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, Clock, ArrowLeft, ChevronDown, ChevronRight, Database, Sparkles, CircleCheck } from 'lucide-react'
import { NODE_META } from './NodeCard'
import type { Workflow, WorkflowNodeResult, WorkflowRunResult, WorkflowRunStatus, WorkflowNodeCategory } from '../types'

type RunnerState =
  | { phase: 'running'; run_id: string; nodeStatuses: Record<string, WorkflowNodeResult> }
  | { phase: 'done'; result: WorkflowRunResult; nodeStatuses: Record<string, WorkflowNodeResult> }

interface Props {
  workflow: Workflow
  runnerState: RunnerState
  onBack: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

const CATEGORY_COLORS: Record<WorkflowNodeCategory, string> = {
  data:   'text-blue-400',
  ai:     'text-violet-400',
  action: 'text-emerald-400',
}

const CATEGORY_BG: Record<WorkflowNodeCategory, string> = {
  data:   'bg-blue-400/10 border-blue-400/30',
  ai:     'bg-violet-400/10 border-violet-400/30',
  action: 'bg-emerald-400/10 border-emerald-400/30',
}

function CategoryIcon({ category, size = 16 }: { category: WorkflowNodeCategory; size?: number }) {
  if (category === 'data') return <Database size={size} />
  if (category === 'ai') return <Sparkles size={size} />
  return <CircleCheck size={size} />
}

// ── Output preview (expandable) ────────────────────────────────────────────

function OutputPreview({ output }: { output: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  if (!output) return null

  const aiRaw = typeof output.ai_raw === 'string' ? output.ai_raw : undefined
  const simpleEntries = Object.entries(output)
    .filter(([k, v]) => k !== 'ai_raw' && (typeof v !== 'object' || v === null))
    .slice(0, 4)
  const hasComplex = Object.entries(output).some(([k, v]) => k !== 'ai_raw' && typeof v === 'object' && v !== null)

  return (
    <div className="mt-2 pt-2 border-t border-white/5">
      {simpleEntries.length > 0 && (
        <div className="flex flex-col gap-1">
          {simpleEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[11px]">
              <span className="text-subtle font-mono shrink-0">{k}:</span>
              <span className="text-fg truncate">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
      {aiRaw && (
        <div className={simpleEntries.length > 0 ? 'mt-2' : ''}>
          <button onClick={() => setTextOpen(!textOpen)} className="flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors mb-1.5">
            {textOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            AI-svar
          </button>
          {textOpen && (
            <pre className="text-[11px] text-muted bg-bg/60 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap font-sans leading-relaxed">
              {aiRaw}
            </pre>
          )}
        </div>
      )}
      {hasComplex && (
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 mt-1.5 text-[11px] text-muted hover:text-fg transition-colors">
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          {open ? 'Dölj detaljer' : 'Visa detaljer'}
        </button>
      )}
      {open && (
        <pre className="mt-2 text-[10px] text-subtle bg-bg/60 rounded p-2 overflow-auto max-h-28 font-mono">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function WorkflowRunner({ workflow, runnerState, onBack }: Props) {
  const nodes = [...(workflow.definition?.nodes ?? [])].sort((a, b) => a.position - b.position)
  const { nodeStatuses } = runnerState
  const result = runnerState.phase === 'done' ? runnerState.result : null
  const isRunning = runnerState.phase === 'running'

  // Find active node (first one that's 'kör')
  const activeNode = nodes.find((n) => nodeStatuses[n.id]?.status === 'kör')
  // Count completed
  const doneCount = nodes.filter((n) => nodeStatuses[n.id]?.status === 'klar').length
  const failedNode = result?.status === 'fel' ? nodes.find((n) => n.id === result.error_node) : null
  const _forslagId = result?.output?.forslag_id as string | undefined
  void _forslagId
  const forslagNummer = result?.output?.forslag_nummer as string | undefined

  const activeMeta = activeNode ? NODE_META[activeNode.type] : null

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          disabled={isRunning}
          className="p-1 rounded hover:bg-hover text-muted hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <p className="flex-1 text-sm font-semibold text-fg truncate">{workflow.namn}</p>
        {isRunning && (
          <span className="text-[11px] text-blue-400 shrink-0">{doneCount}/{nodes.length} steg</span>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-md mx-auto flex flex-col gap-5">

          {/* ── Active step card (only while running) ── */}
          {isRunning && (
            <div className={`rounded-xl border p-5 ${activeMeta ? CATEGORY_BG[activeMeta.category] : 'bg-elevated border-border'} transition-all`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${activeMeta ? CATEGORY_COLORS[activeMeta.category] : 'text-muted'}`}>
                  {activeMeta
                    ? <CategoryIcon category={activeMeta.category} size={18} />
                    : <Loader2 size={18} className="animate-spin text-muted" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted uppercase tracking-widest mb-1">
                    {activeMeta ? activeMeta.category === 'ai' ? 'AI bearbetar' : activeMeta.category === 'data' ? 'Hämtar data' : 'Åtgärd' : 'Startar'}
                  </p>
                  <p className="text-base font-semibold text-fg">
                    {activeNode?.label ?? 'Förbereder...'}
                  </p>
                  {activeMeta && (
                    <p className="text-xs text-muted mt-1">{activeMeta.description}</p>
                  )}
                </div>
                <Loader2 size={16} className="shrink-0 mt-1 text-blue-400 animate-spin" />
              </div>

              {/* Progress dots */}
              <div className="flex items-center gap-1.5 mt-4">
                {nodes.map((n) => {
                  const s = nodeStatuses[n.id]?.status
                  return (
                    <div
                      key={n.id}
                      className={`h-1 rounded-full flex-1 transition-all duration-500 ${
                        s === 'klar' ? 'bg-emerald-400' :
                        s === 'kör'  ? 'bg-blue-400 animate-pulse' :
                        s === 'fel'  ? 'bg-red-400' :
                        'bg-border'
                      }`}
                    />
                  )
                })}
              </div>
              <p className="text-[10px] text-muted mt-2 text-right">
                {doneCount} av {nodes.length} steg klara
              </p>
            </div>
          )}

          {/* ── Success card ── */}
          {!isRunning && result?.status === 'klar' && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-fg">Workflow slutfört</p>
                  <p className="text-xs text-muted mt-0.5">
                    {result.duration_ms != null ? fmtDuration(result.duration_ms) : ''} · {nodes.length} steg körda
                  </p>
                </div>
              </div>
              {forslagNummer && (
                <div className="mt-3 pt-3 border-t border-emerald-400/20">
                  <p className="text-xs text-muted">Förslag skapat:</p>
                  <p className="text-sm font-semibold text-emerald-400 mt-0.5">{forslagNummer}</p>
                  <p className="text-[11px] text-subtle mt-1">
                    Öppna Förslag-sektionen för att se det. Dokumentet är sparat i projektets Dokument-flik.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Error card ── */}
          {!isRunning && result?.status === 'fel' && (
            <div className="rounded-xl border border-red-400/30 bg-red-400/5 p-5">
              <div className="flex items-center gap-3">
                <XCircle size={20} className="text-red-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-fg">Workflow misslyckades</p>
                  <p className="text-xs text-muted mt-0.5">
                    Fel i nod: <span className="text-fg">{failedNode?.label ?? result.error_node ?? 'okänd'}</span>
                  </p>
                </div>
              </div>
              {result.error_msg && (
                <p className="mt-3 text-xs text-red-300/80 bg-red-400/5 rounded-lg px-3 py-2 border border-red-400/20">
                  {result.error_msg}
                </p>
              )}
            </div>
          )}

          {/* ── Step list ── */}
          <div className="flex flex-col gap-1">
            {nodes.map((node) => {
              const nodeResult = nodeStatuses[node.id]
              const status: WorkflowRunStatus | 'väntar' = nodeResult?.status ?? 'väntar'
              const isActive = status === 'kör'
              const isDone = status === 'klar'
              const isFailed = status === 'fel'

              return (
                <div
                  key={node.id}
                  className={`rounded-lg border px-3.5 py-2.5 transition-all duration-300 ${
                    isActive  ? 'border-blue-400/40 bg-blue-400/5' :
                    isDone    ? 'border-emerald-400/20 bg-emerald-400/3' :
                    isFailed  ? 'border-red-400/40 bg-red-400/5' :
                    'border-border/50 opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`shrink-0 ${
                      isActive ? 'text-blue-400' :
                      isDone   ? 'text-emerald-400' :
                      isFailed ? 'text-red-400' :
                      'text-subtle'
                    }`}>
                      {isActive  ? <Loader2 size={13} className="animate-spin" /> :
                       isDone    ? <CheckCircle2 size={13} /> :
                       isFailed  ? <XCircle size={13} /> :
                       <Clock size={13} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${!nodeResult ? 'text-subtle' : 'text-fg'}`}>
                        {node.label}
                      </p>
                    </div>
                    {nodeResult?.duration_ms != null && nodeResult.duration_ms > 0 && (
                      <span className="text-[10px] text-subtle shrink-0">{fmtDuration(nodeResult.duration_ms)}</span>
                    )}
                  </div>

                  {isFailed && nodeResult?.error && (
                    <p className="mt-1.5 text-[11px] text-red-300 pl-6">{nodeResult.error}</p>
                  )}

                  {isDone && nodeResult?.output && (
                    <div className="pl-6">
                      <OutputPreview output={nodeResult.output} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Back button */}
          {!isRunning && (
            <button
              onClick={onBack}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 bg-elevated border border-border rounded text-xs text-muted hover:text-fg hover:bg-hover transition-colors"
            >
              <ArrowLeft size={12} />
              Tillbaka till editor
            </button>
          )}

        </div>
      </div>
    </div>
  )
}
