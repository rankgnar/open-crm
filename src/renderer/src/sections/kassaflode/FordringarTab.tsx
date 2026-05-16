import type { FortnoxInvoiceSummary } from '../fortnox/types'

interface Props {
  invoices: FortnoxInvoiceSummary[]
}

function daysOverdue(dueDate: string | null | undefined): number {
  if (!dueDate) return 0
  const due = new Date(dueDate)
  const now = new Date()
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

function fmtSEK(n: number): string {
  return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return d.slice(0, 10)
}

function UrgencyBadge({ days }: { days: number }) {
  if (days > 30) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-400/10 text-red-400">
        {days} dagar sen
      </span>
    )
  }
  if (days > 0) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-400/10 text-amber-400">
        {days} dagar sen
      </span>
    )
  }
  if (days === 0) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-400/10 text-amber-400">
        Förfaller idag
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-hover text-muted">
      {Math.abs(days)} dagar kvar
    </span>
  )
}

export function FordringarTab({ invoices }: Props) {
  const unpaid = invoices
    .filter((i) => (i.Balance ?? 0) > 0 && !i.Cancelled && !i.Credit)
    .map((i) => ({ ...i, days: daysOverdue(i.DueDate) }))
    .sort((a, b) => b.days - a.days)

  const totalOutstanding = unpaid.reduce((s, i) => s + (i.Balance ?? 0), 0)

  if (!unpaid.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <p className="text-sm text-muted">Inga obetalda fakturor.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <p className="text-[11px] uppercase tracking-wider text-muted">{unpaid.length} obetald{unpaid.length !== 1 ? 'a' : ''} faktura{unpaid.length !== 1 ? 'r' : ''}</p>
        <p className="text-sm font-semibold text-amber-400 tabular-nums">
          Utestående: {fmtSEK(totalOutstanding)} kr
        </p>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-6 text-[11px] uppercase tracking-wider text-muted font-normal">Kund</th>
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted font-normal">Faktura nr</th>
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted font-normal">Datum</th>
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted font-normal">Förfallodatum</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted font-normal">Total</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted font-normal">Utestående</th>
              <th className="text-left py-3 px-6 text-[11px] uppercase tracking-wider text-muted font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {unpaid.map((inv) => (
              <tr key={inv.DocumentNumber} className="border-b border-border hover:bg-hover transition-colors">
                <td className="py-2.5 px-6 text-fg">{inv.CustomerName || '—'}</td>
                <td className="py-2.5 px-4 text-muted font-mono text-xs">{inv.DocumentNumber}</td>
                <td className="py-2.5 px-4 text-muted">{fmtDate(inv.InvoiceDate)}</td>
                <td className="py-2.5 px-4 text-muted">{fmtDate(inv.DueDate)}</td>
                <td className="py-2.5 px-4 text-right tabular-nums text-fg">{fmtSEK(inv.Total ?? 0)}</td>
                <td className="py-2.5 px-4 text-right tabular-nums font-medium text-amber-400">{fmtSEK(inv.Balance ?? 0)}</td>
                <td className="py-2.5 px-6">
                  <UrgencyBadge days={inv.days} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
