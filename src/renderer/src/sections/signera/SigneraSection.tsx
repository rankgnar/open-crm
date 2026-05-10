import { useCallback, useEffect, useState } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { SigneraTable } from './SigneraTable'
import { SigneraSkapaModal } from './SigneraSkapaModal'
import { SigneraDetail } from './SigneraDetail'
import type { SigneraRow } from './types'
import type { ProjektWithKund } from '@/sections/projekt/types'

type View = 'list' | 'detail'

export function SigneraSection() {
  const [view, setView]         = useState<View>('list')
  const [rader, setRader]       = useState<SigneraRow[]>([])
  const [projekt, setProjekt]   = useState<ProjektWithKund[]>([])
  const [selected, setSelected] = useState<SigneraRow | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]       = useState('')

  const reload = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([
        window.api.invoke('db:signera:list') as Promise<SigneraRow[]>,
        window.api.invoke('db:projekt:list') as Promise<ProjektWithKund[]>,
      ])
      setRader(r)
      setProjekt(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte ladda')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])
  useRefreshHandler(reload)

  function handleSelect(row: SigneraRow) {
    setSelected(row)
    setView('detail')
  }

  async function handleDeleteMany(ids: string[]) {
    await window.api.invoke('db:signera:delete-many', ids)
    await reload()
  }

  async function refreshSelected() {
    if (!selected) return
    const fresh = await window.api.invoke('db:signera:list') as SigneraRow[]
    setRader(fresh)
    const updated = fresh.find(r => r.lank.id === selected.lank.id)
    if (updated) setSelected(updated)
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      if (selected) {
        await refreshSelected()
      } else {
        await reload()
      }
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><p className="text-muted text-sm">Laddar…</p></div>
  }

  if (error) {
    return <div className="flex h-full items-center justify-center"><p className="text-red-400 text-sm">{error}</p></div>
  }

  if (view === 'detail' && selected) {
    return (
      <>
        <SigneraDetail
          row={selected}
          onBack={() => { setView('list'); setSelected(null); void reload() }}
          onArchived={() => { void refreshSelected() }}
          onUpdated={refreshSelected}
        />
      </>
    )
  }

  return (
    <>
      <SigneraTable
        rader={rader}
        onSelect={handleSelect}
        onNew={() => setShowModal(true)}
        onDeleteMany={handleDeleteMany}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
      {showModal && (
        <SigneraSkapaModal
          projekt={projekt}
          onClose={() => setShowModal(false)}
          onCreated={() => { void reload() }}
        />
      )}
    </>
  )
}
