import { useState, useEffect, useCallback, useRef } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { useChangeListener } from '@/hooks/useChangeListener'
import { ForslagTable } from './ForslagTable'
import { ProjektInfoModal } from './ProjektInfoModal'
import { DuplikatForslagModal } from './DuplikatForslagModal'
import { ForslagForm } from './ForslagForm'
import { ForslagDetail } from './ForslagDetail'
import type { ForslagWithProjekt, CreateForslagInput, ForslagStatusar, SignaturSummary } from './types'
import type { ProjektWithKund, ProjektStatusar } from '@/sections/projekt/types'

type View = 'list' | 'create' | 'detail'

interface Props {
  initialProjektId?: string
  onNavigateProjekt?: (projektId: string) => void
  initialForslagId?: string
  openTidplanReminderOnLoad?: boolean
  onNavigateTidplan?: (forslagId: string, mode: 'send' | 'direct') => void
}

export function ForslagSection({ initialProjektId, onNavigateProjekt, initialForslagId, openTidplanReminderOnLoad, onNavigateTidplan }: Props = {}) {
  const [projektModalId, setProjektModalId] = useState<string | null>(null)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [forslag, setForslag] = useState<ForslagWithProjekt[]>([])
  const [allProjekt, setAllProjekt] = useState<ProjektWithKund[]>([])
  const [statusar, setStatusar] = useState<ForslagStatusar[]>([])
  const [projektStatusar, setProjektStatusar] = useState<ProjektStatusar[]>([])
  const [signingEvents, setSigningEvents] = useState<Record<string, SignaturSummary>>({})
  const [smsForslag, setSmsForslag] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('list')
  const [selectedForslag, setSelectedForslag] = useState<ForslagWithProjekt | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [forslagData, projektData, statusData, projektStatusData, signingData, smsIds] = await Promise.all([
        window.api.invoke('db:forslag:list') as Promise<ForslagWithProjekt[]>,
        window.api.invoke('db:projekt:list') as Promise<ProjektWithKund[]>,
        window.api.invoke('db:forslag-statusar:list') as Promise<ForslagStatusar[]>,
        window.api.invoke('db:projekt-statusar:list') as Promise<ProjektStatusar[]>,
        window.api.invoke('db:signatur-lank:forslag-events') as Promise<Record<string, SignaturSummary>>,
        window.api.invoke('db:forslag-sms-log:forslag-ids') as Promise<string[]>,
      ])
      setForslag(forslagData)
      setAllProjekt(projektData)
      setStatusar(statusData)
      setProjektStatusar(projektStatusData)
      setSigningEvents(signingData)
      setSmsForslag(new Set(smsIds))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useRefreshHandler(loadData)
  useChangeListener(['forslag', 'projekt'], loadData)

  const initialForslagConsumed = useRef(false)
  useEffect(() => {
    if (!initialForslagId || initialForslagConsumed.current || forslag.length === 0) return
    const target = forslag.find((f) => f.id === initialForslagId)
    if (target) {
      initialForslagConsumed.current = true
      setSelectedForslag(target)
      setView('detail')
    }
  }, [initialForslagId, forslag])

  async function handleCreate(data: CreateForslagInput, mallId?: string) {
    const created = await window.api.invoke('db:forslag:create', data) as ForslagWithProjekt
    if (mallId) {
      await window.api.invoke('db:forslag:apply-mall', created.id, mallId)
    }
    setForslag((prev) => [created, ...prev])
    setSelectedForslag(created)
    setView('detail')
    if (created.projekt_id) {
      window.api.invoke('db:projekt-aktivitet:create', {
        projekt_id: created.projekt_id,
        handelse: 'forslag_skapat',
        text: `Förslag ${created.forslag_nummer} skapat`,
      })
    }
  }

  function statusToHandelse(status: string): { handelse: string; text: (nummer: string) => string } {
    switch (status) {
      case 'Skickat':    return { handelse: 'forslag_skickat',  text: (n) => `Förslag ${n} skickat` }
      case 'Accepterat': return { handelse: 'forslag_signerat', text: (n) => `Förslag ${n} accepterat av kund` }
      case 'Avvisat':    return { handelse: 'forslag_avvisat',  text: (n) => `Förslag ${n} avvisat` }
      default:           return { handelse: 'forslag_status_andrad', text: (n) => `Förslag ${n} status ändrad till ${status}` }
    }
  }

  async function handleEdit(data: CreateForslagInput) {
    if (!selectedForslag) return
    const prevStatus = selectedForslag.status
    const updated = await window.api.invoke('db:forslag:update', selectedForslag.id, data) as ForslagWithProjekt
    setForslag((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    setSelectedForslag(updated)
    if (data.status && data.status !== prevStatus && updated.projekt_id) {
      const { handelse, text } = statusToHandelse(data.status)
      await window.api.invoke('db:projekt-aktivitet:create', {
        projekt_id: updated.projekt_id,
        handelse,
        text: text(updated.forslag_nummer),
      })
    }
  }

  async function handleStatusChange(id: string, status: string) {
    const updated = await window.api.invoke('db:forslag:update', id, { status }) as ForslagWithProjekt
    setForslag((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    if (selectedForslag?.id === id) setSelectedForslag(updated)
    if (updated.projekt_id) {
      const { handelse, text } = statusToHandelse(status)
      await window.api.invoke('db:projekt-aktivitet:create', {
        projekt_id: updated.projekt_id,
        handelse,
        text: text(updated.forslag_nummer),
      })
    }
  }

  async function handleDelete() {
    if (!selectedForslag) return
    await window.api.invoke('db:forslag:delete', selectedForslag.id)
    setForslag((prev) => prev.filter((f) => f.id !== selectedForslag.id))
    setSelectedForslag(null)
    setView('list')
  }

  function handleDuplicated(newForslag: ForslagWithProjekt) {
    setForslag((prev) => [newForslag, ...prev])
    setSelectedForslag(newForslag)
    setView('detail')
    setShowDuplicate(false)
  }

  async function handleProjektStatusChange(projektId: string, status: string) {
    await window.api.invoke('db:projekt:update', projektId, { status })
    setForslag((prev) => prev.map((f) => f.projekt_id === projektId ? { ...f, projekt: { ...f.projekt, status } } : f))
  }

  async function handleDeleteMany(ids: string[]) {
    if (ids.length === 0) return
    await window.api.invoke('db:forslag:delete-many', ids)
    const idSet = new Set(ids)
    setForslag((prev) => prev.filter((f) => !idSet.has(f.id)))
    if (selectedForslag && idSet.has(selectedForslag.id)) {
      setSelectedForslag(null)
      setView('list')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted text-sm">Laddar förslag...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (view === 'create') {
    return <ForslagForm statusar={statusar} projekt={allProjekt} onSubmit={handleCreate} onCancel={() => setView('list')} />
  }

  if (view === 'detail' && selectedForslag) {
    return (
      <ForslagDetail
        forslag={selectedForslag}
        statusar={statusar}
        allProjekt={allProjekt}
        onBack={() => { setView('list'); setSelectedForslag(null) }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onNavigateProjekt={onNavigateProjekt ? () => onNavigateProjekt(selectedForslag.projekt_id) : undefined}
        onNavigateTidplan={onNavigateTidplan ? (mode) => onNavigateTidplan(selectedForslag.id, mode) : undefined}
        openTidplanReminder={openTidplanReminderOnLoad && selectedForslag?.id === initialForslagId}
      />
    )
  }

  const visibleForslag = initialProjektId
    ? forslag.filter((f) => f.projekt_id === initialProjektId)
    : forslag

  return (
    <>
      <ForslagTable
        forslag={visibleForslag}
        statusar={statusar}
        projektStatusar={projektStatusar}
        signingEvents={signingEvents}
        smsForslag={smsForslag}
        onSelect={(f) => { setSelectedForslag(f); setView('detail') }}
        onNew={() => setView('create')}
        onDuplicate={() => setShowDuplicate(true)}
        onStatusChange={handleStatusChange}
        onDeleteMany={handleDeleteMany}
        onClickProjekt={(id) => setProjektModalId(id)}
        onProjektStatusChange={handleProjektStatusChange}
      />
      {projektModalId && (
        <ProjektInfoModal projektId={projektModalId} onClose={() => setProjektModalId(null)} />
      )}
      {showDuplicate && (
        <DuplikatForslagModal
          allForslag={forslag}
          allProjekt={allProjekt}
          defaultProjektId={initialProjektId}
          onClose={() => setShowDuplicate(false)}
          onDuplicated={handleDuplicated}
        />
      )}
    </>
  )
}
