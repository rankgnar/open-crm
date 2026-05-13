import { useState } from 'react'
import { useAppConfig } from '@/context/AppConfig'
import type { KalkylatorInput, KalkylatorType, VentanaPreset, TakType } from './types'
import { DEFAULT_VENTANA_PRESETS, DEFAULT_TAK_TYPER } from './types'
import { computeKalkylator } from './kalkylator-calc'
import { FasadKalkylator } from './FasadKalkylator'
import { KalkylatorResultPanel } from './KalkylatorResultPanel'
import { SkapaForslagModal } from './SkapaForslagModal'
import type { ProjektWithKund } from '@/sections/projekt/types'

function makeDefaultInput(): KalkylatorInput {
  return {
    type: 'fasad',
    surfaces: [],
    deductions: [],
    materials: [],
    laborHoursPerM2: 1.5,
    laborRate: 450,
  }
}

const TABS: { type: KalkylatorType; label: string; available: boolean }[] = [
  { type: 'fasad', label: 'Fasad', available: true },
  { type: 'tak', label: 'Tak', available: false },
  { type: 'golv', label: 'Golv', available: false },
  { type: 'vagg', label: 'Vägg', available: false },
]

const round2 = (n: number) => Math.round(n * 100) / 100

interface Props {
  onNavigate?: (section: string) => void
}

export function KalkylatorsSection({ onNavigate }: Props) {
  const { config } = useAppConfig()
  const [input, setInput] = useState<KalkylatorInput>(makeDefaultInput)
  const [showModal, setShowModal] = useState(false)
  const [projekt, setProjekt] = useState<ProjektWithKund[]>([])
  const [projektLoaded, setProjektLoaded] = useState(false)

  const result = computeKalkylator(input)

  const ventanaPresets: VentanaPreset[] = [
    ...(config?.kalkyl_ventanatyper as VentanaPreset[] | undefined ?? []),
    ...DEFAULT_VENTANA_PRESETS.filter(d =>
      !(config?.kalkyl_ventanatyper as VentanaPreset[] | undefined ?? []).some(u => u.id === d.id)
    ),
  ]

  const takTyper: TakType[] = [
    ...(config?.kalkyl_taktyper as TakType[] | undefined ?? []),
    ...DEFAULT_TAK_TYPER.filter(d =>
      !(config?.kalkyl_taktyper as TakType[] | undefined ?? []).some(u => u.id === d.id)
    ),
  ]

  const handleOpenModal = () => {
    if (!projektLoaded) {
      window.api.invoke('db:projekt:list')
        .then(data => { setProjekt(data as ProjektWithKund[]); setProjektLoaded(true) })
        .catch(() => {})
    }
    setShowModal(true)
  }

  const handleSuccess = () => {
    setShowModal(false)
    onNavigate?.('forslag')
  }

  const handleSkapa = async (projektId: string, titel: string): Promise<void> => {
    const forslag = await window.api.invoke('db:forslag:create', {
      projekt_id: projektId,
      titel,
    }) as { id: string }

    const fas = await window.api.invoke('db:forslag-faser:create', {
      forslag_id: forslag.id,
      namn: 'Fasad',
    }) as { id: string }

    const subfas = await window.api.invoke('db:forslag-subfaser:create', {
      fas_id: fas.id,
      namn: 'Material & Arbete',
    }) as { id: string }

    for (const line of input.materials) {
      const m = await window.api.invoke('db:forslag-material:create', subfas.id) as { id: string }
      await window.api.invoke('db:forslag-material:update', m.id, {
        beskrivning: line.name,
        enhet: line.unit,
        antal: round2(result.netArea * line.coveragePerM2),
        a_pris: line.unitPrice,
      })
    }

    const a = await window.api.invoke('db:forslag-arbete:create', subfas.id) as { id: string }
    await window.api.invoke('db:forslag-arbete:update', a.id, {
      beskrivning: 'Fasadarbete',
      antal_timmar: round2(result.laborHours),
      timpris: input.laborRate,
      rot_berattigad: false,
    })

    handleSuccess()
  }

  return (
    <div className="flex h-full">
      {/* Left — form */}
      <div className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Header with type tabs */}
        <div className="px-6 py-3 border-b border-border bg-sidebar shrink-0 flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab.type}
              disabled={!tab.available}
              title={!tab.available ? 'Kommer snart' : undefined}
              className={[
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                tab.available
                  ? input.type === tab.type
                    ? 'bg-elevated text-fg border border-border'
                    : 'text-muted hover:text-fg'
                  : 'text-subtle opacity-40 cursor-not-allowed',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Calculator */}
        {input.type === 'fasad' && (
          <FasadKalkylator
            input={input}
            ventanaPresets={ventanaPresets}
            takTyper={takTyper}
            onUpdate={setInput}
          />
        )}
      </div>

      {/* Right — results */}
      <div className="w-72 shrink-0 border-l border-border flex flex-col">
        <KalkylatorResultPanel result={result} onSkapa={handleOpenModal} />
      </div>

      {showModal && (
        <SkapaForslagModal
          input={input}
          result={result}
          projekt={projekt}
          onSkapa={handleSkapa}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
