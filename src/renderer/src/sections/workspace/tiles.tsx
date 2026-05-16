import { Tile } from './Tile'
import { Sparkline } from './Sparkline'
import type { WorkspaceOverview, WorkspaceTarget } from './types'

const fmt = new Intl.NumberFormat('sv-SE')
const fmtSEK = (n: number) => `${fmt.format(Math.round(n))} kr`

function HourMin(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const SV_DAYS = ['må', 'ti', 'on', 'to', 'fr', 'lö', 'sö']

interface NavProps { onNavigate: (s: WorkspaceTarget) => void }

// ── KUNDER ─────────────────────────────────────────────────
export function KunderTile({ data, onNavigate, index }: { data: WorkspaceOverview['kunder'] } & NavProps & { index: number }) {
  const series = data.sparkline_30d.reduce((acc, b) => {
    acc.push((acc[acc.length - 1] ?? 0) + b.count)
    return acc
  }, [] as number[])
  const delta = data.nya_senaste_vecka
  return (
    <Tile title="Kunder" onClick={() => onNavigate('kunder')} index={index} className="col-span-3 row-span-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[40px] font-semibold text-fg ws-tabular leading-none">{fmt.format(data.total)}</span>
        {delta > 0 && (
          <span className="text-xs text-emerald-400 ws-tabular">+{delta}</span>
        )}
      </div>
      <div className="text-[11px] text-muted mt-1">senaste 30 dagarna</div>
      <div className="flex-1 flex items-end mt-3 text-fg/60">
        <Sparkline data={series} height={48} />
      </div>
      <div className="text-[11px] text-subtle mt-2">+{delta} senaste veckan</div>
    </Tile>
  )
}

// ── PROJEKT PIPELINE ───────────────────────────────────────
export function ProjektPipelineTile({ data, onNavigate, index }: { data: WorkspaceOverview['projekt'] } & NavProps & { index: number }) {
  const total = data.total || 1
  const sorted = [...data.per_status].sort((a, b) => b.count - a.count).slice(0, 6)
  const barColors = ['bg-emerald-400/80', 'bg-blue-400/70', 'bg-amber-400/70', 'bg-fg/50', 'bg-muted/60', 'bg-subtle']
  const textColors = ['text-emerald-400', 'text-blue-400', 'text-amber-400', 'text-fg/70', 'text-muted', 'text-subtle']
  const maxCount = sorted[0]?.count || 1
  return (
    <Tile title="Projekt — pipeline" onClick={() => onNavigate('projekt')} index={index} className="col-span-6 row-span-2">
      <div className="flex items-baseline gap-3">
        <span className="text-[40px] font-semibold text-fg ws-tabular leading-none">{fmt.format(data.total)}</span>
        <span className="text-xs text-muted">totalt</span>
      </div>
      <div className="flex w-full h-1.5 mt-3 overflow-hidden rounded-sm">
        {sorted.map((s, i) => (
          <div
            key={s.status}
            className={barColors[i % barColors.length]}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.status}: ${s.count}`}
          />
        ))}
      </div>
      <div className="flex-1 flex flex-col justify-center gap-2.5 mt-4">
        {sorted.map((s, i) => (
          <div key={s.status} className="flex items-center gap-3 min-w-0">
            <span className="text-[11px] text-muted w-28 shrink-0 truncate uppercase tracking-wide">{s.status}</span>
            <div className="flex-1 h-1.5 bg-fg/10 rounded-sm overflow-hidden">
              <div
                className={`h-full rounded-sm transition-all ${barColors[i % barColors.length]}`}
                style={{ width: `${(s.count / maxCount) * 100}%` }}
              />
            </div>
            <span className={`text-sm font-semibold ws-tabular shrink-0 w-6 text-right ${textColors[i % textColors.length]}`}>{s.count}</span>
            <span className="text-[11px] text-subtle shrink-0 w-8 text-right ws-tabular">{Math.round((s.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </Tile>
  )
}

// ── STATUS-LIST TILES (Förslag, Order, ÄTA) ────────────────
function StatusListTile({
  title, target, total, per_status, extra, onNavigate, index, span = 'col-span-3 row-span-1',
}: {
  title: string
  target: WorkspaceTarget
  total: number
  per_status: { status: string; count: number }[]
  extra?: string
  index: number
  span?: string
} & NavProps) {
  const top = per_status.slice(0, 3)
  return (
    <Tile title={title} onClick={() => onNavigate(target)} index={index} className={span}>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-fg ws-tabular leading-none">{fmt.format(total)}</span>
        <span className="text-[11px] text-muted">totalt</span>
      </div>
      <div className="space-y-1 mt-3">
        {top.length === 0 && <div className="text-xs text-subtle">—</div>}
        {top.map((s) => (
          <div key={s.status} className="flex justify-between text-xs">
            <span className="text-muted truncate">{s.status}</span>
            <span className="text-fg ws-tabular">{s.count}</span>
          </div>
        ))}
      </div>
      {extra && <div className="text-[11px] text-subtle mt-auto pt-2">{extra}</div>}
    </Tile>
  )
}

export function ForslagTile({ data, onNavigate, index }: { data: WorkspaceOverview['forslag'] } & NavProps & { index: number }) {
  return <StatusListTile title="Förslag" target="forslag" total={data.total} per_status={data.per_status} onNavigate={onNavigate} index={index} />
}

export function OrderTile({ data, onNavigate, index }: { data: WorkspaceOverview['ordrar'] } & NavProps & { index: number }) {
  return <StatusListTile title="Order" target="order" total={data.total} per_status={data.per_status} extra={data.belopp_aktiva > 0 ? `Aktivt belopp: ${fmtSEK(data.belopp_aktiva)}` : undefined} onNavigate={onNavigate} index={index} />
}

export function AtaTile({ data, onNavigate, index }: { data: WorkspaceOverview['ata'] } & NavProps & { index: number }) {
  return <StatusListTile title="ÄTA" target="ata" total={data.total} per_status={data.per_status} extra={data.belopp_utestaende > 0 ? `Utestående: ${fmtSEK(data.belopp_utestaende)}` : undefined} onNavigate={onNavigate} index={index} />
}

// ── TIDPLAN — week heatmap ────────────────────────────────
export function TidplanTile({ data, onNavigate, index }: { data: WorkspaceOverview['tidplan'] } & NavProps & { index: number }) {
  const max = Math.max(...data.per_dag_denna_vecka.map((d) => d.count), 1)
  const todayKey = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  return (
    <Tile title="Tidplan — denna vecka" onClick={() => onNavigate('tidplan')} index={index} className="col-span-4 row-span-1">
      <div className="flex items-baseline gap-4">
        <div>
          <div className="text-2xl font-semibold text-fg ws-tabular leading-none">{data.idag}</div>
          <div className="text-[11px] text-muted mt-1">idag</div>
        </div>
        <div>
          <div className="text-lg font-medium text-muted ws-tabular leading-none">{data.imorgon}</div>
          <div className="text-[11px] text-subtle mt-1">imorgon</div>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mt-3">
        {data.per_dag_denna_vecka.map((d, i) => {
          const h = d.count > 0 ? Math.max((d.count / max) * 100, 30) : 0
          const isToday = d.datum === todayKey
          return (
            <div key={d.datum} className="flex flex-col items-center gap-1">
              <div className="relative w-full h-7 flex items-end" title={`${d.datum}: ${d.count}`}>
                {d.count > 0 ? (
                  <>
                    <div
                      className={`w-full rounded-sm ${isToday ? 'bg-emerald-400' : 'bg-fg/40'}`}
                      style={{ height: `${h}%` }}
                    />
                    <span className={`absolute inset-x-0 -top-0.5 text-center text-[9px] ws-tabular ${isToday ? 'text-emerald-400' : 'text-muted'}`}>
                      {d.count}
                    </span>
                  </>
                ) : (
                  <div className={`w-full h-px ${isToday ? 'bg-emerald-400/60' : 'bg-fg/15'}`} />
                )}
              </div>
              <span className={`text-[10px] tracking-wide ${isToday ? 'text-emerald-400 font-medium' : 'text-muted'}`}>
                {SV_DAYS[i]}
              </span>
            </div>
          )
        })}
      </div>
    </Tile>
  )
}

// ── KOSTNADER — 12 month sparkline + delta ────────────────
export function KostnaderTile({ data, onNavigate, index }: { data: WorkspaceOverview['kostnader'] } & NavProps & { index: number }) {
  const series = data.sparkline_12m.map((b) => b.belopp)
  const delta = data.foregaende_manad === 0 ? 0 : ((data.denna_manad - data.foregaende_manad) / data.foregaende_manad) * 100
  const positive = delta >= 0
  return (
    <Tile title="Kostnader" onClick={() => onNavigate('ekonomi')} index={index} className="col-span-5 row-span-1">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold text-fg ws-tabular leading-none">{fmtSEK(data.denna_manad)}</span>
        <span className={`text-xs ws-tabular ${positive ? 'text-amber-400' : 'text-emerald-400'}`}>
          {positive ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}%
        </span>
      </div>
      <div className="text-[11px] text-muted mt-1">
        denna månad · föreg. {fmtSEK(data.foregaende_manad)}
      </div>
      <div className="flex-1 flex items-end mt-2 text-fg/60 min-h-[28px]">
        <Sparkline data={series} height={28} />
      </div>
    </Tile>
  )
}

// ── MINI-KPI tiles ─────────────────────────────────────────
function MiniKpiTile({
  title, value, sub, target, span, pulse, onNavigate, index, valueColor = 'text-fg',
}: {
  title: string
  value: string | number
  sub?: string
  target: WorkspaceTarget
  span: string
  pulse?: boolean
  index: number
  valueColor?: string
} & NavProps) {
  return (
    <Tile title={title} onClick={() => onNavigate(target)} index={index} className={span} pulse={pulse}>
      <div className={`text-2xl font-semibold ws-tabular leading-none ${valueColor}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted mt-1">{sub}</div>}
    </Tile>
  )
}

export function SigneraTile({ data, onNavigate, index }: { data: WorkspaceOverview['signatur'] } & NavProps & { index: number }) {
  return (
    <MiniKpiTile
      title="Signera"
      value={data.vantande}
      sub={`${data.signerade_30d} signerade 30d`}
      target="signera"
      span="col-span-2 row-span-1"
      pulse={data.vantande > 0}
      onNavigate={onNavigate}
      index={index}
      valueColor={data.vantande > 0 ? 'text-amber-400' : 'text-fg'}
    />
  )
}

export function EpostTile({ data, onNavigate, index }: { data: WorkspaceOverview['epost'] } & NavProps & { index: number }) {
  if (data.inkorg_status === 'ej_ansluten') {
    return (
      <Tile title="E-post" onClick={() => onNavigate('epost')} index={index} className="col-span-2 row-span-1">
        <div className="text-sm text-amber-400">Zoho ej ansluten</div>
        <div className="text-[11px] text-muted mt-1">Anslut i Inställningar</div>
      </Tile>
    )
  }
  if (data.inkorg_status === 'fel') {
    return (
      <Tile title="E-post" onClick={() => onNavigate('epost')} index={index} className="col-span-2 row-span-1">
        <div className="text-sm text-red-400">Kunde inte hämta inkorg</div>
      </Tile>
    )
  }
  const hasOlasta = data.olasta > 0
  const hasFail = data.misslyckade > 0
  return (
    <Tile title="E-post" onClick={() => onNavigate('epost')} index={index} className="col-span-2 row-span-1" pulse={hasOlasta || hasFail}>
      <div className={`text-2xl font-semibold ws-tabular leading-none ${hasOlasta ? 'text-emerald-400' : 'text-fg'}`}>
        {data.olasta}
      </div>
      <div className="text-[11px] text-muted mt-1">{data.olasta === 1 ? 'oläst i inkorgen' : 'olästa i inkorgen'}</div>
      {data.i_kon > 0 && (
        <div className="text-[11px] text-amber-400 mt-auto pt-2 ws-tabular">{data.i_kon} i kö</div>
      )}
      {hasFail && (
        <div className={`text-[11px] text-red-400 ws-tabular ${data.i_kon > 0 ? '' : 'mt-auto pt-2'}`}>{data.misslyckade} misslyckades</div>
      )}
    </Tile>
  )
}

export function KalenderTile({ data, onNavigate, index }: { data: WorkspaceOverview['kalender'] } & NavProps & { index: number }) {
  const next = data.nasta_handelser[0]
  return (
    <Tile title="Kalender" onClick={() => onNavigate('kalender')} index={index} className="col-span-2 row-span-1">
      <div className="text-2xl font-semibold text-fg ws-tabular leading-none">{data.idag}</div>
      <div className="text-[11px] text-muted mt-1">möten idag</div>
      {next && (
        <div className="text-[11px] text-subtle mt-auto truncate">
          <span className="font-mono text-fg/70">{HourMin(next.start)}</span> {next.titel}
        </div>
      )}
    </Tile>
  )
}

export function RevisorTile({ data, onNavigate, index }: { data: WorkspaceOverview['revisor'] } & NavProps & { index: number }) {
  return (
    <Tile title="Revisor" onClick={() => onNavigate('revisor')} index={index} className="col-span-3 row-span-1">
      <div className="text-2xl font-semibold text-fg ws-tabular leading-none">{data.kommande_deadlines}</div>
      <div className="text-[11px] text-muted mt-1">kommande deadlines</div>
      {data.nasta_deadline && (
        <div className="text-[11px] text-subtle mt-auto truncate">
          <span className="font-mono text-fg/70">{data.nasta_deadline.datum}</span> {data.nasta_deadline.titel}
        </div>
      )}
    </Tile>
  )
}

export function PersonalTile({ data, onNavigate, index }: { data: WorkspaceOverview['personal'] } & NavProps & { index: number }) {
  const pendingTotal = data.tidrapporter_inskickade + data.ledighet_inskickade
  const hasPending = pendingTotal > 0
  return (
    <Tile title="Personal" onClick={() => onNavigate('personal')} index={index} className="col-span-4 row-span-1" pulse={hasPending}>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-fg ws-tabular leading-none">{data.aktiva}</span>
        <span className="text-[11px] text-muted">aktiva · {data.total} totalt</span>
      </div>
      <div className="mt-3 space-y-1">
        {data.tidrapporter_inskickade > 0 && (
          <div className="text-[11px]">
            <span className="text-amber-400 ws-tabular">{data.tidrapporter_inskickade}</span>{' '}
            <span className="text-muted">tidrapport{data.tidrapporter_inskickade === 1 ? '' : 'er'} att godkänna</span>
          </div>
        )}
        {data.ledighet_inskickade > 0 && (
          <div className="text-[11px]">
            <span className="text-amber-400 ws-tabular">{data.ledighet_inskickade}</span>{' '}
            <span className="text-muted">ledighetsansök{data.ledighet_inskickade === 1 ? 'an' : 'ningar'}</span>
          </div>
        )}
        {data.lediga_idag > 0 && (
          <div className="text-[11px]">
            <span className="text-blue-400 ws-tabular">{data.lediga_idag}</span>{' '}
            <span className="text-muted">ledig{data.lediga_idag === 1 ? '' : 'a'} idag</span>
          </div>
        )}
        {!hasPending && data.lediga_idag === 0 && (
          <div className="text-[11px] text-subtle">Inget att åtgärda</div>
        )}
      </div>
    </Tile>
  )
}

export function FortnoxTile({ data, onNavigate, index }: { data: WorkspaceOverview['fortnox'] } & NavProps & { index: number }) {
  const ok = data.status === 'ok'
  return (
    <Tile title="Fortnox" onClick={() => onNavigate('fortnox')} index={index} className="col-span-3 row-span-1">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <span className="text-sm font-medium text-fg">{ok ? 'Synkad' : 'Aldrig synkad'}</span>
      </div>
      {data.senaste_synk && (
        <div className="text-[11px] text-muted mt-1 font-mono">
          {new Date(data.senaste_synk).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      )}
    </Tile>
  )
}

export function FaktureringTile({ data, onNavigate, index }: { data: WorkspaceOverview['fakturering'] } & NavProps & { index: number }) {
  return (
    <Tile title="Fakturering" onClick={() => onNavigate('fakturering')} index={index} className="col-span-2 row-span-1">
      <div className="text-2xl font-semibold text-fg ws-tabular leading-none">{data.antal_planer}</div>
      <div className="text-[11px] text-muted mt-1">{data.antal_planer === 1 ? 'plan' : 'planer'}</div>
      {data.total_planerat > 0 && (
        <div className="text-[11px] text-subtle mt-2 ws-tabular">{fmtSEK(data.total_planerat)} planerat</div>
      )}
      {data.nasta_forfall && (
        <div className="text-[10px] text-muted mt-auto pt-2 border-t border-fg/10">
          <div className="font-mono">{data.nasta_forfall.datum}</div>
          <div className="ws-tabular">{fmtSEK(data.nasta_forfall.belopp)}</div>
        </div>
      )}
    </Tile>
  )
}

// ── AI / Workflows ────────────────────────────────────────
function StatusDot({ status }: { status: 'ok' | 'no_key' | 'inaktiv' }) {
  const cls = status === 'ok' ? 'bg-emerald-400' : status === 'no_key' ? 'bg-amber-400' : 'bg-subtle'
  const title = status === 'ok' ? 'Aktiv' : status === 'no_key' ? 'Saknar API-nyckel' : 'Inaktiv'
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cls}`} title={title} />
}

function AiRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-fg/10 last:border-b-0">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="text-xs text-fg ws-tabular">{value}</span>
    </div>
  )
}

export function AiTile({ data, onNavigate, index }: { data: WorkspaceOverview['ai'] } & NavProps & { index: number }) {
  return (
    <Tile title="AI · Workflows" onClick={() => onNavigate('avancerat')} index={index} className="col-span-3 row-span-2">
      <div className="flex flex-col flex-1 min-h-0 gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-subtle">Leverantörer</div>
          {data.leverantorer.length === 0 ? (
            <span className="text-xs text-subtle">—</span>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {data.leverantorer.map((p) => (
                <div key={p.slug} className="flex items-center gap-1.5 min-w-0">
                  <StatusDot status={p.status} />
                  <span className="text-[11px] text-fg truncate">{p.namn}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto border-t border-fg/15 pt-1.5 flex flex-col">
          <AiRow label="Assistenter" value={data.assistenter_aktiva} />
          <AiRow label="Aktiva flöden" value={data.workflows_aktiva} />
          <AiRow label="Noder" value={data.noder_count} />
          <AiRow label="Kontext" value={data.kontext_count} />
        </div>
      </div>
    </Tile>
  )
}

