import { useState, useEffect, useCallback } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { useChangeListener } from '@/hooks/useChangeListener'
import { KunderTable } from './KunderTable'
import { KundForm } from './KundForm'
import { KundDetail } from './KundDetail'
import type { Kund, CreateKundInput, KundStatusar, KundLastProjekt, KundLastForslag } from './types'

type View = 'list' | 'create' | 'detail'

interface Props {
  onNavigateProjekt?: (projektId: string) => void
  onNavigateForslag?: (forslagId: string) => void
}

export function KunderSection({ onNavigateProjekt, onNavigateForslag }: Props = {}) {
  const [kunder, setKunder] = useState<Kund[]>([])
  const [statusar, setStatusar] = useState<KundStatusar[]>([])
  const [projektCounts, setProjektCounts] = useState<KundLastProjekt>({})
  const [forslagCounts, setForslagCounts] = useState<KundLastForslag>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('list')
  const [selectedKund, setSelectedKund] = useState<Kund | null>(null)

  const loadKunder = useCallback(async () => {
    try {
      const [data, s, pc, fc] = await Promise.all([
        window.api.invoke('db:kunder:list') as Promise<Kund[]>,
        window.api.invoke('db:kund-statusar:list') as Promise<KundStatusar[]>,
        window.api.invoke('db:kunder:projekt-counts') as Promise<KundLastProjekt>,
        window.api.invoke('db:kunder:forslag-counts') as Promise<KundLastForslag>,
      ])
      setKunder(data)
      setStatusar(s)
      setProjektCounts(pc)
      setForslagCounts(fc)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda kunder')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadKunder() }, [loadKunder])
  useRefreshHandler(loadKunder)
  useChangeListener(['kunder'], loadKunder)

  async function handleCreate(data: CreateKundInput) {
    const created = await window.api.invoke('db:kunder:create', data) as Kund
    setKunder((prev) => [created, ...prev])
    setView('list')
  }

  async function handleEdit(data: CreateKundInput) {
    if (!selectedKund) return
    const updated = await window.api.invoke('db:kunder:update', selectedKund.id, data) as Kund
    setKunder((prev) => prev.map((k) => (k.id === updated.id ? updated : k)))
    setSelectedKund(updated)
  }

  async function handleStatusChange(id: string, status: string) {
    const updated = await window.api.invoke('db:kunder:update', id, { status }) as Kund
    setKunder((prev) => prev.map((k) => (k.id === updated.id ? updated : k)))
    if (selectedKund?.id === id) setSelectedKund(updated)
  }

  async function handleDelete() {
    if (!selectedKund) return
    await window.api.invoke('db:kunder:delete', selectedKund.id)
    setKunder((prev) => prev.filter((k) => k.id !== selectedKund.id))
    setSelectedKund(null)
    setView('list')
  }

  async function handleStatusChangeMany(ids: string[], status: string) {
    await window.api.invoke('db:kunder:update-status-many', ids, status)
    setKunder((prev) => prev.map((k) => ids.includes(k.id) ? { ...k, status } : k))
    if (selectedKund && ids.includes(selectedKund.id)) setSelectedKund((prev) => prev ? { ...prev, status } : prev)
  }

  async function handleDeleteMany(ids: string[]) {
    await window.api.invoke('db:kunder:delete-many', ids)
    setKunder((prev) => prev.filter((k) => !ids.includes(k.id)))
    if (selectedKund && ids.includes(selectedKund.id)) {
      setSelectedKund(null)
      setView('list')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted text-sm">Laddar kunder...</p>
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
    return <KundForm statusar={statusar} onSubmit={handleCreate} onCancel={() => setView('list')} />
  }

  if (view === 'detail' && selectedKund) {
    return (
      <KundDetail
        kund={selectedKund}
        statusar={statusar}
        onBack={() => { setView('list'); setSelectedKund(null) }}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    )
  }

  return (
    <KunderTable
      kunder={kunder}
      statusar={statusar}
      lastProjekt={projektCounts}
      lastForslag={forslagCounts}
      onSelect={(kund) => { setSelectedKund(kund); setView('detail') }}
      onStatusChange={handleStatusChange}
      onStatusChangeMany={handleStatusChangeMany}
      onDeleteMany={handleDeleteMany}
      onNew={() => setView('create')}
      onNavigateProjekt={onNavigateProjekt}
      onNavigateForslag={onNavigateForslag}
    />
  )
}
