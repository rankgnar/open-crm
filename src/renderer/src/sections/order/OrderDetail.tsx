import { useEffect, useState } from 'react'
import { ArrowLeft, Trash2, PenSquare, FileDown, Send, Pencil, Check, X as XIcon } from 'lucide-react'
import { OrderSignaturePad } from './OrderSignaturePad'
import { OrderStatusPicker } from './OrderStatusPicker'
import type { OrderWithRader, OrderStatus, UpdateOrderInput } from './types'
import { useAppConfig } from '@/context/AppConfig'
import type { PdfMall } from '@/sections/installningar/types'
import { DEFAULT_ORDER_HTML, buildOrderRaderHtml } from '@/pdf/defaultOrderTemplate'
import { injectVars } from '@/pdf/inject'
import { SkickaForSignaturModal } from '@/sections/signatur/SkickaForSignaturModal'
import { SignaturLankarPanel } from '@/sections/signatur/SignaturLankarPanel'
import { SignaturTimeline, type SignaturTimelineLink } from '@/sections/signatur/SignaturTimeline'
import { SignaturGodkannandeBlock } from '@/sections/signatur/SignaturGodkannandeBlock'

interface Props {
  order: OrderWithRader
  onBack: () => void
  onSetStatus: (id: string, status: OrderStatus) => Promise<void>
  onSign: (id: string, godkand_av: string, signatur_data: string) => Promise<void>
  onUpdate: (id: string, patch: UpdateOrderInput) => Promise<OrderWithRader>
  onDelete: (id: string) => Promise<void>
}

export function OrderDetail({ order: orderProp, onBack, onSetStatus, onSign, onUpdate, onDelete }: Props) {
  // Local mirror so server-side status bumps (Utkast → Skickad → Godkänd)
  // reflect in the UI without parent refetch.
  const [order, setOrder] = useState(orderProp)
  useEffect(() => { setOrder(orderProp) }, [orderProp])

  const { config, formatCurrency } = useAppConfig()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showPad, setShowPad] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [linksRefresh, setLinksRefresh] = useState(0)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [latestLink, setLatestLink] = useState<SignaturTimelineLink | null>(null)
  const [editingVillkor, setEditingVillkor] = useState(false)
  const [villkorDraft, setVillkorDraft] = useState(order.villkor ?? '')
  const [savingVillkor, setSavingVillkor] = useState(false)
  useEffect(() => { setVillkorDraft(order.villkor ?? '') }, [order.villkor])

  async function saveVillkor() {
    const next = villkorDraft.trim()
    if (next === (order.villkor ?? '').trim()) {
      setEditingVillkor(false)
      return
    }
    setSavingVillkor(true)
    try {
      const fresh = await onUpdate(order.id, { villkor: next })
      setOrder(fresh)
      setEditingVillkor(false)
    } finally {
      setSavingVillkor(false)
    }
  }

  // Refetch the order itself whenever linksRefresh ticks.
  useEffect(() => {
    if (linksRefresh === 0) return
    void (async () => {
      try {
        const fresh = await window.api.invoke('db:order:get', orderProp.id) as typeof orderProp
        if (fresh) setOrder(fresh)
      } catch (e) { console.error(e) }
    })()
  }, [linksRefresh, orderProp.id])

  // Latest link feeds the Signering timeline.
  useEffect(() => {
    void (async () => {
      const lankar = await window.api.invoke('db:signatur-lank:list-for-doc', 'order', order.id) as SignaturTimelineLink[]
      setLatestLink(lankar[0] ?? null)
    })()
  }, [order.id, linksRefresh])

  // Live refresh while a link is pending.
  useEffect(() => {
    if (!latestLink) return
    if (latestLink.signerad_at || latestLink.revoked_at) return
    const tick = () => setLinksRefresh(k => k + 1)
    const intervalId = window.setInterval(tick, 8000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', tick)
    }
  }, [latestLink])

  async function handle(action: () => Promise<void>) {
    setBusy(true)
    try { await action() } finally { setBusy(false) }
  }

  async function handleStatusChange(next: OrderStatus) {
    if (next === order.status) return
    if (order.status === 'Godkänd') {
      const ok = confirm('Detta tar bort signaturen och godkännandet. Fortsätt?')
      if (!ok) return
    }
    await handle(() => onSetStatus(order.id, next))
  }

  async function buildOrderHtml(): Promise<string> {
    const mall = await window.api.invoke('db:pdf-mall:get', 'order') as PdfMall | null
    const template = mall?.html_mall || DEFAULT_ORDER_HTML
    const accentFarg = mall?.accent_farg ?? '#1B3A6B'

    const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))
    const logoHtml = config?.foretag_logo_url
      ? `<img src="${config.foretag_logo_url}" style="max-height:50px;max-width:160px;object-fit:contain;" />`
      : `<div class="cover-logo">${config?.foretag_namn ?? ''}</div>`

    const isGodkand = order.status === 'Godkänd' && !!order.signatur_data
    const signaturImgHtml = isGodkand
      ? `<img src="${order.signatur_data}" alt="Signatur" class="signatur-img" />`
      : '<div style="font-size:10px;color:#888;font-style:italic;padding:14px 0;">Ej signerad ännu</div>'

    const vars: Record<string, string> = {
      foretag_namn: config?.foretag_namn ?? '',
      foretag_org_nummer: config?.foretag_org_nummer ?? '',
      foretag_telefon: config?.foretag_telefon ?? '',
      foretag_email: config?.foretag_email ?? '',
      foretag_webbadress: config?.foretag_webbadress ?? '',
      accent_farg: accentFarg,
      visa_villkor_display: mall?.visa_villkor !== false ? 'block' : 'none',
      visa_beskrivning_display: order.beskrivning?.trim() ? 'block' : 'none',
      visa_godkand_fskatt_text: mall?.visa_godkand_f_skatt !== false ? ' &nbsp;·&nbsp; Godkänd för F-skatt' : '',
      villkor_text: order.villkor?.trim() || 'Order är gällande efter signering av kund. Arbetet faktureras separat från huvudprojekt.',
      logo_html: logoHtml,
      order_nummer: order.order_nummer,
      titel: order.titel,
      kund_namn: order.kund_namn,
      kund_org_nr: order.kund_org_nr || '—',
      projekt_namn: order.projekt?.namn ?? '—',
      fas_namn: order.fas?.namn ?? '—',
      subfas_namn: order.subfas?.namn ?? '—',
      datum: new Date(order.skapad_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }),
      beskrivning: order.beskrivning || '',
      rader_html: buildOrderRaderHtml(order.rader.map((r) => ({
        beskrivning: r.beskrivning, antal: r.antal, enhet: r.enhet, a_pris: r.a_pris, belopp: r.belopp,
      })), 'kr'),
      netto: fmt(order.belopp_netto),
      moms: fmt(order.belopp_moms),
      total: fmt(order.belopp_total),
      valuta: 'kr',
      signatur_img_html: signaturImgHtml,
      godkand_av: order.godkand_av || '—',
      godkand_datum: order.godkand_datum ? new Date(order.godkand_datum).toLocaleDateString('sv-SE') : '—',
    }

    return injectVars(template, vars)
  }

  async function handleExportPdf() {
    setExportingPdf(true)
    try {
      const html = await buildOrderHtml()
      await window.api.invoke('pdf:generate-html', { html, name: `order-${order.order_nummer}-${order.kund_namn.replace(/\s+/g, '_')}`, save: true })
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-muted hover:text-fg transition-colors text-sm">
            <ArrowLeft size={14} />Order
          </button>
          <span className="text-subtle">/</span>
          <span className="text-sm text-fg font-medium">{order.order_nummer}</span>
          <OrderStatusPicker
            status={order.status}
            onChange={(next) => handleStatusChange(next)}
            onRequestUnlock={order.status === 'Godkänd' ? () => void handleStatusChange('Utkast') : undefined}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors disabled:opacity-40"
          >
            <FileDown size={11} />{exportingPdf ? 'Genererar...' : 'PDF'}
          </button>
          <button
            onClick={() => setShowSendModal(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-emerald-400 transition-colors disabled:opacity-40"
          >
            <Send size={11} />Skicka för signatur
          </button>
          {order.status !== 'Godkänd' && (
            <button
              onClick={() => setShowPad(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors disabled:opacity-40"
            >
              <PenSquare size={11} />Signera nu
            </button>
          )}
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-red-400 transition-colors">
              <Trash2 size={11} />Ta bort
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">Är du säker?</span>
              <button onClick={() => handle(() => onDelete(order.id))} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors disabled:opacity-40">
                Ja, ta bort
              </button>
              <button onClick={() => setConfirmDelete(false)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
                Avbryt
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* Main content — scrollable */}
        <div className="flex-1 overflow-auto flex flex-col">
        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-0.5">{order.order_nummer}</p>
          <h2 className="text-xl font-semibold text-fg">{order.titel}</h2>
        </div>

        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Kund & projekt</p>
          <div className="grid grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <DetailField label="Kund" value={order.kund_namn} />
            <DetailField label="Org-nummer" value={order.kund_org_nr || '—'} />
            <DetailField label="Projekt" value={order.projekt?.namn ?? '—'} />
            <DetailField label="Fas" value={order.fas?.namn ?? '—'} />
            <DetailField label="Subfas" value={order.subfas?.namn ?? '—'} />
          </div>
        </div>

        {order.beskrivning && (
          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-3">Beskrivning</p>
            <p className="text-sm text-fg whitespace-pre-wrap">{order.beskrivning}</p>
          </div>
        )}

        <div className="px-8 py-6 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-widest text-muted">Villkor</p>
            {!editingVillkor ? (
              <button
                onClick={() => { setVillkorDraft(order.villkor ?? ''); setEditingVillkor(true) }}
                className="flex items-center gap-1.5 text-[11px] text-muted hover:text-fg transition-colors"
              >
                <Pencil size={11} />Redigera
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setVillkorDraft(order.villkor ?? ''); setEditingVillkor(false) }}
                  disabled={savingVillkor}
                  className="flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors disabled:opacity-40"
                >
                  <XIcon size={11} />Avbryt
                </button>
                <button
                  onClick={saveVillkor}
                  disabled={savingVillkor}
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-40"
                >
                  <Check size={11} />{savingVillkor ? 'Sparar...' : 'Spara'}
                </button>
              </div>
            )}
          </div>
          {editingVillkor ? (
            <textarea
              autoFocus
              className="input min-h-32 leading-relaxed"
              value={villkorDraft}
              onChange={(e) => setVillkorDraft(e.target.value)}
              placeholder="Villkor för denna order..."
            />
          ) : order.villkor?.trim() ? (
            <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">{order.villkor}</p>
          ) : (
            <p className="text-sm text-subtle italic">Inga villkor angivna.</p>
          )}
        </div>

        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Rader</p>
          {order.rader.length === 0 ? (
            <p className="text-sm text-muted">Inga rader</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
                  <th className="text-left pb-2 font-medium">Beskrivning</th>
                  <th className="text-right pb-2 font-medium w-20">Antal</th>
                  <th className="text-left pb-2 font-medium w-20">Enhet</th>
                  <th className="text-right pb-2 font-medium w-32">À-pris</th>
                  <th className="text-right pb-2 font-medium w-32">Belopp</th>
                </tr>
              </thead>
              <tbody>
                {order.rader.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2 text-fg">{r.beskrivning}</td>
                    <td className="py-2 text-right font-mono text-muted">{r.antal}</td>
                    <td className="py-2 text-muted">{r.enhet}</td>
                    <td className="py-2 text-right font-mono text-muted">{formatCurrency(r.a_pris)}</td>
                    <td className="py-2 text-right font-mono text-fg">{formatCurrency(r.belopp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="grid grid-cols-2 gap-x-8 max-w-md ml-auto mt-4 text-xs">
            <span className="text-muted py-1">Netto</span>
            <span className="text-right font-mono text-fg py-1">{formatCurrency(order.belopp_netto)}</span>
            <span className="text-muted py-1">Moms 25%</span>
            <span className="text-right font-mono text-fg py-1">{formatCurrency(order.belopp_moms)}</span>
            <span className="text-fg font-semibold border-t border-border pt-2">Total</span>
            <span className="text-right font-mono text-fg font-semibold border-t border-border pt-2">{formatCurrency(order.belopp_total)}</span>
          </div>
        </div>

        <div className="px-8 py-4 mt-auto border-t border-border flex items-center gap-6 text-[11px] text-muted">
          <span>Skapad {order.skapad_at.slice(0, 10)}</span>
          <span>Uppdaterad {order.uppdaterad_at.slice(0, 10)}</span>
        </div>
        </div>

        {/* Right sidebar — Signering */}
        <div className="w-96 shrink-0 border-l border-border overflow-auto flex flex-col">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Signering</p>
          </div>
          <div className="px-4 py-4 border-b border-border">
            <SignaturTimeline
              docStatus={order.status}
              acceptedStatuses={['Godkänd']}
              rejectedStatuses={['Avvisad']}
              latestLink={latestLink}
            />
          </div>
          {order.status === 'Godkänd' && (
            <SignaturGodkannandeBlock
              godkand_av={order.godkand_av}
              godkand_datum={order.godkand_datum}
              signatur_data={order.signatur_data}
            />
          )}
          <div className="flex-1">
            <SignaturLankarPanel dokument_typ="order" dokument_id={order.id} refreshKey={linksRefresh} />
          </div>
        </div>
      </div>

      {showPad && (
        <OrderSignaturePad
          onCancel={() => setShowPad(false)}
          onSign={async (godkand_av, signatur_data) => {
            await onSign(order.id, godkand_av, signatur_data)
            setShowPad(false)
          }}
        />
      )}

      {showSendModal && (
        <SkickaForSignaturModal
          dokument_typ="order"
          dokument_id={order.id}
          initialEmail={order.kund?.email ?? ''}
          onClose={() => setShowSendModal(false)}
          onSent={(link) => {
            setLinksRefresh(k => k + 1)
            void (async () => {
              try {
                const html = await buildOrderHtml()
                await window.api.invoke('db:signatur-lank:render-document-pdf', { link_id: link.id, html })
              } catch (e) { console.error('Render document PDF failed:', e) }
              setLinksRefresh(k => k + 1)
            })()
          }}
        />
      )}
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-fg">{value ?? '—'}</span>
    </div>
  )
}
