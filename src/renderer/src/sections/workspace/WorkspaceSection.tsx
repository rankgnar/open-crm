import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { WorkspaceOverview, WorkspaceTarget } from './types'
import { useRefreshHandler } from '@/context/RefreshContext'
import {
  KunderTile, ProjektPipelineTile, ForslagTile, OrderTile, AtaTile,
  TidplanTile, KostnaderTile, SigneraTile, EpostTile, KalenderTile,
  PersonalTile, FaktureringTile, AiTile,
} from './tiles'

interface Props {
  onNavigate: (target: WorkspaceTarget) => void
}

export function WorkspaceSection({ onNavigate }: Props) {
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ov = await window.api.invoke('db:workspace:overview') as WorkspaceOverview
      setOverview(ov)
      setNow(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda workspace')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useRefreshHandler(load)

  const datum = now.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const klocka = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">Workspace</div>
          <div className="text-sm text-fg first-letter:uppercase">{datum} <span className="text-muted font-mono ml-2">{klocka}</span></div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted hover:text-fg hover:bg-hover rounded transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Uppdatera
        </button>
      </div>

      {error && (
        <div className="px-6 py-2 text-xs text-red-400 bg-red-400/5 border-b border-border">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-px bg-fg/15">
        {!overview && !error ? (
          <div className="h-full flex items-center justify-center text-subtle text-xs">
            Laddar översikt…
          </div>
        ) : overview ? (
          <div className="grid grid-cols-12 grid-rows-5 gap-px h-full min-h-[600px]">
            {/* Row 1-2 — heroes */}
            <KunderTile data={overview.kunder} onNavigate={onNavigate} index={0} />
            <ProjektPipelineTile data={overview.projekt} onNavigate={onNavigate} index={1} />
            <AiTile data={overview.ai} onNavigate={onNavigate} index={2} />

            {/* Row 3 — pipeline */}
            <ForslagTile data={overview.forslag} onNavigate={onNavigate} index={3} />
            <OrderTile data={overview.ordrar} onNavigate={onNavigate} index={4} />
            <AtaTile data={overview.ata} onNavigate={onNavigate} index={5} />
            {/* Row 4 — current period */}
            <TidplanTile data={overview.tidplan} onNavigate={onNavigate} index={7} />
            <KostnaderTile data={overview.kostnader} onNavigate={onNavigate} index={8} />

            {/* Row 5 — comms & people */}
            <PersonalTile data={overview.personal} onNavigate={onNavigate} index={10} />
            <SigneraTile data={overview.signatur} onNavigate={onNavigate} index={11} />
            <EpostTile data={overview.epost} onNavigate={onNavigate} index={12} />
            <KalenderTile data={overview.kalender} onNavigate={onNavigate} index={13} />
            <FaktureringTile data={overview.fakturering} onNavigate={onNavigate} index={14} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
