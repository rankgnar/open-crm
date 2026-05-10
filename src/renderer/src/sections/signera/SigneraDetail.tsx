import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, FileText, Image as ImageIcon, FolderInput, CheckCircle2, Loader2, Send, X as XIcon, RefreshCw } from 'lucide-react'
import { SignaturLankarPanel } from '@/sections/signatur/SignaturLankarPanel'
import { SignaturTimeline } from '@/sections/signatur/SignaturTimeline'
import { SignaturGodkannandeBlock } from '@/sections/signatur/SignaturGodkannandeBlock'
import { SkickaUppdateradVersionModal } from '@/sections/signatur/SkickaUppdateradVersionModal'
import { lankStatus } from '@/sections/signatur/types'
import type { SigneraRow } from './types'

interface Props {
  row:        SigneraRow
  onBack:     () => void
  onArchived: () => void
  onUpdated?: () => void | Promise<void>
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export function SigneraDetail({ row, onBack, onArchived, onUpdated }: Props) {
  const [archiving, setArchiving] = useState(false)
  const [archived, setArchived]   = useState(Boolean(row.dokument?.arkiverad_dokument_id))
  const [error, setError]         = useState('')
  const [showRevisedModal, setShowRevisedModal] = useState(false)
  const [sendingRevised, setSendingRevised]     = useState(false)
  const [revisedFeedback, setRevisedFeedback]   = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [refreshing, setRefreshing]             = useState(false)

  useEffect(() => {
    setArchived(Boolean(row.dokument?.arkiverad_dokument_id))
  }, [row.dokument?.arkiverad_dokument_id])

  const status = lankStatus(row.lank)
  const signed = status === 'signerad'

  async function handleArchive() {
    setError('')
    setArchiving(true)
    try {
      await window.api.invoke('db:signera:archive-to-projekt', row.lank.id)
      setArchived(true)
      onArchived()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setArchiving(false)
    }
  }

  async function openOriginal() {
    if (!row.lank.document_pdf_url) return
    await window.api.invoke('shell:open-external', row.lank.document_pdf_url)
  }

  async function openSigned() {
    if (!row.lank.signed_pdf_url) return
    await window.api.invoke('shell:open-external', row.lank.signed_pdf_url)
  }

  async function handleRefresh() {
    if (refreshing || !onUpdated) return
    setRefreshing(true)
    try {
      await onUpdated()
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSendRevisedVersion(meddelande: string) {
    setSendingRevised(true)
    setRevisedFeedback(null)
    try {
      await window.api.invoke('db:signatur-lank:clear-change-request', row.lank.id)
      await window.api.invoke('db:signatur-lank:resend', row.lank.id, { revised: true, meddelande })
      setShowRevisedModal(false)
      setRevisedFeedback({ kind: 'success', message: 'Uppdaterad version skickad till kunden. E-postet hamnar i kön och skickas inom en minut.' })
      onUpdated?.()
    } catch (e) {
      const msg = (e as Error).message ?? String(e)
      setRevisedFeedback({ kind: 'error', message: `Kunde inte skicka uppdaterad version: ${msg}` })
      throw e
    } finally {
      setSendingRevised(false)
    }
  }

  const Icon = row.dokument?.mime_type === 'application/pdf' ? FileText : ImageIcon
  const docStatus = row.lank.signerad_at ? 'signerat' : row.lank.revoked_at ? 'aterkallad' : 'vantar'
  const lastAndringReason = row.lank.andring_historik?.length
    ? row.lank.andring_historik[row.lank.andring_historik.length - 1].reason
    : null
  const showAndringBanner = !!row.lank.andring_begard_at && !row.lank.signerad_at && !row.lank.revoked_at

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
        >
          <ArrowLeft size={13} />Tillbaka
        </button>
        <div className="flex items-center gap-2">
          {onUpdated && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors disabled:opacity-40"
              title="Uppdatera"
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />Uppdatera
            </button>
          )}
          {signed && !archived && (
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-emerald-400 transition-colors disabled:opacity-40"
            >
              {archiving ? <Loader2 size={11} className="animate-spin" /> : <FolderInput size={11} />}Spara till projekt
            </button>
          )}
          {signed && archived && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 size={13} />Arkiverat i projekt
            </span>
          )}
        </div>
      </div>

      {showAndringBanner && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
                Kunden begärde ändringar
              </p>
              {lastAndringReason && (
                <p className="text-sm text-fg whitespace-pre-wrap">"{lastAndringReason}"</p>
              )}
              <p className="text-[11px] text-muted mt-1">
                {new Date(row.lank.andring_begard_at!).toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            </div>
            <button
              onClick={() => setShowRevisedModal(true)}
              disabled={sendingRevised}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/10 border border-amber-400/40 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-400/20 transition-colors disabled:opacity-50 shrink-0"
            >
              <Send size={12} />
              {sendingRevised ? 'Skickar...' : 'Skicka uppdaterad version'}
            </button>
          </div>
        </div>
      )}

      {revisedFeedback && (
        <div className={`border-b px-6 py-2.5 text-xs flex items-center justify-between gap-3 shrink-0 ${
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

      <SkickaUppdateradVersionModal
        isOpen={showRevisedModal}
        onClose={() => { if (!sendingRevised) setShowRevisedModal(false) }}
        onSubmit={handleSendRevisedVersion}
        senasteAndring={lastAndringReason ?? undefined}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted">Signera</p>
            <h2 className="text-xl font-semibold text-fg mt-1">{row.dokument?.titel ?? '—'}</h2>
          </div>

          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Mottagare & projekt</p>
            <div className="grid grid-cols-3 gap-x-8 gap-y-5">
              <div>
                <p className="text-[11px] text-subtle mb-1">Projekt</p>
                <p className="text-sm text-fg">{row.projekt?.namn ?? '—'}</p>
                <p className="text-[11px] text-muted">{row.projekt?.projekt_nummer ?? ''}</p>
              </div>
              <div>
                <p className="text-[11px] text-subtle mb-1">Kund</p>
                <p className="text-sm text-fg">{row.kund?.namn ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-subtle mb-1">Skickat till</p>
                <p className="text-sm text-fg break-all">{row.lank.kund_email}</p>
              </div>
              <div>
                <p className="text-[11px] text-subtle mb-1">Skapad</p>
                <p className="text-sm text-fg">{fmtDate(row.lank.skapad_at)}</p>
              </div>
              <div>
                <p className="text-[11px] text-subtle mb-1">Giltig till</p>
                <p className="text-sm text-fg">{fmtDate(row.lank.gar_ut_at)}</p>
              </div>
              <div>
                <p className="text-[11px] text-subtle mb-1">Signerad</p>
                <p className="text-sm text-fg">
                  {row.lank.signerad_at
                    ? <>av {row.lank.signerad_namn} · {fmtDate(row.lank.signerad_at)}</>
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Dokument</p>
            {row.dokument ? (
              <div className="flex items-center gap-3">
                <Icon size={18} className={row.dokument.mime_type === 'application/pdf' ? 'text-red-400' : 'text-blue-400'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg">{row.dokument.filnamn}</p>
                  <p className="text-[11px] text-subtle">{fmtSize(row.dokument.storlek)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {row.lank.document_pdf_url && (
                    <button
                      onClick={openOriginal}
                      className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors px-2 py-1"
                    >
                      <ExternalLink size={12} />Original
                    </button>
                  )}
                  {row.lank.signed_pdf_url && (
                    <button
                      onClick={openSigned}
                      className="flex items-center gap-1.5 text-xs text-emerald-400 hover:opacity-80 transition-opacity px-2 py-1"
                    >
                      <ExternalLink size={12} />Signerad PDF
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-subtle">—</p>
            )}
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
          </div>
        </div>

        {/* Right sidebar — Signering */}
        <div className="w-96 shrink-0 border-l border-border overflow-auto flex flex-col">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Signering</p>
          </div>
          <div className="px-4 py-4 border-b border-border">
            <SignaturTimeline
              docStatus={docStatus}
              acceptedStatuses={['signerat']}
              rejectedStatuses={['aterkallad']}
              latestLink={row.lank}
            />
          </div>
          {row.lank.signerad_at && (
            <SignaturGodkannandeBlock
              godkand_av={row.lank.signerad_namn}
              godkand_datum={row.lank.signerad_at}
              signatur_data={row.lank.signatur_data}
            />
          )}
          <div className="flex-1">
            <SignaturLankarPanel dokument_typ="fritt" dokument_id={row.dokument?.id ?? ''} />
          </div>
        </div>
      </div>
    </div>
  )
}
