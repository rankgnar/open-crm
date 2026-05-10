import { useState, useEffect, useCallback } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { ATATable } from './ATATable'
import { ATAForm } from './ATAForm'
import { ATADetail } from './ATADetail'
import type { ATA, ATAWithRader, CreateATAInput, ATAStatus, UpdateATAInput } from './types'
import type { ProjektWithKund } from '@/sections/projekt/types'

type View = 'list' | 'create' | 'detail'

export function ATASection() {
  const [view, setView] = useState<View>('list')
  const [atas, setAtas] = useState<ATA[]>([])
  const [projekt, setProjekt] = useState<ProjektWithKund[]>([])
  const [selected, setSelected] = useState<ATAWithRader | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([
        window.api.invoke('db:ata:list') as Promise<ATA[]>,
        window.api.invoke('db:projekt:list') as Promise<ProjektWithKund[]>,
      ])
      setAtas(a)
      setProjekt(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda ÄTA')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])
  useRefreshHandler(reload)

  async function loadDetail(id: string) {
    const full = await window.api.invoke('db:ata:get', id) as ATAWithRader
    setSelected(full)
  }

  function logAta(projekt_id: string, handelse: string, text: string) {
    return window.api.invoke('db:projekt-aktivitet:create', { projekt_id, handelse, text }).catch(() => {})
  }

  function statusToHandelse(status: ATAStatus): { handelse: string; text: (n: string) => string } {
    switch (status) {
      case 'Skickad': return { handelse: 'ata_skickad',       text: (n) => `ÄTA ${n} skickad` }
      case 'Godkänd': return { handelse: 'ata_signerad',      text: (n) => `ÄTA ${n} godkänd av kund` }
      case 'Avvisad': return { handelse: 'ata_avvisad',       text: (n) => `ÄTA ${n} avvisad` }
      default:        return { handelse: 'ata_status_andrad', text: (n) => `ÄTA ${n} status ändrad till ${status}` }
    }
  }

  async function handleCreate(input: CreateATAInput) {
    const created = await window.api.invoke('db:ata:create', input) as ATA
    setAtas((prev) => [created, ...prev])
    if (created.projekt_id) logAta(created.projekt_id, 'ata_skapad', `ÄTA ${created.ata_nummer} skapad`)
    await loadDetail(created.id)
    setView('detail')
  }

  async function handleSelect(a: ATA) {
    await loadDetail(a.id)
    setView('detail')
  }

  async function handleSetStatus(id: string, status: ATAStatus) {
    const updated = await window.api.invoke('db:ata:set-status', id, status) as ATA
    setAtas((prev) => prev.map((a) => a.id === id ? { ...a, ...updated } : a))
    if (selected?.id === id) setSelected({ ...selected, ...updated })
    if (updated.projekt_id) {
      const { handelse, text } = statusToHandelse(status)
      logAta(updated.projekt_id, handelse, text(updated.ata_nummer))
    }
  }

  async function handleSign(id: string, godkand_av: string, signatur_data: string) {
    const updated = await window.api.invoke('db:ata:sign', id, godkand_av, signatur_data) as ATA
    setAtas((prev) => prev.map((a) => a.id === id ? { ...a, ...updated } : a))
    if (selected?.id === id) setSelected({ ...selected, ...updated })
    if (updated.projekt_id) {
      logAta(updated.projekt_id, 'ata_signerad', `ÄTA ${updated.ata_nummer} signerad av ${godkand_av}`)
    }
  }

  async function handleUpdate(id: string, patch: UpdateATAInput): Promise<ATAWithRader> {
    const updated = await window.api.invoke('db:ata:update', id, patch) as ATA
    setAtas((prev) => prev.map((a) => a.id === id ? { ...a, ...updated } : a))
    const merged: ATAWithRader = selected?.id === id
      ? { ...selected, ...updated }
      : { ...updated, rader: [] }
    if (selected?.id === id) setSelected(merged)
    return merged
  }

  async function handleDelete(id: string) {
    await window.api.invoke('db:ata:delete', id)
    setAtas((prev) => prev.filter((a) => a.id !== id))
    setSelected(null)
    setView('list')
  }

  async function handleDeleteMany(ids: string[]) {
    if (ids.length === 0) return
    await window.api.invoke('db:ata:delete-many', ids)
    const idSet = new Set(ids)
    setAtas((prev) => prev.filter((a) => !idSet.has(a.id)))
    if (selected && idSet.has(selected.id)) {
      setSelected(null)
      setView('list')
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><p className="text-muted text-sm">Laddar ÄTA...</p></div>
  }

  if (error) {
    return <div className="flex h-full items-center justify-center"><p className="text-red-400 text-sm">{error}</p></div>
  }

  if (view === 'create') {
    return (
      <ATAForm
        projekt={projekt}
        onSubmit={handleCreate}
        onCancel={() => setView('list')}
      />
    )
  }

  if (view === 'detail' && selected) {
    return (
      <ATADetail
        ata={selected}
        onBack={() => { setView('list'); setSelected(null) }}
        onSetStatus={handleSetStatus}
        onSign={handleSign}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    )
  }

  return (
    <ATATable
      atas={atas}
      onSelect={handleSelect}
      onNew={() => setView('create')}
      onSetStatus={handleSetStatus}
      onDeleteMany={handleDeleteMany}
    />
  )
}
