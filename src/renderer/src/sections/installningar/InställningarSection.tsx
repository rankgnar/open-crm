import { useState } from 'react'
import { Building2, Briefcase, Package, Boxes, Layers, Mail, FileText, Users, FolderKanban, TrendingUp, ClipboardSignature, ClipboardPlus, ChevronRight, SquareArrowOutUpRight, RefreshCw, Calculator, type LucideIcon } from 'lucide-react'
import type { InstallningarPanel } from './types'
import { KalkylPanel } from './panels/KalkylPanel'
import { ForetagPanel } from './panels/ForetagPanel'
import { KunderPanel } from './panels/KunderPanel'
import { ProjektPanel } from './panels/ProjektPanel'
import { ForslagPanel } from './panels/ForslagPanel'
import { EkonomiPanel } from './panels/EkonomiPanel'
import { OrderPanel } from './panels/OrderPanel'
import { ATAPanel } from './panels/ATAPanel'
import { YrkesrollerPanel } from './panels/YrkesrollerPanel'
import { ArtikklarPanel } from './panels/ArtikklarPanel'
import { MaterialKatalogView } from './panels/MaterialKatalogView'
import { FasMallarPanel } from './panels/FasMallarPanel'
import { PDFsPanel } from './panels/PDFsPanel'
import { EpostMallarPanel } from './panels/EpostMallarPanel'
import { EpostAliasPanel } from './panels/EpostAliasPanel'
import { PersonalPanel } from './panels/PersonalPanel'

interface NavItem {
  id?: InstallningarPanel
  label: string
  icon: LucideIcon
  popout?: boolean
  subItems?: { id: InstallningarPanel; label: string }[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'System',
    items: [
      { id: 'foretag', label: 'Företag', icon: Building2 },
      { id: 'pdfs', label: 'PDFs', icon: FileText },
      {
        label: 'E-post',
        icon: Mail,
        subItems: [
          { id: 'epost-alias', label: 'Alias' },
          { id: 'epost-mallar', label: 'Mallar' },
        ],
      },
    ]
  },
  {
    label: 'Moduler',
    items: [
      { id: 'kunder', label: 'Kunder-config', icon: Users },
      { id: 'projekt', label: 'Projekt-config', icon: FolderKanban },
      { id: 'forslag', label: 'Förslag-config', icon: FileText },
      { id: 'ekonomi', label: 'Kostnader-config', icon: TrendingUp },
      { id: 'order', label: 'Order-config', icon: ClipboardSignature },
      { id: 'ata', label: 'ÄTA-config', icon: ClipboardPlus },
      { id: 'personal', label: 'Personal-config', icon: Users },
    ]
  },
  {
    label: 'Kataloger',
    items: [
      { id: 'yrkesroller', label: 'Timpris', icon: Briefcase },
      { id: 'artiklar', label: 'F-Artiklar', icon: Package },
      { id: 'materialkatalog', label: 'Materialkatalog', icon: Boxes, popout: true },
      { id: 'fas-mallar', label: 'Fas-Subfas', icon: Layers, popout: true },
      { id: 'kalkyl', label: 'Kalkylator', icon: Calculator },
    ]
  },
]

const PANEL_TITLES: Record<InstallningarPanel, string> = {
  foretag: 'Företagsinformation',
  kunder: 'Kunder',
  projekt: 'Projekt',
  forslag: 'Förslag',
  ekonomi: 'Kostnader',
  order: 'Order',
  ata: 'ÄTA',
  yrkesroller: 'Timpris',
  artiklar: 'F-Artiklar',
  materialkatalog: 'Materialkatalog',
  'fas-mallar': 'Fas-Subfas',
  'kalkyl': 'Kalkylator-config',
  'epost-mallar': 'E-post mallar',
  'epost-alias': 'E-post alias',
  'pdfs': 'PDF-konfiguration',
  'personal': 'Personal',
}

function renderPanel(panel: InstallningarPanel) {
  switch (panel) {
    case 'foretag': return <ForetagPanel />
    case 'kunder': return <KunderPanel />
    case 'projekt': return <ProjektPanel />
    case 'forslag': return <ForslagPanel />
    case 'ekonomi': return <EkonomiPanel />
    case 'order': return <OrderPanel />
    case 'ata': return <ATAPanel />
    case 'yrkesroller': return <YrkesrollerPanel />
    case 'artiklar': return <ArtikklarPanel />
    case 'materialkatalog': return <MaterialKatalogView />
    case 'fas-mallar': return <FasMallarPanel />
    case 'epost-mallar': return <EpostMallarPanel />
    case 'epost-alias': return <EpostAliasPanel />
    case 'pdfs': return <PDFsPanel />
    case 'personal': return <PersonalPanel />
    case 'kalkyl': return <KalkylPanel />
  }
}

export function InställningarSection({ initialPanel }: { initialPanel?: InstallningarPanel }) {
  const [activePanel, setActivePanel] = useState<InstallningarPanel | null>(initialPanel ?? null)
  const [fasRefreshKey, setFasRefreshKey] = useState(0)
  const [openParents, setOpenParents] = useState<Set<string>>(() => {
    const open = new Set<string>()
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.subItems?.some(s => s.id === initialPanel)) open.add(item.label)
      }
    }
    return open
  })
  const isFullHeight = activePanel === 'fas-mallar' || activePanel === 'materialkatalog' || activePanel === 'projekt' || activePanel === 'kunder' || activePanel === 'forslag' || activePanel === 'epost-mallar' || activePanel === 'epost-alias' || activePanel === 'personal' || activePanel === 'order' || activePanel === 'ata'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <p className="text-[11px] uppercase tracking-widest text-muted">Inställningar</p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left nav */}
        <nav className="w-52 shrink-0 border-r border-border overflow-auto py-3">
          {NAV_GROUPS.map((group, i) => (
            <div key={group.label}>
              {i > 0 && <div className="mx-4 my-2 border-t border-border" />}
              <div className="mb-2">
              <p className="px-4 mb-1 text-[10px] uppercase tracking-widest text-subtle">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon
                if (item.subItems) {
                  const isOpen = openParents.has(item.label)
                  const hasActiveChild = item.subItems.some(s => s.id === activePanel)
                  return (
                    <div key={item.label}>
                      <button
                        onClick={() => setOpenParents(prev => {
                          const next = new Set(prev)
                          if (next.has(item.label)) next.delete(item.label)
                          else next.add(item.label)
                          return next
                        })}
                        className={`w-full flex items-center gap-2.5 px-4 py-1.5 text-sm transition-colors rounded-lg mx-0 ${hasActiveChild ? 'text-fg' : 'text-muted hover:text-fg hover:bg-hover'}`}
                      >
                        <Icon size={14} />
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronRight size={12} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      </button>
                      {isOpen && item.subItems.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => setActivePanel(sub.id)}
                          className={`w-full flex items-center gap-2.5 pl-10 pr-4 py-1.5 text-sm transition-colors rounded-lg mx-0 ${activePanel === sub.id ? 'text-fg bg-hover' : 'text-muted hover:text-fg hover:bg-hover'}`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )
                }
                const handlePopout = (e: React.MouseEvent): void => {
                  e.stopPropagation()
                  if (item.popout && item.id) void window.api.invoke('window:open-section', item.id)
                }
                return (
                  <div key={item.id} className="group relative">
                    <button
                      onClick={() => item.id && setActivePanel(item.id)}
                      className={`w-full flex items-center gap-2.5 px-4 py-1.5 text-sm transition-colors rounded-lg mx-0 ${activePanel === item.id ? 'text-fg bg-hover' : 'text-muted hover:text-fg hover:bg-hover'}`}
                    >
                      <Icon size={14} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.popout && (
                        <span
                          role="button"
                          onClick={handlePopout}
                          title={`Öppna ${item.label} i nytt fönster`}
                          className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-subtle hover:text-fg transition-opacity"
                        >
                          <SquareArrowOutUpRight size={12} />
                        </span>
                      )}
                    </button>
                  </div>
                )
              })}
              </div>
            </div>
          ))}
        </nav>

        {/* Right content */}
        {activePanel === null ? (
          <div className="relative flex-1 flex items-center justify-center">
            <h1 className="relative text-2xl font-semibold text-fg tracking-tight">Inställningar</h1>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-8 py-4 border-b border-border shrink-0 flex items-center justify-between">
              <h2 className="text-base font-semibold text-fg">{PANEL_TITLES[activePanel]}</h2>
              {activePanel === 'fas-mallar' && (
                <button
                  onClick={() => setFasRefreshKey((k) => k + 1)}
                  title="Uppdatera"
                  className="text-muted hover:text-fg transition-colors"
                >
                  <RefreshCw size={13} />
                </button>
              )}
            </div>
            <div className={`flex-1 ${isFullHeight ? 'overflow-hidden flex flex-col' : 'overflow-auto'}`}>
              {activePanel === 'fas-mallar'
                ? <FasMallarPanel key={fasRefreshKey} />
                : renderPanel(activePanel)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
