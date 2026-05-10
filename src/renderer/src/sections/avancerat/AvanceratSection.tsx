import { useState } from 'react'
import { Zap, Globe, Mail, Sparkles, Cpu, GitBranch, Database, Workflow, HardDrive, Clock, Boxes, SquareArrowOutUpRight, type LucideIcon } from 'lucide-react'
import type { AvanceratPanel } from '@/sections/installningar/types'
import { FortnoxPanel } from '@/sections/installningar/panels/FortnoxPanel'
import { GooglePanel } from '@/sections/installningar/panels/GooglePanel'
import { ZohoPanel } from '@/sections/installningar/panels/ZohoPanel'
import { ProveedoresPanel } from '@/sections/installningar/panels/ProveedoresPanel'
import { AsistenterPanel } from '@/sections/installningar/panels/AsistenterPanel'
import { AktivitetsloggPanel } from '@/sections/installningar/panels/AktivitetsloggPanel'
import { WorkflowNodesPanel } from '@/sections/installningar/panels/WorkflowNodesPanel'
import { WorkflowsPanel } from '@/sections/installningar/panels/WorkflowsPanel'
import { ProjektKontextPanel } from '@/sections/installningar/panels/ProjektKontextPanel'
import { DatabaSPanel } from '@/sections/installningar/panels/DatabaSPanel'
import { CronPanel } from '@/sections/installningar/panels/CronPanel'
import { SatellitApparPanel } from '@/sections/installningar/panels/SatellitApparPanel'

interface NavItem {
  id: AvanceratPanel
  label: string
  icon: LucideIcon
  popout?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Integrationer',
    items: [
      { id: 'databas', label: 'DataBase', icon: Database },
      { id: 'fortnox', label: 'Fortnox', icon: Zap },
      { id: 'google', label: 'Google', icon: Globe },
      { id: 'zoho', label: 'Zoho', icon: Mail },
    ],
  },
  {
    label: 'Logg',
    items: [
      { id: 'aktivitetslogg', label: 'Aktivitetslogg', icon: Zap },
    ],
  },
  {
    label: 'IA-Assistent',
    items: [
      { id: 'ai-proveedores', label: 'AI-Leverantör', icon: Cpu },
      { id: 'ai-asistenter', label: 'Assistenter', icon: Sparkles },
    ],
  },
  {
    label: 'Workflows',
    items: [
      { id: 'workflows', label: 'Workflows', icon: Workflow, popout: true },
      { id: 'kontext', label: 'Kontext', icon: HardDrive, popout: true },
      { id: 'workflow-nodes', label: 'Noder', icon: GitBranch, popout: true },
    ],
  },
  {
    label: 'Automatisering',
    items: [
      { id: 'cron', label: 'Cron', icon: Clock },
    ],
  },
  {
    label: 'Externa appar',
    items: [
      { id: 'satellit-appar', label: 'Satellit-appar', icon: Boxes },
    ],
  },
]

const PANEL_TITLES: Record<AvanceratPanel, string> = {
  databas: 'DataBase & Anslutning',
  fortnox: 'Fortnox',
  google: 'Google Workspace',
  zoho: 'Zoho',
  aktivitetslogg: 'Aktivitetslogg',
  'ai-proveedores': 'AI-Leverantör',
  'ai-asistenter': 'Assistenter',
  workflows: 'Workflows',
  kontext: 'Projekt-kontext',
  'workflow-nodes': 'Workflow-noder',
  cron: 'Schemalagda jobb',
  'satellit-appar': 'Satellit-appar',
}

function renderPanel(panel: AvanceratPanel) {
  switch (panel) {
    case 'databas': return <DatabaSPanel />
    case 'fortnox': return <FortnoxPanel />
    case 'google': return <GooglePanel />
    case 'zoho': return <ZohoPanel />
    case 'aktivitetslogg': return <AktivitetsloggPanel />
    case 'ai-proveedores': return <ProveedoresPanel />
    case 'ai-asistenter': return <AsistenterPanel />
    case 'workflows': return <WorkflowsPanel />
    case 'kontext': return <ProjektKontextPanel />
    case 'workflow-nodes': return <WorkflowNodesPanel />
    case 'cron': return <CronPanel />
    case 'satellit-appar': return <SatellitApparPanel />
  }
}

export function AvanceratSection({ initialPanel }: { initialPanel?: AvanceratPanel }) {
  const [activePanel, setActivePanel] = useState<AvanceratPanel | null>(initialPanel ?? null)
  const isFullHeight = activePanel === 'ai-asistenter' || activePanel === 'workflows' || activePanel === 'kontext'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <p className="text-[11px] uppercase tracking-widest text-muted">Avancerat</p>
      </div>

      <div className="flex flex-1 min-h-0">
        <nav className="w-52 shrink-0 border-r border-border overflow-auto py-3">
          {NAV_GROUPS.map((group, i) => (
            <div key={group.label}>
              {i > 0 && <div className="mx-4 my-2 border-t border-border" />}
              <div className="mb-2">
                <p className="px-4 mb-1 text-[10px] uppercase tracking-widest text-subtle">{group.label}</p>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const handlePopout = (e: React.MouseEvent): void => {
                    e.stopPropagation()
                    if (item.popout) void window.api.invoke('window:open-section', item.id)
                  }
                  return (
                    <div key={item.id} className="group relative">
                      <button
                        onClick={() => setActivePanel(item.id)}
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

        {activePanel === null ? (
          <div className="relative flex-1 flex items-center justify-center">
            <h1 className="relative text-2xl font-semibold text-fg tracking-tight">Avancerat</h1>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-8 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-semibold text-fg">{PANEL_TITLES[activePanel]}</h2>
            </div>
            <div className={`flex-1 ${isFullHeight ? 'overflow-hidden flex flex-col' : 'overflow-auto'}`}>
              {renderPanel(activePanel)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
