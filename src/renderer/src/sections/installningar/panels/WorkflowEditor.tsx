import { useState, useEffect, useRef } from 'react'
import { Play, Trash2, MoreHorizontal, ToggleLeft, ToggleRight, Loader2, GitBranch } from 'lucide-react'
import { NodeCard, NodeConnector, AddNodeButton, NODE_META } from './NodeCard'
import type { Workflow, WorkflowNode, WorkflowNodeType, AiAssistent } from '../types'
import type { EpostMall, EpostAlias } from '../../epost/types'
import { SelectField } from '@/components/SelectField'

interface ProjektOption {
  id: string
  namn: string
  projekt_nummer: string
}

interface Props {
  workflow: Workflow
  onUpdate: (id: string, patch: Partial<Workflow>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRun: (workflow_id: string, input: Record<string, unknown>) => Promise<void>
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function WorkflowEditor({ workflow, onUpdate, onDelete, onRun }: Props) {
  const [editNamn, setEditNamn] = useState(workflow.namn)
  const [editBeskrivning, setEditBeskrivning] = useState(workflow.beskrivning)
  const [nodes, setNodes] = useState<WorkflowNode[]>(
    [...(workflow.definition?.nodes ?? [])].sort((a, b) => a.position - b.position)
  )
  const [asistenter, setAsistenter] = useState<AiAssistent[]>([])
  const [mallar, setMallar] = useState<EpostMall[]>([])
  const [alias, setAlias] = useState<EpostAlias[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [showRunInput, setShowRunInput] = useState(false)
  const [runProjektId, setRunProjektId] = useState('')
  const [projektOptions, setProjektOptions] = useState<ProjektOption[]>([])
  const [loadingProjekt, setLoadingProjekt] = useState(false)
  const [runAsistentId, setRunAsistentId] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.invoke('ai:asistenter:list').then((data) => setAsistenter(data as AiAssistent[]))
    window.api.invoke('db:epost-mallar:list').then((data) => setMallar(data as EpostMall[])).catch(() => {})
    window.api.invoke('db:epost-alias:list').then((data) => setAlias(data as EpostAlias[])).catch(() => {})
  }, [])

  // Sync when workflow changes from outside (e.g. switching selection)
  useEffect(() => {
    setEditNamn(workflow.namn)
    setEditBeskrivning(workflow.beskrivning)
    setNodes([...(workflow.definition?.nodes ?? [])].sort((a, b) => a.position - b.position))
    setRunning(false)
    setShowRunInput(false)
    setRunProjektId('')
    setRunAsistentId('')
  }, [workflow.id])

  // Close menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function scheduleSave(newNodes?: WorkflowNode[], namn?: string, beskrivning?: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const n = newNodes ?? nodes
      const reindexed = n.map((node, i) => ({ ...node, position: i }))
      onUpdate(workflow.id, {
        namn: namn ?? editNamn,
        beskrivning: beskrivning ?? editBeskrivning,
        definition: {
          nodes: reindexed,
          edges: reindexed.slice(1).map((node, i) => ({ from: reindexed[i].id, to: node.id }))
        }
      })
    }, 600)
  }

  function handleNamnChange(val: string) {
    setEditNamn(val)
    scheduleSave(undefined, val, undefined)
  }

  function handleBeskrivningChange(val: string) {
    setEditBeskrivning(val)
    scheduleSave(undefined, undefined, val)
  }

  function handleAddNode(type: WorkflowNodeType) {
    const meta = NODE_META[type]
    const newNode: WorkflowNode = {
      id: genId(),
      type,
      label: meta.label,
      config: {},
      position: nodes.length
    }
    const updated = [...nodes, newNode]
    setNodes(updated)
    scheduleSave(updated)
  }

  function handleUpdateNode(id: string, patch: Partial<WorkflowNode>) {
    const updated = nodes.map((n) => n.id === id ? { ...n, ...patch } : n)
    setNodes(updated)
    scheduleSave(updated)
  }

  function handleDeleteNode(id: string) {
    const updated = nodes.filter((n) => n.id !== id)
    setNodes(updated)
    scheduleSave(updated)
  }

  function handleMoveUp(id: string) {
    const idx = nodes.findIndex((n) => n.id === id)
    if (idx <= 0) return
    const updated = [...nodes]
    ;[updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]]
    setNodes(updated)
    scheduleSave(updated)
  }

  function handleMoveDown(id: string) {
    const idx = nodes.findIndex((n) => n.id === id)
    if (idx >= nodes.length - 1) return
    const updated = [...nodes]
    ;[updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]]
    setNodes(updated)
    scheduleSave(updated)
  }

  function handleToggleAktiv() {
    onUpdate(workflow.id, { aktiv: !workflow.aktiv })
  }

  async function handleDelete() {
    setMenuOpen(false)
    await onDelete(workflow.id)
  }

  const needsProjektId = nodes.some((n) => ([
    'data:projekt', 'data:projekt:anteckningar', 'data:projekt:dokument',
    'data:projekt:dokument-text',
    'data:context', 'action:save-context', 'data:forslag-faser', 'action:create-tidplan',
    'action:import-forslag-from-extraction',
    'action:send-epost', 'action:queue-epost',
  ] as string[]).includes(n.type))
  // Only ask for assistent if an AI node doesn't already have one configured
  const hasAiNode = nodes.some((n) =>
    (['ai:generate', 'ai:analyze-bilder', 'ai:analyze-pdf'] as string[]).includes(n.type) &&
    !n.config.assistent_id
  )

  async function handleRun() {
    if (!showRunInput && (needsProjektId || hasAiNode)) {
      setLoadingProjekt(true)
      setShowRunInput(true)
      try {
        if (needsProjektId) {
          const data = await window.api.invoke('db:projekt:list') as ProjektOption[]
          setProjektOptions(data)
          if (data.length > 0) setRunProjektId(data[0].id)
        }
        if (hasAiNode && asistenter.length > 0 && !runAsistentId) {
          setRunAsistentId(asistenter[0].id)
        }
      } finally {
        setLoadingProjekt(false)
      }
      return
    }
    setRunning(true)
    setShowRunInput(false)
    try {
      const input: Record<string, unknown> = {}
      if (needsProjektId) input.projekt_id = runProjektId
      if (hasAiNode && runAsistentId) input.assistent_id = runAsistentId
      await onRun(workflow.id, input)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <input
          value={editNamn}
          onChange={(e) => handleNamnChange(e.target.value)}
          className="flex-1 bg-transparent text-sm font-semibold text-fg focus:outline-none min-w-0 truncate"
          placeholder="Workflow-namn..."
        />

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleToggleAktiv}
            className="text-muted hover:text-fg transition-colors"
            title={workflow.aktiv ? 'Inaktivera' : 'Aktivera'}
          >
            {workflow.aktiv
              ? <ToggleRight size={18} className="text-emerald-400" />
              : <ToggleLeft size={18} />
            }
          </button>

          <button
            onClick={handleRun}
            disabled={running || nodes.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-elevated border border-border rounded text-xs text-fg hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {running
              ? <Loader2 size={13} className="animate-spin" />
              : <Play size={13} />
            }
            Kör
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded hover:bg-hover text-muted hover:text-fg transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-elevated border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-hover transition-colors flex items-center gap-2"
                >
                  <Trash2 size={12} />
                  Ta bort workflow
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Beskrivning */}
      <div className="px-6 pt-3 pb-2 border-b border-border shrink-0">
        <textarea
          value={editBeskrivning}
          onChange={(e) => handleBeskrivningChange(e.target.value)}
          rows={2}
          placeholder="Kort beskrivning av vad detta workflow gör..."
          className="w-full bg-transparent text-xs text-muted resize-none focus:outline-none focus:text-fg placeholder:text-subtle transition-colors"
        />
      </div>

      {/* Run dialog — projekt + assistent selectors */}
      {showRunInput && (
        <div className="mx-6 mt-4 p-4 bg-elevated border border-border rounded-lg flex flex-col gap-3 shrink-0">
          <p className="text-[11px] uppercase tracking-widest text-muted">Kör workflow</p>

          {loadingProjekt ? (
            <div className="flex items-center gap-2 py-1">
              <Loader2 size={13} className="animate-spin text-muted" />
              <span className="text-xs text-muted">Laddar...</span>
            </div>
          ) : (
            <>
              {needsProjektId && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-subtle mb-1">Projekt</label>
                  <SelectField
                    value={runProjektId}
                    onChange={setRunProjektId}
                    placeholder={projektOptions.length === 0 ? 'Inga projekt hittades' : undefined}
                    searchable
                    options={projektOptions.map((p) => ({ value: p.id, label: `${p.projekt_nummer} — ${p.namn}` }))}
                  />
                </div>
              )}

              {hasAiNode && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-subtle mb-1">AI-assistent</label>
                  <SelectField
                    value={runAsistentId}
                    onChange={setRunAsistentId}
                    placeholder="Välj assistent..."
                    options={asistenter.map((a) => ({ value: a.id, label: a.namn }))}
                  />
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleRun}
              disabled={loadingProjekt || (needsProjektId && !runProjektId) || (hasAiNode && !runAsistentId)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-elevated border border-border rounded text-xs text-fg hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={12} />
              Kör workflow
            </button>
            <button
              onClick={() => { setShowRunInput(false); setRunProjektId(''); setRunAsistentId('') }}
              className="px-2 py-1.5 text-xs text-muted hover:text-fg transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Node list */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center gap-5 pt-16">
            <div className="w-11 h-11 rounded-2xl bg-elevated border border-border flex items-center justify-center">
              <GitBranch size={18} className="text-muted" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-fg">Inga noder</p>
              <p className="text-xs text-muted mt-1">Bygg ditt workflow genom att lägga till noder</p>
            </div>
            <AddNodeButton onAdd={handleAddNode} />
          </div>
        ) : (
          <div className="flex flex-col items-stretch max-w-lg mx-auto gap-0">
            {nodes.map((node, i) => (
              <div key={node.id}>
                <NodeCard
                  node={node}
                  index={i}
                  total={nodes.length}
                  asistenter={asistenter}
                  mallar={mallar}
                  alias={alias}
                  onUpdate={handleUpdateNode}
                  onDelete={handleDeleteNode}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                />
                {i < nodes.length - 1 && <NodeConnector />}
              </div>
            ))}
            <div className="mt-1">
              <NodeConnector />
            </div>
            <div className="flex justify-center">
              <AddNodeButton onAdd={handleAddNode} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
