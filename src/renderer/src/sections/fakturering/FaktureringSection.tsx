import { Fragment, useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronRight } from 'lucide-react'
import { FaktureringWizard } from './FaktureringWizard'
import type { FaktureringSnapshot } from './types'
import { useAppConfig } from '@/context/AppConfig'
import { useRefreshHandler } from '@/context/RefreshContext'
import { RefreshButton } from '@/components/RefreshButton'

type View = 'list' | 'create'

export function FaktureringSection() {
  const [view, setView] = useState<View>('list')
  const [snapshots, setSnapshots] = useState<FaktureringSnapshot[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { formatCurrency } = useAppConfig()

  const reload = useCallback(async () => {
    const data = await window.api.invoke('db:fakturering:list') as FaktureringSnapshot[]
    setSnapshots(data)
  }, [])

  useEffect(() => { void reload() }, [reload])
  useRefreshHandler(reload)

  async function handleDelete(id: string) {
    if (!confirm('Ta bort faktureringen?')) return
    const snap = snapshots.find((s) => s.id === id)
    await window.api.invoke('db:fakturering:delete', id)
    setSnapshots((prev) => prev.filter((s) => s.id !== id))
    if (expandedId === id) setExpandedId(null)
    if (snap?.projekt_id) {
      await window.api.invoke('db:projekt-aktivitet:create', {
        projekt_id: snap.projekt_id,
        handelse: 'faktura_status_andrad',
        text: `Faktureringsplan borttagen för ${snap.forslag_nummer}`,
      }).catch(() => {})
    }
  }

  async function handleCreated(snap: FaktureringSnapshot) {
    if (snap.projekt_id) {
      const total = `${Math.round(snap.att_betala_totalt).toLocaleString('sv-SE')} kr`
      await window.api.invoke('db:projekt-aktivitet:create', {
        projekt_id: snap.projekt_id,
        handelse: 'faktura_skapad',
        text: `Faktureringsplan skapad för ${snap.forslag_nummer}: ${snap.etapper.length} etapper, ${total}`,
      }).catch(() => {})
    }
    void reload()
    setView('list')
  }

  if (view === 'create') {
    return (
      <FaktureringWizard
        onCancel={() => setView('list')}
        onDone={handleCreated}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <h1 className="text-sm font-medium text-fg">Fakturering</h1>
        <div className="flex items-center gap-2">
          <RefreshButton iconOnly />
          <button
            onClick={() => setView('create')}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
          >
            <Plus size={12} />Ny fakturering
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted text-sm">
            <p>Inga faktureringar ännu</p>
            <p className="text-xs text-subtle mt-1">Skapa en plan från ett förslag</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-sidebar">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-muted font-medium w-8" />
                <th className="text-left px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium">Förslag</th>
                <th className="text-left px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium">Titel</th>
                <th className="text-right px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium w-20">Etapper</th>
                <th className="text-right px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium w-32">Netto</th>
                <th className="text-right px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium w-32">Att betala</th>
                <th className="text-left px-2 py-3 text-[10px] uppercase tracking-wider text-muted font-medium w-32">Skapad</th>
                <th className="px-6 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => {
                const expanded = expandedId === s.id
                return (
                  <Fragment key={s.id}>
                    <tr
                      className="border-b border-border hover:bg-hover cursor-pointer group"
                      onClick={() => setExpandedId(expanded ? null : s.id)}
                    >
                      <td className="px-6 py-2.5">
                        <ChevronRight size={14} className={`text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} />
                      </td>
                      <td className="px-2 py-2.5 font-mono text-fg">{s.forslag_nummer}</td>
                      <td className="px-2 py-2.5 text-fg">{s.forslag_titel}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-muted">{s.etapper.length}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-fg">{formatCurrency(s.total_netto)}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-fg font-semibold">{formatCurrency(s.att_betala_totalt)}</td>
                      <td className="px-2 py-2.5 text-muted">{s.skapad_at.slice(0, 10)}</td>
                      <td className="px-6 py-2.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); void handleDelete(s.id) }}
                          className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all"
                          title="Ta bort"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-elevated/40 border-b border-border">
                        <td />
                        <td colSpan={7} className="px-2 py-4">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted text-[10px] uppercase tracking-wider">
                                <th className="text-left pb-2 font-medium">#</th>
                                <th className="text-left pb-2 font-medium">Beskrivning</th>
                                <th className="text-left pb-2 font-medium w-32">Förfallodatum</th>
                                <th className="text-right pb-2 font-medium w-16">%</th>
                                <th className="text-right pb-2 font-medium w-28">Netto</th>
                                {s.rot_avdrag > 0 && <th className="text-right pb-2 font-medium w-28">ROT-avdrag</th>}
                                <th className="text-right pb-2 font-medium w-24">Moms</th>
                                <th className="text-right pb-2 font-medium w-28">Att betala</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.etapper.map((e, i) => (
                                <tr key={i} className="border-t border-border/40">
                                  <td className="py-1.5 text-muted">{i + 1}</td>
                                  <td className="py-1.5 text-fg">{e.beskrivning}</td>
                                  <td className="py-1.5 text-muted">{e.forfall_date ?? '—'}</td>
                                  <td className="py-1.5 text-right font-mono text-muted">{e.pct}%</td>
                                  <td className="py-1.5 text-right font-mono text-fg">{formatCurrency(e.netto)}</td>
                                  {s.rot_avdrag > 0 && (
                                    <td className="py-1.5 text-right font-mono text-emerald-400">−{formatCurrency(e.rot)}</td>
                                  )}
                                  <td className="py-1.5 text-right font-mono text-muted">{formatCurrency(e.moms)}</td>
                                  <td className="py-1.5 text-right font-mono text-fg font-semibold">{formatCurrency(e.att_betala)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
