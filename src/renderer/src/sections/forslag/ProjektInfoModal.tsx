import { useEffect, useState } from 'react'
import { X, MapPin, Calendar, Banknote, User } from 'lucide-react'
import type { ProjektWithKund, ProjektStatusar } from '@/sections/projekt/types'
import { FARG_DOT, FARG_TEXT } from '@/sections/projekt/types'

interface Props {
  projektId: string
  onClose: () => void
}

export function ProjektInfoModal({ projektId, onClose }: Props) {
  const [projekt, setProjekt] = useState<ProjektWithKund | null>(null)
  const [statusar, setStatusar] = useState<ProjektStatusar[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const [p, st] = await Promise.all([
        window.api.invoke('db:projekt:get', projektId) as Promise<ProjektWithKund>,
        window.api.invoke('db:projekt-statusar:list') as Promise<ProjektStatusar[]>,
      ])
      setProjekt(p)
      setStatusar(st)
      setLoading(false)
    })()
  }, [projektId])

  const statusDef = statusar.find((s) => s.namn === projekt?.status)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-elevated border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-sidebar shrink-0">
          <div className="flex items-center gap-2">
            {projekt && (
              <span className="font-mono text-xs text-muted">{projekt.projekt_nummer}</span>
            )}
            <span className="text-sm font-medium text-fg">
              {loading ? 'Laddar…' : projekt?.namn ?? '—'}
            </span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="px-5 py-8 text-center text-muted text-sm">Laddar projektinfo…</div>
        ) : projekt ? (
          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Status + kund */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Status</p>
                {statusDef ? (
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${FARG_DOT[statusDef.farg]}`} />
                    <span className={`text-sm font-medium ${FARG_TEXT[statusDef.farg]}`}>{projekt.status}</span>
                  </div>
                ) : (
                  <span className="text-sm text-fg">{projekt.status || '—'}</span>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Kund</p>
                <div className="flex items-center gap-1.5">
                  <User size={12} className="text-muted shrink-0" />
                  <span className="text-sm text-fg">{projekt.kunder.namn}</span>
                  <span className="font-mono text-xs text-muted">{projekt.kunder.kundnummer}</span>
                </div>
              </div>
            </div>

            {/* Dates */}
            {(projekt.startdatum || projekt.slutdatum) && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {projekt.startdatum && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Startdatum</p>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-muted shrink-0" />
                      <span className="text-sm text-fg">
                        {new Date(projekt.startdatum).toLocaleDateString('sv-SE')}
                      </span>
                    </div>
                  </div>
                )}
                {projekt.slutdatum && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Slutdatum</p>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-muted shrink-0" />
                      <span className="text-sm text-fg">
                        {new Date(projekt.slutdatum).toLocaleDateString('sv-SE')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Budget */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Budget</p>
              <div className="flex items-center gap-1.5">
                <Banknote size={12} className="text-muted shrink-0" />
                <span className="text-sm text-fg font-medium">
                  {projekt.budget_total.toLocaleString('sv-SE')} kr
                </span>
                {projekt.rot_avdrag && (
                  <span className="text-[10px] uppercase tracking-wide text-amber-400 ml-1">ROT</span>
                )}
              </div>
            </div>

            {/* Address */}
            {(projekt.arbetsplats_adress || projekt.arbetsplats_stad) && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Arbetsplats</p>
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-muted shrink-0" />
                  <span className="text-sm text-fg">
                    {[projekt.arbetsplats_adress, projekt.arbetsplats_postnummer, projekt.arbetsplats_stad]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              </div>
            )}

            {/* Description */}
            {projekt.beskrivning && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Beskrivning</p>
                <p className="text-sm text-fg leading-relaxed line-clamp-3">{projekt.beskrivning}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-red-400 text-sm">Kunde inte ladda projekt.</div>
        )}
      </div>
    </div>
  )
}
