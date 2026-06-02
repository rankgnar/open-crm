import type { ForslagArbete, ForslagMaterial, ForslagUnderentreprenor } from './types'
import { useAppConfig } from '@/context/AppConfig'
import { aggregateForslag, computeForslagTotals } from '@/utils/forslag-totals'

interface Props {
  arbete: ForslagArbete[]
  material: ForslagMaterial[]
  underentreprenorer: ForslagUnderentreprenor[]
  rotAvdrag: boolean
  rotProcent: number
  rotInkluderaMedsokande: boolean
  momsProcent: number
  onMedsokandeToggle?: (next: boolean) => Promise<void> | void
  onApplyRot?: () => Promise<void> | void
}

function Row({ label, value, highlight, sub }: { label: string; value: string; highlight?: boolean; sub?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${highlight ? 'text-fg font-semibold' : ''}`}>
      <span className={highlight ? 'text-sm' : sub ? 'text-[11px] text-subtle pl-2' : 'text-xs text-muted'}>{label}</span>
      <span className={highlight ? 'text-sm font-mono' : 'text-xs font-mono text-muted'}>{value}</span>
    </div>
  )
}

export function ForslagKostnadsPanel({
  arbete, material, underentreprenorer,
  rotAvdrag, rotProcent, rotInkluderaMedsokande, momsProcent,
  onMedsokandeToggle, onApplyRot,
}: Props) {
  const { config, formatCurrency } = useAppConfig()
  const fmt = (n: number) => formatCurrency(n, 0)
  const ROT_CAP_SINGLE = config?.rot_avdrag_tak_enkel ?? 50000
  const ROT_CAP_DOUBLE = config?.rot_avdrag_tak_dubbel ?? 100000
  const totals = computeForslagTotals({
    ...aggregateForslag(arbete, material, underentreprenorer),
    momsProcent, rotAvdrag, rotProcent, rotInkluderaMedsokande,
    rotCapEnkel: ROT_CAP_SINGLE, rotCapDubbel: ROT_CAP_DOUBLE,
  })
  const { totalArbete, totalMaterial, totalUE, subtotal, moms, totalInklMoms, rotBelopp: rotAvdragBelopp, totalAttBetala: totalt } = totals
  const rotCap = rotInkluderaMedsokande ? ROT_CAP_DOUBLE : ROT_CAP_SINGLE

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Kostnadssummering</p>
      </div>

      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-muted">Arbetskostnad</span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-subtle font-mono">{arbete.reduce((s, r) => s + r.antal_timmar, 0)} h</span>
            <span className="text-xs font-mono text-muted">{fmt(totalArbete)}</span>
          </div>
        </div>
        <Row label="Materialkostnad" value={fmt(totalMaterial)} />
        {totalUE > 0 && (
          <>
            <Row label="Underentreprenörer" value={fmt(totalUE)} />
            {underentreprenorer.map((ue) => (
              <Row
                key={ue.id}
                label={`${ue.namn || '—'}${ue.inkl_material ? ' (inkl. mat.)' : ''}`}
                value={fmt(ue.kostnad)}
                sub
              />
            ))}
          </>
        )}
        <div className="border-t border-border my-2" />
        <Row label="Subtotal" value={fmt(subtotal)} />
        {rotAvdrag && (
          <div className="flex items-center justify-between py-1">
            <label className={`flex items-center gap-1.5 text-[11px] ${onMedsokandeToggle ? 'cursor-pointer text-muted hover:text-fg' : 'text-subtle'}`}>
              <input
                type="checkbox"
                checked={rotInkluderaMedsokande}
                disabled={!onMedsokandeToggle}
                onChange={(e) => onMedsokandeToggle?.(e.target.checked)}
                className="w-3 h-3 accent-emerald-400"
              />
              <span>Två sökande</span>
            </label>
            <span className="text-[10px] font-mono text-subtle">tak {fmt(rotCap)}</span>
          </div>
        )}
        <Row label={`Moms ${momsProcent}%`} value={`+ ${fmt(moms)}`} />
        <Row label="Total inkl. moms" value={fmt(totalInklMoms)} />
        {rotAvdrag && rotAvdragBelopp > 0 && (
          <Row label={`ROT-avdrag ${rotProcent}% (av arbete inkl. moms)`} value={`− ${fmt(rotAvdragBelopp)}`} />
        )}
        {onApplyRot && (
          <div className="flex justify-end pt-1 pb-1">
            <button
              onClick={() => void onApplyRot()}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors underline-offset-2 hover:underline"
            >
              Tillämpa ROT på alla rader
            </button>
          </div>
        )}
        <div className="border-t border-border my-2" />
        <Row label="ATT BETALA" value={fmt(totalt)} highlight />
      </div>

      <div className="flex-1" />
    </div>
  )
}
