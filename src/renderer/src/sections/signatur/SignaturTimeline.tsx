import { CheckCircle2, FileDown, Send, Eye, XCircle, MessageSquarePlus, RefreshCw, Bell } from 'lucide-react'

export interface SignaturTimelineLink {
  skapad_at:            string
  oppnad_at:            string | null
  signerad_at:          string | null
  signerad_namn:        string | null
  revoked_at:           string | null
  signed_pdf_url:           string | null
  specifikation_pdf_url?:   string | null
  tidplan_pdf_url?:         string | null
  andring_begard_at:        string | null
  andring_historik?:    { at: string; reason: string }[]
  revisioner_historik?: { at: string }[]
  paminnelse_historik?: { at: string }[]
}

interface Props {
  /** Status of the underlying doc — drives the empty/done copy when there's no link. */
  docStatus:    string
  /** Statuses that mean "fully signed". E.g. ['accepterat'] for forslag, ['Godkänd'] for order. */
  acceptedStatuses: string[]
  /** Statuses that mean "rejected". */
  rejectedStatuses: string[]
  /** Most recent signing link (or null if none has been created). */
  latestLink:   SignaturTimelineLink | null
}

function fmtDt(s: string | null): string {
  if (!s) return ''
  return new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

interface TimelineEventProps {
  icon:     React.ReactNode
  label:    string
  datetime: string
  sub?:     string
  color:    'amber' | 'blue' | 'emerald' | 'red'
  isLast?:  boolean
}

const COLOR_MAP: Record<TimelineEventProps['color'], string> = {
  amber:   'bg-amber-400/15 text-amber-400 border-amber-400/30',
  blue:    'bg-blue-400/15 text-blue-400 border-blue-400/30',
  emerald: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
  red:     'bg-red-400/15 text-red-400 border-red-400/30',
}

function TimelineEvent({ icon, label, datetime, sub, color, isLast }: TimelineEventProps) {
  return (
    <div className="flex gap-3 relative">
      <div className="flex flex-col items-center shrink-0">
        <div className={`size-6 rounded-full border flex items-center justify-center ${COLOR_MAP[color]}`}>
          {icon}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border my-1 min-h-[18px]" />}
      </div>
      <div className="flex-1 pb-3 min-w-0">
        <p className="text-xs font-medium text-fg leading-tight">{label}</p>
        {datetime && <p className="text-[10.5px] text-subtle tabular-nums mt-0.5">{datetime}</p>}
        {sub && <p className="text-[10.5px] text-muted truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export function SignaturTimeline({ docStatus, acceptedStatuses, rejectedStatuses, latestLink }: Props) {
  if (!latestLink) {
    if (acceptedStatuses.includes(docStatus)) {
      return <p className="text-xs text-subtle italic">Signerad utanför signaturlänk-systemet.</p>
    }
    if (rejectedStatuses.includes(docStatus)) {
      return (
        <div className="flex items-center gap-2 text-red-400">
          <XCircle size={14} />
          <span className="text-xs">Avvisad av kund</span>
        </div>
      )
    }
    return <p className="text-xs text-subtle italic">Inte signerad ännu. Skicka för signatur för att skicka länken till kunden.</p>
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col">
        <TimelineEvent
          color="amber"
          icon={<Send size={11} />}
          label="Skickat"
          datetime={fmtDt(latestLink.skapad_at)}
        />
        {latestLink.oppnad_at && (
          <TimelineEvent
            color="blue"
            icon={<Eye size={11} />}
            label="Mottagit"
            datetime={fmtDt(latestLink.oppnad_at)}
          />
        )}

        {/* Interleave change-requests and revised-version sends in chronological order. */}
        {(() => {
          type Evt =
            | { at: string; kind: 'andring'; reason: string }
            | { at: string; kind: 'revision' }
            | { at: string; kind: 'paminnelse' }
          const events: Evt[] = [
            ...(latestLink.andring_historik ?? []).map((e): Evt => ({ at: e.at, kind: 'andring', reason: e.reason })),
            ...(latestLink.revisioner_historik ?? []).map((e): Evt => ({ at: e.at, kind: 'revision' })),
            ...(latestLink.paminnelse_historik ?? []).map((e): Evt => ({ at: e.at, kind: 'paminnelse' })),
          ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

          return events.map((e, i) =>
            e.kind === 'andring' ? (
              <TimelineEvent
                key={`andring-${i}`}
                color="amber"
                icon={<MessageSquarePlus size={11} />}
                label="Begärt ändring"
                datetime={fmtDt(e.at)}
                sub={e.reason}
              />
            ) : e.kind === 'revision' ? (
              <TimelineEvent
                key={`revision-${i}`}
                color="blue"
                icon={<RefreshCw size={11} />}
                label="Skickat uppdaterad version"
                datetime={fmtDt(e.at)}
              />
            ) : (
              <TimelineEvent
                key={`paminnelse-${i}`}
                color="amber"
                icon={<Bell size={11} />}
                label="Påminnelse skickad"
                datetime={fmtDt(e.at)}
              />
            )
          )
        })()}

        {latestLink.revoked_at ? (
          <TimelineEvent
            color="red"
            icon={<XCircle size={11} />}
            label="Återkallad"
            datetime={fmtDt(latestLink.revoked_at)}
            isLast
          />
        ) : latestLink.signerad_at ? (
          <TimelineEvent
            color="emerald"
            icon={<CheckCircle2 size={11} />}
            label="Signerat"
            datetime={fmtDt(latestLink.signerad_at)}
            sub={latestLink.signerad_namn ?? undefined}
            isLast
          />
        ) : (
          <TimelineEvent
            color="amber"
            icon={<Eye size={11} />}
            label="Väntar på signatur..."
            datetime=""
            isLast
          />
        )}
      </div>

      {latestLink.signerad_at && (
        latestLink.signed_pdf_url || latestLink.specifikation_pdf_url || latestLink.tidplan_pdf_url ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {latestLink.signed_pdf_url && (
              <a
                href={latestLink.signed_pdf_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-400/20 transition-colors"
              >
                <FileDown size={12} />
                Offert
              </a>
            )}
            {latestLink.specifikation_pdf_url && (
              <a
                href={latestLink.specifikation_pdf_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-400/20 transition-colors"
              >
                <FileDown size={12} />
                Specifikation
              </a>
            )}
            {latestLink.tidplan_pdf_url && (
              <a
                href={latestLink.tidplan_pdf_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-400/20 transition-colors"
              >
                <FileDown size={12} />
                Tidplan
              </a>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-subtle italic mt-2">PDF inte tillgänglig (signerades före PDF-stödet).</p>
        )
      )}
    </div>
  )
}
