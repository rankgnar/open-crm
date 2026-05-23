import { useState, useEffect, useCallback } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { useChangeListener } from '@/hooks/useChangeListener'
import { KunderTable } from './KunderTable'
import { KundForm } from './KundForm'
import { KundDetail } from './KundDetail'
import type { Kund, CreateKundInput, KundLastProjekt, KundLastForslag } from './types'

type View = 'list' | 'create' | 'detail'

interface Props {
  onNavigateProjekt?: (projektId: string) => void
  onNavigateForslag?: (forslagId: string) => void
  onCreateProjekt?: (kundId: string) => void
  onCreateForslag?: (projektId?: string) => void
}

export function KunderSection({ onNavigateProjekt, onNavigateForslag, onCreateProjekt, onCreateForslag }: Props = {}) {
  const [kunder, setKunder] = useState<Kund[]>([])
  const [projektCounts, setProjektCounts] = useState<KundLastProjekt>({})
  const [forslagCounts, setForslagCounts] = useState<KundLastForslag>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('list')
  const [selectedKund, setSelectedKund] = useState<Kund | null>(null)

  const loadKunder = useCallback(async () => {
    try {
      const [data, pc, fc] = await Promise.all([
        window.api.invoke('db:kunder:list') as Promise<Kund[]>,
        window.api.invoke('db:kunder:projekt-counts') as Promise<KundLastProjekt>,
        window.api.invoke('db:kunder:forslag-counts') as Promise<KundLastForslag>,
      ])
      setKunder(data)
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

  async function handleDelete() {
    if (!selectedKund) return
    await window.api.invoke('db:kunder:delete', selectedKund.id)
    setKunder((prev) => prev.filter((k) => k.id !== selectedKund.id))
    setSelectedKund(null)
    setView('list')
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
    return <KundForm onSubmit={handleCreate} onCancel={() => setView('list')} />
  }

  if (view === 'detail' && selectedKund) {
    return (
      <KundDetail
        kund={selectedKund}
        onBack={() => { setView('list'); setSelectedKund(null) }}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    )
  }

  return (
    <KunderTable
      kunder={kunder}
      lastProjekt={projektCounts}
      lastForslag={forslagCounts}
      onSelect={(kund) => { setSelectedKund(kund); setView('detail') }}
      onDeleteMany={handleDeleteMany}
      onNew={() => setView('create')}
      onNavigateProjekt={onNavigateProjekt}
      onNavigateForslag={onNavigateForslag}
      onCreateProjekt={onCreateProjekt}
      onCreateForslag={onCreateForslag}
    />
  )
}
