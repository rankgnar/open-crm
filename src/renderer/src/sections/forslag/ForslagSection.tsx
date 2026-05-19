import { useState, useEffect, useCallback, useRef } from 'react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { useChangeListener } from '@/hooks/useChangeListener'
import { ForslagTable } from './ForslagTable'
import { ProjektInfoModal } from './ProjektInfoModal'
import { DuplikatForslagModal } from './DuplikatForslagModal'
import { ForslagForm } from './ForslagForm'
import { ForslagDetail } from './ForslagDetail'
import type { ForslagWithProjekt, CreateForslagInput, ForslagStatusar, ForslagFas, ForslagSubfas, ForslagArbete, ForslagMaterial, ForslagUnderentreprenor, SignaturSummary } from './types'
import type { ProjektWithKund, ProjektStatusar } from '@/sections/projekt/types'
import type { PdfMall } from '@/sections/installningar/types'
import { buildForslagDesglose } from '@/pdf/buildForslagDesglose'
import { DEFAULT_FORSLAG_HTML } from '@/pdf/defaultTemplates'
import { injectVars } from '@/pdf/inject'
import { useAppConfig } from '@/context/AppConfig'
import { aggregateForslag, computeForslagTotals } from '@/utils/forslag-totals'

type View = 'list' | 'create' | 'detail'

interface Props {
  initialProjektId?: string
  onNavigateProjekt?: (projektId: string) => void
  initialForslagId?: string
  openTidplanReminderOnLoad?: boolean
  onNavigateTidplan?: (forslagId: string, mode: 'send' | 'direct') => void
}

export function ForslagSection({ initialProjektId, onNavigateProjekt, initialForslagId, openTidplanReminderOnLoad, onNavigateTidplan }: Props = {}) {
  const { config } = useAppConfig()
  const ROT_CAP_SINGLE = config?.rot_avdrag_tak_enkel ?? 50000
  const ROT_CAP_DOUBLE = config?.rot_avdrag_tak_dubbel ?? 100000
  const [projektModalId, setProjektModalId] = useState<string | null>(null)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [forslag, setForslag] = useState<ForslagWithProjekt[]>([])
  const [allProjekt, setAllProjekt] = useState<ProjektWithKund[]>([])
  const [statusar, setStatusar] = useState<ForslagStatusar[]>([])
  const [projektStatusar, setProjektStatusar] = useState<ProjektStatusar[]>([])
  const [signingEvents, setSigningEvents] = useState<Record<string, SignaturSummary>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('list')
  const [selectedForslag, setSelectedForslag] = useState<ForslagWithProjekt | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [forslagData, projektData, statusData, projektStatusData, signingData] = await Promise.all([
        window.api.invoke('db:forslag:list') as Promise<ForslagWithProjekt[]>,
        window.api.invoke('db:projekt:list') as Promise<ProjektWithKund[]>,
        window.api.invoke('db:forslag-statusar:list') as Promise<ForslagStatusar[]>,
        window.api.invoke('db:projekt-statusar:list') as Promise<ProjektStatusar[]>,
        window.api.invoke('db:signatur-lank:forslag-events') as Promise<Record<string, SignaturSummary>>,
      ])
      setForslag(forslagData)
      setAllProjekt(projektData)
      setStatusar(statusData)
      setProjektStatusar(projektStatusData)
      setSigningEvents(signingData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useRefreshHandler(loadData)
  useChangeListener(['forslag', 'projekt'], loadData)

  const initialForslagConsumed = useRef(false)
  useEffect(() => {
    if (!initialForslagId || initialForslagConsumed.current || forslag.length === 0) return
    const target = forslag.find((f) => f.id === initialForslagId)
    if (target) {
      initialForslagConsumed.current = true
      setSelectedForslag(target)
      setView('detail')
    }
  }, [initialForslagId, forslag])

  async function handleCreate(data: CreateForslagInput, mallId?: string) {
    const created = await window.api.invoke('db:forslag:create', data) as ForslagWithProjekt
    if (mallId) {
      await window.api.invoke('db:forslag:apply-mall', created.id, mallId)
    }
    setForslag((prev) => [created, ...prev])
    setSelectedForslag(created)
    setView('detail')
    if (created.projekt_id) {
      window.api.invoke('db:projekt-aktivitet:create', {
        projekt_id: created.projekt_id,
        handelse: 'forslag_skapat',
        text: `Förslag ${created.forslag_nummer} skapat`,
      })
    }
  }

  function statusToHandelse(status: string): { handelse: string; text: (nummer: string) => string } {
    switch (status) {
      case 'Skickat':    return { handelse: 'forslag_skickat',  text: (n) => `Förslag ${n} skickat` }
      case 'Accepterat': return { handelse: 'forslag_signerat', text: (n) => `Förslag ${n} accepterat av kund` }
      case 'Avvisat':    return { handelse: 'forslag_avvisat',  text: (n) => `Förslag ${n} avvisat` }
      default:           return { handelse: 'forslag_status_andrad', text: (n) => `Förslag ${n} status ändrad till ${status}` }
    }
  }

  async function handleEdit(data: CreateForslagInput) {
    if (!selectedForslag) return
    const prevStatus = selectedForslag.status
    const updated = await window.api.invoke('db:forslag:update', selectedForslag.id, data) as ForslagWithProjekt
    setForslag((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    setSelectedForslag(updated)
    if (data.status && data.status !== prevStatus && updated.projekt_id) {
      const { handelse, text } = statusToHandelse(data.status)
      await window.api.invoke('db:projekt-aktivitet:create', {
        projekt_id: updated.projekt_id,
        handelse,
        text: text(updated.forslag_nummer),
      })
    }
  }

  async function handleStatusChange(id: string, status: string) {
    const updated = await window.api.invoke('db:forslag:update', id, { status }) as ForslagWithProjekt
    setForslag((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    if (selectedForslag?.id === id) setSelectedForslag(updated)
    if (updated.projekt_id) {
      const { handelse, text } = statusToHandelse(status)
      await window.api.invoke('db:projekt-aktivitet:create', {
        projekt_id: updated.projekt_id,
        handelse,
        text: text(updated.forslag_nummer),
      })
    }
  }

  async function handleExportPdf(f: ForslagWithProjekt) {
    const [faserData, arbeteData, materialData, ueData, subfaserData, mall] = await Promise.all([
      window.api.invoke('db:forslag-faser:list', f.id) as Promise<ForslagFas[]>,
      window.api.invoke('db:forslag-arbete:list-by-forslag', f.id) as Promise<ForslagArbete[]>,
      window.api.invoke('db:forslag-material:list-by-forslag', f.id) as Promise<ForslagMaterial[]>,
      window.api.invoke('db:forslag-ue:list-by-forslag', f.id) as Promise<ForslagUnderentreprenor[]>,
      window.api.invoke('db:forslag-subfaser:list-by-forslag', f.id) as Promise<ForslagSubfas[]>,
      window.api.invoke('db:pdf-mall:get', 'forslag').catch(() => null) as Promise<PdfMall | null>,
    ])

    const subfaserByFas: Record<string, ForslagSubfas[]> = {}
    faserData.forEach((fas) => { subfaserByFas[fas.id] = [] })
    subfaserData.forEach((s) => { if (!subfaserByFas[s.fas_id]) subfaserByFas[s.fas_id] = []; subfaserByFas[s.fas_id].push(s) })

    const arbeteBySubfas: Record<string, ForslagArbete[]> = {}
    arbeteData.forEach((a) => { if (!arbeteBySubfas[a.subfas_id]) arbeteBySubfas[a.subfas_id] = []; arbeteBySubfas[a.subfas_id].push(a) })

    const materialBySubfas: Record<string, ForslagMaterial[]> = {}
    materialData.forEach((m) => { if (!materialBySubfas[m.subfas_id]) materialBySubfas[m.subfas_id] = []; materialBySubfas[m.subfas_id].push(m) })

    const ueBySubfas: Record<string, ForslagUnderentreprenor[]> = {}
    ueData.forEach((u) => { if (!ueBySubfas[u.subfas_id]) ueBySubfas[u.subfas_id] = []; ueBySubfas[u.subfas_id].push(u) })

    const p = f.projekt
    const rotAvdrag = p.rot_avdrag ?? false
    const rotProcent = p.rot_procent ?? 30
    const rotInkluderaMedsokande = p.rot_inkludera_medsokande ?? false
    const accentFarg = mall?.accent_farg ?? '#1B3A6B'

    const desgloseHtml = buildForslagDesglose(
      faserData, subfaserByFas, arbeteBySubfas, materialBySubfas, ueBySubfas,
      { momsProcent: f.moms_procent, rotAvdrag, rotProcent, rotInkluderaMedsokande, rotCapEnkel: ROT_CAP_SINGLE, rotCapDubbel: ROT_CAP_DOUBLE, accentFarg, visaLeverantor: mall?.visa_leverantor_material !== false, visaFasNotat: mall?.visa_fas_notat !== false }
    )

    const totals = computeForslagTotals({
      ...aggregateForslag(arbeteData, materialData, ueData),
      momsProcent: f.moms_procent, rotAvdrag, rotProcent, rotInkluderaMedsokande,
      rotCapEnkel: ROT_CAP_SINGLE, rotCapDubbel: ROT_CAP_DOUBLE,
    })
    const { totalArbete, totalMaterial, totalUE, subtotal, moms: momsBelopp, totalInklMoms, rotBelopp, totalAttBetala: totalt } = totals
    const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))

    const logoHtml = config?.foretag_logo_url
      ? `<img src="${config.foretag_logo_url}" style="max-height:50px;max-width:160px;object-fit:contain;" />`
      : `<div class="cover-logo">${config?.foretag_namn ?? ''}</div>`

    const template = mall?.html_mall || DEFAULT_FORSLAG_HTML
    const vars: Record<string, string> = {
      foretag_namn: config?.foretag_namn ?? '',
      foretag_org_nummer: config?.foretag_org_nummer ?? '',
      foretag_telefon: config?.foretag_telefon ?? '',
      foretag_email: config?.foretag_email ?? '',
      foretag_webbadress: config?.foretag_webbadress ?? '',
      accent_farg: accentFarg,
      portada_titel: mall?.portada_titel || 'FÖRSLAG',
      portada_undertitel: mall?.portada_undertitel || 'Sammanställning av arbete och material',
      visa_portada_display: mall?.visa_portada !== false ? 'flex' : 'none',
      visa_sammanfattning_display: mall?.visa_sammanfattning !== false ? 'flex' : 'none',
      logo_html: logoHtml,
      visa_godkand_fskatt_html: mall?.visa_godkand_f_skatt !== false ? '<div class="cover-company-line">Godkänd för F-skatt</div>' : '',
      visa_godkand_fskatt_text: mall?.visa_godkand_f_skatt !== false ? ' &nbsp;·&nbsp; Godkänd för F-skatt' : '',
      projekt_nummer: p.projekt_nummer ?? '',
      forslag_nummer: f.forslag_nummer ?? '',
      kund_namn: p.kunder?.namn ?? '',
      projekt_namn: p.namn ?? '',
      adress: p.arbetsplats_adress ?? '',
      datum: new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }),
      giltighet: f.giltig_till ? new Date(f.giltig_till).toLocaleDateString('sv-SE') : '30 dagar',
      arbetskostnad: fmt(totalArbete),
      materialkostnad: fmt(totalMaterial),
      total_ue: fmt(totalUE),
      netto_exkl_moms: fmt(subtotal),
      moms_procent_text: String(f.moms_procent),
      moms_belopp: fmt(momsBelopp),
      total_inkl_moms: fmt(totalInklMoms),
      rot_avdrag: fmt(rotBelopp),
      rot_avdrag_display: rotBelopp > 0 ? 'flex' : 'none',
      rot_procent_text: String(rotProcent),
      // Legacy alias kept for custom templates that still reference it.
      netto_efter_rot: fmt(totalt),
      offertvarde: fmt(totalt),
      offertvarde_efter_rot: fmt(totalt),
      valuta: 'kr',
      desglose_html: desgloseHtml,
    }

    const html = injectVars(template, vars)
    await window.api.invoke('pdf:generate-html', { html, name: `forslag-${f.forslag_nummer}-${f.projekt.kunder.namn.replace(/\s+/g, '_')}`, save: true })
  }

  async function handleDelete() {
    if (!selectedForslag) return
    await window.api.invoke('db:forslag:delete', selectedForslag.id)
    setForslag((prev) => prev.filter((f) => f.id !== selectedForslag.id))
    setSelectedForslag(null)
    setView('list')
  }

  function handleDuplicated(newForslag: ForslagWithProjekt) {
    setForslag((prev) => [newForslag, ...prev])
    setSelectedForslag(newForslag)
    setView('detail')
    setShowDuplicate(false)
  }

  async function handleProjektStatusChange(projektId: string, status: string) {
    await window.api.invoke('db:projekt:update', projektId, { status })
    setForslag((prev) => prev.map((f) => f.projekt_id === projektId ? { ...f, projekt: { ...f.projekt, status } } : f))
  }

  async function handleDeleteMany(ids: string[]) {
    if (ids.length === 0) return
    await window.api.invoke('db:forslag:delete-many', ids)
    const idSet = new Set(ids)
    setForslag((prev) => prev.filter((f) => !idSet.has(f.id)))
    if (selectedForslag && idSet.has(selectedForslag.id)) {
      setSelectedForslag(null)
      setView('list')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted text-sm">Laddar förslag...</p>
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
    return <ForslagForm statusar={statusar} projekt={allProjekt} onSubmit={handleCreate} onCancel={() => setView('list')} />
  }

  if (view === 'detail' && selectedForslag) {
    return (
      <ForslagDetail
        forslag={selectedForslag}
        statusar={statusar}
        allProjekt={allProjekt}
        onBack={() => { setView('list'); setSelectedForslag(null) }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onNavigateProjekt={onNavigateProjekt ? () => onNavigateProjekt(selectedForslag.projekt_id) : undefined}
        onNavigateTidplan={onNavigateTidplan ? (mode) => onNavigateTidplan(selectedForslag.id, mode) : undefined}
        openTidplanReminder={openTidplanReminderOnLoad && selectedForslag?.id === initialForslagId}
      />
    )
  }

  const visibleForslag = initialProjektId
    ? forslag.filter((f) => f.projekt_id === initialProjektId)
    : forslag

  return (
    <>
      <ForslagTable
        forslag={visibleForslag}
        statusar={statusar}
        projektStatusar={projektStatusar}
        signingEvents={signingEvents}
        onSelect={(f) => { setSelectedForslag(f); setView('detail') }}
        onNew={() => setView('create')}
        onDuplicate={() => setShowDuplicate(true)}
        onStatusChange={handleStatusChange}
        onExportPdf={handleExportPdf}
        onDeleteMany={handleDeleteMany}
        onClickProjekt={(id) => setProjektModalId(id)}
        onProjektStatusChange={handleProjektStatusChange}
      />
      {projektModalId && (
        <ProjektInfoModal projektId={projektModalId} onClose={() => setProjektModalId(null)} />
      )}
      {showDuplicate && (
        <DuplikatForslagModal
          allForslag={forslag}
          allProjekt={allProjekt}
          defaultProjektId={initialProjektId}
          onClose={() => setShowDuplicate(false)}
          onDuplicated={handleDuplicated}
        />
      )}
    </>
  )
}
