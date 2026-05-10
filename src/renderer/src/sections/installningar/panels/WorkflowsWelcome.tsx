import { GitBranch, ListOrdered, Zap } from 'lucide-react'

type Tab = 'workflows' | 'sekvenser' | 'triggers'

interface Props {
  onSelectTab: (tab: Tab) => void
}

const NAV_CARDS: { tab: Tab; label: string; desc: string; icon: typeof Zap; color: string; border: string; bg: string }[] = [
  {
    tab: 'workflows',
    label: 'Workflows',
    desc: 'Skapa och redigera AI-drivna arbetsflöden med noder',
    icon: GitBranch,
    color: 'text-blue-400',
    border: 'hover:border-blue-400/40',
    bg: 'bg-blue-400/10 border-blue-400/20 group-hover:bg-blue-400/15',
  },
  {
    tab: 'sekvenser',
    label: 'Sekvenser',
    desc: 'Kombinera flera workflows som körs i ordning',
    icon: ListOrdered,
    color: 'text-violet-400',
    border: 'hover:border-violet-400/40',
    bg: 'bg-violet-400/10 border-violet-400/20 group-hover:bg-violet-400/15',
  },
  {
    tab: 'triggers',
    label: 'Triggers',
    desc: 'Lägg till knappar i Projekt, Förslag och fler sektioner',
    icon: Zap,
    color: 'text-amber-400',
    border: 'hover:border-amber-400/40',
    bg: 'bg-amber-400/10 border-amber-400/20 group-hover:bg-amber-400/15',
  },
]

export function WorkflowsWelcome({ onSelectTab }: Props) {
  return (
    <div className="relative h-full overflow-hidden flex flex-col items-center justify-center gap-12">

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center gap-5" style={{ animation: 'fadeUp 0.5s ease-out both' }}>
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl blur-xl opacity-40"
               style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%)' }} />
          <div className="relative w-16 h-16 rounded-2xl bg-elevated border border-border/80 flex items-center justify-center shadow-xl">
            <Zap size={26} className="text-blue-400" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-fg tracking-tight">Workflows</h2>
          <p className="text-sm text-muted mt-1.5 max-w-sm leading-relaxed">
            Automatisera dina processer med AI-drivna arbetsflöden
          </p>
        </div>
      </div>

      {/* Nav cards */}
      <div className="relative z-10 flex gap-3" style={{ animation: 'fadeUp 0.5s ease-out 0.1s both' }}>
        {NAV_CARDS.map(({ tab, label, desc, icon: Icon, color, border, bg }) => (
          <button
            key={tab}
            onClick={() => onSelectTab(tab)}
            className={`group flex flex-col items-start gap-3 w-48 p-4 bg-elevated border border-border rounded-xl ${border} hover:bg-hover transition-all duration-200 hover:-translate-y-0.5 text-left`}
          >
            <div className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${bg}`}>
              <Icon size={16} className={color} />
            </div>
            <div>
              <p className="text-xs font-semibold text-fg">{label}</p>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
