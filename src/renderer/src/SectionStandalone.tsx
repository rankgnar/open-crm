import { type ComponentType, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { TitleBar } from '@/components/TitleBar'
import { KunderSection } from '@/sections/kunder/KunderSection'
import { ProjektSection } from '@/sections/projekt/ProjektSection'
import { ForslagSection } from '@/sections/forslag/ForslagSection'
import { TidplanSection } from '@/sections/tidplan/TidplanSection'
import { EkonomiSection } from '@/sections/ekonomi/EkonomiSection'
import { FaktureringSection } from '@/sections/fakturering/FaktureringSection'
import { KvittoSection } from '@/sections/kvitto/KvittoSection'
import { OrderSection } from '@/sections/order/OrderSection'
import { ATASection } from '@/sections/ata/ATASection'
import { SigneraSection } from '@/sections/signera/SigneraSection'
import { EpostSection } from '@/sections/epost/EpostSection'
import { KalenderSection } from '@/sections/kalender/KalenderSection'
import { FortnoxSection } from '@/sections/fortnox/FortnoxSection'
import { PersonalSection } from '@/sections/personal/PersonalSection'
import { ChatSection } from '@/sections/chat/ChatSection'
import { LeverantorSection } from '@/sections/leverantor/LeverantorSection'
import { WorkflowsPanel } from '@/sections/installningar/panels/WorkflowsPanel'
import { ProjektKontextPanel } from '@/sections/installningar/panels/ProjektKontextPanel'
import { WorkflowNodesPanel } from '@/sections/installningar/panels/WorkflowNodesPanel'
import { MaterialKatalogView } from '@/sections/installningar/panels/MaterialKatalogView'
import { FasMallarPanel } from '@/sections/installningar/panels/FasMallarPanel'

type Wrap = 'none' | 'scroll' | 'full-height'

interface Entry { Component: ComponentType; wrap: Wrap; title?: string }

const SECTION_COMPONENTS: Record<string, Entry> = {
  kunder:      { Component: KunderSection,      wrap: 'none' },
  projekt:     { Component: ProjektSection,     wrap: 'none' },
  forslag:     { Component: ForslagSection,     wrap: 'none' },
  kalender:    { Component: KalenderSection,    wrap: 'none' },
  tidplan:     { Component: TidplanSection,     wrap: 'none' },
  order:       { Component: OrderSection,       wrap: 'none' },
  ata:         { Component: ATASection,         wrap: 'none' },
  ekonomi:     { Component: EkonomiSection,     wrap: 'none' },
  fakturering: { Component: FaktureringSection, wrap: 'none' },
  kvitto:      { Component: KvittoSection,      wrap: 'none' },
  fortnox:     { Component: FortnoxSection,     wrap: 'none' },
  epost:       { Component: EpostSection,       wrap: 'none' },
  chat:        { Component: ChatSection,        wrap: 'none' },
  signera:     { Component: SigneraSection,     wrap: 'none' },
  leverantor:  { Component: LeverantorSection,  wrap: 'none' },
  personal:    { Component: PersonalSection,    wrap: 'none' },
  workflows:        { Component: WorkflowsPanel,       wrap: 'full-height', title: 'Workflows' },
  kontext:          { Component: ProjektKontextPanel,  wrap: 'full-height', title: 'Projekt-kontext' },
  'workflow-nodes': { Component: WorkflowNodesPanel,   wrap: 'scroll',      title: 'Workflow-noder' },
  materialkatalog:  { Component: MaterialKatalogView,  wrap: 'full-height', title: 'Materialkatalog' },
  'fas-mallar':     { Component: FasMallarPanel,       wrap: 'full-height', title: 'Fas-Subfas' },
}

export default function SectionStandalone({ id }: { id: string }) {
  const entry = SECTION_COMPONENTS[id]
  const [refreshKey, setRefreshKey] = useState(0)

  let body: React.ReactNode
  if (!entry) {
    body = (
      <div className="flex h-full items-center justify-center text-muted text-sm">
        Okänd sektion: {id}
      </div>
    )
  } else {
    const { Component, wrap, title } = entry
    const inner = <Component key={refreshKey} />
    const wrapped =
      wrap === 'full-height' ? <div className="flex-1 overflow-hidden flex flex-col min-h-0">{inner}</div>
      : wrap === 'scroll'    ? <div className="flex-1 overflow-auto">{inner}</div>
      : inner
    body = title ? (
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <div className="px-8 py-4 border-b border-border shrink-0 flex items-center justify-between">
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Uppdatera"
            className="text-muted hover:text-fg transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
        {wrapped}
      </div>
    ) : wrapped
  }

  return (
    <div className="flex flex-col h-screen bg-bg text-fg overflow-hidden">
      <TitleBar />
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {body}
      </main>
    </div>
  )
}
