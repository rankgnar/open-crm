import type {
  FortnoxInvoiceSummary,
  FortnoxSupplierInvoiceSummary,
  FortnoxPayment,
  FortnoxSupplierPayment,
} from '../fortnox/types'
import type { BankTransaktion, MonthRow } from './types'

interface Props {
  invoices: FortnoxInvoiceSummary[]
  supplierInvoices: FortnoxSupplierInvoiceSummary[]
  payments: FortnoxPayment[]
  supplierPayments: FortnoxSupplierPayment[]
  bankTransaktioner: BankTransaktion[]
}

function getLastNMonths(n: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
}

function fmtSEK(n: number): string {
  return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function aggregateByMonth(
  months: string[],
  invoices: FortnoxInvoiceSummary[],
  supplierInvoices: FortnoxSupplierInvoiceSummary[],
  payments: FortnoxPayment[],
  supplierPayments: FortnoxSupplierPayment[],
  bankTransaktioner: BankTransaktion[]
): MonthRow[] {
  return months.map((month) => {
    const fakturerat = invoices
      .filter((i) => i.InvoiceDate?.slice(0, 7) === month && !i.Cancelled && !i.Credit)
      .reduce((s, i) => s + (i.Total ?? 0), 0)

    const inkasserat = payments
      .filter((p) => p.PaymentDate?.slice(0, 7) === month)
      .reduce((s, p) => s + (p.Amount ?? 0), 0)

    const levKostnader = supplierInvoices
      .filter((si) => si.InvoiceDate?.slice(0, 7) === month && !si.Cancelled && !si.Credit)
      .reduce((s, si) => s + (si.Total ?? 0), 0)

    const betalttillLev = supplierPayments
      .filter((sp) => sp.PaymentDate?.slice(0, 7) === month)
      .reduce((s, sp) => s + (sp.Amount ?? 0), 0)

    const bankNetto = bankTransaktioner
      .filter((b) => b.datum?.slice(0, 7) === month)
      .reduce((s, b) => s + (b.belopp ?? 0), 0)

    const netto = inkasserat - betalttillLev

    return { month, fakturerat, inkasserat, levKostnader, betalttillLev, bankNetto, netto }
  })
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 border-r border-border last:border-r-0">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${color ?? 'text-fg'}`}>{value}</p>
    </div>
  )
}

export function OversigtTab({ invoices, supplierInvoices, payments, supplierPayments, bankTransaktioner }: Props) {
  const months = getLastNMonths(12)
  const rows = aggregateByMonth(months, invoices, supplierInvoices, payments, supplierPayments, bankTransaktioner)

  const totals: MonthRow = rows.reduce(
    (acc, r) => ({
      month: 'total',
      fakturerat: acc.fakturerat + r.fakturerat,
      inkasserat: acc.inkasserat + r.inkasserat,
      levKostnader: acc.levKostnader + r.levKostnader,
      betalttillLev: acc.betalttillLev + r.betalttillLev,
      bankNetto: acc.bankNetto + r.bankNetto,
      netto: acc.netto + r.netto,
    }),
    { month: 'total', fakturerat: 0, inkasserat: 0, levKostnader: 0, betalttillLev: 0, bankNetto: 0, netto: 0 }
  )

  const totalOutstanding = invoices
    .filter((i) => (i.Balance ?? 0) > 0 && !i.Cancelled && !i.Credit)
    .reduce((s, i) => s + (i.Balance ?? 0), 0)

  return (
    <div className="flex flex-col">
      {/* Summary cards */}
      <div className="flex border-b border-border">
        <SummaryCard label="Utestående (kundfordringar)" value={`${fmtSEK(totalOutstanding)} kr`} color="text-amber-400" />
        <SummaryCard label="Fakturerat (12 mån)" value={`${fmtSEK(totals.fakturerat)} kr`} />
        <SummaryCard label="Inkasserat (12 mån)" value={`${fmtSEK(totals.inkasserat)} kr`} color="text-emerald-400" />
        <SummaryCard label="Lev. kostnader (12 mån)" value={`${fmtSEK(totals.levKostnader)} kr`} />
        <SummaryCard
          label="Fortnox netto (12 mån)"
          value={`${fmtSEK(totals.netto)} kr`}
          color={totals.netto >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      {/* Monthly table */}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-6 text-[11px] uppercase tracking-wider text-muted font-normal">Månad</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted font-normal">Fakturerat</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted font-normal">Inkasserat</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted font-normal">Lev. fakturor</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted font-normal">Betalt t. lev.</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted font-normal">Bank (netto)</th>
              <th className="text-right py-3 px-6 text-[11px] uppercase tracking-wider text-muted font-normal">Fortnox netto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-border hover:bg-hover transition-colors">
                <td className="py-2.5 px-6 text-fg">{monthLabel(r.month)}</td>
                <td className="py-2.5 px-4 text-right tabular-nums text-fg">
                  {r.fakturerat ? fmtSEK(r.fakturerat) : <span className="text-subtle">—</span>}
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums text-fg">
                  {r.inkasserat ? fmtSEK(r.inkasserat) : <span className="text-subtle">—</span>}
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums text-fg">
                  {r.levKostnader ? fmtSEK(r.levKostnader) : <span className="text-subtle">—</span>}
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums text-fg">
                  {r.betalttillLev ? fmtSEK(r.betalttillLev) : <span className="text-subtle">—</span>}
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums">
                  {r.bankNetto !== 0 ? (
                    <span className={r.bankNetto >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {r.bankNetto > 0 ? '+' : ''}{fmtSEK(r.bankNetto)}
                    </span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </td>
                <td className="py-2.5 px-6 text-right tabular-nums font-medium">
                  {r.inkasserat || r.betalttillLev ? (
                    <span className={r.netto >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {r.netto > 0 ? '+' : ''}{fmtSEK(r.netto)}
                    </span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-sidebar">
              <td className="py-2.5 px-6 text-[11px] uppercase tracking-wider text-muted font-medium">Totalt</td>
              <td className="py-2.5 px-4 text-right tabular-nums font-medium text-fg">{fmtSEK(totals.fakturerat)}</td>
              <td className="py-2.5 px-4 text-right tabular-nums font-medium text-fg">{fmtSEK(totals.inkasserat)}</td>
              <td className="py-2.5 px-4 text-right tabular-nums font-medium text-fg">{fmtSEK(totals.levKostnader)}</td>
              <td className="py-2.5 px-4 text-right tabular-nums font-medium text-fg">{fmtSEK(totals.betalttillLev)}</td>
              <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                <span className={totals.bankNetto >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {totals.bankNetto > 0 ? '+' : ''}{fmtSEK(totals.bankNetto)}
                </span>
              </td>
              <td className="py-2.5 px-6 text-right tabular-nums font-bold">
                <span className={totals.netto >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {totals.netto > 0 ? '+' : ''}{fmtSEK(totals.netto)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
