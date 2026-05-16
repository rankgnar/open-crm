import { Settings, Sun, Moon, PanelLeft, Wrench, SquareArrowOutUpRight } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAppConfig } from '@/context/AppConfig'
import { NAV_GROUPS } from '@/nav-sections'
import type { InstallningarPanel } from '@/sections/installningar/types'

type Section = 'workspace' | 'kunder' | 'projekt' | 'forslag' | 'signera' | 'tidplan' | 'ekonomi' | 'fakturering' | 'kvitto' | 'order' | 'ata' | 'fortnox' | 'epost' | 'kalender' | 'revisor' | 'personal' | 'leverantor' | 'chat' | 'installningar' | 'avancerat' | 'inventarier'

interface Props {
  active: Section
  onNavigate: (section: Section) => void
  onNavigateConfig: (panel: InstallningarPanel) => void
  badges?: Partial<Record<Section, number>>
  collapsed: boolean
  onCollapsedChange: (c: boolean) => void
}

export function Sidebar({ active, onNavigate, onNavigateConfig, badges, collapsed, onCollapsedChange }: Props) {
  const { theme, toggle } = useTheme()
  const { config } = useAppConfig()
  const empresaNombre = config?.foretag_namn?.trim() || 'CRM·HDB'

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-150 ${collapsed ? 'w-14' : 'w-64'}`}
    >
      <div className="drag flex h-10 items-center justify-end pr-2">
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="no-drag rounded p-1.5 text-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <PanelLeft size={16} strokeWidth={1.75} />
        </button>
      </div>

      <nav className={`flex flex-1 flex-col overflow-y-auto min-h-0 ${collapsed ? 'px-2' : 'px-3'}`}>
        {NAV_GROUPS.map((group, gi) => (
          <div
            key={group.label ?? '__top'}
            className={
              gi === 0
                ? ''
                : collapsed
                  ? 'mt-1.5 pt-1.5 border-t border-border'
                  : 'mt-2'
            }
          >
            {!collapsed && group.label && (
              <p className="px-2.5 mb-1 text-[10px] font-medium uppercase tracking-widest text-subtle">
                {group.label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ id, label, icon: Icon, popout }) => {
                const configPanel = undefined
                const badge = badges?.[id as Section] ?? 0
                const handlePopout = (e: React.MouseEvent): void => {
                  e.stopPropagation()
                  if (popout) void window.api.invoke('window:open-section', id)
                }
                return (
                  <div key={id} className="group relative">
                    <button
                      onClick={() => onNavigate(id as Section)}
                      title={collapsed ? (badge > 0 ? `${label} (${badge})` : label) : undefined}
                      className={`no-drag w-full flex items-center rounded-lg py-1 text-sm transition-colors ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'} ${active === id ? 'bg-hover text-fg' : 'text-muted hover:bg-hover hover:text-fg'}`}
                    >
                      <span className="relative flex items-center">
                        <Icon size={16} />
                        {collapsed && badge > 0 && (
                          <span className="absolute -top-1 -right-1.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-400 px-1 text-[9px] font-semibold leading-none text-white">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </span>
                      {!collapsed && <span className="flex-1 text-left">{label}</span>}
                      {!collapsed && badge > 0 && (
                        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-400 px-1.5 text-[10px] font-semibold leading-none text-white tabular-nums">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                      {!collapsed && popout && (
                        <span
                          role="button"
                          onClick={handlePopout}
                          title={`Öppna ${label} i nytt fönster`}
                          className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-subtle hover:text-fg transition-opacity"
                        >
                          <SquareArrowOutUpRight size={12} />
                        </span>
                      )}
                      {!collapsed && configPanel && (
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); onNavigateConfig(configPanel) }}
                          title={`Konfig ${label}`}
                          className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-subtle hover:text-fg transition-opacity"
                        >
                          <Settings size={12} />
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

      {/* Workflows + Settings — parte inferior */}
      <div className={`shrink-0 border-t border-border pt-2 ${collapsed ? 'px-2' : 'px-3'}`}>
        <button
          onClick={() => onNavigate('installningar')}
          title={collapsed ? 'Inställningar' : undefined}
          className={`no-drag w-full flex items-center rounded-lg py-1 text-sm transition-colors ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'} ${active === 'installningar' ? 'bg-hover text-fg' : 'text-muted hover:bg-hover hover:text-fg'}`}
        >
          <Settings size={16} />
          {!collapsed && 'Inställningar'}
        </button>
        <button
          onClick={() => onNavigate('avancerat')}
          title={collapsed ? 'Avancerat' : undefined}
          className={`no-drag w-full flex items-center rounded-lg py-1 text-sm transition-colors ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'} ${active === 'avancerat' ? 'bg-hover text-fg' : 'text-muted hover:bg-hover hover:text-fg'}`}
        >
          <Wrench size={16} />
          {!collapsed && 'Avancerat'}
        </button>
      </div>

      <div className={`shrink-0 ${collapsed ? 'p-2' : 'p-3'}`}>
        {collapsed ? (
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            title="Toggle theme"
            className="no-drag flex w-full items-center justify-center rounded-lg py-1.5 text-muted transition-colors hover:bg-hover hover:text-fg"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        ) : (
          <div className="no-drag flex items-center justify-between rounded-full bg-hover px-3 py-1.5">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              <span className="font-mono text-[11px] font-semibold tracking-[0.18em] text-fg truncate max-w-[120px]">
                {empresaNombre}
              </span>
            </span>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="rounded p-1 text-muted hover:bg-hover hover:text-fg"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
