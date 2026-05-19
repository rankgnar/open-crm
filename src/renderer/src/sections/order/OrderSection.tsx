import { useState, useEffect, useCallback } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { useChangeListener } from '@/hooks/useChangeListener'
import { OrderTable } from './OrderTable'
import { OrderForm } from './OrderForm'
import { OrderDetail } from './OrderDetail'
import type { Order, OrderWithRader, CreateOrderInput, OrderStatus, UpdateOrderInput } from './types'
import type { ProjektWithKund } from '@/sections/projekt/types'

type View = 'list' | 'create' | 'detail'

export function OrderSection() {
  const [view, setView] = useState<View>('list')
  const [ordrar, setOrdrar] = useState<Order[]>([])
  const [projekt, setProjekt] = useState<ProjektWithKund[]>([])
  const [selected, setSelected] = useState<OrderWithRader | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const [o, p] = await Promise.all([
        window.api.invoke('db:order:list') as Promise<Order[]>,
        window.api.invoke('db:projekt:list') as Promise<ProjektWithKund[]>,
      ])
      setOrdrar(o)
      setProjekt(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda order')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])
  useRefreshHandler(reload)
  useChangeListener(['order'], reload)

  async function loadDetail(id: string) {
    const full = await window.api.invoke('db:order:get', id) as OrderWithRader
    setSelected(full)
  }

  function logOrder(projekt_id: string, handelse: string, text: string) {
    return window.api.invoke('db:projekt-aktivitet:create', { projekt_id, handelse, text }).catch(() => {})
  }

  function statusToHandelse(status: OrderStatus): { handelse: string; text: (n: string) => string } {
    switch (status) {
      case 'Skickad': return { handelse: 'order_skickad',       text: (n) => `Order ${n} skickad` }
      case 'Godkänd': return { handelse: 'order_slutford',      text: (n) => `Order ${n} godkänd av kund` }
      default:        return { handelse: 'order_status_andrad', text: (n) => `Order ${n} status ändrad till ${status}` }
    }
  }

  async function handleCreate(input: CreateOrderInput) {
    const created = await window.api.invoke('db:order:create', input) as Order
    setOrdrar((prev) => [created, ...prev])
    if (created.projekt_id) logOrder(created.projekt_id, 'order_skapad', `Order ${created.order_nummer} skapad`)
    await loadDetail(created.id)
    setView('detail')
  }

  async function handleSelect(o: Order) {
    await loadDetail(o.id)
    setView('detail')
  }

  async function handleSetStatus(id: string, status: OrderStatus) {
    const updated = await window.api.invoke('db:order:set-status', id, status) as Order
    setOrdrar((prev) => prev.map((o) => o.id === id ? { ...o, ...updated } : o))
    if (selected?.id === id) setSelected({ ...selected, ...updated })
    if (updated.projekt_id) {
      const { handelse, text } = statusToHandelse(status)
      logOrder(updated.projekt_id, handelse, text(updated.order_nummer))
    }
  }

  async function handleSign(id: string, godkand_av: string, signatur_data: string) {
    const updated = await window.api.invoke('db:order:sign', id, godkand_av, signatur_data) as Order
    setOrdrar((prev) => prev.map((o) => o.id === id ? { ...o, ...updated } : o))
    if (selected?.id === id) setSelected({ ...selected, ...updated })
    if (updated.projekt_id) {
      logOrder(updated.projekt_id, 'order_slutford', `Order ${updated.order_nummer} signerad av ${godkand_av}`)
    }
  }

  async function handleUpdate(id: string, patch: UpdateOrderInput): Promise<OrderWithRader> {
    const updated = await window.api.invoke('db:order:update', id, patch) as Order
    setOrdrar((prev) => prev.map((o) => o.id === id ? { ...o, ...updated } : o))
    const merged: OrderWithRader = selected?.id === id
      ? { ...selected, ...updated }
      : { ...updated, rader: [] }
    if (selected?.id === id) setSelected(merged)
    return merged
  }

  async function handleDelete(id: string) {
    await window.api.invoke('db:order:delete', id)
    setOrdrar((prev) => prev.filter((o) => o.id !== id))
    setSelected(null)
    setView('list')
  }

  async function handleDeleteMany(ids: string[]) {
    if (ids.length === 0) return
    await window.api.invoke('db:order:delete-many', ids)
    const idSet = new Set(ids)
    setOrdrar((prev) => prev.filter((o) => !idSet.has(o.id)))
    if (selected && idSet.has(selected.id)) {
      setSelected(null)
      setView('list')
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><p className="text-muted text-sm">Laddar order...</p></div>
  }

  if (error) {
    return <div className="flex h-full items-center justify-center"><p className="text-red-400 text-sm">{error}</p></div>
  }

  if (view === 'create') {
    return (
      <OrderForm
        projekt={projekt}
        onSubmit={handleCreate}
        onCancel={() => setView('list')}
      />
    )
  }

  if (view === 'detail' && selected) {
    return (
      <OrderDetail
        order={selected}
        onBack={() => { setView('list'); setSelected(null) }}
        onSetStatus={handleSetStatus}
        onSign={handleSign}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    )
  }

  return (
    <OrderTable
      ordrar={ordrar}
      onSelect={handleSelect}
      onNew={() => setView('create')}
      onSetStatus={handleSetStatus}
      onDeleteMany={handleDeleteMany}
    />
  )
}
