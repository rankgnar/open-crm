import { useState, useEffect, useCallback } from 'react'
import { BarChart2, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import type { KassaflodeTab, BankTransaktion } from './types'
import type {
  FortnoxInvoiceSummary,
  FortnoxSupplierInvoiceSummary,
  FortnoxPayment,
  FortnoxSupplierPayment,
  FortnoxListResult,
} from '../fortnox/types'
import { OversigtTab } from './OversigtTab'
import { FordringarTab } from './FordringarTab'
import { BanktransaktionerTab } from './BanktransaktionerTab'

async function fetchAllPages<T>(channel: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const first = (await window.api.invoke(channel, { ...params, page: 1 })) as FortnoxListResult<T>
  const all = [...first.items]
  const pages = Math.min(first.meta.totalPages, 15)
  for (let p = 2; p <= pages; p++) {
    const r = (await window.api.invoke(channel, { ...params, page: p })) as FortnoxListResult<T>
    all.push(...r.items)
  }
  return all
}

const TABS: { id: KassaflodeTab; label: string }[] = [
  { id: 'oversikt', label: 'Översikt' },
  { id: 'fordringar', label: 'Fordringar' },
  { id: 'banktransaktioner', label: 'Banktransaktioner' },
]

export function KassaflodeSection() {
  const [tab, setTab] = useState<KassaflodeTab>('oversikt')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const [invoices, setInvoices] = useState<FortnoxInvoiceSummary[]>([])
  const [supplierInvoices, setSupplierInvoices] = useState<FortnoxSupplierInvoiceSummary[]>([])
  const [payments, setPayments] = useState<FortnoxPayment[]>([])
  const [supplierPayments, setSupplierPayments] = useState<FortnoxSupplierPayment[]>([])
  const [bankTransaktioner, setBankTransaktioner] = useState<BankTransaktion[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const status = (await window.api.invoke('fortnox:auth:status')) as { connected: boolean }
      setConnected(status.connected)
      if (!status.connected) return

      const [inv, supInv, pay, supPay, bank] = await Promise.all([
        fetchAllPages<FortnoxInvoiceSummary>('fortnox:invoices:list'),
        fetchAllPages<FortnoxSupplierInvoiceSummary>('fortnox:supplierinvoices:list'),
        fetchAllPages<FortnoxPayment>('fortnox:payments:list'),
        fetchAllPages<FortnoxSupplierPayment>('fortnox:supplier-payments:list'),
        window.api.invoke('db:bank-transaktioner:list') as Promise<BankTransaktion[]>,
      ])

      setInvoices(inv)
      setSupplierInvoices(supInv)
      setPayments(pay)
      setSupplierPayments(supPay)
      setBankTransaktioner(bank)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Okänt fel')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const refreshBank = useCallback(async () => {
    const bank = (await window.api.invoke('db:bank-transaktioner:list')) as BankTransaktion[]
    setBankTransaktioner(bank)
  }, [])

  if (!loading && !connected) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <AlertCircle size={32} className="text-muted" />
        <p className="text-sm text-muted">Fortnox är inte anslutet.</p>
        <p className="text-xs text-subtle">Gå till Fortnox-sektionen och anslut ditt konto.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-muted" />
          <span className="text-sm font-medium text-fg">Kassaflöde</span>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Laddar...' : 'Uppdatera'}
        </button>
      </div>

      <div className="flex border-b border-border bg-sidebar shrink-0 px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-2 px-4 text-sm transition-colors border-b-2 -mb-px ${
              tab === t.id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {error && (
          <div className="flex items-center gap-2 px-6 py-3 text-red-400 text-sm border-b border-border">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-muted text-sm">
            <Loader2 size={16} className="animate-spin" />
            Hämtar data från Fortnox...
          </div>
        ) : (
          <>
            {tab === 'oversikt' && (
              <OversigtTab
                invoices={invoices}
                supplierInvoices={supplierInvoices}
                payments={payments}
                supplierPayments={supplierPayments}
                bankTransaktioner={bankTransaktioner}
              />
            )}
            {tab === 'fordringar' && <FordringarTab invoices={invoices} />}
            {tab === 'banktransaktioner' && (
              <BanktransaktionerTab onImported={refreshBank} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
