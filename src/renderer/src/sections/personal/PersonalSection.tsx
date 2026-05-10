import { useState, useEffect, useCallback } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { PersonalTable } from './PersonalTable'
import { PersonalForm } from './PersonalForm'
import { PersonalDetail } from './PersonalDetail'
import { TidrapporterView } from './TidrapporterView'
import { LedighetView } from './LedighetView'
import { LoneunderlagView } from './LoneunderlagView'
import type {
  Personal, CreatePersonalInput, UpdatePersonalInput, PersonalAnteckning, PersonalDokument,
  PersonalLonepost, PersonalStatusar, DokumentKategori, FileDialogResult, CsvImportResult,
  ProjektPersonal, ProjektItem,
} from './types'

type MainTab = 'anstallda' | 'tidrapporter' | 'ledighet' | 'loneunderlag'
type AnstallView = 'list' | 'create' | 'detail'

const TABS: { key: MainTab; label: string }[] = [
  { key: 'anstallda', label: 'Anställda' },
  { key: 'tidrapporter', label: 'Tidrapporter' },
  { key: 'ledighet', label: 'Ledighet' },
  { key: 'loneunderlag', label: 'Löneunderlag' },
]

export function PersonalSection() {
  const [mainTab, setMainTab] = useState<MainTab>('anstallda')

  // Anställda sub-state
  const [personal, setPersonal] = useState<Personal[]>([])
  const [statusar, setStatusar] = useState<PersonalStatusar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<AnstallView>('list')
  const [selected, setSelected] = useState<Personal | null>(null)
  const [anteckningar, setAnteckningar] = useState<PersonalAnteckning[]>([])
  const [dokument, setDokument] = useState<PersonalDokument[]>([])
  const [loneposter, setLoneposter] = useState<PersonalLonepost[]>([])
  const [assignedProjekt, setAssignedProjekt] = useState<ProjektPersonal[]>([])
  const [availableProjekt, setAvailableProjekt] = useState<ProjektItem[]>([])

  const loadData = useCallback(async () => {
    try {
      const [data, statData] = await Promise.all([
        window.api.invoke('db:personal:list') as Promise<Personal[]>,
        window.api.invoke('db:personal-statusar:list') as Promise<PersonalStatusar[]>,
      ])
      setPersonal(data)
      setStatusar(statData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda personal')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useRefreshHandler(loadData)

  async function loadDetail(personalId: string) {
    const [antData, dokData, loneData, projData, availData] = await Promise.all([
      window.api.invoke('db:personal-anteckningar:list', personalId) as Promise<PersonalAnteckning[]>,
      window.api.invoke('db:personal-dokument:list', personalId) as Promise<PersonalDokument[]>,
      window.api.invoke('db:personal-loneposter:list', personalId) as Promise<PersonalLonepost[]>,
      window.api.invoke('db:personal-projekt:list', personalId) as Promise<ProjektPersonal[]>,
      window.api.invoke('db:personal-projekt:list-available', personalId) as Promise<ProjektItem[]>,
    ])
    setAnteckningar(antData)
    setDokument(dokData)
    setLoneposter(loneData)
    setAssignedProjekt(projData)
    setAvailableProjekt(availData)
  }

  async function handleCreate(data: CreatePersonalInput | UpdatePersonalInput) {
    const created = await window.api.invoke('db:personal:create', data) as Personal
    setPersonal((prev) => [created, ...prev])
    setView('list')
  }

  async function handleEdit(data: CreatePersonalInput | UpdatePersonalInput) {
    if (!selected) return
    const updated = await window.api.invoke('db:personal:update', selected.id, data) as Personal
    setPersonal((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    setSelected(updated)
  }

  async function handleStatusChange(id: string, status: string) {
    const updated = await window.api.invoke('db:personal:update', id, { status }) as Personal
    setPersonal((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    if (selected?.id === id) setSelected(updated)
  }

  async function handleDelete() {
    if (!selected) return
    await window.api.invoke('db:personal:delete', selected.id)
    setPersonal((prev) => prev.filter((p) => p.id !== selected.id))
    setSelected(null)
    setView('list')
  }

  async function handleDeleteMany(ids: string[]) {
    if (ids.length === 0) return
    await window.api.invoke('db:personal:delete-many', ids)
    const idSet = new Set(ids)
    setPersonal((prev) => prev.filter((p) => !idSet.has(p.id)))
    if (selected && idSet.has(selected.id)) {
      setSelected(null)
      setView('list')
    }
  }

  // Anteckningar
  async function handleAddAnteckning(titel: string, innehall: string, farg: string) {
    if (!selected) return
    const created = await window.api.invoke('db:personal-anteckningar:create', { personal_id: selected.id, titel, innehall, farg }) as PersonalAnteckning
    setAnteckningar((prev) => [created, ...prev])
  }

  async function handleUpdateAnteckning(id: string, titel: string, innehall: string, farg: string) {
    const updated = await window.api.invoke('db:personal-anteckningar:update', id, { titel, innehall, farg }) as PersonalAnteckning
    setAnteckningar((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }

  async function handleDeleteAnteckning(id: string) {
    await window.api.invoke('db:personal-anteckningar:delete', id)
    setAnteckningar((prev) => prev.filter((a) => a.id !== id))
  }

  // Dokument
  async function handleUploadDokument(kategori: DokumentKategori) {
    if (!selected) return
    const file = await window.api.invoke('dialog:open-file') as FileDialogResult | null
    if (!file) return
    await window.api.invoke('db:personal-dokument:upload', { personalId: selected.id, kategori, ...file })
    const docs = await window.api.invoke('db:personal-dokument:list', selected.id) as PersonalDokument[]
    setDokument(docs)
  }

  async function handleDeleteDokument(id: string, storagePath: string) {
    await window.api.invoke('db:personal-dokument:delete', { id, storagePath })
    setDokument((prev) => prev.filter((d) => d.id !== id))
  }

  async function handleOpenDokument(storagePath: string) {
    await window.api.invoke('db:personal-dokument:open', storagePath)
  }

  // Löneposter
  async function handleAddLonepost(data: { typ: string; belopp: number; beskrivning: string; datum: string; manad: string }) {
    if (!selected) return
    const created = await window.api.invoke('db:personal-loneposter:create', { personal_id: selected.id, ...data }) as PersonalLonepost
    setLoneposter((prev) => [created, ...prev])
  }

  async function handleDeleteLonepost(id: string) {
    await window.api.invoke('db:personal-loneposter:delete', id)
    setLoneposter((prev) => prev.filter((l) => l.id !== id))
  }

  // Projekt assignment
  async function handleAssignProjekt(projekt_id: string) {
    if (!selected) return
    await window.api.invoke('db:personal-projekt:assign', selected.id, projekt_id)
    const [projData, availData] = await Promise.all([
      window.api.invoke('db:personal-projekt:list', selected.id) as Promise<ProjektPersonal[]>,
      window.api.invoke('db:personal-projekt:list-available', selected.id) as Promise<ProjektItem[]>,
    ])
    setAssignedProjekt(projData)
    setAvailableProjekt(availData)
  }

  async function handleRemoveProjekt(projekt_id: string) {
    if (!selected) return
    await window.api.invoke('db:personal-projekt:remove', selected.id, projekt_id)
    setAssignedProjekt((prev) => prev.filter((p) => p.projekt_id !== projekt_id))
    const avail = await window.api.invoke('db:personal-projekt:list-available', selected.id) as ProjektItem[]
    setAvailableProjekt(avail)
  }

  // App-åtkomst
  async function handleSendInvite() {
    if (!selected) return
    const result = await window.api.invoke('db:personal:send-invite', selected.id) as { user_id: string }
    if (result.user_id && result.user_id !== selected.supabase_user_id) {
      const updated = { ...selected, supabase_user_id: result.user_id }
      setSelected(updated)
      setPersonal((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    }
  }

  async function handleSendPasswordReset() {
    if (!selected) return
    await window.api.invoke('db:personal:send-password-reset', selected.id)
  }

  // CSV import
  async function handleImportCsv(filePath: string) {
    const result = await window.api.invoke('db:personal:import-csv', filePath) as CsvImportResult
    await loadData()
    return result
  }

  function clearDetail() {
    setView('list')
    setSelected(null)
    setAnteckningar([])
    setDokument([])
    setLoneposter([])
    setAssignedProjekt([])
    setAvailableProjekt([])
  }

  if (loading && mainTab === 'anstallda') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted text-sm">Laddar personal...</p>
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

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navigation */}
      <div className="flex border-b border-border bg-sidebar shrink-0 px-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setMainTab(key); if (key === 'anstallda') clearDetail() }}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              mainTab === key ? 'border-fg text-fg' : 'border-transparent text-subtle hover:text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mainTab === 'tidrapporter' && <TidrapporterView />}
        {mainTab === 'ledighet' && <LedighetView />}
        {mainTab === 'loneunderlag' && <LoneunderlagView />}

        {mainTab === 'anstallda' && (
          <>
            {view === 'create' && (
              <PersonalForm statusar={statusar} onSubmit={handleCreate} onCancel={() => setView('list')} />
            )}
            {view === 'detail' && selected && (
              <PersonalDetail
                personal={selected}
                statusar={statusar}
                anteckningar={anteckningar}
                dokument={dokument}
                loneposter={loneposter}
                assignedProjekt={assignedProjekt}
                availableProjekt={availableProjekt}
                onBack={clearDetail}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAddAnteckning={handleAddAnteckning}
                onUpdateAnteckning={handleUpdateAnteckning}
                onDeleteAnteckning={handleDeleteAnteckning}
                onUploadDokument={handleUploadDokument}
                onDeleteDokument={handleDeleteDokument}
                onOpenDokument={handleOpenDokument}
                onAddLonepost={handleAddLonepost}
                onDeleteLonepost={handleDeleteLonepost}
                onAssignProjekt={handleAssignProjekt}
                onRemoveProjekt={handleRemoveProjekt}
                onSendInvite={handleSendInvite}
                onSendPasswordReset={handleSendPasswordReset}
              />
            )}
            {view === 'list' && (
              <PersonalTable
                personal={personal}
                statusar={statusar}
                onSelect={(p) => { setSelected(p); setView('detail'); loadDetail(p.id) }}
                onNew={() => setView('create')}
                onStatusChange={handleStatusChange}
                onImportCsv={handleImportCsv}
                onDeleteMany={handleDeleteMany}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
