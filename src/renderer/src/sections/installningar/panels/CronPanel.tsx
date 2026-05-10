import { useEffect, useState } from 'react'
import { Play, Loader2, Pencil, Check, X } from 'lucide-react'
import { Toggle } from '@/components/Toggle'
import type { CronJob } from '../types'

const CRON_RE = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/

export function CronPanel() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [laddar, setLaddar] = useState(true)
  const [korFel, setKorFel] = useState<string | null>(null)
  const [korandeId, setKorandeId] = useState<string | null>(null)

  useEffect(() => { void hamta() }, [])

  async function hamta() {
    setLaddar(true)
    try {
      const data = await window.api.invoke('db:cron:list') as CronJob[]
      setJobs(data ?? [])
    } finally {
      setLaddar(false)
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    setKorFel(null)
    try {
      const next = await window.api.invoke('db:cron:toggle', id, enabled) as CronJob
      setJobs(prev => prev.map(j => j.id === id ? next : j))
    } catch (e) {
      setKorFel(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleSchedule(id: string, schedule: string) {
    setKorFel(null)
    try {
      const next = await window.api.invoke('db:cron:update-schedule', id, schedule) as CronJob
      setJobs(prev => prev.map(j => j.id === id ? next : j))
    } catch (e) {
      setKorFel(e instanceof Error ? e.message : String(e))
      throw e
    }
  }

  async function handleRunNow(id: string) {
    setKorFel(null)
    setKorandeId(id)
    try {
      const next = await window.api.invoke('db:cron:run-now', id) as CronJob
      setJobs(prev => prev.map(j => j.id === id ? next : j))
    } catch (e) {
      setKorFel(e instanceof Error ? e.message : String(e))
    } finally {
      setKorandeId(null)
    }
  }

  if (laddar) {
    return (
      <div className="flex items-center justify-center py-12 text-muted text-sm">
        <Loader2 size={14} className="animate-spin mr-2" /> Laddar…
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {korFel && (
        <div className="px-8 py-3 border-b border-border bg-red-400/5 text-sm text-red-400">
          {korFel}
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="px-8 py-8 text-sm text-muted">
          Inga schemalagda jobb registrerade.
        </div>
      ) : (
        jobs.map(job => (
          <CronJobRow
            key={job.id}
            job={job}
            korande={korandeId === job.id}
            onToggle={handleToggle}
            onSchedule={handleSchedule}
            onRunNow={handleRunNow}
          />
        ))
      )}
    </div>
  )
}

function CronJobRow({
  job, korande, onToggle, onSchedule, onRunNow,
}: {
  job: CronJob
  korande: boolean
  onToggle: (id: string, enabled: boolean) => Promise<void>
  onSchedule: (id: string, schedule: string) => Promise<void>
  onRunNow: (id: string) => Promise<void>
}) {
  const [editar, setEditar] = useState(false)
  const [scheduleInput, setScheduleInput] = useState(job.schedule)
  const [sparar, setSparar] = useState(false)

  const valid = CRON_RE.test(scheduleInput.trim())

  async function spar() {
    setSparar(true)
    try {
      await onSchedule(job.id, scheduleInput.trim())
      setEditar(false)
    } catch {
      // error handled upstream
    } finally {
      setSparar(false)
    }
  }

  function avbryt() {
    setScheduleInput(job.schedule)
    setEditar(false)
  }

  return (
    <div className="px-8 py-5 border-b border-border">
      <div className="flex items-start justify-between gap-6 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-fg">{job.label}</h3>
          {job.description && (
            <p className="text-xs text-muted mt-1 leading-relaxed">{job.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => void onRunNow(job.id)}
            disabled={korande}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted hover:text-fg hover:bg-hover disabled:opacity-40 transition-colors"
            title="Kör nu"
          >
            {korande ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Kör nu
          </button>

          <Toggle
            checked={job.enabled}
            onChange={(next) => void onToggle(job.id, next)}
            title={job.enabled ? 'Aktiverat' : 'Avaktiverat'}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted mb-1">Schema</p>
          {editar ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={scheduleInput}
                onChange={e => setScheduleInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && valid) void spar()
                  else if (e.key === 'Escape') avbryt()
                }}
                placeholder="m h dom mon dow"
                className={`flex-1 bg-elevated border rounded px-2 py-1 text-xs font-mono outline-none ${valid ? 'border-border focus:border-fg/30 text-fg' : 'border-red-400/40 text-red-400'}`}
                autoFocus
              />
              <button
                onClick={() => void spar()}
                disabled={!valid || sparar}
                className="p-1 rounded text-emerald-400 hover:bg-hover disabled:opacity-40"
                title="Spara"
              >
                <Check size={12} />
              </button>
              <button
                onClick={avbryt}
                className="p-1 rounded text-muted hover:text-fg hover:bg-hover"
                title="Avbryt"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditar(true)}
              className="flex items-center gap-2 text-fg font-mono hover:bg-hover rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 group"
            >
              <span>{job.schedule}</span>
              <Pencil size={11} className="text-muted opacity-0 group-hover:opacity-100" />
            </button>
          )}
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted mb-1">Senast körd</p>
          <p className="text-fg">{formatLastRun(job.last_run_at)}</p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted mb-1">Resultat</p>
          {job.last_status ? (
            <p className={`truncate ${job.last_status === 'ok' ? 'text-emerald-400' : 'text-red-400'}`} title={job.last_result ?? ''}>
              {job.last_status === 'ok' ? job.last_result ?? 'ok' : job.last_result ?? 'fel'}
            </p>
          ) : (
            <p className="text-subtle">—</p>
          )}
        </div>
      </div>
    </div>
  )
}

function formatLastRun(iso: string | null): string {
  if (!iso) return 'Aldrig körd'
  const d = new Date(iso)
  return d.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}
