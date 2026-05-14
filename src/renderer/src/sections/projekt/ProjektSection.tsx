import { useState, useEffect, useCallback } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { ProjektTable } from './ProjektTable'
import { ProjektForm } from './ProjektForm'
import { ProjektDetail } from './ProjektDetail'
import type { ProjektWithKund, CreateProjektInput, ProjektAnteckning, ProjektStatusar, ProjektDokument, FileDialogResult, ProjektAktivitet, DokumentKategori, Frageblankett, FragaFalt, FrageblanktEpostDraft } from './types'
import type { Kund } from '@/sections/kunder/types'
import type { FaktureringSnapshot } from '@/sections/fakturering/types'

type View = 'list' | 'create' | 'detail'

interface Props {
  initialProjektId?: string
}

export function ProjektSection({ initialProjektId }: Props = {}) {
  const [projekt, setProjekt] = useState<ProjektWithKund[]>([])
  const [kunder, setKunder] = useState<Kund[]>([])
  const [fragSummary, setFragSummary] = useState<Record<string, string>>({})
  const [forslagSummary, setForslagSummary] = useState<Record<string, { status: string; farg: string; forslag_nummer: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('list')
  const [selectedProjekt, setSelectedProjekt] = useState<ProjektWithKund | null>(null)
  const [anteckningar, setAnteckningar] = useState<ProjektAnteckning[]>([])
  const [snapshots, setSnapshots] = useState<FaktureringSnapshot[]>([])
  const [statusar, setStatusar] = useState<ProjektStatusar[]>([])
  const [dokument, setDokument] = useState<ProjektDokument[]>([])
  const [aktiviteter, setAktiviteter] = useState<ProjektAktivitet[]>([])
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [frageblanktter, setFrageblanktter] = useState<Frageblankett[]>([])

  function logActivity(projekt_id: string, handelse: string, text: string) {
    return window.api.invoke('db:projekt-aktivitet:create', { projekt_id, handelse, text })
  }

  const loadData = useCallback(async () => {
    try {
      const [projektData, kunderData, statusData, fc, fs] = await Promise.all([
        window.api.invoke('db:projekt:list') as Promise<ProjektWithKund[]>,
        window.api.invoke('db:kunder:list') as Promise<Kund[]>,
        window.api.invoke('db:projekt-statusar:list') as Promise<ProjektStatusar[]>,
        window.api.invoke('db:projekt:frageblankett-summary') as Promise<Record<string, string>>,
        window.api.invoke('db:forslag:status-summary') as Promise<Record<string, { status: string; farg: string; forslag_nummer: string }>>,
      ])
      setProjekt(projektData)
      setKunder(kunderData)
      setStatusar(statusData)
      setFragSummary(fc)
      setForslagSummary(fs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useRefreshHandler(loadData)

  useEffect(() => {
    if (!initialProjektId || projekt.length === 0) return
    const p = projekt.find((pr) => pr.id === initialProjektId)
    if (!p) return
    setSelectedProjekt(p)
    setView('detail')
    loadAnteckningar(p.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjektId, projekt])

  async function handleCreate(data: CreateProjektInput) {
    const created = await window.api.invoke('db:projekt:create', data) as ProjektWithKund
    setProjekt((prev) => [created, ...prev])
    logActivity(created.id, 'projekt_skapat', 'Projekt skapat')
    setView('list')
  }

  async function handleEdit(data: CreateProjektInput) {
    if (!selectedProjekt) return
    const prev = selectedProjekt
    const updated = await window.api.invoke('db:projekt:update', selectedProjekt.id, data) as ProjektWithKund
    setProjekt((p) => p.map((x) => (x.id === updated.id ? updated : x)))
    setSelectedProjekt(updated)

    const logs: Array<{ handelse: string; text: string }> = []
    if (data.status && data.status !== prev.status) {
      logs.push({ handelse: 'status_andrad', text: `Status ändrad till ${data.status}` })
    }
    if (data.kund_id && data.kund_id !== prev.kund_id) {
      const oldKund = kunder.find((k) => k.id === prev.kund_id)?.namn ?? prev.kunder?.namn ?? '—'
      const newKund = kunder.find((k) => k.id === data.kund_id)?.namn ?? '—'
      logs.push({ handelse: 'kund_andrad', text: `Kund ändrad från ${oldKund} till ${newKund}` })
    }
    if (typeof data.budget_total === 'number' && data.budget_total !== prev.budget_total) {
      const fmt = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`
      logs.push({ handelse: 'budget_andrad', text: `Budget ändrad från ${fmt(prev.budget_total)} till ${fmt(data.budget_total)}` })
    }
    const startBefore = prev.startdatum ?? ''
    const startAfter = data.startdatum ?? ''
    const slutBefore = prev.slutdatum ?? ''
    const slutAfter = data.slutdatum ?? ''
    if (startBefore !== startAfter || slutBefore !== slutAfter) {
      const fmt = (d: string) => d || '—'
      logs.push({
        handelse: 'datum_andrade',
        text: `Datum ändrade: ${fmt(startBefore)} → ${fmt(slutBefore)}  ⇒  ${fmt(startAfter)} → ${fmt(slutAfter)}`,
      })
    }

    for (const l of logs) await logActivity(selectedProjekt.id, l.handelse, l.text)
    if (logs.length > 0) {
      const aktivData = await window.api.invoke('db:projekt-aktivitet:list', selectedProjekt.id) as ProjektAktivitet[]
      setAktiviteter(aktivData)
    }
  }

  async function loadAnteckningar(projektId: string) {
    const [antData, snapData, dokData, aktivData, blanktData] = await Promise.all([
      window.api.invoke('db:projekt-anteckningar:list', projektId) as Promise<ProjektAnteckning[]>,
      window.api.invoke('db:fakturering:list-by-projekt', projektId) as Promise<FaktureringSnapshot[]>,
      window.api.invoke('db:projekt-dokument:list', projektId) as Promise<ProjektDokument[]>,
      window.api.invoke('db:projekt-aktivitet:list', projektId) as Promise<ProjektAktivitet[]>,
      window.api.invoke('db:frageblankett:list-by-projekt', projektId) as Promise<Frageblankett[]>,
    ])
    setAnteckningar(antData)
    setSnapshots(snapData)
    setDokument(dokData)
    setAktiviteter(aktivData)
    setFrageblanktter(blanktData)
  }

  async function handleGenerateFromText(txt: string): Promise<FragaFalt[]> {
    return window.api.invoke('db:frageblankett:generate-from-text', txt) as Promise<FragaFalt[]>
  }

  async function handleCreateBlankett(titel: string, questionsJson: FragaFalt[]): Promise<Frageblankett> {
    if (!selectedProjekt) throw new Error('No project selected')
    const b = await window.api.invoke('db:frageblankett:create', { projekt_id: selectedProjekt.id, titel, questions_json: questionsJson }) as Frageblankett
    setFrageblanktter(prev => [b, ...prev])
    return b
  }

  async function handleDeleteBlankett(id: string): Promise<void> {
    await window.api.invoke('db:frageblankett:delete', id)
    setFrageblanktter(prev => prev.filter(b => b.id !== id))
  }

  async function handleGetBlanktLink(id: string): Promise<string> {
    return window.api.invoke('db:frageblankett:get-link', id) as Promise<string>
  }

  async function handleSaveBlanktAsDoc(id: string): Promise<ProjektDokument> {
    const dok = await window.api.invoke('db:frageblankett:save-as-dokument', id) as ProjektDokument
    setDokument(prev => [dok, ...prev])
    return dok
  }

  async function handleRefreshBlankett(id: string): Promise<Frageblankett> {
    const updated = await window.api.invoke('db:frageblankett:get', id) as Frageblankett
    setFrageblanktter(prev => prev.map(b => b.id === id ? updated : b))
    return updated
  }

  async function handleGetBlanktEpostDraft(id: string): Promise<FrageblanktEpostDraft> {
    return window.api.invoke('db:frageblankett:get-epost-draft', id) as Promise<FrageblanktEpostDraft>
  }

  async function handleSendBlanktEpost(draft: FrageblanktEpostDraft): Promise<void> {
    await window.api.invoke('db:epost:send', {
      till: draft.till,
      amne: draft.amne,
      kropp: draft.kropp_html,
      alias_id: draft.alias_id,
      projekt_id: draft.projekt_id,
      kund_id: draft.kund_id,
    })
    // Refresh timeline so the email log appears immediately
    const [antData, aktivData] = await Promise.all([
      window.api.invoke('db:projekt-anteckningar:list', draft.projekt_id) as Promise<ProjektAnteckning[]>,
      window.api.invoke('db:projekt-aktivitet:list', draft.projekt_id) as Promise<ProjektAktivitet[]>,
    ])
    setAnteckningar(antData)
    setAktiviteter(aktivData)
  }

  async function handleUploadDokument(kategori: DokumentKategori = 'dokument', carpeta: string | null = null) {
    if (!selectedProjekt) return
    const files = await window.api.invoke('dialog:open-files') as FileDialogResult[]
    if (!files.length) return
    setUploadProgress({ current: 0, total: files.length })
    for (let i = 0; i < files.length; i++) {
      await window.api.invoke('db:projekt-dokument:upload', { projektId: selectedProjekt.id, ...files[i], kategori, carpeta })
      setUploadProgress({ current: i + 1, total: files.length })
    }
    setUploadProgress(null)
    const docs = await window.api.invoke('db:projekt-dokument:list', selectedProjekt.id) as ProjektDokument[]
    setDokument(docs)
    const kategoriLabel: Record<DokumentKategori, string> = { dokument: 'Dokument', faktura: 'Faktura', order: 'Order', ata: 'ÄTA' }
    const label = files.length === 1 ? `${kategoriLabel[kategori]} uppladdat: ${files[0].fileName}` : `${files.length} ${kategoriLabel[kategori].toLowerCase()}er uppladdade`
    await logActivity(selectedProjekt.id, 'dokument_uppladdat', label)
    const aktivData = await window.api.invoke('db:projekt-aktivitet:list', selectedProjekt.id) as ProjektAktivitet[]
    setAktiviteter(aktivData)
  }

  async function handleMoveCarpeta(id: string, carpeta: string | null) {
    const updated = await window.api.invoke('db:projekt-dokument:move-carpeta', { id, carpeta }) as ProjektDokument
    setDokument((prev) => prev.map((d) => (d.id === id ? updated : d)))
  }

  async function handleClearCarpeta(carpeta: string) {
    if (!selectedProjekt) return
    await window.api.invoke('db:projekt-dokument:clear-carpeta', { projektId: selectedProjekt.id, carpeta })
    const docs = await window.api.invoke('db:projekt-dokument:list', selectedProjekt.id) as ProjektDokument[]
    setDokument(docs)
  }

  async function handleDeleteDokument(id: string, storagePath: string) {
    if (!selectedProjekt) return
    const dok = dokument.find((d) => d.id === id)
    await window.api.invoke('db:projekt-dokument:delete', { id, storagePath })
    setDokument((prev) => prev.filter((d) => d.id !== id))
    await logActivity(selectedProjekt.id, 'dokument_borttaget', `Dokument borttaget: ${dok?.filnamn ?? storagePath}`)
    const aktivData = await window.api.invoke('db:projekt-aktivitet:list', selectedProjekt.id) as ProjektAktivitet[]
    setAktiviteter(aktivData)
  }

  async function handleOpenDokument(storagePath: string) {
    const dok = dokument.find((d) => d.storage_path === storagePath)
    await window.api.invoke('db:projekt-dokument:get-data', { storagePath, mimeType: dok?.mime_type ?? 'application/octet-stream' })
  }

  async function handleToggleDokumentVisibility(id: string, synlig: boolean) {
    const updated = await window.api.invoke('db:projekt-dokument:set-visibility', { id, synlig_for_kund: synlig }) as ProjektDokument
    setDokument((prev) => prev.map((d) => (d.id === id ? updated : d)))
  }

  async function handleRenameDokument(id: string, filnamn: string) {
    const updated = await window.api.invoke('db:projekt-dokument:rename', { id, filnamn }) as ProjektDokument
    setDokument((prev) => prev.map((d) => (d.id === id ? updated : d)))
  }

  async function handleAddAnteckning(titel: string, innehall: string, farg: string) {
    if (!selectedProjekt) return
    const created = await window.api.invoke('db:projekt-anteckningar:create', { projekt_id: selectedProjekt.id, titel, innehall, farg }) as ProjektAnteckning
    setAnteckningar((prev) => [created, ...prev])
  }

  async function handleUpdateAnteckning(id: string, titel: string, innehall: string, farg: string) {
    const updated = await window.api.invoke('db:projekt-anteckningar:update', id, { titel, innehall, farg }) as ProjektAnteckning
    setAnteckningar((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }

  async function handleChangeAnteckningFarg(id: string, farg: string) {
    const a = anteckningar.find((n) => n.id === id)
    if (!a) return
    const updated = await window.api.invoke('db:projekt-anteckningar:update', id, { titel: a.titel, innehall: a.innehall, farg }) as ProjektAnteckning
    setAnteckningar((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
  }

  async function handleDeleteAnteckning(id: string) {
    await window.api.invoke('db:projekt-anteckningar:delete', id)
    setAnteckningar((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleStatusChange(id: string, status: string) {
    const updated = await window.api.invoke('db:projekt:update', id, { status }) as ProjektWithKund
    setProjekt((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    if (selectedProjekt?.id === id) setSelectedProjekt(updated)
    await logActivity(id, 'status_andrad', `Status ändrad till ${status}`)
    if (selectedProjekt?.id === id) {
      const aktivData = await window.api.invoke('db:projekt-aktivitet:list', id) as ProjektAktivitet[]
      setAktiviteter(aktivData)
    }
  }

  async function handleDelete() {
    if (!selectedProjekt) return
    await window.api.invoke('db:projekt:delete', selectedProjekt.id)
    setProjekt((prev) => prev.filter((p) => p.id !== selectedProjekt.id))
    setSelectedProjekt(null)
    setView('list')
  }

  async function handleStatusChangeMany(ids: string[], status: string) {
    await window.api.invoke('db:projekt:update-status-many', ids, status)
    setProjekt((prev) => prev.map((p) => ids.includes(p.id) ? { ...p, status } : p))
    if (selectedProjekt && ids.includes(selectedProjekt.id)) setSelectedProjekt((prev) => prev ? { ...prev, status } : prev)
  }

  async function handleDeleteMany(ids: string[]) {
    await window.api.invoke('db:projekt:delete-many', ids)
    setProjekt((prev) => prev.filter((p) => !ids.includes(p.id)))
    if (selectedProjekt && ids.includes(selectedProjekt.id)) {
      setSelectedProjekt(null)
      setView('list')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted text-sm">Laddar projekt...</p>
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
    return <ProjektForm kunder={kunder} statusar={statusar} onSubmit={handleCreate} onCancel={() => setView('list')} />
  }

  if (view === 'detail' && selectedProjekt) {
    return (
      <ProjektDetail
        projekt={selectedProjekt}
        kunder={kunder}
        statusar={statusar}
        anteckningar={anteckningar}
        snapshots={snapshots}
        onBack={() => { setView('list'); setSelectedProjekt(null); setAnteckningar([]); setSnapshots([]); setDokument([]); setAktiviteter([]); setFrageblanktter([]) }}
        onEdit={handleEdit}
        onChangeStatus={(status) => handleStatusChange(selectedProjekt.id, status)}
        onDelete={handleDelete}
        onAddAnteckning={handleAddAnteckning}
        onUpdateAnteckning={handleUpdateAnteckning}
        onDeleteAnteckning={handleDeleteAnteckning}
        onChangeAnteckningFarg={handleChangeAnteckningFarg}
        aktiviteter={aktiviteter}
        dokument={dokument}
        onUploadDokument={handleUploadDokument}
        onDeleteDokument={handleDeleteDokument}
        onOpenDokument={handleOpenDokument}
        onToggleDokumentVisibility={handleToggleDokumentVisibility}
        onMoveCarpeta={handleMoveCarpeta}
        onDeleteCarpeta={handleClearCarpeta}
        onRenameDokument={handleRenameDokument}
        uploadProgress={uploadProgress}

        frageblanktter={frageblanktter}
        onGenerateFromText={handleGenerateFromText}
        onCreateBlankett={handleCreateBlankett}
        onDeleteBlankett={handleDeleteBlankett}
        onGetBlanktLink={handleGetBlanktLink}
        onSaveBlanktAsDoc={handleSaveBlanktAsDoc}
        onRefreshBlankett={handleRefreshBlankett}
        onGetBlanktEpostDraft={handleGetBlanktEpostDraft}
        onSendBlanktEpost={handleSendBlanktEpost}
      />
    )
  }

  return (
    <ProjektTable
      projekt={projekt}
      statusar={statusar}
      fragSummary={fragSummary}
      forslagSummary={forslagSummary}
      onSelect={(p) => { setSelectedProjekt(p); setView('detail'); loadAnteckningar(p.id) }}
      onNew={() => setView('create')}
      onStatusChange={handleStatusChange}
      onStatusChangeMany={handleStatusChangeMany}
      onDeleteMany={handleDeleteMany}
    />
  )
}
