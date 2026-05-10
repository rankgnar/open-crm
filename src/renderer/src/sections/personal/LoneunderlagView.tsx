import { useState, useEffect, useCallback } from 'react'
import { Printer, Trash2 } from 'lucide-react'
import type { TidrapportGlobal, PersonalLonepost, LonepostTyp } from './types'
import { LONEPOST_TYPER } from './types'

interface PersonalItem {
  id: string; namn: string; personal_nummer: string
  timlön: number | null; manadslön: number | null; loneform: string | null
}

function currentMånad() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` }
function formatKr(n: number) { return n.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kr' }

function effectiveTimlön(p: PersonalItem): number {
  if (p.timlön) return p.timlön
  if (p.loneform === 'MAN' && p.manadslön) return Math.round(p.manadslön / 173)
  return 0
}

interface EmployeeRow {
  personal: PersonalItem
  tidrapporter: TidrapportGlobal[]
  loneposter: (PersonalLonepost & { personal?: unknown })[]
  timmar: number
  bruttolön: number
  poster: number
  total: number
}

const LONEPOST_SIGN: Record<LonepostTyp, 1 | -1> = {
  tillägg: 1, traktamente: 1, utlägg: 1, avdrag: -1, förskott: -1,
}

export function LoneunderlagView() {
  const [manad, setManad] = useState(currentMånad())
  const [rows, setRows] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedPoster, setSelectedPoster] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [personal, tidrapporter, loneposter] = await Promise.all([
        window.api.invoke('db:personal:list') as Promise<PersonalItem[]>,
        window.api.invoke('db:personal-tidrapport:list-all', { status: 'godkänd', manad }) as Promise<TidrapportGlobal[]>,
        window.api.invoke('db:personal-loneposter:list-all', manad) as Promise<(PersonalLonepost & { personal?: unknown })[]>,
      ])

      const employeeRows: EmployeeRow[] = personal.map((p) => {
        const tids = tidrapporter.filter((t) => t.personal_id === p.id)
        const posts = loneposter.filter((l) => l.personal_id === p.id)
        const timlön = effectiveTimlön(p)
        const timmar = tids.reduce((s, t) => s + t.timmar, 0)
        const bruttolön = timmar * timlön
        const poster = posts.reduce((s, l) => s + l.belopp * LONEPOST_SIGN[l.typ as LonepostTyp], 0)
        return { personal: p, tidrapporter: tids, loneposter: posts, timmar, bruttolön, poster, total: bruttolön + poster }
      }).filter((r) => r.timmar > 0 || r.loneposter.length > 0)

      setRows(employeeRows)
    } finally {
      setLoading(false)
    }
  }, [manad])

  useEffect(() => { load() }, [load])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function togglePost(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setSelectedPoster((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmBulk(false)
  }

  async function handleBulkDeletePoster() {
    setDeletingBulk(true)
    try {
      await window.api.invoke('db:personal-loneposter:delete-many', [...selectedPoster])
      setSelectedPoster(new Set())
      setConfirmBulk(false)
      await load()
    } finally {
      setDeletingBulk(false)
    }
  }

  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <p className="text-[11px] uppercase tracking-widest text-muted">Löneunderlag</p>
        <div className="flex items-center gap-2 ml-auto">
          <input type="month" className="input text-xs h-7" value={manad} onChange={(e) => setManad(e.target.value)} />
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-elevated border border-border text-muted hover:text-fg hover:bg-hover transition-colors"
          >
            <Printer size={12} />
            Skriv ut
          </button>
        </div>
      </div>

      {selectedPoster.size > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-elevated shrink-0">
          <span className="text-xs text-fg font-medium shrink-0">{selectedPoster.size} löneposter valda</span>
          {confirmBulk ? (
            <>
              <span className="text-xs text-muted">Radera {selectedPoster.size} poster?</span>
              <button onClick={handleBulkDeletePoster} disabled={deletingBulk} className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-40 transition-colors">
                {deletingBulk ? '...' : 'Ja, radera'}
              </button>
              <button onClick={() => setConfirmBulk(false)} className="text-xs text-muted hover:text-fg transition-colors">Avbryt</button>
            </>
          ) : (
            <button onClick={() => setConfirmBulk(true)} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
              <Trash2 size={12} /> Radera markerade
            </button>
          )}
          <button onClick={() => { setSelectedPoster(new Set()); setConfirmBulk(false) }} className="ml-auto text-xs text-muted hover:text-fg transition-colors">
            Avmarkera alla
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <p className="text-xs text-subtle text-center py-10">Laddar...</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-subtle text-center py-10">Inga godkända timmar eller löneposter för {manad}</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const isOpen = expanded.has(r.personal.id)
              const timlön = effectiveTimlön(r.personal)
              return (
                <div key={r.personal.id} className="border border-border rounded-lg overflow-hidden">
                  {/* Summary row */}
                  <button
                    onClick={() => toggleExpand(r.personal.id)}
                    className="w-full flex items-center gap-4 px-5 py-3 hover:bg-hover transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-fg">{r.personal.namn}</span>
                      <span className="text-xs text-subtle ml-2">{r.personal.personal_nummer}</span>
                    </div>
                    <div className="flex items-center gap-8 text-right">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-subtle">Timmar</p>
                        <p className="text-sm text-fg">{r.timmar.toFixed(1)} h</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-subtle">Lönekostnad</p>
                        <p className="text-sm text-fg">{formatKr(r.bruttolön)}</p>
                      </div>
                      {r.poster !== 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-subtle">Tillägg/Avdrag</p>
                          <p className={`text-sm ${r.poster >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {r.poster >= 0 ? '+' : ''}{formatKr(r.poster)}
                          </p>
                        </div>
                      )}
                      <div className="w-32">
                        <p className="text-[10px] uppercase tracking-wider text-subtle">Totalt att betala</p>
                        <p className="text-base font-semibold text-fg">{formatKr(r.total)}</p>
                      </div>
                    </div>
                    <span className={`text-subtle ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>

                  {/* Detail */}
                  {isOpen && (
                    <div className="border-t border-border bg-elevated px-5 py-3 space-y-3">
                      {r.timmar > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-subtle mb-2">Tidrapporter</p>
                          <div className="space-y-1">
                            {r.tidrapporter.map((t) => (
                              <div key={t.id} className="flex items-center gap-4 text-xs text-muted">
                                <span className="font-mono w-24 shrink-0">{new Date(t.datum).toLocaleDateString('sv-SE')}</span>
                                <span className="w-16 shrink-0">{t.timmar.toFixed(1)} h</span>
                                <span className="text-subtle">{t.projekt ? `${t.projekt.projekt_nummer} ${t.projekt.namn}` : 'Inget projekt'}</span>
                                <span className="ml-auto text-fg">{timlön > 0 ? formatKr(t.timmar * timlön) : '—'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {r.loneposter.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-subtle mb-2">Löneposter</p>
                          <div className="space-y-1">
                            {r.loneposter.map((l) => {
                              const sign = LONEPOST_SIGN[l.typ as LonepostTyp]
                              const typLabel = LONEPOST_TYPER.find((t) => t.value === l.typ)?.label ?? l.typ
                              const isSel = selectedPoster.has(l.id)
                              return (
                                <div key={l.id} className={`flex items-center gap-4 text-xs text-muted px-1 py-0.5 rounded ${isSel ? 'bg-hover' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={isSel}
                                    onChange={() => {}}
                                    onClick={(e) => togglePost(e, l.id)}
                                    className="rounded border-border accent-emerald-400 cursor-pointer shrink-0"
                                  />
                                  <span className="font-mono w-24 shrink-0">{new Date(l.datum).toLocaleDateString('sv-SE')}</span>
                                  <span className="w-24 shrink-0">{typLabel}</span>
                                  <span className="text-subtle flex-1 truncate">{l.beskrivning || '—'}</span>
                                  <span className={sign === 1 ? 'text-emerald-400' : 'text-red-400'}>
                                    {sign === 1 ? '+' : '−'}{formatKr(l.belopp)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      <div className="border-t border-border pt-2 flex justify-end">
                        <span className="text-sm font-semibold text-fg">Totalt: {formatKr(r.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Grand total */}
            <div className="border-t border-border pt-4 flex justify-end">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-subtle">Totalt att betala — {manad}</p>
                <p className="text-xl font-semibold text-fg">{formatKr(grandTotal)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
