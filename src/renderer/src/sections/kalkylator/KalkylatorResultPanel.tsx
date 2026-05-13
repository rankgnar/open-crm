import { ArrowRight } from 'lucide-react'
import { useAppConfig } from '@/context/AppConfig'
import type { KalkylatorResult } from './types'

interface Props {
  result: KalkylatorResult
  onSkapa: () => void
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-xs ${accent ? 'text-fg font-medium' : 'text-muted'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${accent ? 'text-fg font-semibold' : 'text-fg'}`}>{value}</span>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-border" />
}

export function KalkylatorResultPanel({ result, onSkapa }: Props) {
  const { formatCurrency } = useAppConfig()
  const fmt = (n: number) => formatCurrency(n, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border shrink-0">
        <p className="text-[11px] uppercase tracking-widest text-muted">Kalkyl</p>
      </div>

      <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted">Nettoyta</span>
          <span className="text-sm tabular-nums text-fg font-medium">
            {result.netArea.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²
          </span>
        </div>

        <Divider />

        <Row label="Material" value={fmt(result.totalMaterialCost)} />
        <Row
          label={`Arbete (${result.laborHours.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h)`}
          value={fmt(result.laborCost)}
        />

        <Divider />

        <Row label="Netto" value={fmt(result.subtotal)} />
        <Row label="Moms 25%" value={fmt(result.moms)} />

        <Divider />

        <Row label="Total inkl. moms" value={fmt(result.totalInklMoms)} accent />
      </div>

      <div className="px-5 py-4 border-t border-border shrink-0">
        <button
          onClick={onSkapa}
          disabled={result.netArea === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-elevated border border-border text-sm font-medium text-fg hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Skapa Förslag <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
