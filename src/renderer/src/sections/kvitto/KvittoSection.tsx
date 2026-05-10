import { useState, useEffect, useCallback } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { KvittoTable } from './KvittoTable'
import { KvittoForm } from './KvittoForm'
import { KvittoDetail } from './KvittoDetail'
import type { CreateKvittoInput, Kvitto, KvittoListItem, KvittoStatus, UpdateKvittoInput } from './types'
import type { ProjektWithKund } from '@/sections/projekt/types'

type View = 'list' | 'create' | 'detail'

export function KvittoSection() {
  const [view, setView] = useState<View>('list')
  const [kvitton, setKvitton] = useState<KvittoListItem[]>([])
  const [projekt, setProjekt] = useState<ProjektWithKund[]>([])
  const [selected, setSelected] = useState<KvittoListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const [k, p] = await Promise.all([
        window.api.invoke('db:kvitto:list') as Promise<KvittoListItem[]>,
        window.api.invoke('db:projekt:list') as Promise<ProjektWithKund[]>,
      ])
      setKvitton(k)
      setProjekt(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda kvitton')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])
  useRefreshHandler(reload)

  async function handleCreate(input: CreateKvittoInput) {
    await window.api.invoke('db:kvitto:create', input)
    await reload()
    setView('list')
  }

  async function handleSelect(k: KvittoListItem) {
    setSelected(k)
    setView('detail')
  }

  async function handleSetStatus(id: string, status: KvittoStatus) {
    await window.api.invoke('db:kvitto:set-status', { id, status })
    setKvitton((prev) => prev.map((k) => k.id === id ? { ...k, status } : k))
    if (selected?.id === id) setSelected({ ...selected, status })
  }

  async function handleUpdate(id: string, patch: UpdateKvittoInput): Promise<Kvitto> {
    await window.api.invoke('db:kvitto:update', { id, ...patch })
    const fresh = await window.api.invoke('db:kvitto:get', id) as KvittoListItem
    setKvitton((prev) => prev.map((k) => k.id === id ? fresh : k))
    if (selected?.id === id) setSelected(fresh)
    return fresh
  }

  async function handleDelete(id: string, storagePath: string) {
    await window.api.invoke('db:kvitto:delete', { id, storagePath })
    setKvitton((prev) => prev.filter((k) => k.id !== id))
    setSelected(null)
    setView('list')
  }

  async function handleDeleteMany(ids: string[]) {
    if (ids.length === 0) return
    await window.api.invoke('db:kvitto:delete-many', ids)
    const idSet = new Set(ids)
    setKvitton((prev) => prev.filter((k) => !idSet.has(k.id)))
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><p className="text-muted text-sm">Laddar kvitton...</p></div>
  }

  if (error) {
    return <div className="flex h-full items-center justify-center"><p className="text-red-400 text-sm">{error}</p></div>
  }

  if (view === 'create') {
    return (
      <KvittoForm
        projekt={projekt}
        onSubmit={handleCreate}
        onCancel={() => setView('list')}
      />
    )
  }

  if (view === 'detail' && selected) {
    return (
      <KvittoDetail
        kvitto={selected}
        projekt={projekt}
        onBack={() => { setView('list'); setSelected(null) }}
        onUpdate={handleUpdate}
        onSetStatus={handleSetStatus}
        onDelete={handleDelete}
      />
    )
  }

  return (
    <KvittoTable
      kvitton={kvitton}
      onSelect={handleSelect}
      onNew={() => setView('create')}
      onDeleteMany={handleDeleteMany}
    />
  )
}
