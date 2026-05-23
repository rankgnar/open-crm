import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, CheckCircle, X } from 'lucide-react'
import { useRefreshHandler } from '@/context/RefreshContext'
import { useChangeListener } from '@/hooks/useChangeListener'
import { useAppConfig } from '@/context/AppConfig'
import { ForslagTable } from './ForslagTable'
import { ProjektInfoModal } from './ProjektInfoModal'
import { DuplikatForslagModal } from './DuplikatForslagModal'
import { ForslagForm } from './ForslagForm'
import { ForslagDetail } from './ForslagDetail'
import { SmsForslagPanel } from './SmsForslagPanel'
import type { ForslagWithProjekt, CreateForslagInput, ForslagStatusar, SignaturSummary } from './types'
import type { ProjektWithKund } from '@/sections/projekt/types'

type View = 'list' | 'create' | 'detail'

interface Props {
  initialProjektId?: string
  onNavigateProjekt?: (projektId: string) => void
  initialForslagId?: string
  openTidplanReminderOnLoad?: boolean
  onNavigateTidplan?: (forslagId: string, mode: 'send' | 'direct') => void
  initialProjektIdForNew?: string
}

export function ForslagSection({ initialProjektId, onNavigateProjekt, initialForslagId, openTidplanReminderOnLoad, onNavigateTidplan, initialProjektIdForNew }: Props = {}) {
  const { config } = useAppConfig()
  const [projektModalId, setProjektModalId] = useState<string | null>(null)
  const [smsModalForslag, setSmsModalForslag] = useState<ForslagWithProjekt | null>(null)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [forslag, setForslag] = useState<ForslagWithProjekt[]>([])
  const [allProjekt, setAllProjekt] = useState<ProjektWithKund[]>([])
  const [statusar, setStatusar] = useState<ForslagStatusar[]>([])
  const [signingEvents, setSigningEvents] = useState<Record<string, SignaturSummary>>({})
  const [smsForslag, setSmsForslag] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('list')
  const [selectedForslag, setSelectedForslag] = useState<ForslagWithProjekt | null>(null)

  const csvFileRef = useRef<HTMLInputElement>(null)
  const [importRows, setImportRows] = useState<Record<string, string>[] | null>(null)
  const [importTargetProjektId, setImportTargetProjektId] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [forslagData, projektData, statusData, signingData, smsIds] = await Promise.all([
        window.api.invoke('db:forslag:list') as Promise<ForslagWithProjekt[]>,
        window.api.invoke('db:projekt:list') as Promise<ProjektWithKund[]>,
        window.api.invoke('db:forslag-statusar:list') as Promise<ForslagStatusar[]>,
        window.api.invoke('db:signatur-lank:forslag-events') as Promise<Record<string, SignaturSummary>>,
        window.api.invoke('db:forslag-sms-log:forslag-ids') as Promise<string[]>,
      ])
      setForslag(forslagData)
      setAllProjekt(projektData)
      setStatusar(statusData)
      setSigningEvents(signingData)
      setSmsForslag(new Set(smsIds))
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

  const initialProjektForNewConsumed = useRef(false)
  useEffect(() => {
    if (!initialProjektIdForNew || loading || initialProjektForNewConsumed.current) return
    initialProjektForNewConsumed.current = true
    setView('create')
  }, [initialProjektIdForNew, loading])

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

  function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = (ev.target?.result as string ?? '').replace(/^﻿/, '').replace(/\r/g, '')
      const lines = text.trim().split('\n')
      if (lines.length < 2) { setImportError('Filen är tom eller har fel format.'); return }
      const headers = lines[0].split(',')
      const rows: Record<string, string>[] = []
      for (const line of lines.slice(1)) {
        const cols: string[] = []
        let cur = '', inQ = false
        for (const ch of line) {
          if (ch === '"') { inQ = !inQ }
          else if (ch === ',' && !inQ) { cols.push(cur); cur = '' }
          else { cur += ch }
        }
        cols.push(cur)
        const row: Record<string, string> = {}
        headers.forEach((h, i) => { row[h.trim()] = (cols[i] ?? '').trim() })
        rows.push(row)
      }
      if (!rows.some((r) => r.type === 'meta')) { setImportError('CSV saknar meta-rad (type=meta).'); return }
      setImportRows(rows)
      setImportTargetProjektId(initialProjektId ?? allProjekt[0]?.id ?? '')
      setImportError('')
      setImportSuccess('')
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleConfirmImport() {
    if (!importRows || !importTargetProjektId) return
    setImporting(true)
    setImportError('')
    try {
      const newF = await window.api.invoke('db:forslag:import-csv', importTargetProjektId, importRows) as ForslagWithProjekt
      setForslag((prev) => [newF, ...prev])
      setImportRows(null)
      setImportSuccess(`Förslag ${newF.forslag_nummer} importerat.`)
      setSelectedForslag(newF)
      setView('detail')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import misslyckades.')
    } finally {
      setImporting(false)
    }
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

  async function handleBulkReminder(lankIds: string[]) {
    await Promise.allSettled(
      lankIds.map((id) => window.api.invoke('db:signatur-lank:resend', id, { reminder: true }))
    )
  }

  async function handleSendReminder(lankId: string, meddelande: string) {
    await window.api.invoke('db:signatur-lank:resend', lankId, { reminder: true, meddelande: meddelande || undefined })
    const signingData = await window.api.invoke('db:signatur-lank:forslag-events') as Record<string, SignaturSummary>
    setSigningEvents(signingData)
  }

  async function reloadSmsForslag() {
    const ids = await window.api.invoke('db:forslag-sms-log:forslag-ids') as string[]
    setSmsForslag(new Set(ids))
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
    return <ForslagForm statusar={statusar} projekt={allProjekt} initialProjektId={initialProjektIdForNew} onSubmit={handleCreate} onCancel={() => setView('list')} />
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

  const importFaserCount = importRows ? [...new Set(importRows.filter((r) => r.type === 'fas').map((r) => r.fas))].length : 0
  const importArbeteCount = importRows ? importRows.filter((r) => r.type === 'arbete').length : 0
  const importMaterialCount = importRows ? importRows.filter((r) => r.type === 'material').length : 0
  const importMeta = importRows?.find((r) => r.type === 'meta')

  return (
    <>
      <input ref={csvFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFileChange} />

      {importRows && (
        <div className="flex items-start gap-3 px-5 py-3 bg-amber-400/10 border-b border-amber-400/20 shrink-0">
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-fg font-medium">
              Importera förslag "{importMeta?.titel}"?
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              {importFaserCount} faser · {importArbeteCount} arbetsrader · {importMaterialCount} materialrader
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-muted shrink-0">Projekt:</span>
              <select
                value={importTargetProjektId}
                onChange={(e) => setImportTargetProjektId(e.target.value)}
                className="text-[11px] bg-elevated border border-border rounded px-2 py-0.5 text-fg focus:outline-none"
              >
                <option value="">Välj projekt...</option>
                {allProjekt.map((p) => (
                  <option key={p.id} value={p.id}>{p.namn}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleConfirmImport}
              disabled={importing || !importTargetProjektId}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
            >
              {importing ? 'Importerar...' : 'Bekräfta'}
            </button>
            <button
              onClick={() => { setImportRows(null); setImportError('') }}
              className="text-xs text-muted hover:text-fg transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {importSuccess && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-emerald-400/10 border-b border-emerald-400/20 shrink-0">
          <CheckCircle size={13} className="text-emerald-400 shrink-0" />
          <p className="text-xs text-fg flex-1">{importSuccess}</p>
          <button onClick={() => setImportSuccess('')} className="text-xs text-muted hover:text-fg transition-colors">×</button>
        </div>
      )}

      {importError && (
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border shrink-0">
          <AlertTriangle size={13} className="text-red-400 shrink-0" />
          <p className="text-xs text-red-400 flex-1">{importError}</p>
          <button onClick={() => setImportError('')} className="text-xs text-muted hover:text-fg transition-colors">×</button>
        </div>
      )}

      <ForslagTable
        forslag={visibleForslag}
        statusar={statusar}
        signingEvents={signingEvents}
        smsForslag={smsForslag}
        onSelect={(f) => { setSelectedForslag(f); setView('detail') }}
        onNew={() => setView('create')}
        onDuplicate={() => setShowDuplicate(true)}
        onImportCsv={() => csvFileRef.current?.click()}
        onStatusChange={handleStatusChange}
        onDeleteMany={handleDeleteMany}
        onBulkReminder={handleBulkReminder}
        onClickProjekt={(id) => setProjektModalId(id)}
        onSendReminder={handleSendReminder}
        onOpenSms={(f) => setSmsModalForslag(f)}
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
      {smsModalForslag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={(e) => { if (e.target === e.currentTarget) { setSmsModalForslag(null); reloadSmsForslag() } }}>
          <div className="bg-elevated border border-border rounded-xl shadow-xl w-[520px] max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <p className="text-[11px] uppercase tracking-widest text-muted font-semibold">SMS — {smsModalForslag.forslag_nummer}</p>
              <button onClick={() => { setSmsModalForslag(null); reloadSmsForslag() }} className="text-subtle hover:text-fg transition-colors"><X size={14} /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <SmsForslagPanel
                forslagId={smsModalForslag.id}
                projektId={smsModalForslag.projekt_id}
                kund_namn={smsModalForslag.projekt.kunder.namn}
                kund_email={smsModalForslag.projekt.kunder.email ?? ''}
                kund_telefon={smsModalForslag.projekt.kunder.telefon ?? ''}
                kund_stad={smsModalForslag.projekt.kunder.stad ?? ''}
                projekt_namn={smsModalForslag.projekt.namn}
                forslag_nummer={smsModalForslag.forslag_nummer}
                foretag_namn={config?.foretag_namn ?? ''}
                foretag_email={config?.foretag_email ?? ''}
                foretag_telefon={config?.foretag_telefon ?? ''}
                foretag_webbadress={config?.foretag_webbadress ?? ''}
                onNoteCreated={() => {}}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
