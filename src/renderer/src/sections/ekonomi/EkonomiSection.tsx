import { useState, useEffect, useCallback } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { useChangeListener } from '@/hooks/useChangeListener'
import { EkonomiTable } from './EkonomiTable'
import { EkonomiDetail } from './EkonomiDetail'
import type { ProjektWithKund } from '@/sections/projekt/types'
import type { EkonomiUtfall, CreateUtfallInput } from './types'

type View = 'list' | 'detail'

export function EkonomiSection() {
  const [projekt, setProjekt] = useState<ProjektWithKund[]>([])
  const [utfallAll, setUtfallAll] = useState<EkonomiUtfall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('list')
  const [selectedProjekt, setSelectedProjekt] = useState<ProjektWithKund | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [projektData, utfallData] = await Promise.all([
        window.api.invoke('db:projekt:list') as Promise<ProjektWithKund[]>,
        window.api.invoke('db:ekonomi-utfall:list-all') as Promise<EkonomiUtfall[]>,
      ])
      setProjekt(projektData)
      setUtfallAll(utfallData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useRefreshHandler(loadData)
  useChangeListener(['ekonomi', 'forslag'], loadData)

  function utfallHandelse(kategori: 'arbete' | 'material' | 'ue' | 'övrigt', action: 'add' | 'remove'): string {
    if (kategori === 'arbete')   return action === 'add' ? 'arbetskostnad_lagt_till'   : 'arbetskostnad_borttagen'
    if (kategori === 'material') return action === 'add' ? 'materialkostnad_lagt_till' : 'materialkostnad_borttagen'
    return action === 'add' ? 'arbetskostnad_lagt_till' : 'arbetskostnad_borttagen'
  }

  async function handleAddUtfall(input: CreateUtfallInput) {
    const created = await window.api.invoke('db:ekonomi-utfall:create', input) as EkonomiUtfall
    setUtfallAll((prev) => [created, ...prev])
    const fmt = `${Math.round(created.belopp).toLocaleString('sv-SE')} kr`
    await window.api.invoke('db:projekt-aktivitet:create', {
      projekt_id: created.projekt_id,
      handelse: utfallHandelse(created.kategori, 'add'),
      text: `${created.kategori === 'arbete' ? 'Arbetskostnad' : created.kategori === 'material' ? 'Materialkostnad' : 'Kostnad'} tillagd: ${created.beskrivning} (${fmt})`,
    }).catch(() => {})
  }

  async function handleDeleteUtfall(id: string) {
    const u = utfallAll.find((x) => x.id === id)
    await window.api.invoke('db:ekonomi-utfall:delete', id)
    setUtfallAll((prev) => prev.filter((x) => x.id !== id))
    if (u) {
      const fmt = `${Math.round(u.belopp).toLocaleString('sv-SE')} kr`
      await window.api.invoke('db:projekt-aktivitet:create', {
        projekt_id: u.projekt_id,
        handelse: utfallHandelse(u.kategori, 'remove'),
        text: `${u.kategori === 'arbete' ? 'Arbetskostnad' : u.kategori === 'material' ? 'Materialkostnad' : 'Kostnad'} borttagen: ${u.beskrivning} (${fmt})`,
      }).catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted text-sm">Laddar ekonomi...</p>
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

  if (view === 'detail' && selectedProjekt) {
    const utfall = utfallAll.filter((u) => u.projekt_id === selectedProjekt.id)
    return (
      <EkonomiDetail
        projekt={selectedProjekt}
        utfall={utfall}
        onBack={() => { setView('list'); setSelectedProjekt(null) }}
        onAddUtfall={handleAddUtfall}
        onDeleteUtfall={handleDeleteUtfall}
      />
    )
  }

  return (
    <EkonomiTable
      projekt={projekt}
      utfallAll={utfallAll}
      onSelect={(p) => { setSelectedProjekt(p); setView('detail') }}
    />
  )
}
