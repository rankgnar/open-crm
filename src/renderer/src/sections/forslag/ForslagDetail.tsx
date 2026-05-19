import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowLeft, ArrowUp, ArrowDown, Pencil, Trash2, Plus, X as XIcon, Check, ChevronRight, ChevronDown, CalendarDays, FileDown, Send, Mail, RefreshCw, FolderOpen, ChevronsUpDown, StickyNote, Eye, EyeOff, Sparkles, Loader2, Bell, Tags } from 'lucide-react'
import { WorkflowTriggerBar } from '@/components/WorkflowTriggerBar'
import { SkickaForSignaturModal } from '@/sections/signatur/SkickaForSignaturModal'
import { SkickaUppdateradVersionModal } from '@/sections/signatur/SkickaUppdateradVersionModal'
import { PaminnelseModal } from '@/sections/signatur/PaminnelseModal'
import { VilkorReminderModal } from './VilkorReminderModal'
import { TidplanReminderModal } from './TidplanReminderModal'
import { BulkTimprisModal } from './BulkTimprisModal'
import { SignaturLankarPanel } from '@/sections/signatur/SignaturLankarPanel'
import { SignaturTimeline } from '@/sections/signatur/SignaturTimeline'
import { SignaturGodkannandeBlock } from '@/sections/signatur/SignaturGodkannandeBlock'
import type { SignaturLank } from '@/sections/signatur/types'
import { ForslagForm } from './ForslagForm'
import { FasEditor } from './FasEditor'
import { ForslagKostnadsPanel } from './ForslagKostnadsPanel'
import { buildTidplanHtml } from '@/pdf/buildTidplanHtml'
import type {
  ForslagWithProjekt, CreateForslagInput, ForslagStatusar,
  ForslagFas, ForslagSubfas, ForslagArbete, ForslagMaterial, ForslagUnderentreprenor,
  ForslagEpostRef,
} from './types'
import type { ProjektWithKund, ProjektAnteckning, ProjektDokument, AnteckningFarg } from '@/sections/projekt/types'
import { ANTECKNING_FARG_DOT } from '@/sections/projekt/types'
import { DokumentPanel } from '@/sections/projekt/DokumentPanel'
import type { Kund } from '@/sections/kunder/types'
import type { AiAssistent, ArbetsRoll, PdfMall } from '@/sections/installningar/types'
import { useAppConfig } from '@/context/AppConfig'
import { buildForslagDesglose } from '@/pdf/buildForslagDesglose'
import { DEFAULT_FORSLAG_HTML } from '@/pdf/defaultTemplates'
import { injectVars } from '@/pdf/inject'
import { aggregateForslag, computeForslagTotals } from '@/utils/forslag-totals'

const FARG_DOT: Record<string, string> = {
  emerald: 'bg-emerald-400', blue: 'bg-blue-400', amber: 'bg-amber-400', red: 'bg-red-400', muted: 'bg-muted',
}

const ANT_FARG_OPTIONS: { value: AnteckningFarg; dot: string }[] = [
  { value: 'muted',   dot: 'bg-subtle border-subtle' },
  { value: 'emerald', dot: 'bg-emerald-400 border-emerald-400' },
  { value: 'amber',   dot: 'bg-amber-400 border-amber-400' },
  { value: 'red',     dot: 'bg-red-400 border-red-400' },
  { value: 'blue',    dot: 'bg-blue-400 border-blue-400' },
]

function AntFargPicker({ value, onChange }: { value: AnteckningFarg; onChange: (f: AnteckningFarg) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {ANT_FARG_OPTIONS.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`size-3 rounded-full border-2 transition-transform ${o.dot} ${value === o.value ? 'scale-125' : 'opacity-50 hover:opacity-100'}`} />
      ))}
    </div>
  )
}

interface EpostKoRef {
  id: string
  amne: string
  till: string
  status: string
  schemalagd_till: string
  skickad_at: string | null
  fel_meddelande: string
}

interface Props {
  forslag: ForslagWithProjekt
  statusar: ForslagStatusar[]
  allProjekt: ProjektWithKund[]
  onBack: () => void
  onEdit: (data: CreateForslagInput) => Promise<void>
  onDelete: () => Promise<void>
  onNavigateProjekt?: () => void
  onNavigateTidplan?: (mode: 'send' | 'direct') => void
  openTidplanReminder?: boolean
}

export function ForslagDetail({ forslag: forslagProp, statusar, allProjekt, onBack, onEdit, onDelete, onNavigateProjekt, onNavigateTidplan, openTidplanReminder }: Props) {
  // Local mirror so server-side status bumps (utkast → skickat → accepterat)
  // reflect in the UI without parent refetch.
  const [forslag, setForslag] = useState(forslagProp)
  useEffect(() => { setForslag(forslagProp) }, [forslagProp])

  const currentStatus = statusar.find((s) => s.namn === forslag.status)
  const { config, formatCurrency } = useAppConfig()
  const ROT_CAP_SINGLE = config?.rot_avdrag_tak_enkel ?? 50000
  const ROT_CAP_DOUBLE = config?.rot_avdrag_tak_dubbel ?? 100000
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [showVilkorReminder, setShowVilkorReminder] = useState(false)
  const [showTidplanReminder, setShowTidplanReminder] = useState(false)
  const [showBulkTimpris, setShowBulkTimpris] = useState(false)
  const [linksRefresh, setLinksRefresh] = useState(0)
  const [latestLink, setLatestLink] = useState<SignaturLank | null>(null)
  const [sendingRevised, setSendingRevised] = useState(false)
  const [revisedFeedback, setRevisedFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [showAndringHistorik, setShowAndringHistorik] = useState(false)
  const [showRevisedModal, setShowRevisedModal] = useState(false)
  const [showPaminnelseModal, setShowPaminnelseModal] = useState(false)
  const [sendingPaminnelse, setSendingPaminnelse]     = useState(false)
  const [paminnelseFeedback, setPaminnelseFeedback]   = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [paminnelseDefaultMsg, setPaminnelseDefaultMsg] = useState('')
  const [rightTab, setRightTab] = useState<'signering' | 'uppgifter' | 'projekt' | 'kostnad' | 'epost' | 'villkor' | 'anteckningar' | 'dokument'>('signering')
  const [kundFull, setKundFull] = useState<Kund | null>(null)
  const [epostRefs, setEpostRefs] = useState<ForslagEpostRef[]>([])
  const [epostKo, setEpostKo] = useState<EpostKoRef[]>([])
  const [epostLoading, setEpostLoading] = useState(false)
  const [epostOpenHint, setEpostOpenHint] = useState(false)
  const [villkorEditing, setVillkorEditing] = useState(false)
  const [villkorDraft, setVillkorDraft] = useState('')
  const [villkorSaving, setVillkorSaving] = useState(false)
  const [villkorAssistentId, setVillkorAssistentId] = useState<string | null>(null)
  const [villkorGenerating, setVillkorGenerating] = useState(false)

  // Anteckningar (project notes, shared with ProjektDetail)
  const [anteckningar, setAnteckningar] = useState<ProjektAnteckning[]>([])
  const [nyAntTitel, setNyAntTitel] = useState('')
  const [nyAntInnehall, setNyAntInnehall] = useState('')
  const [nyAntFarg, setNyAntFarg] = useState<AnteckningFarg>('muted')
  const [savingNote, setSavingNote] = useState(false)
  const [expandedAntIds, setExpandedAntIds] = useState<Set<string>>(new Set())
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editAntTitel, setEditAntTitel] = useState('')
  const [editAntInnehall, setEditAntInnehall] = useState('')
  const [editAntFarg, setEditAntFarg] = useState<AnteckningFarg>('muted')
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)

  // Dokument (project documents, shared with ProjektDetail)
  const [dokument, setDokument] = useState<ProjektDokument[]>([])
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)

  useEffect(() => {
    if (rightTab !== 'uppgifter') return
    window.api.invoke('db:kunder:get', forslag.projekt.kund_id).then(k => setKundFull(k as Kund))
  }, [rightTab, forslag.projekt.kund_id])

  useEffect(() => {
    if (rightTab !== 'villkor') return
    window.api.invoke('ai:asistenter:list').then((list) => {
      const found = (list as AiAssistent[]).find(a => a.aktiv && a.uppgifter.includes('villkor-beskrivning'))
      setVillkorAssistentId(found?.id ?? null)
    })
  }, [rightTab])

  useEffect(() => {
    if (rightTab !== 'epost') return
    setEpostLoading(true)
    Promise.all([
      window.api.invoke('db:forslag-epost:list', forslag.id) as Promise<ForslagEpostRef[]>,
      window.api.invoke('db:epost-ko:list-by-forslag', forslag.id) as Promise<EpostKoRef[]>,
    ]).then(([refs, ko]) => {
      setEpostRefs(refs)
      setEpostKo(ko)
    }).finally(() => setEpostLoading(false))
  }, [rightTab, forslag.id])

  useEffect(() => {
    if (rightTab !== 'anteckningar') return
    window.api.invoke('db:projekt-anteckningar:list', forslag.projekt_id)
      .then(d => setAnteckningar(d as ProjektAnteckning[]))
  }, [rightTab, forslag.projekt_id])

  useEffect(() => {
    if (rightTab !== 'dokument') return
    window.api.invoke('db:projekt-dokument:list', forslag.projekt_id)
      .then(d => setDokument((d as ProjektDokument[]).filter(doc => (doc.kategori ?? 'dokument') === 'dokument')))
  }, [rightTab, forslag.projekt_id])

  const [pdfTitelPicker, setPdfTitelPicker] = useState<{ titel1: string; titel2: string } | null>(null)
  // Selected title + tidplan-attach flag inside the export modal.
  const [pdfExportTitel, setPdfExportTitel] = useState<string>('')
  const [pdfExportBifogaTidplan, setPdfExportBifogaTidplan] = useState<boolean>(false)
  const [pdfExportSammanfattad, setPdfExportSammanfattad] = useState<boolean>(false)
  const [pdfExportSplit, setPdfExportSplit] = useState<boolean>(false)
  const [signaturTitelOptions, setSignaturTitelOptions] = useState<{ titel1: string; titel2?: string } | null>(null)

  useEffect(() => {
    if (openTidplanReminder) setShowTidplanReminder(true)
  }, [openTidplanReminder])

  const [accentFarg, setAccentFarg] = useState('#1B3A6B')
  useEffect(() => {
    window.api.invoke('db:pdf-mall:get', 'forslag').then((m) => {
      const mall = m as PdfMall | null
      if (mall?.accent_farg) setAccentFarg(mall.accent_farg)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    window.api.invoke('db:epost-mallar:list').then((mallar) => {
      const mall = (mallar as { system_kod: string | null; meddelande_standard: string | null }[])
        .find(m => m.system_kod === 'signatur_paminnelse_forslag')
      if (mall?.meddelande_standard) {
        const kundNamn = forslag.projekt.kunder.namn
        setPaminnelseDefaultMsg(mall.meddelande_standard.replace(/\{\{kund_namn\}\}/g, kundNamn))
      }
    }).catch(() => {})
  }, [forslag.projekt.kunder.namn])

  // Faser
  const [faser, setFaser] = useState<ForslagFas[]>([])
  const [selectedFasId, setSelectedFasId] = useState<string | null>(null)
  const [collapsedFaser, setCollapsedFaser] = useState<Set<string>>(new Set())
  const [addingFas, setAddingFas] = useState(false)
  const [nyFasNamn, setNyFasNamn] = useState('')
  const [editingFasId, setEditingFasId] = useState<string | null>(null)
  const [editFasNamn, setEditFasNamn] = useState('')
  const [editingFasNotatId, setEditingFasNotatId] = useState<string | null>(null)
  const [editFasNotat, setEditFasNotat] = useState('')

  // Subfaser
  const [subfaserByFas, setSubfaserByFas] = useState<Record<string, ForslagSubfas[]>>({})
  const [selectedSubfasIds, setSelectedSubfasIds] = useState<Set<string>>(new Set())
  const [addingSubfas, setAddingSubfas] = useState(false)
  const [nySubfasNamn, setNySubfasNamn] = useState('')
  const [editingSubfasId, setEditingSubfasId] = useState<string | null>(null)
  const [editSubfasNamn, setEditSubfasNamn] = useState('')

  const [arbetsRoller, setArbetsRoller] = useState<ArbetsRoll[]>([])
  const catalogPortalRef = useRef<HTMLDivElement>(null)

  // Arbete + Material + UE (keyed by subfas_id)
  const [arbeteBySubfas, setArbeteBySubfas] = useState<Record<string, ForslagArbete[]>>({})
  const [materialBySubfas, setMaterialBySubfas] = useState<Record<string, ForslagMaterial[]>>({})
  const [ueBySubfas, setUeBySubfas] = useState<Record<string, ForslagUnderentreprenor[]>>({})

  const loadAll = useCallback(async () => {
    const [faserData, arbeteData, materialData, ueData] = await Promise.all([
      window.api.invoke('db:forslag-faser:list', forslag.id) as Promise<ForslagFas[]>,
      window.api.invoke('db:forslag-arbete:list-by-forslag', forslag.id) as Promise<ForslagArbete[]>,
      window.api.invoke('db:forslag-material:list-by-forslag', forslag.id) as Promise<ForslagMaterial[]>,
      window.api.invoke('db:forslag-ue:list-by-forslag', forslag.id) as Promise<ForslagUnderentreprenor[]>,
    ])
    setFaser(faserData)
    setCollapsedFaser(new Set())

    if (faserData.length > 0) {
      const fasIds = faserData.map((f) => f.id)
      const subfaserData = await window.api.invoke('db:forslag-subfaser:list-by-forslag', forslag.id) as ForslagSubfas[]
      const byFas: Record<string, ForslagSubfas[]> = {}
      fasIds.forEach((id) => { byFas[id] = [] })
      subfaserData.forEach((s) => {
        if (!byFas[s.fas_id]) byFas[s.fas_id] = []
        byFas[s.fas_id].push(s)
      })
      setSubfaserByFas(byFas)

      const byArbete: Record<string, ForslagArbete[]> = {}
      arbeteData.forEach((a) => {
        if (!byArbete[a.subfas_id]) byArbete[a.subfas_id] = []
        byArbete[a.subfas_id].push(a)
      })
      setArbeteBySubfas(byArbete)

      const byMaterial: Record<string, ForslagMaterial[]> = {}
      materialData.forEach((m) => {
        if (!byMaterial[m.subfas_id]) byMaterial[m.subfas_id] = []
        byMaterial[m.subfas_id].push(m)
      })
      setMaterialBySubfas(byMaterial)

      const byUE: Record<string, ForslagUnderentreprenor[]> = {}
      ueData.forEach((u) => {
        if (!byUE[u.subfas_id]) byUE[u.subfas_id] = []
        byUE[u.subfas_id].push(u)
      })
      setUeBySubfas(byUE)
    }
  }, [forslag.id])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    window.api.invoke('db:arbets-roller:list').then((r) => setArbetsRoller(r as ArbetsRoll[]))
  }, [])

  // Refetch the forslag itself when linksRefresh ticks — keeps status,
  // godkand_av etc. in sync with BD after the customer signs.
  useEffect(() => {
    if (linksRefresh === 0) return
    void (async () => {
      try {
        const fresh = await window.api.invoke('db:forslag:get', forslagProp.id) as typeof forslagProp
        if (fresh) setForslag(fresh)
      } catch (e) { console.error(e) }
    })()
  }, [linksRefresh, forslagProp.id])

  // Most recent link (any state) feeds the Signering-timeline. Refresh when
  // a new link is sent or the panel is re-opened.
  useEffect(() => {
    void (async () => {
      const lankar = await window.api.invoke('db:signatur-lank:list-for-doc', 'forslag', forslag.id) as SignaturLank[]
      // list-for-doc returns DESC by skapad_at — first = most recent
      setLatestLink(lankar[0] ?? null)
    })()
  }, [forslag.id, linksRefresh])


  // --- Fas handlers ---
  async function handleAddFas() {
    const namn = nyFasNamn.trim()
    if (!namn) return
    const created = await window.api.invoke('db:forslag-faser:create', { forslag_id: forslag.id, namn }) as ForslagFas
    setFaser((prev) => [...prev, created])
    setSubfaserByFas((prev) => ({ ...prev, [created.id]: [] }))
    setCollapsedFaser((prev) => { const n = new Set(prev); n.delete(created.id); return n })
    setSelectedFasId(created.id)
    setSelectedSubfasIds(new Set())
    setNyFasNamn('')
    setAddingFas(false)
  }

  async function handleRenameFas() {
    if (!editingFasId) return
    const namn = editFasNamn.trim()
    if (!namn) { setEditingFasId(null); return }
    const updated = await window.api.invoke('db:forslag-faser:update', editingFasId, { namn }) as ForslagFas
    setFaser((prev) => prev.map((f) => f.id === updated.id ? updated : f))
    setEditingFasId(null)
  }

  async function handleSaveFasNotat(fasId: string) {
    const notat = editFasNotat.trim() || null
    const updated = await window.api.invoke('db:forslag-faser:update', fasId, { notat }) as ForslagFas
    setFaser((prev) => prev.map((f) => f.id === fasId ? updated : f))
    setEditingFasNotatId(null)
  }

  async function handleDeleteFas(fasId: string) {
    await window.api.invoke('db:forslag-faser:delete', fasId)
    setFaser((prev) => prev.filter((f) => f.id !== fasId))
    setSubfaserByFas((prev) => { const n = { ...prev }; delete n[fasId]; return n })
    setCollapsedFaser((prev) => { const n = new Set(prev); n.delete(fasId); return n })
    if (selectedFasId === fasId) { setSelectedFasId(null); setSelectedSubfasIds(new Set()) }
  }

  // --- Subfas handlers ---
  async function handleAddSubfas() {
    if (!selectedFasId) return
    const namn = nySubfasNamn.trim()
    if (!namn) return
    const created = await window.api.invoke('db:forslag-subfaser:create', { fas_id: selectedFasId, namn }) as ForslagSubfas
    setSubfaserByFas((prev) => ({ ...prev, [selectedFasId]: [...(prev[selectedFasId] ?? []), created] }))
    setArbeteBySubfas((prev) => ({ ...prev, [created.id]: [] }))
    setMaterialBySubfas((prev) => ({ ...prev, [created.id]: [] }))
    setUeBySubfas((prev) => ({ ...prev, [created.id]: [] }))
    setNySubfasNamn('')
    setAddingSubfas(false)
    setSelectedSubfasIds((prev) => { const n = new Set(prev); n.add(created.id); return n })
  }

  async function handleRenameSubfas() {
    if (!editingSubfasId) return
    const namn = editSubfasNamn.trim()
    if (!namn) { setEditingSubfasId(null); return }
    const updated = await window.api.invoke('db:forslag-subfaser:update', editingSubfasId, { namn }) as ForslagSubfas
    setSubfaserByFas((prev) => ({
      ...prev,
      [updated.fas_id]: (prev[updated.fas_id] ?? []).map((s) => s.id === updated.id ? updated : s)
    }))
    setEditingSubfasId(null)
  }

  async function handleDeleteSubfas(subfas: ForslagSubfas) {
    await window.api.invoke('db:forslag-subfaser:delete', subfas.id)
    setSubfaserByFas((prev) => ({
      ...prev,
      [subfas.fas_id]: (prev[subfas.fas_id] ?? []).filter((s) => s.id !== subfas.id)
    }))
    setArbeteBySubfas((prev) => { const n = { ...prev }; delete n[subfas.id]; return n })
    setMaterialBySubfas((prev) => { const n = { ...prev }; delete n[subfas.id]; return n })
    setUeBySubfas((prev) => { const n = { ...prev }; delete n[subfas.id]; return n })
    setSelectedSubfasIds((prev) => { const n = new Set(prev); n.delete(subfas.id); return n })
  }

  async function handleToggleFasAktiv(fas: ForslagFas) {
    const next = !fas.aktiv
    setFaser((prev) => prev.map((f) => f.id === fas.id ? { ...f, aktiv: next } : f))
    await window.api.invoke('db:forslag-faser:update', fas.id, { aktiv: next })
  }

  async function handleMoveFas(fas: ForslagFas, dir: 'up' | 'down') {
    const idx = faser.findIndex((f) => f.id === fas.id)
    const neighbor = dir === 'up' ? faser[idx - 1] : faser[idx + 1]
    if (!neighbor) return
    await window.api.invoke('db:forslag-faser:swap', fas.id, neighbor.id)
    await loadAll()
  }

  async function handleMoveSubfas(sf: ForslagSubfas, fasId: string, dir: 'up' | 'down') {
    const list = subfaserByFas[fasId] ?? []
    const idx = list.findIndex((s) => s.id === sf.id)
    const neighbor = dir === 'up' ? list[idx - 1] : list[idx + 1]
    if (!neighbor) return
    await window.api.invoke('db:forslag-subfaser:swap', sf.id, neighbor.id)
    await loadAll()
  }

  // --- Arbete handlers ---
  async function handleAddArbete(subfasId: string) {
    const created = await window.api.invoke('db:forslag-arbete:create', subfasId) as ForslagArbete
    setArbeteBySubfas((prev) => ({ ...prev, [subfasId]: [...(prev[subfasId] ?? []), created] }))
  }

  async function handleUpdateArbete(id: string, field: string, value: string | number | boolean) {
    const updated = await window.api.invoke('db:forslag-arbete:update', id, { [field]: value }) as ForslagArbete
    setArbeteBySubfas((prev) => ({
      ...prev,
      [updated.subfas_id]: (prev[updated.subfas_id] ?? []).map((r) => r.id === updated.id ? updated : r)
    }))
  }

  async function handleDeleteArbete(id: string, subfasId: string) {
    await window.api.invoke('db:forslag-arbete:delete', id)
    setArbeteBySubfas((prev) => ({
      ...prev,
      [subfasId]: (prev[subfasId] ?? []).filter((r) => r.id !== id)
    }))
  }

  // --- Material handlers ---
  async function handleAddMaterial(subfasId: string) {
    const created = await window.api.invoke('db:forslag-material:create', subfasId) as ForslagMaterial
    setMaterialBySubfas((prev) => ({ ...prev, [subfasId]: [...(prev[subfasId] ?? []), created] }))
  }

  async function handleUpdateMaterial(id: string, field: string, value: string | number) {
    const updated = await window.api.invoke('db:forslag-material:update', id, { [field]: value }) as ForslagMaterial
    setMaterialBySubfas((prev) => ({
      ...prev,
      [updated.subfas_id]: (prev[updated.subfas_id] ?? []).map((r) => r.id === updated.id ? updated : r)
    }))
  }

  async function handleDeleteMaterial(id: string, subfasId: string) {
    await window.api.invoke('db:forslag-material:delete', id)
    setMaterialBySubfas((prev) => ({
      ...prev,
      [subfasId]: (prev[subfasId] ?? []).filter((r) => r.id !== id)
    }))
  }

  // --- Underentreprenör handlers ---
  async function handleAddUE(subfasId: string) {
    const created = await window.api.invoke('db:forslag-ue:create', subfasId) as ForslagUnderentreprenor
    setUeBySubfas((prev) => ({ ...prev, [subfasId]: [...(prev[subfasId] ?? []), created] }))
  }

  async function handleUpdateUE(id: string, field: string, value: string | number | boolean) {
    const updated = await window.api.invoke('db:forslag-ue:update', id, { [field]: value }) as ForslagUnderentreprenor
    setUeBySubfas((prev) => ({
      ...prev,
      [updated.subfas_id]: (prev[updated.subfas_id] ?? []).map((r) => r.id === updated.id ? updated : r)
    }))
  }

  async function handleDeleteUE(id: string, subfasId: string) {
    await window.api.invoke('db:forslag-ue:delete', id)
    setUeBySubfas((prev) => ({
      ...prev,
      [subfasId]: (prev[subfasId] ?? []).filter((r) => r.id !== id)
    }))
  }

  async function handleToggleMedsokande(next: boolean) {
    await window.api.invoke('db:projekt:update', forslag.projekt_id, { rot_inkludera_medsokande: next })
    setForslag((prev) => ({ ...prev, projekt: { ...prev.projekt, rot_inkludera_medsokande: next } }))
  }

  async function handleApplyRot() {
    await window.api.invoke('db:forslag-arbete:apply-rot', forslag.id)
    await loadAll()
  }

  async function handleGenerateBeskrivning() {
    if (!villkorAssistentId) return
    setVillkorGenerating(true)
    try {
      const projektInfo = [
        `Projekt: ${forslag.projekt.namn}`,
        forslag.projekt.beskrivning ? `Beskrivning: ${forslag.projekt.beskrivning}` : '',
        forslag.projekt.arbetsplats_adress ? `Adress: ${forslag.projekt.arbetsplats_adress}, ${forslag.projekt.arbetsplats_stad ?? ''}` : '',
        `Kund: ${forslag.projekt.kunder.namn}`,
        `Förslag: ${forslag.titel}`,
        forslag.sammanfattning ? `Sammanfattning: ${forslag.sammanfattning}` : '',
        faser.length ? `Faser: ${faser.map(f => f.namn).join(', ')}` : '',
      ].filter(Boolean).join('\n')

      const result = await window.api.invoke('ai:chat', {
        assistent_id: villkorAssistentId,
        messages: [{ role: 'user', content: projektInfo }],
      }) as string

      const current = villkorEditing ? villkorDraft : (forslag.projekt?.villkor ?? '')
      setVillkorDraft(result.trim() + (current.trim() ? '\n\n' + current : ''))
      setVillkorEditing(true)
    } catch {
      // silently fail — user can retry
    } finally {
      setVillkorGenerating(false)
    }
  }

  // --- Delete proposal ---
  async function handleDelete() {
    setDeleting(true)
    try { await onDelete() } catch { setDeleting(false); setConfirmDelete(false) }
  }

  const activeFasSubfasIds = new Set(
    faser.filter(f => f.aktiv).flatMap(f => (subfaserByFas[f.id] ?? []).map(sf => sf.id))
  )
  const allArbete = Object.values(arbeteBySubfas).flat().filter(r => activeFasSubfasIds.has(r.subfas_id))
  const allMaterial = Object.values(materialBySubfas).flat().filter(r => activeFasSubfasIds.has(r.subfas_id))
  const allUE = Object.values(ueBySubfas).flat().filter(r => activeFasSubfasIds.has(r.subfas_id))

  const subfasCount = (id: string) =>
    (arbeteBySubfas[id]?.length ?? 0) + (materialBySubfas[id]?.length ?? 0) + (ueBySubfas[id]?.length ?? 0)

  const fasCount = (fasId: string) =>
    (subfaserByFas[fasId] ?? []).reduce((s, sf) => s + subfasCount(sf.id), 0)

  const subfasTotal = (sfId: string) => {
    const { totalArbete, totalMaterial, totalUE } = aggregateForslag(
      arbeteBySubfas[sfId] ?? [],
      materialBySubfas[sfId] ?? [],
      ueBySubfas[sfId] ?? [],
    )
    return totalArbete + totalMaterial + totalUE
  }

  const fasTotal = (fasId: string) => {
    const subfases = subfaserByFas[fasId] ?? []
    const { totalArbete, totalMaterial, totalUE } = aggregateForslag(
      subfases.flatMap(sf => arbeteBySubfas[sf.id] ?? []),
      subfases.flatMap(sf => materialBySubfas[sf.id] ?? []),
      subfases.flatMap(sf => ueBySubfas[sf.id] ?? []),
    )
    return totalArbete + totalMaterial + totalUE
  }

  async function handleExportPdf() {
    const mall = await window.api.invoke('db:pdf-mall:get', 'forslag') as PdfMall | null
    const titel1 = mall?.portada_titel || 'FÖRSLAG'
    const titel2 = mall?.portada_titel_2?.trim() ?? ''
    setPdfTitelPicker({ titel1, titel2 })
    setPdfExportTitel(titel1)
    setPdfExportBifogaTidplan(false)
  }

  async function buildTidplanHtmlForExport(): Promise<string> {
    let mall: Partial<PdfMall> | null = null
    try { mall = await window.api.invoke('db:pdf-mall:get', 'forslag') as PdfMall } catch { /* fall back to defaults */ }
    return buildTidplanHtml(forslag, faser, mall, config)
  }

  async function buildForslagHtml(titelOverride: string, displayOverrides?: Record<string, string>, sammanfattad?: boolean): Promise<string> {
    const mall = await window.api.invoke('db:pdf-mall:get', 'forslag') as PdfMall | null
    const template = mall?.html_mall || DEFAULT_FORSLAG_HTML
    const accentFarg = mall?.accent_farg ?? '#1B3A6B'

    const p = forslag.projekt
    const rotAvdrag = p.rot_avdrag ?? false
    const rotProcent = p.rot_procent ?? 30
    const rotInkluderaMedsokande = p.rot_inkludera_medsokande ?? false

    const activeFaser = faser.filter(f => f.aktiv)
    const activeSubfasIds = new Set(activeFaser.flatMap(f => (subfaserByFas[f.id] ?? []).map(sf => sf.id)))

    const desgloseHtml = buildForslagDesglose(
      activeFaser, subfaserByFas, arbeteBySubfas, materialBySubfas, ueBySubfas,
      { momsProcent: forslag.moms_procent, rotAvdrag, rotProcent, rotInkluderaMedsokande, rotCapEnkel: ROT_CAP_SINGLE, rotCapDubbel: ROT_CAP_DOUBLE, accentFarg, visaLeverantor: mall?.visa_leverantor_material !== false, visaFasNotat: mall?.visa_fas_notat !== false, sammanfattad }
    )

    const allArbete = Object.values(arbeteBySubfas).flat().filter(r => activeSubfasIds.has(r.subfas_id))
    const allMaterial = Object.values(materialBySubfas).flat().filter(r => activeSubfasIds.has(r.subfas_id))
    const allUE = Object.values(ueBySubfas).flat().filter(r => activeSubfasIds.has(r.subfas_id))
    const totals = computeForslagTotals({
      ...aggregateForslag(allArbete, allMaterial, allUE),
      momsProcent: forslag.moms_procent, rotAvdrag, rotProcent, rotInkluderaMedsokande,
      rotCapEnkel: ROT_CAP_SINGLE, rotCapDubbel: ROT_CAP_DOUBLE,
    })
    const { totalArbete, totalMaterial, totalUE, subtotal, moms: momsBelopp, totalInklMoms, rotBelopp, totalAttBetala: totalt } = totals
    const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))

    const giltighetText = forslag.giltig_till
      ? new Date(forslag.giltig_till).toLocaleDateString('sv-SE')
      : '30 dagar'

    const logoHtml = config?.foretag_logo_url
      ? `<img src="${config.foretag_logo_url}" style="max-height:50px;max-width:160px;object-fit:contain;" />`
      : `<div class="cover-logo">${config?.foretag_namn ?? ''}</div>`

    const vars: Record<string, string> = {
      foretag_namn: config?.foretag_namn ?? '',
      foretag_org_nummer: config?.foretag_org_nummer ?? '',
      foretag_telefon: config?.foretag_telefon ?? '',
      foretag_email: config?.foretag_email ?? '',
      foretag_webbadress: config?.foretag_webbadress ?? '',
      accent_farg: accentFarg,
      portada_titel: titelOverride,
      portada_undertitel: mall?.portada_undertitel || 'Sammanställning av arbete och material',
      visa_portada_display: mall?.visa_portada !== false ? 'flex' : 'none',
      visa_desglose_display: 'block',
      visa_sammanfattning_display: mall?.visa_sammanfattning !== false ? 'flex' : 'none',
      visa_villkor_display: mall?.visa_villkor !== false ? 'block' : 'none',
      projekt_villkor: p.villkor ?? '',
      logo_html: logoHtml,
      visa_godkand_fskatt_html: mall?.visa_godkand_f_skatt !== false ? '<div class="cover-company-line">Godkänd för F-skatt</div>' : '',
      visa_godkand_fskatt_text: mall?.visa_godkand_f_skatt !== false ? ' &nbsp;·&nbsp; Godkänd för F-skatt' : '',
      projekt_nummer: p.projekt_nummer ?? '',
      forslag_nummer: forslag.forslag_nummer ?? '',
      kund_namn: p.kunder?.namn ?? '',
      projekt_namn: p.namn ?? '',
      adress: p.arbetsplats_adress ?? '',
      datum: new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }),
      giltighet: giltighetText,
      arbetskostnad: fmt(totalArbete),
      materialkostnad: fmt(totalMaterial),
      total_ue: fmt(totalUE),
      netto_exkl_moms: fmt(subtotal),
      moms_procent_text: String(forslag.moms_procent),
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

    if (displayOverrides) Object.assign(vars, displayOverrides)
    return injectVars(template, vars)
  }

  async function doExportPdf(titelOverride: string, bifogaTidplan: boolean = false, sammanfattad: boolean = false, split: boolean = false) {
    setPdfTitelPicker(null)
    setExportingPdf(true)
    const baseName = `forslag-${forslag.forslag_nummer}-${forslag.projekt.kunder.namn.replace(/\s+/g, '_')}`
    try {
      if (split) {
        const pdf1Html = await buildForslagHtml(titelOverride, { visa_desglose_display: 'none' }, false)
        const pdf2Html = await buildForslagHtml(titelOverride, { visa_portada_display: 'none', visa_sammanfattning_display: 'none', visa_villkor_display: 'none' }, sammanfattad)
        if (bifogaTidplan) {
          const tidplanHtml = await buildTidplanHtmlForExport()
          const [pdf1b64, pdf2b64, tidplanb64] = await Promise.all([
            window.api.invoke('pdf:generate-buffer', { html: pdf1Html }) as Promise<string>,
            window.api.invoke('pdf:generate-buffer', { html: pdf2Html }) as Promise<string>,
            window.api.invoke('pdf:generate-buffer', { html: tidplanHtml }) as Promise<string>,
          ])
          await window.api.invoke('pdf:save-pdfs', [
            { name: `${baseName}-offert`, data_base64: pdf1b64 },
            { name: `${baseName}-spec`, data_base64: pdf2b64 },
            { name: `${baseName}-tidplan`, data_base64: tidplanb64 },
          ])
        } else {
          const [pdf1b64, pdf2b64] = await Promise.all([
            window.api.invoke('pdf:generate-buffer', { html: pdf1Html }) as Promise<string>,
            window.api.invoke('pdf:generate-buffer', { html: pdf2Html }) as Promise<string>,
          ])
          await window.api.invoke('pdf:save-pdfs', [
            { name: `${baseName}-offert`, data_base64: pdf1b64 },
            { name: `${baseName}-spec`, data_base64: pdf2b64 },
          ])
        }
      } else {
        const parts: { html: string; landscape?: boolean }[] = []
        if (bifogaTidplan) {
          const [forslagSinSammaf, tidplanHtml, sammafHtml] = await Promise.all([
            buildForslagHtml(titelOverride, { visa_sammanfattning_display: 'none' }, sammanfattad),
            buildTidplanHtmlForExport(),
            buildForslagHtml(titelOverride, { visa_portada_display: 'none', visa_desglose_display: 'none' }, sammanfattad),
          ])
          parts.push({ html: forslagSinSammaf }, { html: tidplanHtml }, { html: sammafHtml })
        } else {
          parts.push({ html: await buildForslagHtml(titelOverride, undefined, sammanfattad) })
        }
        await window.api.invoke('pdf:generate-merged', { parts, name: baseName })
      }
    } finally {
      setExportingPdf(false)
    }
  }

  async function renderSigningPdf(linkId: string, titelOverride?: string, sammanfattad?: boolean, splitPdf?: boolean): Promise<void> {
    // When split mode is on, the signing document is PDF1 only (portada + sammaf + villkor).
    const splitOverride = splitPdf ? { visa_desglose_display: 'none' } : undefined
    try {
      const mall = await window.api.invoke('db:pdf-mall:get', 'forslag') as PdfMall | null
      const titel1 = mall?.portada_titel || 'FÖRSLAG'
      const titel2 = mall?.portada_titel_2?.trim() || ''
      const chosen = titelOverride || titel1

      const html = await buildForslagHtml(chosen, splitOverride, sammanfattad)
      await window.api.invoke('db:signatur-lank:render-document-pdf', { link_id: linkId, html })

      // If the admin sent with titel1 and a distinct titel2 is configured,
      // pre-render the Slutlig version too. The customer portal stamps the
      // signature on `final_document_pdf_url` when present, so the post-sign
      // copy automatically upgrades to the final title.
      if (titel2 && titel2 !== chosen) {
        try {
          const finalHtml = await buildForslagHtml(titel2, splitOverride, sammanfattad)
          await window.api.invoke('db:signatur-lank:render-final-document-pdf', { link_id: linkId, html: finalHtml })
        } catch (e) {
          console.error('Render final PDF failed (non-critical, portal falls back to document_pdf_url):', e)
        }
      }
    } catch (e) {
      console.error('Render document PDF failed:', e)
    }
  }

  async function handleSendRevisedVersion(linkId: string, meddelande: string): Promise<void> {
    setSendingRevised(true)
    setRevisedFeedback(null)
    try {
      // Re-render the document PDF first. We do it inline (not via
      // renderSigningPdf) so a render failure aborts the chain instead of
      // silently sending a stale PDF.
      const mall = await window.api.invoke('db:pdf-mall:get', 'forslag') as PdfMall | null
      const titel1 = mall?.portada_titel || 'FÖRSLAG'
      const titel2 = mall?.portada_titel_2?.trim() || ''
      const html = await buildForslagHtml(titel1)
      await window.api.invoke('db:signatur-lank:render-document-pdf', { link_id: linkId, html })

      // If a Slutlig title is configured, also re-render the final version so
      // the post-sign copy reflects the latest revision instead of a stale one
      // pre-rendered when the link was first created. Non-critical: if it
      // fails the customer can still sign the revised preliminary.
      if (titel2 && titel2 !== titel1) {
        try {
          const finalHtml = await buildForslagHtml(titel2)
          await window.api.invoke('db:signatur-lank:render-final-document-pdf', { link_id: linkId, html: finalHtml })
        } catch (e) {
          console.error('Render final PDF (revised) failed:', e)
        }
      }

      await window.api.invoke('db:signatur-lank:clear-change-request', linkId)
      await window.api.invoke('db:signatur-lank:resend', linkId, { revised: true, meddelande })
      setLinksRefresh(k => k + 1)
      setShowRevisedModal(false)
      setRevisedFeedback({ kind: 'success', message: 'Uppdaterad version skickad till kunden. E-postet hamnar i kön och skickas inom en minut.' })
    } catch (e) {
      const msg = (e as Error).message ?? String(e)
      console.error('Send revised version failed:', e)
      setRevisedFeedback({ kind: 'error', message: `Kunde inte skicka uppdaterad version: ${msg}` })
      throw e
    } finally {
      setSendingRevised(false)
    }
  }

  async function handleSendPaminnelse(meddelande: string): Promise<void> {
    if (!latestLink) return
    setSendingPaminnelse(true)
    setPaminnelseFeedback(null)
    try {
      await window.api.invoke('db:signatur-lank:resend', latestLink.id, { reminder: true, meddelande })
      setShowPaminnelseModal(false)
      setPaminnelseFeedback({ kind: 'success', message: 'Påminnelse skickad till kunden. E-postet hamnar i kön och skickas inom en minut.' })
    } catch (e) {
      const msg = (e as Error).message ?? String(e)
      setPaminnelseFeedback({ kind: 'error', message: `Kunde inte skicka påminnelse: ${msg}` })
      throw e
    } finally {
      setSendingPaminnelse(false)
    }
  }

  // Anteckningar handlers
  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!nyAntTitel.trim()) return
    setSavingNote(true)
    const created = await window.api.invoke('db:projekt-anteckningar:create', { projekt_id: forslag.projekt_id, titel: nyAntTitel.trim(), innehall: nyAntInnehall.trim(), farg: nyAntFarg }) as ProjektAnteckning
    setAnteckningar(prev => [created, ...prev])
    setNyAntTitel('')
    setNyAntInnehall('')
    setNyAntFarg('muted')
    setSavingNote(false)
  }

  function toggleExpandAnt(id: string) {
    setExpandedAntIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function startEditAnt(a: ProjektAnteckning) {
    setEditingNoteId(a.id)
    setEditAntTitel(a.titel)
    setEditAntInnehall(a.innehall)
    setEditAntFarg(a.farg)
    setExpandedAntIds(prev => new Set(prev).add(a.id))
  }

  async function saveEditAnt(id: string) {
    if (!editAntTitel.trim()) return
    setSavingEditId(id)
    const updated = await window.api.invoke('db:projekt-anteckningar:update', id, { titel: editAntTitel.trim(), innehall: editAntInnehall.trim(), farg: editAntFarg }) as ProjektAnteckning
    setAnteckningar(prev => prev.map(a => a.id === updated.id ? updated : a))
    setEditingNoteId(null)
    setSavingEditId(null)
  }

  function cancelEditAnt() { setEditingNoteId(null) }

  async function handleDeleteNote(id: string) {
    setDeletingNoteId(id)
    await window.api.invoke('db:projekt-anteckningar:delete', id)
    setAnteckningar(prev => prev.filter(a => a.id !== id))
    setDeletingNoteId(null)
  }

  async function handleChangeAntFarg(id: string, farg: string) {
    const a = anteckningar.find(n => n.id === id)
    if (!a) return
    const updated = await window.api.invoke('db:projekt-anteckningar:update', id, { titel: a.titel, innehall: a.innehall, farg }) as ProjektAnteckning
    setAnteckningar(prev => prev.map(n => n.id === updated.id ? updated : n))
  }

  // Dokument handlers
  async function handleUploadDokument(carpeta: string | null) {
    const files = await window.api.invoke('dialog:open-files') as { filePath: string; fileName: string; mimeType: string; size: number }[]
    if (!files.length) return
    setUploadProgress({ current: 0, total: files.length })
    for (let i = 0; i < files.length; i++) {
      await window.api.invoke('db:projekt-dokument:upload', { projektId: forslag.projekt_id, ...files[i], kategori: 'dokument', carpeta })
      setUploadProgress({ current: i + 1, total: files.length })
    }
    setUploadProgress(null)
    const docs = await window.api.invoke('db:projekt-dokument:list', forslag.projekt_id) as ProjektDokument[]
    setDokument(docs.filter(d => (d.kategori ?? 'dokument') === 'dokument'))
  }

  async function handleCreateTextDokument(fileName: string, content: string, carpeta: string | null) {
    const doc = await window.api.invoke('db:projekt-dokument:create-text', { projektId: forslag.projekt_id, fileName, content, carpeta }) as ProjektDokument
    setDokument(prev => [doc, ...prev])
  }

  async function handleDeleteDokument(id: string, storagePath: string) {
    await window.api.invoke('db:projekt-dokument:delete', { id, storagePath })
    setDokument(prev => prev.filter(d => d.id !== id))
  }

  async function handleOpenDokument(storagePath: string) {
    const dok = dokument.find(d => d.storage_path === storagePath)
    await window.api.invoke('db:projekt-dokument:get-data', { storagePath, mimeType: dok?.mime_type ?? 'application/octet-stream' })
  }

  async function handleToggleDokumentVisibility(id: string, synlig: boolean) {
    const updated = await window.api.invoke('db:projekt-dokument:set-visibility', { id, synlig_for_kund: synlig }) as ProjektDokument
    setDokument(prev => prev.map(d => d.id === id ? updated : d))
  }

  async function handleMoveCarpeta(id: string, carpeta: string | null) {
    const updated = await window.api.invoke('db:projekt-dokument:move-carpeta', { id, carpeta }) as ProjektDokument
    setDokument(prev => prev.map(d => d.id === id ? updated : d))
  }

  async function handleDeleteCarpeta(carpeta: string) {
    await window.api.invoke('db:projekt-dokument:clear-carpeta', { projektId: forslag.projekt_id, carpeta })
    const docs = await window.api.invoke('db:projekt-dokument:list', forslag.projekt_id) as ProjektDokument[]
    setDokument(docs.filter(d => (d.kategori ?? 'dokument') === 'dokument'))
  }

  async function handleRenameDokument(id: string, filnamn: string) {
    const updated = await window.api.invoke('db:projekt-dokument:rename', { id, filnamn }) as ProjektDokument
    setDokument(prev => prev.map(d => d.id === id ? updated : d))
  }

  if (editing) {
    return (
      <ForslagForm
        projekt={allProjekt}
        statusar={statusar}
        initial={forslag}
        onSubmit={async (data) => { await onEdit(data); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-muted hover:text-fg transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Förslag</span>
            <span className="text-subtle">/</span>
            <span className="font-mono text-xs text-muted">{forslag.forslag_nummer}</span>
            <span className="text-subtle">/</span>
            <span className="text-fg font-medium">{forslag.titel}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs ml-2">
            <span className={`size-1.5 rounded-full ${FARG_DOT[currentStatus?.farg ?? 'muted']}`} />
            <span className="text-muted">{forslag.status}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-muted">Ta bort förslaget?</span>
              <button onClick={handleDelete} disabled={deleting} className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40">
                {deleting ? 'Tar bort...' : 'Ja, ta bort'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1 text-xs text-muted hover:text-fg transition-colors">Avbryt</button>
            </>
          ) : (
            <>
              <button onClick={loadAll} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
                <RefreshCw size={11} />
              </button>
              <button onClick={() => setShowBulkTimpris(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
                <Tags size={11} />Timpriser
              </button>
              <button onClick={handleExportPdf} disabled={exportingPdf} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors disabled:opacity-40">
                <FileDown size={11} />{exportingPdf ? 'Genererar...' : 'PDF'}
              </button>
              <button onClick={() => onNavigateTidplan ? onNavigateTidplan('direct') : window.api.invoke('window:open-tidplan', forslag.id)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
                <CalendarDays size={11} />Tidplan
              </button>
              <button onClick={() => setShowVilkorReminder(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-emerald-400 transition-colors">
                <Send size={11} />Skicka för signatur
              </button>
              {latestLink && !latestLink.signerad_at && !latestLink.revoked_at && new Date(latestLink.gar_ut_at) > new Date() && forslag.status?.toLowerCase() === 'skickat' && (
                <button
                  onClick={() => setShowPaminnelseModal(true)}
                  disabled={sendingPaminnelse}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-amber-400 transition-colors disabled:opacity-40"
                >
                  <Bell size={11} />Påminnelse
                </button>
              )}
              <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
                <Pencil size={11} />Redigera
              </button>
              <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-red-400 transition-colors">
                <Trash2 size={11} />Ta bort
              </button>
            </>
          )}
        </div>
      </div>

      <WorkflowTriggerBar
        seccion="forslag"
        context={{ forslag_id: forslag.id, projekt_id: forslag.projekt_id }}
        onComplete={loadAll}
        rightSlot={onNavigateProjekt && (
          <button
            onClick={onNavigateProjekt}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-elevated border border-border rounded text-[11px] text-muted hover:text-fg hover:border-subtle transition-colors"
          >
            <FolderOpen size={10} className="shrink-0" />
            Projekt
          </button>
        )}
      />

      {latestLink?.andring_begard_at && !latestLink.signerad_at && !latestLink.revoked_at && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
                Kunden begärde ändringar
              </p>
              {latestLink.andring_historik.length > 0 && (
                <p className="text-sm text-fg whitespace-pre-wrap">
                  "{latestLink.andring_historik[latestLink.andring_historik.length - 1].reason}"
                </p>
              )}
              <p className="text-[11px] text-muted mt-1">
                {new Date(latestLink.andring_begard_at).toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {latestLink.andring_historik.length > 1 && (
                <button
                  onClick={() => setShowAndringHistorik(true)}
                  className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-400/10 transition-colors"
                >
                  Visa historik ({latestLink.andring_historik.length})
                </button>
              )}
              <button
                onClick={() => setShowRevisedModal(true)}
                disabled={sendingRevised}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/10 border border-amber-400/40 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-400/20 transition-colors disabled:opacity-50"
              >
                <Send size={12} />
                {sendingRevised ? 'Skickar...' : 'Skicka uppdaterad version'}
              </button>
            </div>
          </div>
        </div>
      )}

      {revisedFeedback && (
        <div className={`border-b px-6 py-2.5 text-xs flex items-center justify-between gap-3 ${
          revisedFeedback.kind === 'success'
            ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
            : 'bg-red-400/10 border-red-400/30 text-red-400'
        }`}>
          <span>{revisedFeedback.message}</span>
          <button onClick={() => setRevisedFeedback(null)} className="opacity-60 hover:opacity-100">
            <XIcon size={12} />
          </button>
        </div>
      )}

      {paminnelseFeedback && (
        <div className={`border-b px-6 py-2.5 text-xs flex items-center justify-between gap-3 ${
          paminnelseFeedback.kind === 'success'
            ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
            : 'bg-red-400/10 border-red-400/30 text-red-400'
        }`}>
          <span>{paminnelseFeedback.message}</span>
          <button onClick={() => setPaminnelseFeedback(null)} className="opacity-60 hover:opacity-100">
            <XIcon size={12} />
          </button>
        </div>
      )}

      {latestLink && (
        <SkickaUppdateradVersionModal
          isOpen={showRevisedModal}
          onClose={() => { if (!sendingRevised) setShowRevisedModal(false) }}
          onSubmit={(meddelande) => handleSendRevisedVersion(latestLink.id, meddelande)}
          senasteAndring={
            latestLink.andring_historik.length > 0
              ? latestLink.andring_historik[latestLink.andring_historik.length - 1].reason
              : undefined
          }
          reRendersPdf
        />
      )}

      {latestLink && (
        <PaminnelseModal
          isOpen={showPaminnelseModal}
          onClose={() => setShowPaminnelseModal(false)}
          onSubmit={handleSendPaminnelse}
          kund_email={latestLink.kund_email}
          defaultMeddelande={paminnelseDefaultMsg}
        />
      )}

      {showAndringHistorik && latestLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAndringHistorik(false)}>
          <div
            className="bg-bg border border-border rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-fg">Historik — ändringsbegäranden</h3>
              <button onClick={() => setShowAndringHistorik(false)} className="text-muted hover:text-fg">
                <XIcon size={16} />
              </button>
            </div>
            <div className="overflow-auto px-5 py-4 space-y-4">
              {[...latestLink.andring_historik].reverse().map((entry, i) => (
                <div key={i} className="border-l-2 border-amber-400/40 pl-4">
                  <p className="text-[11px] text-muted mb-1">
                    {new Date(entry.at).toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' })}
                  </p>
                  <p className="text-sm text-fg whitespace-pre-wrap">{entry.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* Left — Accordion faser/subfaser */}
        <div className="flex-1 overflow-auto">

          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg sticky top-0 z-10">
            <p className="text-[10px] uppercase tracking-widest text-muted font-medium">
              {faser.length} faser · {Object.values(subfaserByFas).flat().length} subfaser · {allArbete.length + allMaterial.length + allUE.length} rader
            </p>
            <button
              onClick={() => {
                const allSubfasIds = Object.values(subfaserByFas).flat().map((sf) => sf.id)
                const allOpen = collapsedFaser.size === 0 && allSubfasIds.every((id) => selectedSubfasIds.has(id))
                if (allOpen) {
                  setCollapsedFaser(new Set(faser.map((f) => f.id)))
                  setSelectedSubfasIds(new Set())
                } else {
                  setCollapsedFaser(new Set())
                  setSelectedSubfasIds(new Set(allSubfasIds))
                }
              }}
              className="flex items-center gap-1 text-[10px] text-subtle hover:text-fg transition-colors"
            >
              <ChevronsUpDown size={11} />
            </button>
          </div>

          {/* Faser */}
          {faser.map((fas) => (
            <div key={fas.id} className={`border-b border-border transition-opacity ${!fas.aktiv ? 'opacity-50' : ''}`}>

              {/* Fas header */}
              <div
                className="group flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none"
                style={{ backgroundColor: accentFarg + '28', borderLeft: `2px solid ${accentFarg}60` }}
                onClick={() => setCollapsedFaser((prev) => {
                  const next = new Set(prev)
                  next.has(fas.id) ? next.delete(fas.id) : next.add(fas.id)
                  return next
                })}
              >
                {collapsedFaser.has(fas.id)
                  ? <ChevronRight size={12} className="text-subtle shrink-0" />
                  : <ChevronDown size={12} className="text-subtle shrink-0" />
                }
                {editingFasId === fas.id ? (
                  <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      className="input text-xs py-0.5 px-1.5 flex-1 min-w-0"
                      value={editFasNamn}
                      onChange={(e) => setEditFasNamn(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFas(); if (e.key === 'Escape') setEditingFasId(null) }}
                    />
                    <button onClick={handleRenameFas} className="text-emerald-400 hover:text-emerald-300 shrink-0"><Check size={11} /></button>
                    <button onClick={() => setEditingFasId(null)} className="text-subtle hover:text-fg shrink-0"><XIcon size={11} /></button>
                  </div>
                ) : (
                  <>
                    <span className="text-[11px] font-semibold text-fg flex-1 uppercase tracking-widest">{fas.namn}</span>
                    <span className="text-[9px] font-mono bg-elevated text-subtle px-1 py-0.5 rounded shrink-0">
                      {(subfaserByFas[fas.id] ?? []).length} · {fasCount(fas.id)}
                    </span>
                    {fasTotal(fas.id) > 0 && (
                      <span className="text-[9px] font-mono text-emerald-400 shrink-0">
                        {formatCurrency(fasTotal(fas.id), 0)}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedFasId(fas.id); setAddingSubfas(true); setCollapsedFaser((prev) => { const n = new Set(prev); n.delete(fas.id); return n }) }}
                      className="flex items-center gap-0.5 text-[10px] text-subtle hover:text-fg transition-opacity shrink-0"
                    >
                      <Plus size={10} />subfas
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditFasNamn(fas.namn); setEditingFasId(fas.id) }}
                      className="text-subtle hover:text-fg shrink-0 transition-opacity"
                    ><Pencil size={10} /></button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditFasNotat(fas.notat ?? ''); setEditingFasNotatId(fas.id) }}
                      className={`shrink-0 transition-opacity ${fas.notat ? 'text-amber-400' : 'text-subtle hover:text-fg'}`}
                    ><StickyNote size={10} /></button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleFasAktiv(fas) }}
                      className={`shrink-0 transition-opacity ${fas.aktiv ? 'text-subtle hover:text-fg' : 'text-red-400 hover:text-red-300'}`}
                      title={fas.aktiv ? 'Inkluderad i PDF' : 'Exkluderad från PDF'}
                    >{fas.aktiv ? <Eye size={10} /> : <EyeOff size={10} />}</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFas(fas.id) }}
                      className="text-subtle hover:text-red-400 shrink-0 transition-opacity"
                    ><Trash2 size={10} /></button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveFas(fas, 'up') }}
                      disabled={faser.indexOf(fas) === 0}
                      className="text-subtle hover:text-fg shrink-0 transition-opacity disabled:opacity-20 disabled:pointer-events-none"
                    ><ArrowUp size={10} /></button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveFas(fas, 'down') }}
                      disabled={faser.indexOf(fas) === faser.length - 1}
                      className="text-subtle hover:text-fg shrink-0 transition-opacity disabled:opacity-20 disabled:pointer-events-none"
                    ><ArrowDown size={10} /></button>
                  </>
                )}
              </div>

              {/* Fas note — read-only display */}
              {fas.notat && editingFasNotatId !== fas.id && (
                <div
                  className="px-5 py-1.5 border-t border-border/30 bg-sidebar/60 cursor-pointer hover:bg-hover/40 flex items-center gap-1.5 group/note"
                  onClick={(e) => { e.stopPropagation(); setEditFasNotat(fas.notat ?? ''); setEditingFasNotatId(fas.id) }}
                >
                  <span className="text-[10px] text-muted italic flex-1">* Anm: {fas.notat}</span>
                  <Pencil size={9} className="text-subtle opacity-0 group-hover/note:opacity-100 transition-opacity shrink-0" />
                </div>
              )}

              {/* Fas note editor */}
              {editingFasNotatId === fas.id && (
                <div
                  className="px-5 py-2 border-t border-border/30 bg-sidebar space-y-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <textarea
                    autoFocus
                    rows={2}
                    placeholder="Anteckning till denna fas..."
                    className="input w-full text-xs resize-none py-1 px-1.5"
                    value={editFasNotat}
                    onChange={(e) => setEditFasNotat(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingFasNotatId(null)
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveFasNotat(fas.id)
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveFasNotat(fas.id)}
                      className="flex items-center gap-0.5 text-[10px] text-emerald-400 hover:text-emerald-300"
                    >
                      <Check size={10} /> Spara
                    </button>
                    <button
                      onClick={() => setEditingFasNotatId(null)}
                      className="text-[10px] text-subtle hover:text-fg"
                    >
                      Avbryt
                    </button>
                    {fas.notat && (
                      <button
                        onClick={() => { setEditFasNotat(''); handleSaveFasNotat(fas.id) }}
                        className="ml-auto text-[10px] text-subtle hover:text-red-400"
                      >
                        Ta bort notat
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Subfaser — ocultas si colapsado */}
              {!collapsedFaser.has(fas.id) && (subfaserByFas[fas.id] ?? []).map((sf) => (
                <div key={sf.id}>
                  {/* Subfas row */}
                  <div
                    className={`group flex items-center gap-2 px-5 py-2 border-t border-border/30 cursor-pointer transition-colors ${selectedSubfasIds.has(sf.id) ? 'bg-hover' : 'hover:bg-hover/60'}`}
                    onClick={() => {
                      setSelectedFasId(fas.id)
                      setSelectedSubfasIds((prev) => {
                        const n = new Set(prev)
                        n.has(sf.id) ? n.delete(sf.id) : n.add(sf.id)
                        return n
                      })
                      setAddingSubfas(false)
                      setEditingSubfasId(null)
                    }}
                  >
                    {selectedSubfasIds.has(sf.id)
                      ? <ChevronDown size={12} className="text-subtle shrink-0" />
                      : <ChevronRight size={12} className="text-subtle shrink-0" />
                    }
                    {editingSubfasId === sf.id ? (
                      <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          className="input text-xs py-0.5 px-1.5 flex-1 min-w-0"
                          value={editSubfasNamn}
                          onChange={(e) => setEditSubfasNamn(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubfas(); if (e.key === 'Escape') setEditingSubfasId(null) }}
                        />
                        <button onClick={handleRenameSubfas} className="text-emerald-400 hover:text-emerald-300 shrink-0"><Check size={11} /></button>
                        <button onClick={() => setEditingSubfasId(null)} className="text-subtle hover:text-fg shrink-0"><XIcon size={11} /></button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs text-fg flex-1">{sf.namn}</span>
                        {(arbeteBySubfas[sf.id]?.length ?? 0) > 0 && (
                          <span className="text-[9px] text-blue-400 tabular-nums">Arb:{arbeteBySubfas[sf.id].length}</span>
                        )}
                        {(materialBySubfas[sf.id]?.length ?? 0) > 0 && (
                          <span className="text-[9px] text-amber-400 tabular-nums">Mat:{materialBySubfas[sf.id].length}</span>
                        )}
                        {(ueBySubfas[sf.id]?.length ?? 0) > 0 && (
                          <span className="text-[9px] text-emerald-400 tabular-nums">UE:{ueBySubfas[sf.id].length}</span>
                        )}
                        {subfasTotal(sf.id) > 0 && (
                          <span className="text-[9px] font-mono text-emerald-400 shrink-0">
                            {formatCurrency(subfasTotal(sf.id), 0)}
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditSubfasNamn(sf.namn); setEditingSubfasId(sf.id) }}
                          className="text-subtle hover:text-fg shrink-0 transition-opacity"
                        ><Pencil size={10} /></button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSubfas(sf) }}
                          className="text-subtle hover:text-red-400 shrink-0 transition-opacity"
                        ><Trash2 size={10} /></button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveSubfas(sf, fas.id, 'up') }}
                          disabled={(subfaserByFas[fas.id] ?? []).indexOf(sf) === 0}
                          className="text-subtle hover:text-fg shrink-0 transition-opacity disabled:opacity-20 disabled:pointer-events-none"
                        ><ArrowUp size={10} /></button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveSubfas(sf, fas.id, 'down') }}
                          disabled={(subfaserByFas[fas.id] ?? []).indexOf(sf) === (subfaserByFas[fas.id] ?? []).length - 1}
                          className="text-subtle hover:text-fg shrink-0 transition-opacity disabled:opacity-20 disabled:pointer-events-none"
                        ><ArrowDown size={10} /></button>
                      </>
                    )}
                  </div>

                  {/* Inline editor */}
                  {selectedSubfasIds.has(sf.id) && (
                    <div className="border-t border-border" style={{ height: 380 }}>
                      <FasEditor
                        subfasNamn={sf.namn}
                        catalogPortal={catalogPortalRef.current}
                        arbete={arbeteBySubfas[sf.id] ?? []}
                        material={materialBySubfas[sf.id] ?? []}
                        underentreprenorer={ueBySubfas[sf.id] ?? []}
                        arbetsRoller={arbetsRoller}
                        onAddArbete={() => handleAddArbete(sf.id)}
                        onUpdateArbete={handleUpdateArbete}
                        onDeleteArbete={(id) => handleDeleteArbete(id, sf.id)}
                        onAddMaterial={() => handleAddMaterial(sf.id)}
                        onUpdateMaterial={handleUpdateMaterial}
                        onDeleteMaterial={(id) => handleDeleteMaterial(id, sf.id)}
                        onAddUE={() => handleAddUE(sf.id)}
                        onUpdateUE={handleUpdateUE}
                        onDeleteUE={(id) => handleDeleteUE(id, sf.id)}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Add subfas input */}
              {addingSubfas && selectedFasId === fas.id && (
                <div className="flex items-center gap-1 px-5 py-2 border-t border-border/30 bg-hover/30">
                  <Plus size={11} className="text-subtle shrink-0" />
                  <input
                    autoFocus
                    className="input text-xs py-0.5 px-1.5 flex-1 min-w-0"
                    placeholder="Subfas namn..."
                    value={nySubfasNamn}
                    onChange={(e) => setNySubfasNamn(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubfas(); if (e.key === 'Escape') { setAddingSubfas(false); setNySubfasNamn('') } }}
                  />
                  <button onClick={handleAddSubfas} className="text-emerald-400 hover:text-emerald-300 shrink-0"><Check size={11} /></button>
                  <button onClick={() => { setAddingSubfas(false); setNySubfasNamn('') }} className="text-subtle hover:text-fg shrink-0"><XIcon size={11} /></button>
                </div>
              )}
            </div>
          ))}

          {/* Add fas */}
          <div className="px-4 py-3">
            {addingFas ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  className="input text-xs py-0.5 px-1.5 flex-1 min-w-0"
                  placeholder="Fas namn..."
                  value={nyFasNamn}
                  onChange={(e) => setNyFasNamn(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddFas(); if (e.key === 'Escape') { setAddingFas(false); setNyFasNamn('') } }}
                />
                <button onClick={handleAddFas} className="text-emerald-400 hover:text-emerald-300 shrink-0"><Check size={11} /></button>
                <button onClick={() => { setAddingFas(false); setNyFasNamn('') }} className="text-subtle hover:text-fg shrink-0"><XIcon size={11} /></button>
              </div>
            ) : (
              <button onClick={() => setAddingFas(true)} className="flex items-center gap-1 text-xs text-subtle hover:text-fg transition-colors">
                <Plus size={11} />Ny fas
              </button>
            )}
          </div>
        </div>

        {/* Right — Signering / Uppgifter / Kostnad tabs */}
        <div className="w-[480px] shrink-0 border-l border-border overflow-hidden flex flex-col">

          {/* Tab bar — row 1: proposal tabs */}
          <div className="flex border-b border-border shrink-0 bg-sidebar">
            {(['signering', 'uppgifter', 'projekt', 'kostnad', 'epost', 'villkor'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${rightTab === tab ? 'text-fg border-b-2 border-emerald-400' : 'text-muted hover:text-fg'}`}
              >
                {tab === 'signering' ? 'Sign' : tab === 'uppgifter' ? 'Kund' : tab === 'projekt' ? 'Projekt' : tab === 'kostnad' ? 'Kostnad' : tab === 'epost' ? 'E-post' : 'Villkor'}
              </button>
            ))}
          </div>
          {/* Tab bar — row 2: project notes + documents */}
          <div className="flex border-b border-border shrink-0 bg-sidebar">
            <button
              onClick={() => setRightTab('anteckningar')}
              className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${rightTab === 'anteckningar' ? 'text-fg border-b-2 border-emerald-400' : 'text-muted hover:text-fg'}`}
            >
              Anteckningar
              <span className="text-[10px] bg-elevated border border-border rounded-full px-1.5 py-0.5">{anteckningar.length}</span>
            </button>
            <button
              onClick={() => setRightTab('dokument')}
              className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${rightTab === 'dokument' ? 'text-fg border-b-2 border-emerald-400' : 'text-muted hover:text-fg'}`}
            >
              Dokument
              <span className="text-[10px] bg-elevated border border-border rounded-full px-1.5 py-0.5">{dokument.length}</span>
            </button>
          </div>

          {/* Signering */}
          {rightTab === 'signering' && (
            <div className="flex-1 flex flex-col overflow-auto">
              <div className="px-4 py-4 border-b border-border">
                <SignaturTimeline
                  docStatus={forslag.status}
                  acceptedStatuses={statusar.filter(s => s.farg === 'emerald').map(s => s.namn)}
                  rejectedStatuses={statusar.filter(s => s.farg === 'red').map(s => s.namn)}
                  latestLink={latestLink}
                />
              </div>
              {forslag.godkand_datum && (
                <SignaturGodkannandeBlock
                  godkand_av={forslag.godkand_av}
                  godkand_datum={forslag.godkand_datum}
                  signatur_data={forslag.signatur_data}
                />
              )}
              <SignaturLankarPanel dokument_typ="forslag" dokument_id={forslag.id} refreshKey={linksRefresh} />
            </div>
          )}

          {/* Uppgifter — kund + projekt info */}
          {rightTab === 'uppgifter' && (
            <div className="flex-1 flex flex-col overflow-auto">
              {!kundFull ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-muted">Laddar...</p>
                </div>
              ) : (
                <>
                  {/* Kund */}
                  <div className="px-5 py-3 border-b border-border">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Kund</p>
                    <div className="flex flex-col divide-y divide-border">

                      {/* Namn */}
                      <div className="py-2">
                        <p className="text-[10px] text-muted">Namn</p>
                        <p className="text-sm font-semibold text-fg mt-0.5">{kundFull.namn}</p>
                      </div>

                      {/* Kundnummer | Org.nr / Personnr */}
                      <div className="flex py-2 gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted">Kundnummer</p>
                          <p className="text-xs text-fg mt-0.5 font-mono">{kundFull.kundnummer}</p>
                        </div>
                        {(kundFull.org_nummer || kundFull.personnummer) && (
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted">{kundFull.org_nummer ? 'Org.nr' : 'Personnr'}</p>
                            <p className="text-xs text-fg mt-0.5 font-mono">{kundFull.org_nummer ?? kundFull.personnummer}</p>
                          </div>
                        )}
                      </div>

                      {/* E-post */}
                      <div className="py-2">
                        <p className="text-[10px] text-muted">E-post</p>
                        <p className="text-xs text-fg mt-0.5 break-all">{kundFull.email ?? '—'}</p>
                      </div>

                      {/* Telefon | Telefon 2 */}
                      <div className="flex py-2 gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted">Telefon</p>
                          <p className="text-xs text-fg mt-0.5">{kundFull.telefon ?? '—'}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted">Telefon 2</p>
                          <p className="text-xs text-fg mt-0.5">{kundFull.telefon_2 ?? '—'}</p>
                        </div>
                      </div>

                      {/* Fax | Webb — solo si existen */}
                      {(kundFull.fax || kundFull.webbadress) && (
                        <div className="flex py-2 gap-4">
                          {kundFull.fax && (
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted">Fax</p>
                              <p className="text-xs text-fg mt-0.5">{kundFull.fax}</p>
                            </div>
                          )}
                          {kundFull.webbadress && (
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted">Webb</p>
                              <p className="text-xs text-fg mt-0.5 break-all">{kundFull.webbadress}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Adress */}
                      <div className="py-2">
                        <p className="text-[10px] text-muted">Adress</p>
                        <p className="text-xs text-fg mt-0.5">
                          {kundFull.adress ?? '—'}{kundFull.adress_2 ? `, ${kundFull.adress_2}` : ''}
                        </p>
                      </div>

                      {/* Postnummer | Stad */}
                      <div className="flex py-2 gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted">Postnummer</p>
                          <p className="text-xs text-fg mt-0.5 font-mono">{kundFull.postnummer ?? '—'}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted">Stad</p>
                          <p className="text-xs text-fg mt-0.5">{kundFull.stad ?? '—'}</p>
                        </div>
                      </div>

                      {/* Land | Fastighetsbeteckning — solo si existen */}
                      {(kundFull.land || kundFull.fastighetsbeteckning || kundFull.brf_org_nummer) && (
                        <div className="flex py-2 gap-4">
                          {kundFull.land && (
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted">Land</p>
                              <p className="text-xs text-fg mt-0.5">{kundFull.land}</p>
                            </div>
                          )}
                          {kundFull.fastighetsbeteckning && (
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted">Fastighetsbeteckning</p>
                              <p className="text-xs text-fg mt-0.5">{kundFull.fastighetsbeteckning}</p>
                            </div>
                          )}
                          {!kundFull.land && !kundFull.fastighetsbeteckning && kundFull.brf_org_nummer && (
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted">BRF org.nr</p>
                              <p className="text-xs text-fg mt-0.5 font-mono">{kundFull.brf_org_nummer}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Medsökande — solo si existe */}
                      {kundFull.medsokande_namn && (
                        <div className="flex py-2 gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted">Medsökande</p>
                            <p className="text-xs text-fg mt-0.5">{kundFull.medsokande_namn}</p>
                          </div>
                          {kundFull.medsokande_personnummer && (
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted">Personnummer</p>
                              <p className="text-xs text-fg mt-0.5 font-mono">{kundFull.medsokande_personnummer}</p>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>

                </>
              )}
            </div>
          )}

          {/* Projekt */}
          {rightTab === 'projekt' && (
            <div className="flex-1 flex flex-col overflow-auto">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Projekt</p>
                <div className="flex flex-col divide-y divide-border">
                  <div className="py-2">
                    <p className="text-[10px] text-muted">Namn</p>
                    <p className="text-sm font-semibold text-fg mt-0.5">{forslag.projekt.namn}</p>
                  </div>
                  <div className="flex py-2 gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted">Nummer</p>
                      <p className="text-xs text-fg mt-0.5 font-mono">{forslag.projekt.projekt_nummer}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted">Status</p>
                      <p className="text-xs text-fg mt-0.5">{forslag.projekt.status}</p>
                    </div>
                  </div>
                  {(forslag.projekt.startdatum || forslag.projekt.slutdatum) && (
                    <div className="flex py-2 gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted">Startdatum</p>
                        <p className="text-xs text-fg mt-0.5">{forslag.projekt.startdatum ? new Date(forslag.projekt.startdatum).toLocaleDateString('sv-SE') : '—'}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted">Slutdatum</p>
                        <p className="text-xs text-fg mt-0.5">{forslag.projekt.slutdatum ? new Date(forslag.projekt.slutdatum).toLocaleDateString('sv-SE') : '—'}</p>
                      </div>
                    </div>
                  )}
                  {forslag.projekt.betalningsvillkor && (
                    <div className="py-2">
                      <p className="text-[10px] text-muted">Betalningsvillkor</p>
                      <p className="text-xs text-fg mt-0.5">{forslag.projekt.betalningsvillkor}</p>
                    </div>
                  )}
                  {(forslag.projekt.arbetsplats_adress || forslag.projekt.arbetsplats_postnummer || forslag.projekt.arbetsplats_stad) && (
                    <>
                      <div className="py-2">
                        <p className="text-[10px] text-muted">Arbetsplats</p>
                        <p className="text-xs text-fg mt-0.5">{forslag.projekt.arbetsplats_adress ?? '—'}</p>
                      </div>
                      <div className="flex py-2 gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted">Postnummer</p>
                          <p className="text-xs text-fg mt-0.5 font-mono">{forslag.projekt.arbetsplats_postnummer ?? '—'}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted">Stad</p>
                          <p className="text-xs text-fg mt-0.5">{forslag.projekt.arbetsplats_stad ?? '—'}</p>
                        </div>
                      </div>
                    </>
                  )}
                  {forslag.projekt.beskrivning && (
                    <div className="py-2">
                      <p className="text-[10px] text-muted">Beskrivning</p>
                      <p className="text-xs text-fg mt-0.5 leading-relaxed whitespace-pre-wrap">{forslag.projekt.beskrivning}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Kostnad */}
          {rightTab === 'kostnad' && (
            <div className="flex-1 overflow-hidden">
              <ForslagKostnadsPanel
                arbete={allArbete}
                material={allMaterial}
                underentreprenorer={allUE}
                rotAvdrag={forslag.projekt.rot_avdrag}
                rotProcent={forslag.projekt.rot_procent}
                rotInkluderaMedsokande={forslag.projekt.rot_inkludera_medsokande}
                momsProcent={forslag.moms_procent}
                onMedsokandeToggle={handleToggleMedsokande}
                onApplyRot={handleApplyRot}
              />
            </div>
          )}

          {/* E-post */}
          {rightTab === 'epost' && (
            <div className="flex-1 flex flex-col overflow-auto">
              {epostLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-muted">Laddar...</p>
                </div>
              ) : (epostRefs.length === 0 && epostKo.length === 0) ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6">
                  <Mail size={20} className="text-muted" />
                  <p className="text-xs text-muted text-center">Inga e-post kopplade till detta förslag</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {epostKo.map(ko => {
                    const statusColor = ko.status === 'skickat' ? 'text-emerald-400' : ko.status === 'misslyckades' ? 'text-red-400' : ko.status === 'skickar' ? 'text-blue-400' : 'text-amber-400'
                    return (
                      <div key={ko.id} className="px-4 py-3 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <Send size={11} className="text-muted shrink-0" />
                          <p className="text-xs text-fg truncate flex-1">{ko.amne || '(inget ämne)'}</p>
                          <span className={`text-[10px] font-medium ${statusColor}`}>{ko.status}</span>
                          {ko.status !== 'skickar' && (
                            <button
                              onClick={async () => {
                                await window.api.invoke('db:epost-ko:delete', ko.id)
                                setEpostKo(prev => prev.filter(k => k.id !== ko.id))
                              }}
                              className="text-[10px] text-red-400 hover:text-red-300 transition-opacity shrink-0"
                            >
                              Ta bort
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-muted ml-[19px] truncate">{ko.till}</p>
                        <p className="text-[11px] text-subtle ml-[19px]">
                          {new Date(ko.skickad_at ?? ko.schemalagd_till).toLocaleString('sv-SE')}
                        </p>
                      </div>
                    )
                  })}
                  {epostRefs.map(ref => (
                    <div key={ref.id} className="px-4 py-3 flex flex-col gap-0.5 group">
                      <div className="flex items-center gap-2">
                        <Mail size={11} className="text-muted shrink-0" />
                        <p className="text-xs text-fg truncate flex-1">{ref.amne || '(inget ämne)'}</p>
                        <button
                          onClick={() => {
                            localStorage.setItem('open-crm:pending-email', JSON.stringify({
                              message_id: ref.message_id,
                              folder_id: ref.folder_id,
                              provider: ref.provider,
                              amne: ref.amne,
                              fran_adress: ref.fran_adress,
                              fran_namn: ref.fran_namn,
                              snippet: ref.snippet,
                              datum: ref.datum,
                            }))
                            setEpostOpenHint(true)
                            setTimeout(() => setEpostOpenHint(false), 3000)
                          }}
                          className="text-[10px] text-blue-400 hover:text-blue-300 transition-opacity shrink-0"
                        >
                          Öppna
                        </button>
                        <button
                          onClick={async () => {
                            await window.api.invoke('db:forslag-epost:delete', ref.id)
                            setEpostRefs(prev => prev.filter(r => r.id !== ref.id))
                          }}
                          className="text-[10px] text-red-400 hover:text-red-300 transition-opacity shrink-0"
                        >
                          Ta bort
                        </button>
                      </div>
                      <p className="text-[11px] text-muted ml-[19px] truncate">{ref.fran_namn || ref.fran_adress}</p>
                      <p className="text-[11px] text-subtle ml-[19px]">
                        {new Date(ref.datum).toLocaleString('sv-SE')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {epostOpenHint && (
                <div className="px-4 py-2 border-t border-border bg-sidebar shrink-0">
                  <p className="text-[11px] text-blue-400">Navigera till E-post i menyn för att se meddelandet</p>
                </div>
              )}
            </div>
          )}

          {/* Villkor */}
          {rightTab === 'villkor' && (
            <div className="flex-1 flex flex-col overflow-auto">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
                <p className="text-[10px] uppercase tracking-widest text-muted">Villkor</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateBeskrivning}
                    disabled={!villkorAssistentId || villkorGenerating}
                    title={!villkorAssistentId ? 'Ingen assistent konfigurerad för villkor-beskrivning' : 'Generera projektbeskrivning'}
                    className="flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors disabled:opacity-40"
                  >
                    {villkorGenerating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    Beskrivning
                  </button>
                  {!villkorEditing && (
                    <button
                      onClick={() => {
                        setVillkorDraft(forslag.projekt?.villkor ?? '')
                        setVillkorEditing(true)
                      }}
                      className="flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors"
                    >
                      <Pencil size={11} />
                      Redigera
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 flex flex-col px-5 py-4 gap-3">
                {villkorEditing ? (
                  <>
                    <textarea
                      value={villkorDraft}
                      onChange={(e) => setVillkorDraft(e.target.value)}
                      rows={12}
                      className="bg-elevated border border-border rounded-sm px-3 py-2 text-xs text-fg outline-none resize-y leading-relaxed placeholder:text-subtle w-full"
                      placeholder="Projektspecifika villkor..."
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setVillkorEditing(false)}
                        disabled={villkorSaving}
                        className="text-xs text-muted hover:text-fg transition-colors px-3 py-1.5"
                      >
                        Avbryt
                      </button>
                      <button
                        onClick={async () => {
                          setVillkorSaving(true)
                          try {
                            await window.api.invoke('db:projekt:update', forslag.projekt_id, { villkor: villkorDraft })
                            setForslag((prev) => ({ ...prev, projekt: { ...prev.projekt!, villkor: villkorDraft } }))
                            setVillkorEditing(false)
                          } finally {
                            setVillkorSaving(false)
                          }
                        }}
                        disabled={villkorSaving}
                        className="rounded-md border border-emerald-400 text-emerald-400 px-4 py-1.5 text-xs font-medium hover:bg-emerald-400/10 transition-colors disabled:opacity-50"
                      >
                        {villkorSaving ? 'Sparar…' : 'Spara'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-elevated border border-border rounded-md px-3 py-2 flex-1 overflow-auto">
                    {(forslag.projekt?.villkor ?? '').trim()
                      ? <pre className="text-xs text-fg whitespace-pre-wrap font-sans">{forslag.projekt?.villkor}</pre>
                      : <p className="text-xs text-subtle italic">Inga villkor satta — standardtext används vid PDF-export.</p>
                    }
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Anteckningar */}
          {rightTab === 'anteckningar' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-auto">
                {anteckningar.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-subtle text-xs">Inga anteckningar ännu.</p>
                  </div>
                ) : (
                  <div className="relative py-4">
                    <div className="absolute left-[27px] top-0 bottom-0 w-px bg-border" />
                    {anteckningar.map((a) => {
                      const expanded = expandedAntIds.has(a.id)
                      const isEditing = editingNoteId === a.id
                      return (
                        <div key={a.id} className="group relative flex gap-3 px-4 pb-5 last:pb-2">
                          <div className="relative shrink-0 flex flex-col items-center mt-1">
                            <button
                              type="button"
                              onClick={() => setColorPickerId(colorPickerId === a.id ? null : a.id)}
                              className={`relative z-10 size-2.5 rounded-full border-2 transition-transform hover:scale-125 ${ANTECKNING_FARG_DOT[a.farg ?? 'muted']}`}
                            />
                            {colorPickerId === a.id && (
                              <div className="absolute top-4 left-0 z-20 flex items-center gap-1 bg-sidebar border border-border rounded-lg px-2 py-1.5 shadow-lg">
                                {ANT_FARG_OPTIONS.map((o) => (
                                  <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => { void handleChangeAntFarg(a.id, o.value); setColorPickerId(null) }}
                                    className={`size-3 rounded-full border-2 transition-transform hover:scale-125 ${o.dot} ${a.farg === o.value ? 'scale-125' : 'opacity-60'}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              {isEditing ? (
                                <input autoFocus className="input flex-1" value={editAntTitel} onChange={(e) => setEditAntTitel(e.target.value)} />
                              ) : (
                                <span className="text-xs font-semibold text-fg cursor-pointer hover:text-muted transition-colors leading-relaxed" onClick={() => toggleExpandAnt(a.id)}>
                                  {a.titel || '(ingen titel)'}
                                </span>
                              )}
                              <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                                {isEditing ? (
                                  <>
                                    <button onClick={() => void saveEditAnt(a.id)} disabled={savingEditId === a.id} className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"><Check size={12} /></button>
                                    <button onClick={cancelEditAnt} className="p-1 text-muted hover:text-fg transition-colors"><XIcon size={12} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => startEditAnt(a)} className="p-1 text-subtle hover:text-fg opacity-0 group-hover:opacity-100 transition-all"><Pencil size={11} /></button>
                                    <button onClick={() => void handleDeleteNote(a.id)} disabled={deletingNoteId === a.id} className="p-1 text-subtle hover:text-red-400 opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-all"><Trash2 size={11} /></button>
                                  </>
                                )}
                              </div>
                            </div>
                            <p className="text-[11px] text-subtle mt-0.5">{new Date(a.skapad_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}</p>
                            {isEditing && <AntFargPicker value={editAntFarg} onChange={setEditAntFarg} />}
                            {isEditing ? (
                              <textarea className="input resize-none w-full mt-2" rows={5} value={editAntInnehall} onChange={(e) => setEditAntInnehall(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') cancelEditAnt() }} placeholder="Innehåll..." />
                            ) : a.innehall ? (
                              <p className="text-xs text-muted mt-1.5 cursor-pointer leading-relaxed" onClick={() => toggleExpandAnt(a.id)}>
                                {expanded ? a.innehall : a.innehall.length > 80 ? a.innehall.slice(0, 80) + '…' : a.innehall}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <form onSubmit={(e) => void handleAddNote(e)} className="border-t border-border p-4 flex flex-col gap-2 shrink-0">
                <input className="input text-xs" placeholder="Titel *" value={nyAntTitel} onChange={(e) => setNyAntTitel(e.target.value)} />
                <AntFargPicker value={nyAntFarg} onChange={setNyAntFarg} />
                <textarea className="input resize-none text-xs" rows={5} placeholder="Innehåll (valfritt)..." value={nyAntInnehall} onChange={(e) => setNyAntInnehall(e.target.value)} />
                <button type="submit" disabled={savingNote || !nyAntTitel.trim()} className="flex items-center justify-center gap-1.5 rounded-lg bg-fg text-bg px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-30">
                  <Send size={11} />
                  {savingNote ? 'Sparar...' : 'Lägg till anteckning'}
                </button>
              </form>
            </div>
          )}

          {/* Dokument */}
          {rightTab === 'dokument' && (
            <DokumentPanel
              dokument={dokument}
              projektId={forslag.projekt_id}
              onUpload={(carpeta) => handleUploadDokument(carpeta)}
              onCreateText={handleCreateTextDokument}
              onDelete={handleDeleteDokument}
              onOpen={handleOpenDokument}
              onToggleVisibility={handleToggleDokumentVisibility}
              onMoveCarpeta={handleMoveCarpeta}
              onDeleteCarpeta={handleDeleteCarpeta}
              onRename={handleRenameDokument}
              uploadProgress={uploadProgress}
            />
          )}

          {/* Always-mounted portal target for the FasEditor catalog */}
          <div ref={catalogPortalRef} className="shrink-0" />
        </div>
      </div>

      {showVilkorReminder && (
        <VilkorReminderModal
          villkor={forslag.projekt?.villkor ?? ''}
          projektId={forslag.projekt_id}
          onVillkorSave={async (newVillkor: string) => {
            await window.api.invoke('db:projekt:update', forslag.projekt_id, { villkor: newVillkor })
            setForslag((prev) => prev
              ? { ...prev, projekt: { ...prev.projekt!, villkor: newVillkor } }
              : prev
            )
          }}
          onClose={() => setShowVilkorReminder(false)}
          onConfirm={() => {
            setShowVilkorReminder(false)
            setShowTidplanReminder(true)
          }}
        />
      )}

      {showBulkTimpris && (
        <BulkTimprisModal
          forslagId={forslag.id}
          arbete={Object.values(arbeteBySubfas).flat()}
          arbetsRoller={arbetsRoller}
          onClose={() => setShowBulkTimpris(false)}
          onApplied={() => { setShowBulkTimpris(false); loadAll() }}
        />
      )}

      {showTidplanReminder && (
        <TidplanReminderModal
          faser={faser}
          onClose={() => setShowTidplanReminder(false)}
          onNavigateTidplan={() => {
            setShowTidplanReminder(false)
            onNavigateTidplan?.('send')
          }}
          onConfirm={async () => {
            setShowTidplanReminder(false)
            const mall = await window.api.invoke('db:pdf-mall:get', 'forslag') as PdfMall | null
            const titel1 = mall?.portada_titel || 'FÖRSLAG'
            const titel2 = mall?.portada_titel_2?.trim() ?? ''
            setSignaturTitelOptions({ titel1, titel2: titel2 || undefined })
            setShowSendModal(true)
          }}
        />
      )}

      {showSendModal && (
        <SkickaForSignaturModal
          dokument_typ="forslag"
          dokument_id={forslag.id}
          initialEmail={forslag.projekt?.kunder?.email ?? ''}
          kund_namn={forslag.projekt.kunder.namn}
          projekt_namn={forslag.projekt.namn}
          titelOptions={signaturTitelOptions ?? undefined}
          bifogaOptions={[
            {
              id: 'tidplan',
              label: 'Bifoga tidplan',
              generate: async () => {
                const html = await buildTidplanHtmlForExport()
                const data_base64 = await window.api.invoke('pdf:generate-buffer', { html }) as string
                return { filnamn: `tidplan-${forslag.forslag_nummer}.pdf`, data_base64 }
              },
            },
            {
              id: 'specifikation',
              label: 'Bifoga specifikation',
              generate: async () => {
                const specHtml = await buildForslagHtml(
                  signaturTitelOptions?.titel1 || 'FÖRSLAG',
                  { visa_portada_display: 'none', visa_sammanfattning_display: 'none', visa_villkor_display: 'none' },
                  pdfExportSammanfattad
                )
                const data_base64 = await window.api.invoke('pdf:generate-buffer', { html: specHtml }) as string
                return { filnamn: `specifikation-${forslag.forslag_nummer}.pdf`, data_base64 }
              },
            },
          ]}
          onClose={() => setShowSendModal(false)}
          onSent={(link, extras) => {
            setLinksRefresh(k => k + 1)
            void renderSigningPdf(link.id, extras?.titel, extras?.sammanfattad, extras?.splitPdf)
              .then(async () => {
                if (extras?.splitPdf) {
                  try {
                    const specHtml = await buildForslagHtml(
                      signaturTitelOptions?.titel1 || 'FÖRSLAG',
                      { visa_portada_display: 'none', visa_sammanfattning_display: 'none', visa_villkor_display: 'none' },
                      extras?.sammanfattad ?? false
                    )
                    await window.api.invoke('db:signatur-lank:render-specifikation-pdf', { link_id: link.id, html: specHtml })
                  } catch (e) {
                    console.error('Render specifikation PDF failed:', e)
                  }
                }
                if (extras?.bifogaTidplan) {
                  try {
                    const tidplanHtml = await buildTidplanHtmlForExport()
                    await window.api.invoke('db:signatur-lank:render-tidplan-pdf', { link_id: link.id, html: tidplanHtml })
                  } catch (e) {
                    console.error('Render tidplan PDF failed:', e)
                  }
                }
                setLinksRefresh(k => k + 1)
              })
          }}
        />
      )}

      {/* PDF export modal — title selection (if mall has two titlar) + Bifoga tidplan checkbox */}
      {pdfTitelPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-elevated border border-border rounded-xl shadow-2xl w-96 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-sidebar">
              <p className="text-sm font-medium text-fg">Exportera PDF</p>
              <button onClick={() => setPdfTitelPicker(null)} className="text-muted hover:text-fg transition-colors">
                <XIcon size={14} />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4">
              {pdfTitelPicker.titel2 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] uppercase tracking-widest text-muted">Titel</p>
                  <div className="flex flex-col gap-1.5">
                    {[pdfTitelPicker.titel1, pdfTitelPicker.titel2].map(t => (
                      <label key={t} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${pdfExportTitel === t ? 'border-emerald-400/60 bg-emerald-400/5' : 'border-border hover:border-subtle'}`}>
                        <input
                          type="radio"
                          name="pdf-titel"
                          checked={pdfExportTitel === t}
                          onChange={() => setPdfExportTitel(t)}
                          className="accent-emerald-400"
                        />
                        <span className="text-sm text-fg">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Titel</span>
                  <span className="font-medium text-fg">{pdfTitelPicker.titel1}</span>
                </div>
              )}

              <label className={`flex items-center gap-2 text-xs cursor-pointer select-none transition-colors ${pdfExportBifogaTidplan ? 'text-emerald-400 font-medium' : 'text-muted hover:text-fg'}`}>
                <input
                  type="checkbox"
                  checked={pdfExportBifogaTidplan}
                  onChange={(e) => setPdfExportBifogaTidplan(e.target.checked)}
                  className="w-4 h-4 accent-emerald-400"
                />
                <span>Inkludera tidplan i samma PDF</span>
              </label>

              <label className={`flex items-center gap-2 text-xs cursor-pointer select-none transition-colors ${pdfExportSammanfattad ? 'text-emerald-400 font-medium' : 'text-muted hover:text-fg'}`}>
                <input
                  type="checkbox"
                  checked={pdfExportSammanfattad}
                  onChange={(e) => setPdfExportSammanfattad(e.target.checked)}
                  className="w-4 h-4 accent-emerald-400"
                />
                <span>Dölj raddetaljer</span>
              </label>

              <label className={`flex items-center gap-2 text-xs cursor-pointer select-none transition-colors ${pdfExportSplit ? 'text-emerald-400 font-medium' : 'text-muted hover:text-fg'}`}>
                <input
                  type="checkbox"
                  checked={pdfExportSplit}
                  onChange={(e) => setPdfExportSplit(e.target.checked)}
                  className="w-4 h-4 accent-emerald-400"
                />
                <span>Dela upp i 2 PDF (offert + spec)</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-sidebar">
              <button onClick={() => setPdfTitelPicker(null)} className="text-sm text-muted hover:text-fg transition-colors px-3 py-1.5">
                Avbryt
              </button>
              <button
                onClick={() => doExportPdf(pdfExportTitel || pdfTitelPicker.titel1, pdfExportBifogaTidplan, pdfExportSammanfattad, pdfExportSplit)}
                disabled={exportingPdf}
                className="flex items-center gap-1.5 rounded-md bg-emerald-400 text-bg px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                <FileDown size={12} />Exportera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
