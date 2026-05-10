import { useState, useEffect, useCallback } from 'react'
import { GitBranch, ListOrdered, Zap, ChevronLeft } from 'lucide-react'
import { WorkflowList } from './WorkflowList'
import { WorkflowEditor } from './WorkflowEditor'
import { WorkflowRunner } from './WorkflowRunner'
import { WorkflowsWelcome } from './WorkflowsWelcome'
import { SekvensPanel } from './SekvensPanel'
import { SekvensEditor } from './SekvensEditor'
import { TriggerListPanel } from './TriggerListPanel'
import { TriggerEditor } from './TriggerEditor'
import type {
  Workflow,
  WorkflowSequence,
  WorkflowTrigger,
  WorkflowRunResult,
  WorkflowProgressEvent,
  WorkflowNodeResult,
} from '../types'

type ActiveTab = 'workflows' | 'sekvenser' | 'triggers'

type RunnerState =
  | { phase: 'idle' }
  | { phase: 'running'; run_id: string; nodeStatuses: Record<string, WorkflowNodeResult> }
  | { phase: 'done'; result: WorkflowRunResult; nodeStatuses: Record<string, WorkflowNodeResult> }

const TAB_META: Record<ActiveTab, { label: string; icon: typeof GitBranch }> = {
  workflows: { label: 'Workflows', icon: GitBranch },
  sekvenser: { label: 'Sekvenser', icon: ListOrdered },
  triggers:  { label: 'Triggers',  icon: Zap },
}

export function WorkflowsPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null)

  // Workflows state
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const [loadingWorkflows, setLoadingWorkflows] = useState(true)
  const [runnerState, setRunnerState] = useState<RunnerState>({ phase: 'idle' })

  // Sequences state
  const [sequences, setSequences] = useState<WorkflowSequence[]>([])
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null)
  const [creatingSequence, setCreatingSequence] = useState(false)
  const [loadingSequences, setLoadingSequences] = useState(true)

  // Triggers state
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>([])
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null)
  const [creatingTrigger, setCreatingTrigger] = useState(false)
  const [loadingTriggers, setLoadingTriggers] = useState(true)

  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId) ?? null
  const selectedSequence = sequences.find(s => s.id === selectedSequenceId) ?? null
  const selectedTrigger = triggers.find(t => t.id === selectedTriggerId) ?? null

  const loadWorkflows = useCallback(async () => {
    setLoadingWorkflows(true)
    try {
      const data = await window.api.invoke('db:workflows:list') as Workflow[]
      setWorkflows(data)
    } finally {
      setLoadingWorkflows(false)
    }
  }, [])

  const loadSequences = useCallback(async () => {
    setLoadingSequences(true)
    try {
      const data = await window.api.invoke('db:sequences:list') as WorkflowSequence[]
      setSequences(data)
    } finally {
      setLoadingSequences(false)
    }
  }, [])

  const loadTriggers = useCallback(async () => {
    setLoadingTriggers(true)
    try {
      const data = await window.api.invoke('db:workflow-triggers:list') as WorkflowTrigger[]
      setTriggers(data)
    } finally {
      setLoadingTriggers(false)
    }
  }, [])

  useEffect(() => {
    loadWorkflows()
    loadSequences()
    loadTriggers()
  }, [])

  useEffect(() => { setRunnerState({ phase: 'idle' }) }, [selectedWorkflowId])

  useEffect(() => {
    if (runnerState.phase !== 'running') return
    const handler = (...args: unknown[]) => {
      const ev = args[0] as WorkflowProgressEvent
      setRunnerState(prev => {
        if (prev.phase !== 'running') return prev
        if (prev.run_id && ev.run_id !== prev.run_id) return prev
        return {
          ...prev,
          run_id: prev.run_id || ev.run_id,
          nodeStatuses: {
            ...prev.nodeStatuses,
            [ev.node_id]: { status: ev.status, output: ev.output ?? null, error: ev.error ?? null, duration_ms: 0 }
          }
        }
      })
    }
    window.api.on('workflow:progress', handler)
    return () => window.api.off('workflow:progress', handler)
  }, [runnerState.phase])

  // ── Workflow handlers ──
  async function handleCreateWorkflow(namn: string, kategori: string) {
    const data = await window.api.invoke('db:workflows:create', { namn, kategori }) as Workflow
    setWorkflows(prev => [data, ...prev])
    setSelectedWorkflowId(data.id)
  }

  async function handleUpdateWorkflow(id: string, patch: Partial<Workflow>) {
    const updated = await window.api.invoke('db:workflows:update', id, patch) as Workflow
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, ...updated } : w))
  }

  async function handleDeleteWorkflow(id: string) {
    await window.api.invoke('db:workflows:delete', id)
    const remaining = workflows.filter(w => w.id !== id)
    setWorkflows(remaining)
    setSelectedWorkflowId(remaining[0]?.id ?? null)
  }

  async function handleRunWorkflow(workflow_id: string, input: Record<string, unknown>) {
    setRunnerState({ phase: 'running', run_id: '', nodeStatuses: {} })
    const result = await window.api.invoke('workflow:run', { workflow_id, input, trigger_type: 'manual' }) as WorkflowRunResult
    setRunnerState(prev => ({
      phase: 'done',
      result,
      nodeStatuses: prev.phase === 'running' ? prev.nodeStatuses : {}
    }))
    loadWorkflows()
  }

  // ── Sequence handlers ──
  async function handleCreateSequence(data: { namn: string; beskrivning: string; workflow_ids: string[] }) {
    const created = await window.api.invoke('db:sequences:create', data) as WorkflowSequence
    setSequences(prev => [created, ...prev])
    setSelectedSequenceId(created.id)
    setCreatingSequence(false)
  }

  async function handleUpdateSequence(id: string, data: { namn: string; beskrivning: string; workflow_ids: string[] }) {
    const updated = await window.api.invoke('db:sequences:update', id, data) as WorkflowSequence
    setSequences(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s))
  }

  async function handleDeleteSequence(id: string) {
    await window.api.invoke('db:sequences:delete', id)
    const remaining = sequences.filter(s => s.id !== id)
    setSequences(remaining)
    setSelectedSequenceId(remaining[0]?.id ?? null)
    setCreatingSequence(false)
    loadTriggers()
  }

  // ── Trigger handlers ──
  async function handleCreateTrigger(data: {
    seccion: string; etikett: string; workflow_id: string | null; sequence_id: string | null
  }) {
    await window.api.invoke('db:workflow-triggers:create', { ...data, sequence_ids: null })
    await loadTriggers()
    setCreatingTrigger(false)
    setSelectedTriggerId(null)
  }

  async function handleDeleteTrigger(id: string) {
    await window.api.invoke('db:workflow-triggers:delete', id)
    const remaining = triggers.filter(t => t.id !== id)
    setTriggers(remaining)
    setSelectedTriggerId(remaining[0]?.id ?? null)
    setCreatingTrigger(false)
  }

  // Welcome screen — no tab selected
  if (activeTab === null) {
    return <WorkflowsWelcome onSelectTab={setActiveTab} />
  }

  const { label: tabLabel, icon: TabIcon } = TAB_META[activeTab]

  return (
    <div className="flex h-full">
      {/* ── Sidebar ── */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        {/* Sidebar header: current tab + back button */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border shrink-0">
          <button
            onClick={() => setActiveTab(null)}
            className="p-1 rounded hover:bg-hover text-subtle hover:text-muted transition-colors"
            title="Tillbaka"
          >
            <ChevronLeft size={14} />
          </button>
          <TabIcon size={13} className="text-muted" />
          <span className="text-xs font-medium text-fg">{tabLabel}</span>
        </div>

        {/* List for active tab */}
        <div className="flex-1 min-h-0">
          {activeTab === 'workflows' && (
            <WorkflowList
              workflows={workflows}
              selectedId={selectedWorkflowId}
              onSelect={setSelectedWorkflowId}
              onCreate={handleCreateWorkflow}
              loading={loadingWorkflows}
            />
          )}
          {activeTab === 'sekvenser' && (
            <SekvensPanel
              sequences={sequences}
              selectedId={selectedSequenceId}
              onSelect={id => { setSelectedSequenceId(id); setCreatingSequence(false) }}
              onCreate={() => { setSelectedSequenceId(null); setCreatingSequence(true) }}
              loading={loadingSequences}
            />
          )}
          {activeTab === 'triggers' && (
            <TriggerListPanel
              triggers={triggers}
              selectedId={selectedTriggerId}
              onSelect={id => { setSelectedTriggerId(id); setCreatingTrigger(false) }}
              onCreate={() => { setSelectedTriggerId(null); setCreatingTrigger(true) }}
              loading={loadingTriggers}
            />
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-w-0">
        {activeTab === 'workflows' && (
          runnerState.phase !== 'idle' && selectedWorkflow ? (
            <WorkflowRunner
              workflow={selectedWorkflow}
              runnerState={runnerState}
              onBack={() => setRunnerState({ phase: 'idle' })}
            />
          ) : selectedWorkflow ? (
            <WorkflowEditor
              workflow={selectedWorkflow}
              onUpdate={handleUpdateWorkflow}
              onDelete={handleDeleteWorkflow}
              onRun={handleRunWorkflow}
            />
          ) : (
            <WorkflowAreaEmpty />
          )
        )}

        {activeTab === 'sekvenser' && (
          creatingSequence || selectedSequenceId ? (
            <SekvensEditor
              sequence={creatingSequence && !selectedSequenceId ? null : selectedSequence}
              allWorkflows={workflows}
              onSave={creatingSequence && !selectedSequenceId
                ? handleCreateSequence
                : data => handleUpdateSequence(selectedSequenceId!, data)
              }
              onDelete={selectedSequenceId ? () => handleDeleteSequence(selectedSequenceId!) : undefined}
              onCancel={() => { setCreatingSequence(false); setSelectedSequenceId(sequences[0]?.id ?? null) }}
            />
          ) : (
            <SekvensEmptyState onCreate={() => { setSelectedSequenceId(null); setCreatingSequence(true) }} />
          )
        )}

        {activeTab === 'triggers' && (
          creatingTrigger || selectedTriggerId ? (
            <TriggerEditor
              trigger={creatingTrigger && !selectedTriggerId ? null : selectedTrigger}
              allWorkflows={workflows}
              allSequences={sequences}
              onSave={creatingTrigger && !selectedTriggerId
                ? handleCreateTrigger
                : data => handleCreateTrigger(data)
              }
              onDelete={selectedTriggerId ? () => handleDeleteTrigger(selectedTriggerId!) : undefined}
              onCancel={() => { setCreatingTrigger(false); setSelectedTriggerId(triggers[0]?.id ?? null) }}
            />
          ) : (
            <TriggerEmptyState onCreate={() => { setSelectedTriggerId(null); setCreatingTrigger(true) }} />
          )
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, desc, cta, onCreate }: {
  icon: typeof GitBranch; title: string; desc: string; cta: string; onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="w-11 h-11 rounded-2xl bg-elevated border border-border flex items-center justify-center">
        <Icon size={18} className="text-muted" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">{desc}</p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-1.5 px-4 py-2 bg-elevated border border-border rounded-lg text-xs text-fg hover:bg-hover transition-colors"
      >
        {cta}
      </button>
    </div>
  )
}

function WorkflowAreaEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <GitBranch size={18} className="text-subtle" />
      <p className="text-xs text-muted">Välj ett workflow i listan eller skapa ett nytt.</p>
    </div>
  )
}

function SekvensEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={ListOrdered}
      title="Inga sekvenser"
      desc="Skapa en sekvens för att köra flera workflows automatiskt i ordning."
      cta="Skapa din första sekvens"
      onCreate={onCreate}
    />
  )
}

function TriggerEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={Zap}
      title="Inga triggers"
      desc="Triggers lägger till knappar i Projekt, Förslag och andra sektioner för att köra workflows direkt."
      cta="Skapa din första trigger"
      onCreate={onCreate}
    />
  )
}
