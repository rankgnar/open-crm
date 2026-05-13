import { useState } from 'react'
import { useAppConfig } from '@/context/AppConfig'
import type { KalkylatorInput, KalkylatorType, VentanaPreset, TakType } from './types'
import {
  DEFAULT_VENTANA_PRESETS, DEFAULT_TAK_TYPER,
  DEFAULT_TAK_AVDRAG, DEFAULT_GOLV_AVDRAG, DEFAULT_VAGG_AVDRAG,
} from './types'
import { computeKalkylator } from './kalkylator-calc'
import { FasadKalkylator } from './FasadKalkylator'
import { TakKalkylator } from './TakKalkylator'
import { GolvKalkylator } from './GolvKalkylator'
import { VaggKalkylator } from './VaggKalkylator'
import { KalkylatorResultPanel } from './KalkylatorResultPanel'
import { SkapaForslagModal } from './SkapaForslagModal'
import type { ProjektWithKund } from '@/sections/projekt/types'

const TABS: { type: KalkylatorType; label: string }[] = [
  { type: 'fasad', label: 'Fasad' },
  { type: 'tak', label: 'Tak' },
  { type: 'golv', label: 'Golv' },
  { type: 'vagg', label: 'Vägg' },
]

const FAS_NAMES: Record<KalkylatorType, string> = {
  fasad: 'Fasad', tak: 'Tak', golv: 'Golv', vagg: 'Vägg',
}
const ARBETE_NAMES: Record<KalkylatorType, string> = {
  fasad: 'Fasadarbete', tak: 'Takarbete', golv: 'Golvläggning', vagg: 'Väggarbete',
}

const round2 = (n: number) => Math.round(n * 100) / 100

type InputMap = Record<KalkylatorType, KalkylatorInput>

function makeInput(type: KalkylatorType): KalkylatorInput {
  return { type, surfaces: [], deductions: [], materials: [], laborHoursPerM2: 1.5, laborRate: 450 }
}

function mergePresets<T extends { id: string }>(configVal: unknown, defaults: T[]): T[] {
  const user = Array.isArray(configVal) ? (configVal as T[]) : []
  return [...user, ...defaults.filter(d => !user.some(u => u.id === d.id))]
}

interface Props {
  onNavigate?: (section: string) => void
}

export function KalkylatorsSection({ onNavigate }: Props) {
  const { config } = useAppConfig()
  const [activeType, setActiveType] = useState<KalkylatorType>('fasad')
  const [inputs, setInputs] = useState<InputMap>(() => ({
    fasad: makeInput('fasad'),
    tak: makeInput('tak'),
    golv: makeInput('golv'),
    vagg: makeInput('vagg'),
  }))
  const [showModal, setShowModal] = useState(false)
  const [projekt, setProjekt] = useState<ProjektWithKund[]>([])
  const [projektLoaded, setProjektLoaded] = useState(false)

  const input = inputs[activeType]
  const setInput = (next: KalkylatorInput) => setInputs(prev => ({ ...prev, [activeType]: next }))
  const result = computeKalkylator(input)

  const ventanaPresets = mergePresets<VentanaPreset>(config?.kalkyl_ventanatyper, DEFAULT_VENTANA_PRESETS)
  const takTyper = mergePresets<TakType>(config?.kalkyl_taktyper, DEFAULT_TAK_TYPER)
  const takAvdrag = mergePresets<VentanaPreset>(config?.kalkyl_tak_avdrag, DEFAULT_TAK_AVDRAG)
  const golvAvdrag = mergePresets<VentanaPreset>(config?.kalkyl_golv_avdrag, DEFAULT_GOLV_AVDRAG)
  const vaggAvdrag = mergePresets<VentanaPreset>(config?.kalkyl_vagg_avdrag, DEFAULT_VAGG_AVDRAG)

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
      namn: FAS_NAMES[activeType],
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
      beskrivning: ARBETE_NAMES[activeType],
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
              onClick={() => setActiveType(tab.type)}
              className={[
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                activeType === tab.type
                  ? 'bg-elevated text-fg border border-border'
                  : 'text-muted hover:text-fg',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Calculator — each type has its own isolated input state */}
        {activeType === 'fasad' && (
          <FasadKalkylator input={input} ventanaPresets={ventanaPresets} takTyper={takTyper} onUpdate={setInput} />
        )}
        {activeType === 'tak' && (
          <TakKalkylator input={input} avdragPresets={takAvdrag} takTyper={takTyper} onUpdate={setInput} />
        )}
        {activeType === 'golv' && (
          <GolvKalkylator input={input} avdragPresets={golvAvdrag} onUpdate={setInput} />
        )}
        {activeType === 'vagg' && (
          <VaggKalkylator input={input} avdragPresets={vaggAvdrag} onUpdate={setInput} />
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
