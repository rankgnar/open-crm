import { useState, useEffect } from 'react'
import { ArrowLeft, Pencil, Trash2, Send, KeyRound, X } from 'lucide-react'
import { KundForm } from './KundForm'
import { WorkflowTriggerBar } from '@/components/WorkflowTriggerBar'
import type { Kund, CreateKundInput, KundStatusar, KundAvslutsfeedback } from './types'

interface KundUserRow {
  id: string
  auth_user_id: string
  kund_id: string
  email: string | null
  invited_at: string
  accepted_at: string | null
  skapad_at: string
}

const FARG_DOT: Record<string, string> = {
  emerald: 'bg-emerald-400',
  blue:    'bg-blue-400',
  amber:   'bg-amber-400',
  red:     'bg-red-400',
  muted:   'bg-muted',
}

interface Props {
  kund: Kund
  statusar: KundStatusar[]
  onBack: () => void
  onEdit: (data: CreateKundInput) => Promise<void>
  onDelete: () => Promise<void>
}

export function KundDetail({ kund, statusar, onBack, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [kundUser, setKundUser] = useState<KundUserRow | null>(null)
  const [inviting, setInviting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [inviteFeedback, setInviteFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [feedbackList, setFeedbackList] = useState<KundAvslutsfeedback[]>([])
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const currentStatus = statusar.find((s) => s.namn === kund.status)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await window.api.invoke('db:kund_users:list-by-kund', kund.id) as KundUserRow[]
        if (!cancelled) setKundUser(rows[0] ?? null)
      } catch {
        if (!cancelled) setKundUser(null)
      }
    })()
    return () => { cancelled = true }
  }, [kund.id])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await window.api.invoke('db:kund-avslut:list-by-kund', kund.id) as KundAvslutsfeedback[]
        if (!cancelled) setFeedbackList(rows)
      } catch {
        if (!cancelled) setFeedbackList([])
      }
    })()
    return () => { cancelled = true }
  }, [kund.id])

  async function handleInvite() {
    if (!kund.email?.trim()) {
      setInviteFeedback({ kind: 'err', msg: 'Kunden saknar e-postadress' })
      return
    }
    setInviting(true)
    setInviteFeedback(null)
    try {
      await window.api.invoke('db:kund_users:invite', kund.id)
      const rows = await window.api.invoke('db:kund_users:list-by-kund', kund.id) as KundUserRow[]
      setKundUser(rows[0] ?? null)
      setInviteFeedback({ kind: 'ok', msg: 'Inbjudan skickad' })
      setTimeout(() => setInviteFeedback(null), 3500)
    } catch (e) {
      setInviteFeedback({ kind: 'err', msg: e instanceof Error ? e.message : 'Okänt fel' })
    } finally {
      setInviting(false)
    }
  }

  async function handlePasswordReset() {
    setResetting(true)
    setInviteFeedback(null)
    try {
      await window.api.invoke('db:kund_users:send-password-reset', kund.id)
      setInviteFeedback({ kind: 'ok', msg: 'Återställningslänk skickad' })
      setTimeout(() => setInviteFeedback(null), 3500)
    } catch (e) {
      setInviteFeedback({ kind: 'err', msg: e instanceof Error ? e.message : 'Okänt fel' })
    } finally {
      setResetting(false)
    }
  }

  if (editing) {
    return (
      <KundForm
        initial={kund}
        statusar={statusar}
        onSubmit={async (data) => {
          await onEdit(data as CreateKundInput)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  async function handleDelete() {
    setDeleting(true)
    await onDelete()
  }

  const hasFeedback = feedbackList.length > 0
  const hasBesvarat = feedbackList.some((f) => f.status === 'besvarat')

  return (
    <div className="flex flex-col h-full">

      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-muted hover:text-fg transition-colors text-sm">
            <ArrowLeft size={14} />
            Kunder
          </button>
          <span className="text-subtle">/</span>
          <span className="text-sm text-fg font-medium uppercase">{kund.namn}</span>
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border border-border bg-elevated">
            <span className={`size-1.5 rounded-full ${FARG_DOT[currentStatus?.farg ?? 'muted']}`} />
            {kund.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {inviteFeedback ? (
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${inviteFeedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
              {inviteFeedback.msg}
            </span>
          ) : kundUser?.accepted_at ? (
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Aktiv sedan {new Date(kundUser.accepted_at).toLocaleDateString('sv-SE')}
            </span>
          ) : kundUser ? (
            <span className="flex items-center gap-1.5 text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
              <span className="size-1.5 rounded-full bg-amber-400" />
              Inbjudan skickad · {new Date(kundUser.invited_at).toLocaleDateString('sv-SE')}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] text-red-400 font-semibold uppercase tracking-wider">
              <span className="size-1.5 rounded-full bg-red-400" />
              Ej tillgång
            </span>
          )}
          {hasFeedback && (
            <button
              onClick={() => setFeedbackOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${feedbackOpen ? 'text-fg' : 'text-muted hover:text-fg'}`}
            >
              <span className={`size-1.5 rounded-full ${hasBesvarat ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              Feedback
            </button>
          )}
          {kundUser?.accepted_at ? (
            <button
              onClick={handlePasswordReset}
              disabled={resetting || inviting || !kund.email?.trim()}
              title={kund.email?.trim() ? undefined : 'Kunden saknar e-postadress'}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors disabled:opacity-40"
            >
              <KeyRound size={11} />{resetting ? 'Skickar...' : 'Återställ lösenord'}
            </button>
          ) : (
            <button
              onClick={handleInvite}
              disabled={inviting || resetting || !kund.email?.trim()}
              title={kund.email?.trim() ? undefined : 'Kunden saknar e-postadress'}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors disabled:opacity-40"
            >
              <Send size={11} />{inviting ? 'Skickar...' : kundUser ? 'Skicka påminnelse' : 'Bjud in'}
            </button>
          )}
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
            <Pencil size={11} />Redigera
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-red-400 transition-colors">
              <Trash2 size={11} />Ta bort
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">Är du säker?</span>
              <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors disabled:opacity-40">
                {deleting ? 'Tar bort...' : 'Ja, ta bort'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
                Avbryt
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        <div className="flex-1 overflow-auto flex flex-col">

          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-0.5">{kund.kundnummer}</p>
            <h2 className="text-xl font-semibold text-fg uppercase">{kund.namn}</h2>
          </div>

          <WorkflowTriggerBar seccion="kunder" context={{ kund_id: kund.id }} />

          <DetailSection title="Grunduppgifter">
            <DetailField label="Kundnummer" value={kund.kundnummer} />
            <DetailField label="Org-nummer" value={kund.org_nummer} />
            <DetailField label="Login" value={kund.login_anteckning} />
          </DetailSection>

          <DetailSection title="Kontaktuppgifter">
            <DetailField label="E-post" value={kund.email} />
            <DetailField label="Url" value={kund.webbadress} />
            <DetailField label="Telefon" value={kund.telefon} />
            <DetailField label="Telefon 2" value={kund.telefon_2} />
            <DetailField label="Fax" value={kund.fax} />
            <DetailField label="Personnummer" value={kund.personnummer} />
          </DetailSection>

          <DetailSection title="Fakturaadress">
            <DetailField label="Adress" value={kund.adress} />
            <DetailField label="Adress 2" value={kund.adress_2} />
            <DetailField label="Postnummer" value={kund.postnummer} />
            <DetailField label="Ort" value={kund.stad} />
            <DetailField label="Land" value={kund.land} />
            <DetailField label="Landskod" value={kund.landskod} />
          </DetailSection>

          <DetailSection title="Fastighet & husarbete" cols={4}>
            <DetailField label="Fastighetsbeteckning / Lägenhetsnr" value={kund.fastighetsbeteckning} />
            <DetailField label="BRF:s org.nr" value={kund.brf_org_nummer} />
            <DetailField label="Namn för medsökande" value={kund.medsokande_namn} />
            <DetailField label="Personnummer för medsökande" value={kund.medsokande_personnummer} />
          </DetailSection>

          <div className="px-8 py-6 border-b border-border flex flex-col gap-3">
            <p className="text-[11px] uppercase tracking-widest text-muted">Standardvillkor för extraarbeten (Order)</p>
            <div className="bg-elevated border border-border rounded-sm px-4 py-3 text-sm leading-relaxed min-h-[80px]">
              {kund.order_std_villkor?.trim()
                ? <p className="text-muted whitespace-pre-wrap">{kund.order_std_villkor}</p>
                : <p className="text-subtle italic">Inga standardvillkor angivna.</p>
              }
            </div>
            <p className="text-[11px] text-subtle">Snapshot — kopieras till varje ny order. Ändringar påverkar inte redan skapade orders.</p>
          </div>

          <div className="px-8 py-6 border-b border-border flex flex-col gap-3">
            <p className="text-[11px] uppercase tracking-widest text-muted">Standardvillkor för ÄTA</p>
            <div className="bg-elevated border border-border rounded-sm px-4 py-3 text-sm leading-relaxed min-h-[80px]">
              {kund.ata_std_villkor?.trim()
                ? <p className="text-muted whitespace-pre-wrap">{kund.ata_std_villkor}</p>
                : <p className="text-subtle italic">Inga ÄTA-villkor angivna.</p>
              }
            </div>
            <p className="text-[11px] text-subtle">Snapshot — kopieras till varje ny ÄTA. Ändringar påverkar inte redan skapade ÄTA-arbeten.</p>
          </div>

          <div className="px-8 py-4 mt-auto border-t border-border flex items-center gap-6">
            <MetaField label="Skapad" value={new Date(kund.skapad_at).toLocaleDateString('sv-SE')} />
            <MetaField label="Uppdaterad" value={new Date(kund.uppdaterad_at).toLocaleDateString('sv-SE')} />
          </div>

        </div>

        {feedbackOpen && (
          <div className="w-80 border-l border-border flex flex-col shrink-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <p className="text-[11px] uppercase tracking-widest text-muted">Feedback projektavslut</p>
              <button onClick={() => setFeedbackOpen(false)} className="text-subtle hover:text-fg transition-colors">
                <X size={13} />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex flex-col divide-y divide-border">
              {feedbackList.map((f) => (
                <FeedbackItem key={f.id} feedback={f} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function FeedbackItem({ feedback }: { feedback: KundAvslutsfeedback }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col gap-0.5 px-5 py-4 text-left hover:bg-hover transition-colors"
      >
        <span className="text-sm font-medium text-fg truncate">{feedback.projekt_namn}</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${feedback.status === 'besvarat' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {feedback.status === 'besvarat' ? 'Besvarat' : 'Väntar på svar'}
          </span>
          <span className="text-[10px] text-subtle">{new Date(feedback.skapad_at).toLocaleDateString('sv-SE')}</span>
        </div>
      </button>
      {open && feedback.status === 'besvarat' && feedback.answers_json && (
        <div className="px-5 pb-4 flex flex-col gap-3">
          {feedback.questions_json.map((q) => (
            <div key={q.id} className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted">{q.label}</span>
              <span className="text-xs text-fg">{feedback.answers_json![q.id] ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
      {open && feedback.status === 'skickat' && (
        <p className="px-5 pb-4 text-xs text-subtle italic">Formuläret har inte besvarats än.</p>
      )}
    </div>
  )
}

function DetailSection({ title, children, cols = 3 }: { title: string; children: React.ReactNode; cols?: 3 | 4 }) {
  return (
    <div className="px-8 py-6 border-b border-border">
      <p className="text-[11px] uppercase tracking-widest text-muted mb-4">{title}</p>
      <div className={`grid gap-[1px] bg-border overflow-hidden rounded-sm ${cols === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {children}
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1.5 bg-elevated px-4 py-3">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className="text-sm text-fg">{value ?? '—'}</span>
    </div>
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-subtle">
      {label}: <span className="text-muted">{value}</span>
    </span>
  )
}
