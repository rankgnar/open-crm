import { useState, useMemo } from 'react'
import { X, Wand2, Loader2 } from 'lucide-react'
import type { ForslagFas, ForslagSubfas, ForslagArbete } from '@/sections/forslag/types'
import { useAppConfig } from '@/context/AppConfig'

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addWorkingDays(start: Date, n: number, daysPerWeek: number): Date {
  const d = new Date(start)
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    const isWork = (dow >= 1 && dow <= 5) || (daysPerWeek >= 6 && dow === 6) || (daysPerWeek === 7 && dow === 0)
    if (isWork) added++
  }
  return d
}

interface Props {
  faser: ForslagFas[]
  subfaserByFas: Record<string, ForslagSubfas[]>
  arbetenBySubfas: Record<string, ForslagArbete[]>
  onConfirm: (updates: Array<{ id: string; start_datum: string; slut_datum: string }>) => Promise<void>
  onClose: () => void
}

export function PlanerautomatisktModal({ faser, subfaserByFas, arbetenBySubfas, onConfirm, onClose }: Props) {
  const { config } = useAppConfig()
  const [startDate, setStartDate] = useState(toISO(new Date()))
  const [inkluderaHelger, setInkluderaHelger] = useState(false)
  const [buffert, setBuffert] = useState<0 | 1 | 2>(0)
  const [saving, setSaving] = useState(false)

  const preview = useMemo(() => {
    if (!startDate) return []
    const timmarPerDag = config?.timmar_per_dag ?? 8
    const daysPerWeek = inkluderaHelger ? 7 : (config?.arbetsdagar_per_vecka ?? 5)
    let cursor = new Date(startDate + 'T12:00:00')
    return faser.map(fas => {
      const subfaser = subfaserByFas[fas.id] ?? []
      const hours = subfaser.reduce((sum, sub) => {
        return sum + (arbetenBySubfas[sub.id] ?? []).reduce((s, a) => s + (a.antal_timmar ?? 0), 0)
      }, 0)
      const workDays = hours > 0 ? Math.max(1, Math.ceil(hours / timmarPerDag)) : 1
      const start_datum = toISO(cursor)
      const slut_datum = workDays === 1 ? start_datum : toISO(addWorkingDays(new Date(cursor), workDays - 1, daysPerWeek))
      cursor = addWorkingDays(new Date(slut_datum + 'T12:00:00'), 1 + buffert, daysPerWeek)
      return { fas, hours, workDays, start_datum, slut_datum }
    })
  }, [faser, subfaserByFas, arbetenBySubfas, startDate, inkluderaHelger, buffert, config])

  async function handleConfirm() {
    setSaving(true)
    try {
      await onConfirm(preview.map(p => ({ id: p.fas.id, start_datum: p.start_datum, slut_datum: p.slut_datum })))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-elevated border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <Wand2 size={15} className="text-emerald-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-fg">Planera automatiskt</p>
            <p className="text-[11px] text-muted mt-0.5">Fördelar faserna sekventiellt baserat på timmar</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors p-1">
            <X size={14} />
          </button>
        </div>

        {/* Inputs */}
        <div className="px-5 py-4 flex flex-col gap-4 border-b border-border">

          {/* Startdatum */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase tracking-widest text-muted">Startdatum</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input text-xs font-mono"
              style={{ width: 148 }}
            />
          </div>

          {/* Inkludera helger */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase tracking-widest text-muted">Inkludera helger</label>
            <button
              onClick={() => setInkluderaHelger(v => !v)}
              className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                inkluderaHelger
                  ? 'border-emerald-400/50 text-emerald-400 bg-emerald-400/10'
                  : 'border-border text-muted hover:text-fg hover:bg-hover'
              }`}
            >
              {inkluderaHelger ? 'Ja — 7 dagar/vecka' : 'Nej — mån–fre'}
            </button>
          </div>

          {/* Buffert */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase tracking-widest text-muted">Buffert mellan faser</label>
            <div className="flex gap-1">
              {([0, 1, 2] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setBuffert(v)}
                  className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                    buffert === v
                      ? 'border-emerald-400/50 text-emerald-400 bg-emerald-400/10'
                      : 'border-border text-muted hover:text-fg hover:bg-hover'
                  }`}
                >
                  {v === 0 ? 'Ingen' : `${v}d`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview table */}
        <div className="flex-1 overflow-auto" style={{ maxHeight: 220 }}>
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-elevated border-b border-border">
              <tr>
                <th className="text-left px-5 py-2 text-muted font-medium uppercase tracking-widest text-[10px]">Fas</th>
                <th className="text-right px-3 py-2 text-muted font-medium uppercase tracking-widest text-[10px] w-16">Timmar</th>
                <th className="text-right px-3 py-2 text-muted font-medium uppercase tracking-widest text-[10px] w-28">Start</th>
                <th className="text-right px-5 py-2 text-muted font-medium uppercase tracking-widest text-[10px] w-28">Slut</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((p, i) => (
                <tr key={p.fas.id} className={i % 2 === 0 ? 'bg-bg/40' : ''}>
                  <td className="px-5 py-1.5 text-fg truncate max-w-[180px]">{p.fas.namn}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-muted">
                    {p.hours > 0 ? `${p.hours}h` : <span className="text-amber-400">1d</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-fg">{p.start_datum}</td>
                  <td className="px-5 py-1.5 text-right font-mono text-fg">{p.slut_datum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-xs border border-border text-muted hover:text-fg hover:bg-hover transition-colors disabled:opacity-40"
          >
            Avbryt
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={saving || preview.length === 0 || !startDate}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
            {saving ? 'Sparar…' : 'Planera'}
          </button>
        </div>
      </div>
    </div>
  )
}
