import { useState, useEffect, useCallback } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { InventarierTable } from './InventarierTable'
import { InventarierForm } from './InventarierForm'
import type { Inventarie, CreateInventarieInput, UpdateInventarieInput } from './types'

type View = 'list' | 'form'

export function InventarierSection() {
  const [view, setView] = useState<View>('list')
  const [items, setItems] = useState<Inventarie[]>([])
  const [editing, setEditing] = useState<Inventarie | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const data = await window.api.invoke('db:inventarier:list') as Inventarie[]
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda inventarielistan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])
  useRefreshHandler(reload)

  async function handleCreate(input: CreateInventarieInput) {
    await window.api.invoke('db:inventarier:create', input)
    await reload()
    setView('list')
    setEditing(null)
  }

  async function handleUpdate(id: string, patch: UpdateInventarieInput) {
    await window.api.invoke('db:inventarier:update', { id, ...patch })
    await reload()
    setView('list')
    setEditing(null)
  }

  async function handleDelete(id: string) {
    await window.api.invoke('db:inventarier:delete', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function handleDeleteMany(ids: string[]) {
    await window.api.invoke('db:inventarier:delete-many', ids)
    const idSet = new Set(ids)
    setItems((prev) => prev.filter((i) => !idSet.has(i.id)))
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted text-sm">Laddar inventarier...</p>
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

  if (view === 'form') {
    return (
      <InventarierForm
        item={editing}
        onSubmit={
          editing
            ? (p) => handleUpdate(editing.id, p as UpdateInventarieInput)
            : (p) => handleCreate(p as CreateInventarieInput)
        }
        onCancel={() => { setView('list'); setEditing(null) }}
      />
    )
  }

  return (
    <InventarierTable
      items={items}
      onNew={() => { setEditing(null); setView('form') }}
      onEdit={(item) => { setEditing(item); setView('form') }}
      onDelete={handleDelete}
      onDeleteMany={handleDeleteMany}
    />
  )
}
