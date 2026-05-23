import { useState, useEffect } from 'react'
import { ToggleRight, ToggleLeft } from 'lucide-react'
import { ConfigField } from './ConfigField'
import { useAppConfig } from '@/context/AppConfig'
import { KunderImportSection } from './KunderImportSection'
import { KlientportalSection } from './KlientportalSection'

export function KunderPanel() {
  const { config, updateConfig } = useAppConfig()
  const [numCurrent, setNumCurrent] = useState<number | null>(null)
  const [numInput, setNumInput] = useState('')
  const [numSaving, setNumSaving] = useState(false)
  const [numSaved, setNumSaved] = useState(false)
  const [numError, setNumError] = useState('')

  useEffect(() => {
    window.api.invoke('db:kunder-nummer:get').then((n) => {
      setNumCurrent(n as number)
      setNumInput(String(n as number))
    })
  }, [])

  async function handleSetNummer() {
    const val = parseInt(numInput)
    if (!val || val < 1) { setNumError('Ange ett positivt heltal.'); return }
    setNumSaving(true); setNumError('')
    try {
      const next = await window.api.invoke('db:kunder-nummer:set', val) as number
      setNumCurrent(next); setNumSaved(true); setTimeout(() => setNumSaved(false), 2500)
    } catch (err) {
      setNumError(err instanceof Error ? err.message : 'Fel')
    } finally { setNumSaving(false) }
  }

  return (
    <div className="flex h-full min-h-0">

      {/* Left column */}
      <div className="flex flex-col flex-1 overflow-auto">

        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-5">Standardvärden</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <ConfigField label="Standardland" field="kund_std_land" placeholder="Sverige" />
            <ConfigField label="Landskod" field="kund_std_landskod" placeholder="SE" />
          </div>
        </div>

        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Kundnummer</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-subtle">
              Nästa: <span className="font-mono text-fg">K-{numCurrent != null ? String(numCurrent).padStart(4, '0') : '…'}</span>
            </span>
            <input
              type="number" min="1" step="1" className="input font-mono w-24 text-sm"
              value={numInput}
              onChange={(e) => setNumInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSetNummer() }}
            />
            <button onClick={handleSetNummer} disabled={numSaving} className="px-3 py-1.5 rounded-lg bg-hover text-fg text-xs font-medium hover:bg-border disabled:opacity-40 transition-colors">
              {numSaving ? '...' : numSaved ? '✓ Sparat' : 'Sätt'}
            </button>
            <button
              onClick={async () => {
                setNumInput('1'); setNumSaving(true); setNumError('')
                try {
                  const next = await window.api.invoke('db:kunder-nummer:set', 1) as number
                  setNumCurrent(next); setNumSaved(true); setTimeout(() => setNumSaved(false), 2500)
                } catch (err) { setNumError(err instanceof Error ? err.message : 'Fel') }
                finally { setNumSaving(false) }
              }}
              disabled={numSaving}
              className="text-xs text-muted hover:text-fg disabled:opacity-40 transition-colors"
            >
              Återställ till 1
            </button>
          </div>
          {numError && <p className="text-xs text-red-400 mt-2">{numError}</p>}
        </div>

        <div className="border-b border-border">
          <KunderImportSection />
        </div>

        <KlientportalSection />

        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-5">Projektavslut</p>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-fg">Skicka feedback-formulär vid projektradering</span>
              <span className="text-xs text-muted">Skickar automatiskt ett formulär till kunden när ett projekt raderas.</span>
            </div>
            <button
              onClick={() => updateConfig({ avslut_feedback_aktiv: !config?.avslut_feedback_aktiv })}
              className="shrink-0 text-muted hover:text-fg transition-colors"
            >
              {config?.avslut_feedback_aktiv
                ? <ToggleRight size={22} className="text-emerald-400" />
                : <ToggleLeft size={22} />
              }
            </button>
          </div>
        </div>

      </div>

    </div>
  )
}
