import { useState, useEffect, useCallback } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { RefreshButton } from '@/components/RefreshButton'
import { RevisorDeadlines } from './RevisorDeadlines'
import { RevisorAnteckningar } from './RevisorAnteckningar'
import { RevisorDokumentPanel } from './RevisorDokumentPanel'
import type { RevisorDeadline, RevisorAnteckning, RevisorDokument, CreateDeadlineInput, AnteckningFarg } from './types'

type RightTab = 'anteckningar' | 'dokument'
type FileDialogResult = { filePath: string; fileName: string; mimeType: string; size: number }

export function RevisorSection() {
  const [deadlines, setDeadlines] = useState<RevisorDeadline[]>([])
  const [anteckningar, setAnteckningar] = useState<RevisorAnteckning[]>([])
  const [dokument, setDokument] = useState<RevisorDokument[]>([])
  const [rightTab, setRightTab] = useState<RightTab>('anteckningar')
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    const [d, a, dok] = await Promise.all([
      window.api.invoke('db:revisor-deadlines:list') as Promise<RevisorDeadline[]>,
      window.api.invoke('db:revisor-anteckningar:list') as Promise<RevisorAnteckning[]>,
      window.api.invoke('db:revisor-dokument:list') as Promise<RevisorDokument[]>,
    ])
    setDeadlines(d)
    setAnteckningar(a)
    setDokument(dok)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useRefreshHandler(loadAll)

  async function handleCreateDeadline(input: CreateDeadlineInput) {
    await window.api.invoke('db:revisor-deadlines:create', input)
    const d = await window.api.invoke('db:revisor-deadlines:list') as RevisorDeadline[]
    setDeadlines(d)
  }

  async function handleToggleDeadline(id: string, status: 'kommande' | 'slutford') {
    await window.api.invoke('db:revisor-deadlines:update', { id, status })
    setDeadlines((prev) => prev.map((d) => d.id === id ? { ...d, status } : d))
  }

  async function handleDeleteDeadline(id: string) {
    await window.api.invoke('db:revisor-deadlines:delete', id)
    setDeadlines((prev) => prev.filter((d) => d.id !== id))
  }

  async function handleAddAnteckning(titel: string, innehall: string, farg: AnteckningFarg) {
    await window.api.invoke('db:revisor-anteckningar:create', { titel, innehall, farg })
    const a = await window.api.invoke('db:revisor-anteckningar:list') as RevisorAnteckning[]
    setAnteckningar(a)
  }

  async function handleUpdateAnteckning(id: string, titel: string, innehall: string, farg: AnteckningFarg) {
    await window.api.invoke('db:revisor-anteckningar:update', { id, titel, innehall, farg })
    setAnteckningar((prev) => prev.map((a) => a.id === id ? { ...a, titel, innehall, farg } : a))
  }

  async function handleDeleteAnteckning(id: string) {
    await window.api.invoke('db:revisor-anteckningar:delete', id)
    setAnteckningar((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleUploadDokument() {
    const file = await window.api.invoke('dialog:open-file') as FileDialogResult | null
    if (!file) return
    await window.api.invoke('db:revisor-dokument:upload', file)
    const dok = await window.api.invoke('db:revisor-dokument:list') as RevisorDokument[]
    setDokument(dok)
  }

  async function handleDeleteDokument(id: string, storagePath: string) {
    await window.api.invoke('db:revisor-dokument:delete', { id, storagePath })
    setDokument((prev) => prev.filter((d) => d.id !== id))
  }

  async function handleOpenDokument(storagePath: string) {
    await window.api.invoke('db:revisor-dokument:open', storagePath)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-fg">Revisor</span>
          <span className="text-[10px] uppercase tracking-widest text-amber-400 border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 rounded-full">Alfa</span>
        </div>
        <RefreshButton iconOnly />
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-0.5">Rådgivning & Revision</p>
            <h2 className="text-xl font-semibold text-fg">Revisor</h2>
            <p className="text-xs text-subtle mt-1">Hantera dokument, deadlines och kommunikation med er revisor.</p>
          </div>

          {!loading && (
            <RevisorDeadlines
              deadlines={deadlines}
              onCreate={handleCreateDeadline}
              onToggle={handleToggleDeadline}
              onDelete={handleDeleteDeadline}
            />
          )}

          <div className="px-8 py-4 mt-auto border-t border-border flex items-center gap-6">
            <span className="text-xs text-subtle">Modul: <span className="text-muted">Revisor v0.1-alfa</span></span>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-[480px] border-l border-border flex flex-col shrink-0">
          <div className="flex shrink-0 border-b border-border">
            <button
              onClick={() => setRightTab('anteckningar')}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${rightTab === 'anteckningar' ? 'text-fg border-fg' : 'text-muted border-transparent hover:text-fg'}`}
            >
              Anteckningar
              <span className="text-[10px] bg-elevated border border-border rounded-full px-1.5 py-0.5">{anteckningar.length}</span>
            </button>
            <button
              onClick={() => setRightTab('dokument')}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${rightTab === 'dokument' ? 'text-fg border-fg' : 'text-muted border-transparent hover:text-fg'}`}
            >
              Dokument
              <span className="text-[10px] bg-elevated border border-border rounded-full px-1.5 py-0.5">{dokument.length}</span>
            </button>
          </div>

          {rightTab === 'anteckningar' && (
            <RevisorAnteckningar
              anteckningar={anteckningar}
              onAdd={handleAddAnteckning}
              onUpdate={handleUpdateAnteckning}
              onDelete={handleDeleteAnteckning}
            />
          )}
          {rightTab === 'dokument' && (
            <RevisorDokumentPanel
              dokument={dokument}
              onUpload={handleUploadDokument}
              onDelete={handleDeleteDokument}
              onOpen={handleOpenDokument}
            />
          )}
        </div>
      </div>
    </div>
  )
}
