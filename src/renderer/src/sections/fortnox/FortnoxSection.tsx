import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  RefreshCw, CheckCircle2, FileText, Truck, CreditCard,
  Users, Package, Building2, AlertCircle, Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  X, FileDown, Send
} from 'lucide-react'
import type {
  FortnoxTab, FortnoxInvoiceSummary, FortnoxSupplierInvoiceSummary, FortnoxSupplierInvoice,
  FortnoxCustomer, FortnoxSupplier, FortnoxPayment, FortnoxSupplierPayment,
  FortnoxArticle, FortnoxListResult, SortState, FortnoxInboxFile
} from './types'
import type { ProjektWithKund } from '../projekt/types'
import { useRefreshHandler } from '@/context/RefreshContext'
import { RefreshButton } from '@/components/RefreshButton'
import { SelectField } from '@/components/SelectField'

type UtfallKategori = 'arbete' | 'material' | 'ue' | 'övrigt'

const KATEGORI_OPTIONS: { value: UtfallKategori; label: string }[] = [
  { value: 'material', label: 'Material' },
  { value: 'ue',       label: 'Underentreprenör' },
  { value: 'arbete',   label: 'Arbete' },
  { value: 'övrigt',   label: 'Övrigt' },
]

// ── Shared helpers ────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return d.slice(0, 10)
}

function fmtAmount(n: number | null | undefined, currency = 'SEK'): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + currency
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Shared UI components ──────────────────────────────────────────────────────

function StatusBadge({ booked, cancelled, notCompleted, credit }: { booked?: boolean; cancelled?: boolean; notCompleted?: boolean; credit?: boolean }) {
  if (cancelled) return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-400/10 text-red-400">Makulerad</span>
  if (credit) return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-400/10 text-amber-400">Kreditnota</span>
  if (notCompleted) return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-400/10 text-blue-400">Utkast</span>
  if (booked) return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-400/10 text-emerald-400">Bokförd</span>
  return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-hover text-muted">Ej bokförd</span>
}

function SortTh({ field, label, sort, onSort, className = '', sortable = true }: {
  field: string; label: string; sort: SortState; onSort: (s: SortState) => void; className?: string; sortable?: boolean
}) {
  const active = sort.field === field

  if (!sortable) {
    return <th className={`py-2 text-[11px] uppercase tracking-wider text-muted font-normal ${className}`}>{label}</th>
  }

  function handleClick() {
    onSort({ field, order: active && sort.order === 'descending' ? 'ascending' : 'descending' })
  }

  return (
    <th
      onClick={handleClick}
      className={`py-2 text-[11px] uppercase tracking-wider font-normal select-none cursor-pointer transition-colors ${active ? 'text-fg' : 'text-muted hover:text-fg'} ${className}`}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? sort.order === 'descending' ? <ChevronDown size={11} /> : <ChevronUp size={11} />
          : <ChevronDown size={11} className="opacity-20" />}
      </span>
    </th>
  )
}

function Pagination({ meta, page, onPage }: {
  meta: { totalPages: number; currentPage: number; totalResources: number }
  page: number
  onPage: (p: number) => void
}) {
  if (meta.totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-6 py-2.5 border-t border-border shrink-0">
      <span className="text-xs text-muted">{meta.totalResources} poster</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="p-1 rounded text-muted hover:text-fg disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs text-muted px-2">Sida {page} av {meta.totalPages}</span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= meta.totalPages}
          className="p-1 rounded text-muted hover:text-fg disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 mx-6 mt-4 px-4 py-3 rounded-lg border border-red-400/30 text-red-400 text-sm bg-red-400/5">
      <AlertCircle size={14} className="shrink-0" /> {message}
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return <div className="flex items-center justify-center h-32 text-muted text-sm">{label}</div>
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center h-32 gap-2 text-muted text-sm">
      <Loader2 size={16} className="animate-spin" /> Laddar...
    </div>
  )
}

// ── Shared hook for paginated + sorted Fortnox lists ──────────────────────────

interface UseFortnoxListOptions {
  channel: string
  defaultSort: SortState
  extraParams?: Record<string, unknown>
}

function useFortnoxList<T>({ channel, defaultSort, extraParams }: UseFortnoxListOptions) {
  const [items, setItems] = useState<T[]>([])
  const [meta, setMeta] = useState({ totalPages: 1, currentPage: 1, totalResources: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPageState] = useState(1)
  const [sort, setSortState] = useState<SortState>(defaultSort)
  // Keep a ref to extra params to avoid stale closures
  const extraRef = useRef(extraParams)
  extraRef.current = extraParams

  const load = useCallback(async (p: number, s: SortState, extra?: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    try {
      const sortParams = s.field ? { sortby: s.field, sortorder: s.order } : {}
      const result = await window.api.invoke(channel, {
        page: p, ...sortParams, ...extra
      }) as FortnoxListResult<T>
      setItems(result.items)
      setMeta(result.meta)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Okänt fel')
    } finally {
      setLoading(false)
    }
  }, [channel])

  const setPage = useCallback((p: number) => {
    setPageState(p)
    load(p, sort, extraRef.current)
  }, [sort, load])

  const setSort = useCallback((s: SortState) => {
    setSortState(s)
    setPageState(1)
    load(1, s, extraRef.current)
  }, [load])

  const refresh = useCallback(() => {
    load(page, sort, extraRef.current)
  }, [page, sort, load])

  // Reload page 1 with new extra params — updates the ref in the same call,
  // avoiding the stale-ref issue when filter/search changes from outside.
  const reloadWith = useCallback((extra: Record<string, unknown>) => {
    extraRef.current = extra
    setPageState(1)
    load(1, sort, extra)
  }, [sort, load])

  useEffect(() => {
    load(1, defaultSort, extraParams)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { items, meta, loading, error, page, sort, setPage, setSort, refresh, reloadWith }
}

// ── Tab: Fakturor ─────────────────────────────────────────────────────────────

type InvoiceFilter = 'all' | 'unbooked' | 'unpaid' | 'overdue' | 'fullypaid' | 'cancelled'

// All confirmed against Fortnox API (code 2000587 = invalid filter)
const INVOICE_FILTER_API: Record<InvoiceFilter, string | undefined> = {
  'all':      undefined,
  'unbooked': 'unbooked',
  'unpaid':   'unpaid',
  'overdue':  'unpaidoverdue',
  'fullypaid':'fullypaid',
  'cancelled':'cancelled',
}

const INVOICE_FILTERS: { key: InvoiceFilter; label: string }[] = [
  { key: 'all',      label: 'Alla'               },
  { key: 'unbooked', label: 'Ej bokförda'        },
  { key: 'unpaid',   label: 'Obetalda'           },
  { key: 'overdue',  label: 'Obetalda förfallna' },
  { key: 'fullypaid',label: 'Slutbetalda'        },
  { key: 'cancelled',label: 'Makulerade'         },
]

function FakturorTab() {
  const [filter, setFilter] = useState<InvoiceFilter>('all')

  const { items, meta, loading, error, page, sort, setPage, setSort, refresh, reloadWith } = useFortnoxList<FortnoxInvoiceSummary>({
    channel: 'fortnox:invoices:list',
    defaultSort: { field: 'invoicedate', order: 'descending' },
  })

  function handleFilter(f: InvoiceFilter) {
    setFilter(f)
    const apiFilter = INVOICE_FILTER_API[f]
    reloadWith(apiFilter ? { filter: apiFilter } : {})
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-0.5 overflow-x-auto flex-nowrap">
          {INVOICE_FILTERS.map((f) => (
            <button key={f.key} onClick={() => handleFilter(f.key)}
              className={`shrink-0 px-2.5 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${filter === f.key ? 'bg-hover text-fg' : 'text-muted hover:text-fg'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={refresh} className="ml-auto shrink-0 text-muted hover:text-fg transition-colors"><RefreshCw size={14} /></button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && <LoadingRow />}
        {!loading && error && <ErrorBanner message={error} />}
        {!loading && !error && items.length === 0 && <Empty label="Inga fakturor hittades" />}
        {!loading && !error && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <SortTh field="documentnumber" label="Nr" sort={sort} onSort={setSort} className="px-6 text-left" />
                <SortTh field="customername" label="Kund" sort={sort} onSort={setSort} className="px-3 text-left" />
                <SortTh field="invoicedate" label="Datum" sort={sort} onSort={setSort} className="px-3 text-left" />
                <SortTh field="duedate" label="Förfallodatum" sort={sort} onSort={setSort} className="px-3 text-left" />
                <SortTh field="total" label="Totalt" sort={sort} onSort={setSort} className="px-3 text-right" />
                <SortTh field="balance" label="Saldo" sort={sort} onSort={setSort} className="px-3 text-right" sortable={false} />
                <th className="px-6 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((inv) => (
                <tr key={inv.DocumentNumber} className="border-b border-border hover:bg-hover transition-colors">
                  <td className="px-6 py-2.5 text-muted font-mono text-xs">{inv.DocumentNumber}</td>
                  <td className="px-3 py-2.5 text-fg">{inv.CustomerName}</td>
                  <td className="px-3 py-2.5 text-muted">{fmtDate(inv.InvoiceDate)}</td>
                  <td className={`px-3 py-2.5 ${inv.Balance > 0 && inv.DueDate && inv.DueDate < today() ? 'text-red-400' : 'text-muted'}`}>
                    {fmtDate(inv.DueDate)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-fg">{fmtAmount(inv.Total, inv.Currency)}</td>
                  <td className={`px-3 py-2.5 text-right ${inv.Balance > 0 ? 'text-amber-400' : 'text-muted'}`}>
                    {fmtAmount(inv.Balance, inv.Currency)}
                  </td>
                  <td className="px-6 py-2.5">
                    <StatusBadge booked={inv.Booked} cancelled={inv.Cancelled} notCompleted={inv.NotCompleted} credit={inv.Credit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={meta} page={page} onPage={setPage} />
    </div>
  )
}

// ── Supplier invoice detail panel ────────────────────────────────────────────

function scoreFile(file: FortnoxInboxFile, invoice: FortnoxSupplierInvoiceSummary): number {
  const name = file.Name.toLowerCase()
  if (invoice.InvoiceNumber && name.includes(invoice.InvoiceNumber.toLowerCase())) return 3
  if (name.includes(String(invoice.GivenNumber))) return 2
  const words = invoice.SupplierName.toLowerCase().split(/\s+/).filter(w => w.length >= 4)
  if (words.some(w => name.includes(w))) return 1
  return 0
}

type PdfState = 'idle' | 'opening' | 'opened' | 'no-file'

function SupplierInvoicePanel({ invoice, onClose }: {
  invoice: FortnoxSupplierInvoiceSummary
  onClose: () => void
}) {
  const [detail, setDetail] = useState<FortnoxSupplierInvoice | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [pdfState, setPdfState] = useState<PdfState>('idle')
  const [inboxFiles, setInboxFiles] = useState<FortnoxInboxFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [openingFile, setOpeningFile] = useState<string | null>(null)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [fileSearch, setFileSearch] = useState('')

  useEffect(() => {
    setDetail(null)
    setPdfState('idle')
    setInboxFiles([])
    setFilesError(null)
    setShowAll(false)
    setFileSearch('')

    setLoadingDetail(true)
    window.api.invoke('fortnox:supplierinvoices:get', invoice.GivenNumber)
      .then((d) => setDetail(d as FortnoxSupplierInvoice))
      .catch(() => {})
      .finally(() => setLoadingDetail(false))
  }, [invoice.GivenNumber])

  function loadInbox() {
    setLoadingFiles(true)
    window.api.invoke('fortnox:inbox:list', 'inbox_s')
      .then((files) => setInboxFiles(files as FortnoxInboxFile[]))
      .catch((e: Error) => setFilesError(e.message))
      .finally(() => setLoadingFiles(false))
  }

  async function handleOpenPdf() {
    setPdfState('opening')
    try {
      const result = await window.api.invoke('fortnox:supplierinvoices:open-pdf', invoice.GivenNumber)
      if (result) {
        setPdfState('opened')
      } else {
        setPdfState('no-file')
        loadInbox()
      }
    } catch {
      setPdfState('no-file')
      loadInbox()
    }
  }

  async function handleOpenFile(file: FortnoxInboxFile) {
    setOpeningFile(file.Id)
    try {
      await window.api.invoke('fortnox:inbox:open', file.Id, file.Name)
    } catch {
      // ignore — shell.openPath errors are non-critical
    } finally {
      setOpeningFile(null)
    }
  }

  const bestScore = inboxFiles.reduce((max, f) => Math.max(max, scoreFile(f, invoice)), 0)
  const matched = inboxFiles.filter(f => scoreFile(f, invoice) >= bestScore && bestScore > 0)
  const hasMatch = bestScore > 0

  return (
    <div className="flex flex-col h-full w-80 shrink-0 border-l border-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted">#{invoice.GivenNumber}</p>
          <p className="text-sm font-medium text-fg truncate">{invoice.SupplierName}</p>
        </div>
        <button onClick={onClose} className="ml-2 shrink-0 text-muted hover:text-fg transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Invoice metadata */}
        <div className="px-4 py-4 border-b border-border">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div>
              <p className="text-muted mb-0.5">Fakturanr</p>
              <p className="text-fg font-mono">{invoice.InvoiceNumber || '—'}</p>
            </div>
            <div>
              <p className="text-muted mb-0.5">Datum</p>
              <p className="text-fg">{fmtDate(invoice.InvoiceDate)}</p>
            </div>
            <div>
              <p className="text-muted mb-0.5">Förfallodatum</p>
              <p className={invoice.Balance > 0 && invoice.DueDate && invoice.DueDate < today() ? 'text-red-400' : 'text-fg'}>
                {fmtDate(invoice.DueDate)}
              </p>
            </div>
            <div>
              <p className="text-muted mb-0.5">Totalt</p>
              <p className="text-fg">{fmtAmount(invoice.Total, invoice.Currency)}</p>
            </div>
            <div>
              <p className="text-muted mb-0.5">Saldo</p>
              <p className={invoice.Balance > 0 ? 'text-amber-400' : 'text-fg'}>{fmtAmount(invoice.Balance, invoice.Currency)}</p>
            </div>
            <div>
              <p className="text-muted mb-0.5">Status</p>
              <StatusBadge booked={invoice.Booked} cancelled={invoice.Cancelled} credit={invoice.Credit} />
            </div>
          </div>
          {detail?.Comments && (
            <p className="mt-3 text-xs text-muted italic">{detail.Comments}</p>
          )}
        </div>

        {/* Invoice rows */}
        {loadingDetail && (
          <div className="flex items-center justify-center py-6 text-muted">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}
        {!loadingDetail && detail && detail.SupplierInvoiceRows.length > 0 && (
          <div className="px-4 py-4 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-3">Rader</p>
            <div className="space-y-2.5">
              {detail.SupplierInvoiceRows.map((row, i) => (
                <div key={i} className="flex justify-between items-start gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="text-muted font-mono mr-1.5">{row.Account}</span>
                    <span className="text-fg">{row.Description || '—'}</span>
                  </div>
                  <span className="text-fg shrink-0">{fmtAmount(row.Total, invoice.Currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PDF / Bifogad fil */}
        <div className="px-4 py-4">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-3">Bifogad fil</p>

          {pdfState === 'idle' && (
            <button
              onClick={handleOpenPdf}
              className="flex items-center gap-2 text-xs text-fg hover:opacity-70 transition-opacity"
            >
              <FileDown size={14} /> Öppna PDF
            </button>
          )}

          {pdfState === 'opening' && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Loader2 size={12} className="animate-spin" /> Hämtar PDF...
            </div>
          )}

          {pdfState === 'opened' && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 size={12} /> PDF öppnad
            </div>
          )}

          {pdfState === 'no-file' && (() => {
            if (loadingFiles) return (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 size={12} className="animate-spin" /> Hämtar inkorg...
              </div>
            )
            if (filesError) return <p className="text-xs text-red-400">Kunde inte hämta inkorg.</p>

            const q = fileSearch.trim().toLowerCase()
            const visible = q ? inboxFiles.filter(f => f.Name.toLowerCase().includes(q)) : inboxFiles

            if (hasMatch && !showAll) {
              return (
                <>
                  {matched.map(file => (
                    <div key={file.Id} className="flex items-center justify-between gap-2 py-1">
                      <span className="text-xs text-fg truncate min-w-0" title={file.Name}>{file.Name}</span>
                      <button
                        onClick={() => handleOpenFile(file)}
                        disabled={openingFile === file.Id}
                        title="Öppna fil"
                        className="shrink-0 text-muted hover:text-fg transition-colors disabled:opacity-40"
                      >
                        {openingFile === file.Id ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setShowAll(true)} className="mt-2 text-[11px] text-muted hover:text-fg transition-colors">
                    Visa alla filer ({inboxFiles.length})
                  </button>
                </>
              )
            }

            return (
              <>
                {inboxFiles.length === 0 && <p className="text-xs text-muted">Inga filer i inkorg.</p>}
                {inboxFiles.length > 0 && (
                  <>
                    <input
                      type="text"
                      value={fileSearch}
                      onChange={e => setFileSearch(e.target.value)}
                      placeholder="Filtrera filer..."
                      className="w-full mb-2 px-2.5 py-1.5 text-xs bg-elevated border border-border rounded text-fg placeholder:text-muted outline-none focus:border-fg/30"
                    />
                    {visible.length === 0 && <p className="text-xs text-muted">Inga filer matchar.</p>}
                    {visible.map(file => (
                      <div key={file.Id} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="text-xs text-fg truncate min-w-0" title={file.Name}>{file.Name}</span>
                        <button
                          onClick={() => handleOpenFile(file)}
                          disabled={openingFile === file.Id}
                          title="Öppna fil"
                          className="shrink-0 text-muted hover:text-fg transition-colors disabled:opacity-40"
                        >
                          {openingFile === file.Id ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                        </button>
                      </div>
                    ))}
                    <p className="mt-2 text-[11px] text-muted">{visible.length} av {inboxFiles.length} filer</p>
                  </>
                )}
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ── Skicka till projekt modal ────────────────────────────────────────────────

function SkickaTillProjektModal({
  invoices, onClose, onDone,
}: {
  invoices: FortnoxSupplierInvoiceSummary[]
  onClose: () => void
  onDone: (result: { inserted: number; skipped: number }) => void
}) {
  const [projekt, setProjekt] = useState<ProjektWithKund[]>([])
  const [projektId, setProjektId] = useState<string>('')
  const [kategori, setKategori] = useState<UtfallKategori>('material')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.invoke('db:projekt:list')
      .then((data) => {
        setProjekt(data as ProjektWithKund[])
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const totalNetto = invoices.reduce((sum, inv) => sum + (inv.Total ?? 0) - (inv.VAT ?? 0), 0)

  async function handleSubmit() {
    if (!projektId) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await window.api.invoke('db:ekonomi-utfall:create-from-fortnox', {
        projekt_id: projektId,
        kategori,
        invoices: invoices.map((inv) => ({
          GivenNumber: inv.GivenNumber,
          SupplierName: inv.SupplierName,
          InvoiceNumber: inv.InvoiceNumber || null,
          InvoiceDate: inv.InvoiceDate,
          Total: inv.Total,
          VAT: inv.VAT,
        })),
      }) as { inserted: number; skipped: number }
      onDone(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Okänt fel')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-bg border border-border rounded-lg w-[480px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-sm font-medium text-fg">Skicka till projekt</p>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Antal</p>
            <p className="text-sm text-fg">{invoices.length} {invoices.length === 1 ? 'faktura' : 'fakturor'} · netto {fmtAmount(totalNetto)}</p>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted block mb-2">Projekt</label>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted py-2">
                <Loader2 size={12} className="animate-spin" /> Hämtar projekt...
              </div>
            ) : (
              <SelectField
                value={projektId}
                onChange={setProjektId}
                placeholder="Välj projekt..."
                searchable
                options={projekt.map((p) => ({ value: p.id, label: `${p.projekt_nummer} — ${p.namn} (${p.kunder.namn})` }))}
              />
            )}
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted block mb-2">Kategori</label>
            <SelectField
              value={kategori}
              onChange={(v) => setKategori(v as UtfallKategori)}
              className="w-48"
              options={KATEGORI_OPTIONS.map((k) => ({ value: k.value, label: k.label }))}
            />
          </div>

          <p className="text-[11px] text-muted">
            Belopp = Total − Moms. Redan importerade fakturor hoppas över.
          </p>

          {error && <ErrorBanner message={error} />}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-xs text-muted hover:text-fg transition-colors disabled:opacity-40"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={!projektId || submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-fg border border-border rounded hover:bg-hover transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Skicka
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Leverantörsfakturor ──────────────────────────────────────────────────

type SupplierInvoiceFilter = 'all' | 'unbooked' | 'unpaid' | 'overdue' | 'fullypaid' | 'cancelled'

const SUPPLIER_FILTER_API: Record<SupplierInvoiceFilter, string | undefined> = {
  'all':      undefined,
  'unbooked': 'unbooked',
  'unpaid':   'unpaid',
  'overdue':  'unpaidoverdue',
  'fullypaid':'fullypaid',
  'cancelled':'cancelled',
}

const SUPPLIER_FILTERS: { key: SupplierInvoiceFilter; label: string }[] = [
  { key: 'all',      label: 'Alla'               },
  { key: 'unbooked', label: 'Ej bokförda'        },
  { key: 'unpaid',   label: 'Obetalda'           },
  { key: 'overdue',  label: 'Obetalda förfallna' },
  { key: 'fullypaid',label: 'Slutbetalda'        },
  { key: 'cancelled',label: 'Makulerade'         },
]

function LevFakturorTab() {
  const [filter, setFilter] = useState<SupplierInvoiceFilter>('all')
  const [localSort, setLocalSort] = useState<SortState>({ field: 'invoicedate', order: 'descending' })
  const [selected, setSelected] = useState<FortnoxSupplierInvoiceSummary | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [imported, setImported] = useState<Set<number>>(new Set())
  const [showSendModal, setShowSendModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const { items, meta, loading, error, page, setPage, setSort, refresh, reloadWith } = useFortnoxList<FortnoxSupplierInvoiceSummary>({
    channel: 'fortnox:supplierinvoices:list',
    defaultSort: { field: 'invoicedate', order: 'descending' },
  })

  const loadImported = useCallback(() => {
    window.api.invoke('db:ekonomi-utfall:list-fortnox-givennumbers')
      .then((nums) => setImported(new Set(nums as number[])))
      .catch(() => {})
  }, [])

  useEffect(() => { loadImported() }, [loadImported])

  function handleSort(s: SortState) {
    setLocalSort(s)
    if (s.field !== 'givennumber') setSort(s)
  }

  function handleFilter(f: SupplierInvoiceFilter) {
    setFilter(f)
    const apiFilter = SUPPLIER_FILTER_API[f]
    reloadWith(apiFilter ? { filter: apiFilter } : {})
  }

  function toggleOne(gn: number) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(gn)) next.delete(gn); else next.add(gn)
      return next
    })
  }

  const displayItems = localSort.field === 'givennumber'
    ? [...items].sort((a, b) => (a.GivenNumber - b.GivenNumber) * (localSort.order === 'ascending' ? 1 : -1))
    : items

  const selectableOnPage = useMemo(
    () => displayItems.filter((inv) => !imported.has(inv.GivenNumber)),
    [displayItems, imported],
  )
  const allSelected = selectableOnPage.length > 0 && selectableOnPage.every((inv) => checked.has(inv.GivenNumber))

  function toggleAll() {
    setChecked((prev) => {
      if (allSelected) {
        const next = new Set(prev)
        for (const inv of selectableOnPage) next.delete(inv.GivenNumber)
        return next
      }
      const next = new Set(prev)
      for (const inv of selectableOnPage) next.add(inv.GivenNumber)
      return next
    })
  }

  const checkedInvoices = useMemo(
    () => items.filter((inv) => checked.has(inv.GivenNumber)),
    [items, checked],
  )

  function handleSent(result: { inserted: number; skipped: number }) {
    setShowSendModal(false)
    setChecked(new Set())
    loadImported()
    const msg = result.skipped > 0
      ? `${result.inserted} skickade · ${result.skipped} hoppades över (redan importerade)`
      : `${result.inserted} ${result.inserted === 1 ? 'faktura skickad' : 'fakturor skickade'} till projekt`
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-0.5 overflow-x-auto flex-nowrap">
          {SUPPLIER_FILTERS.map((f) => (
            <button key={f.key} onClick={() => handleFilter(f.key)}
              className={`shrink-0 px-2.5 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${filter === f.key ? 'bg-hover text-fg' : 'text-muted hover:text-fg'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={refresh} className="ml-auto shrink-0 text-muted hover:text-fg transition-colors"><RefreshCw size={14} /></button>
      </div>

      {checked.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg">{checked.size} {checked.size === 1 ? 'vald' : 'valda'}</span>
          <button
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-fg border border-border rounded hover:bg-hover transition-colors"
          >
            <Send size={12} /> Skicka till projekt
          </button>
          <button
            onClick={() => setChecked(new Set())}
            className="ml-auto text-xs text-muted hover:text-fg transition-colors"
          >
            Avmarkera alla
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-auto">
            {loading && <LoadingRow />}
            {!loading && error && <ErrorBanner message={error} />}
            {!loading && !error && items.length === 0 && <Empty label="Inga leverantörsfakturor hittades" />}
            {!loading && !error && items.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pl-6 pr-2 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        disabled={selectableOnPage.length === 0}
                        className="cursor-pointer disabled:cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                    <SortTh field="givennumber" label="Nr" sort={localSort} onSort={handleSort} className="px-2 text-left" />
                    <SortTh field="suppliername" label="Leverantör" sort={localSort} onSort={handleSort} className="px-3 text-left" />
                    <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Fakturanr</th>
                    <SortTh field="invoicedate" label="Datum" sort={localSort} onSort={handleSort} className="px-3 text-left" />
                    <SortTh field="duedate" label="Förfallodatum" sort={localSort} onSort={handleSort} className="px-3 text-left" sortable={false} />
                    <SortTh field="total" label="Totalt" sort={localSort} onSort={handleSort} className="px-3 text-right" sortable={false} />
                    <SortTh field="balance" label="Saldo" sort={localSort} onSort={handleSort} className="px-3 text-right" sortable={false} />
                    <th className="px-6 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((inv) => {
                    const isImported = imported.has(inv.GivenNumber)
                    const isChecked = checked.has(inv.GivenNumber)
                    return (
                      <tr
                        key={inv.GivenNumber}
                        onClick={() => setSelected(selected?.GivenNumber === inv.GivenNumber ? null : inv)}
                        className={`border-b border-border cursor-pointer transition-colors ${selected?.GivenNumber === inv.GivenNumber ? 'bg-hover' : 'hover:bg-hover'}`}
                      >
                        <td className="pl-6 pr-2 py-2.5 w-8">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isImported}
                            onChange={() => toggleOne(inv.GivenNumber)}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer disabled:cursor-default"
                            title={isImported ? 'Redan importerad' : ''}
                          />
                        </td>
                        <td className="px-2 py-2.5 text-muted font-mono text-xs">{inv.GivenNumber}</td>
                        <td className="px-3 py-2.5 text-fg">
                          <div className="flex items-center gap-2">
                            <span>{inv.SupplierName}</span>
                            {isImported && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-400/10 text-emerald-400">
                                Importerad
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted font-mono text-xs">{inv.InvoiceNumber || '—'}</td>
                        <td className="px-3 py-2.5 text-muted">{fmtDate(inv.InvoiceDate)}</td>
                        <td className={`px-3 py-2.5 ${inv.Balance > 0 && inv.DueDate && inv.DueDate < today() ? 'text-red-400' : 'text-muted'}`}>
                          {fmtDate(inv.DueDate)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-fg">{fmtAmount(inv.Total, inv.Currency)}</td>
                        <td className={`px-3 py-2.5 text-right ${inv.Balance > 0 ? 'text-amber-400' : 'text-muted'}`}>
                          {fmtAmount(inv.Balance, inv.Currency)}
                        </td>
                        <td className="px-6 py-2.5">
                          <StatusBadge booked={inv.Booked} cancelled={inv.Cancelled} credit={inv.Credit} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          <Pagination meta={meta} page={page} onPage={setPage} />
        </div>

        {selected && (
          <SupplierInvoicePanel invoice={selected} onClose={() => setSelected(null)} />
        )}
      </div>

      {toast && (
        <div className="absolute bottom-4 right-4 px-3 py-2 rounded-md bg-elevated border border-border text-xs text-fg shadow-lg">
          {toast}
        </div>
      )}

      {showSendModal && (
        <SkickaTillProjektModal
          invoices={checkedInvoices}
          onClose={() => setShowSendModal(false)}
          onDone={handleSent}
        />
      )}
    </div>
  )
}

// ── Tab: Betalningar ──────────────────────────────────────────────────────────

type PaymentView = 'fakturor' | 'leverantorer'

function BetalningarTab() {
  const [view, setView] = useState<PaymentView>('fakturor')

  const invPayments = useFortnoxList<FortnoxPayment>({
    channel: 'fortnox:payments:list',
    defaultSort: { field: 'paymentdate', order: 'descending' },
  })

  const supPayments = useFortnoxList<FortnoxSupplierPayment>({
    channel: 'fortnox:supplier-payments:list',
    defaultSort: { field: '', order: 'descending' },
  })

  const active = view === 'fakturor' ? invPayments : supPayments

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => setView('fakturor')} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${view === 'fakturor' ? 'bg-hover text-fg' : 'text-muted hover:text-fg'}`}>Fakturor</button>
          <button onClick={() => setView('leverantorer')} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${view === 'leverantorer' ? 'bg-hover text-fg' : 'text-muted hover:text-fg'}`}>Leverantörer</button>
        </div>
        <button onClick={active.refresh} className="ml-auto text-muted hover:text-fg transition-colors"><RefreshCw size={14} /></button>
      </div>

      <div className="flex-1 overflow-auto">
        {active.loading && <LoadingRow />}
        {!active.loading && active.error && <ErrorBanner message={active.error} />}
        {!active.loading && !active.error && active.items.length === 0 && <Empty label="Inga betalningar hittades" />}

        {!active.loading && !active.error && active.items.length > 0 && view === 'fakturor' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <SortTh field="number" label="Nr" sort={invPayments.sort} onSort={invPayments.setSort} className="px-6 text-left" sortable={false} />
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Kund</th>
                <SortTh field="invoicenumber" label="Faktura" sort={invPayments.sort} onSort={invPayments.setSort} className="px-3 text-left" />
                <SortTh field="paymentdate" label="Datum" sort={invPayments.sort} onSort={invPayments.setSort} className="px-3 text-left" />
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Sätt</th>
                <SortTh field="amount" label="Belopp" sort={invPayments.sort} onSort={invPayments.setSort} className="px-6 text-right" />
              </tr>
            </thead>
            <tbody>
              {(invPayments.items as FortnoxPayment[]).map((p) => (
                <tr key={p.Number} className="border-b border-border hover:bg-hover transition-colors">
                  <td className="px-6 py-2.5 text-muted font-mono text-xs">{p.Number}</td>
                  <td className="px-3 py-2.5 text-fg">{p.InvoiceCustomerName}</td>
                  <td className="px-3 py-2.5 text-muted font-mono text-xs">{p.InvoiceNumber}</td>
                  <td className="px-3 py-2.5 text-muted">{fmtDate(p.PaymentDate)}</td>
                  <td className="px-3 py-2.5 text-muted">{p.ModeOfPayment || '—'}</td>
                  <td className="px-6 py-2.5 text-right text-fg">{fmtAmount(p.Amount, p.Currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!active.loading && !active.error && active.items.length > 0 && view === 'leverantorer' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Nr</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Leverantör</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Faktura</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Datum</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Sätt</th>
                <th className="px-6 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-right">Belopp</th>
              </tr>
            </thead>
            <tbody>
              {(supPayments.items as FortnoxSupplierPayment[]).map((p) => (
                <tr key={p.Number} className="border-b border-border hover:bg-hover transition-colors">
                  <td className="px-6 py-2.5 text-muted font-mono text-xs">{p.Number}</td>
                  <td className="px-3 py-2.5 text-fg">{p.InvoiceSupplierName}</td>
                  <td className="px-3 py-2.5 text-muted font-mono text-xs">{p.InvoiceNumber}</td>
                  <td className="px-3 py-2.5 text-muted">{fmtDate(p.PaymentDate)}</td>
                  <td className="px-3 py-2.5 text-muted">{p.ModeOfPayment || '—'}</td>
                  <td className="px-6 py-2.5 text-right text-fg">{fmtAmount(p.Amount, p.Currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={active.meta} page={active.page} onPage={active.setPage} />
    </div>
  )
}

// ── Tab: Kunder ───────────────────────────────────────────────────────────────

function KunderTab() {
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  const { items, meta, loading, error, page, sort, setPage, setSort, refresh } = useFortnoxList<FortnoxCustomer>({
    channel: 'fortnox:customers:list',
    defaultSort: { field: 'name', order: 'ascending' },
    extraParams: appliedSearch ? { search: appliedSearch } : {},
  })

  function handleSearch() {
    setAppliedSearch(search)
    refresh()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <input className="input text-sm w-56" placeholder="Sök namn..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }} />
        <button onClick={handleSearch} className="text-xs text-muted hover:text-fg px-2 py-1 rounded border border-border transition-colors">Sök</button>
        <button onClick={refresh} className="ml-auto text-muted hover:text-fg transition-colors"><RefreshCw size={14} /></button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && <LoadingRow />}
        {!loading && error && <ErrorBanner message={error} />}
        {!loading && !error && items.length === 0 && <Empty label="Inga kunder hittades" />}
        {!loading && !error && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <SortTh field="customernumber" label="Nr" sort={sort} onSort={setSort} className="px-6 text-left" />
                <SortTh field="name" label="Namn" sort={sort} onSort={setSort} className="px-3 text-left" />
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Org.nr</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Stad</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">E-post</th>
                <th className="px-6 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Typ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.CustomerNumber} className="border-b border-border hover:bg-hover transition-colors">
                  <td className="px-6 py-2.5 text-muted font-mono text-xs">{c.CustomerNumber}</td>
                  <td className="px-3 py-2.5 text-fg">{c.Name}</td>
                  <td className="px-3 py-2.5 text-muted font-mono text-xs">{c.OrganisationNumber || '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{c.City || '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{c.Email || '—'}</td>
                  <td className="px-6 py-2.5 text-muted text-xs">{c.Type === 'PRIVATE' ? 'Privat' : 'Företag'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={meta} page={page} onPage={setPage} />
    </div>
  )
}

// ── Tab: Leverantörer ─────────────────────────────────────────────────────────

function LeverantörerTab() {
  const { items, meta, loading, error, page, sort, setPage, setSort, refresh } = useFortnoxList<FortnoxSupplier>({
    channel: 'fortnox:suppliers:list',
    defaultSort: { field: 'name', order: 'ascending' },
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-6 py-3 border-b border-border shrink-0">
        <button onClick={refresh} className="ml-auto text-muted hover:text-fg transition-colors"><RefreshCw size={14} /></button>
      </div>
      <div className="flex-1 overflow-auto">
        {loading && <LoadingRow />}
        {!loading && error && <ErrorBanner message={error} />}
        {!loading && !error && items.length === 0 && <Empty label="Inga leverantörer hittades" />}
        {!loading && !error && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <SortTh field="suppliernumber" label="Nr" sort={sort} onSort={setSort} className="px-6 text-left" />
                <SortTh field="name" label="Namn" sort={sort} onSort={setSort} className="px-3 text-left" />
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Org.nr</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Stad</th>
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">E-post</th>
                <th className="px-6 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Telefon</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.SupplierNumber} className="border-b border-border hover:bg-hover transition-colors">
                  <td className="px-6 py-2.5 text-muted font-mono text-xs">{s.SupplierNumber}</td>
                  <td className="px-3 py-2.5 text-fg">{s.Name}</td>
                  <td className="px-3 py-2.5 text-muted font-mono text-xs">{s.OrganisationNumber || '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{s.City || '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{s.Email || '—'}</td>
                  <td className="px-6 py-2.5 text-muted">{s.Phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={meta} page={page} onPage={setPage} />
    </div>
  )
}

// ── Tab: Artiklar ─────────────────────────────────────────────────────────────

function ArtiklerTab() {
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [localSort, setLocalSort] = useState<SortState>({ field: 'description', order: 'ascending' })

  const { items, meta, loading, error, page, setPage, refresh, reloadWith } = useFortnoxList<FortnoxArticle>({
    channel: 'fortnox:articles:list',
    defaultSort: { field: '', order: 'ascending' },
    extraParams: appliedSearch ? { search: appliedSearch } : {},
  })

  function handleSort(s: SortState) {
    setLocalSort(s)
  }

  function handleSearch() {
    const q = search
    setAppliedSearch(q)
    reloadWith(q ? { search: q } : {})
  }

  const displayItems = [...items].sort((a, b) => {
    const dir = localSort.order === 'ascending' ? 1 : -1
    switch (localSort.field) {
      case 'articlenumber':  return a.ArticleNumber.localeCompare(b.ArticleNumber, 'sv') * dir
      case 'purchaseprice':  return ((a.PurchasePrice ?? 0) - (b.PurchasePrice ?? 0)) * dir
      case 'salesprice':     return ((a.SalesPrice ?? 0) - (b.SalesPrice ?? 0)) * dir
      default:               return (a.Description ?? '').localeCompare(b.Description ?? '', 'sv') * dir
    }
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <input className="input text-sm w-56" placeholder="Sök beskrivning..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }} />
        <button onClick={handleSearch} className="text-xs text-muted hover:text-fg px-2 py-1 rounded border border-border transition-colors">Sök</button>
        <button onClick={refresh} className="ml-auto text-muted hover:text-fg transition-colors"><RefreshCw size={14} /></button>
      </div>
      <div className="flex-1 overflow-auto">
        {loading && <LoadingRow />}
        {!loading && error && <ErrorBanner message={error} />}
        {!loading && !error && items.length === 0 && <Empty label="Inga artiklar hittades" />}
        {!loading && !error && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <SortTh field="articlenumber" label="Art.nr" sort={localSort} onSort={handleSort} className="px-6 text-left" />
                <SortTh field="description" label="Beskrivning" sort={localSort} onSort={handleSort} className="px-3 text-left" />
                <th className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-left">Typ</th>
                <SortTh field="purchaseprice" label="Inköpspris" sort={localSort} onSort={handleSort} className="px-3 text-right" />
                <SortTh field="salesprice" label="Försäljningspris" sort={localSort} onSort={handleSort} className="px-3 text-right" />
                <th className="px-6 py-2 text-[11px] uppercase tracking-wider text-muted font-normal text-right">Moms %</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((a) => (
                <tr key={a.ArticleNumber} className="border-b border-border hover:bg-hover transition-colors">
                  <td className="px-6 py-2.5 text-muted font-mono text-xs">{a.ArticleNumber}</td>
                  <td className="px-3 py-2.5 text-fg">{a.Description}</td>
                  <td className="px-3 py-2.5 text-muted text-xs">{a.Type === 'SERVICE' ? 'Tjänst' : 'Lager'}</td>
                  <td className="px-3 py-2.5 text-right text-muted">{a.PurchasePrice != null ? fmtAmount(a.PurchasePrice) : '—'}</td>
                  <td className="px-3 py-2.5 text-right text-fg">{a.SalesPrice != null ? fmtAmount(a.SalesPrice) : '—'}</td>
                  <td className="px-6 py-2.5 text-right text-muted">{a.VAT} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination meta={meta} page={page} onPage={setPage} />
    </div>
  )
}

// ── Not connected ─────────────────────────────────────────────────────────────

function NotConnected() {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-4">
      <div className="flex items-center justify-center size-14 rounded-2xl bg-elevated border border-border">
        <Building2 size={24} className="text-muted" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-fg">Fortnox ej ansluten</p>
        <p className="text-xs text-muted mt-1">Gå till Inställningar → Fortnox för att ansluta.</p>
      </div>
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────────────────────

const TABS: { id: FortnoxTab; label: string; icon: React.ElementType }[] = [
  { id: 'fakturor',      label: 'Fakturor',       icon: FileText   },
  { id: 'lev-fakturor',  label: 'Lev.fakturor',   icon: Truck      },
  { id: 'betalningar',   label: 'Betalningar',    icon: CreditCard },
  { id: 'kunder',        label: 'Kunder',         icon: Users      },
  { id: 'leverantorer',  label: 'Leverantörer',   icon: Package    },
  { id: 'artiklar',      label: 'Artiklar',       icon: ChevronRight },
]

const TAB_COMPONENTS: Record<FortnoxTab, React.ReactElement> = {
  'fakturor':     <FakturorTab />,
  'lev-fakturor': <LevFakturorTab />,
  'betalningar':  <BetalningarTab />,
  'kunder':       <KunderTab />,
  'leverantorer': <LeverantörerTab />,
  'artiklar':     <ArtiklerTab />,
}

export function FortnoxSection() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<FortnoxTab>('fakturor')
  // Lazy mount: once visited, stay mounted (data persists on tab switch)
  const [mountedTabs, setMountedTabs] = useState<Set<FortnoxTab>>(new Set<FortnoxTab>(['fakturor']))

  const checkStatus = useCallback(async () => {
    try {
      const status = await window.api.invoke('fortnox:auth:status') as { connected: boolean }
      setConnected(status.connected)
    } catch {
      setConnected(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
    window.api.on('fortnox:auth:success', checkStatus)
    return () => window.api.off('fortnox:auth:success', checkStatus)
  }, [checkStatus])
  useRefreshHandler(checkStatus)

  function handleTabChange(tab: FortnoxTab) {
    setActiveTab(tab)
    setMountedTabs((prev) => new Set([...prev, tab]))
  }

  if (connected === null) {
    return <div className="flex h-full items-center justify-center"><Loader2 size={20} className="animate-spin text-muted" /></div>
  }

  if (!connected) return <NotConnected />

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-muted" />
          <span className="text-sm font-medium text-fg">Fortnox</span>
          <span className="flex items-center gap-1 text-xs text-emerald-400 ml-2">
            <CheckCircle2 size={12} /> Ansluten
          </span>
        </div>
        <RefreshButton iconOnly />
      </div>

      <div className="flex items-center gap-1 px-6 border-b border-border bg-sidebar shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 transition-colors ${activeTab === tab.id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg'}`}>
              <Icon size={13} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-hidden relative">
        {TABS.map((tab) =>
          mountedTabs.has(tab.id) ? (
            <div key={tab.id} className={`absolute inset-0 flex flex-col ${activeTab === tab.id ? '' : 'hidden'}`}>
              {TAB_COMPONENTS[tab.id]}
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}
