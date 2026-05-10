import { useState, useEffect } from 'react'
import { Database, Sparkles, CheckCircle2, ChevronDown, ChevronRight, Copy, Check, Loader2, Info, X } from 'lucide-react'
import { NODE_META } from './NodeCard'
import type { WorkflowNodeType, WorkflowNodeCategory } from '../types'

const CATEGORY_STYLES: Record<WorkflowNodeCategory, { border: string; icon: string }> = {
  data:   { border: 'border-l-blue-400/70',    icon: 'text-blue-400' },
  ai:     { border: 'border-l-violet-400/70',  icon: 'text-violet-400' },
  action: { border: 'border-l-emerald-400/70', icon: 'text-emerald-400' },
}

const FILTERS: { id: WorkflowNodeCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Alla' },
  { id: 'data', label: 'Data' },
  { id: 'ai', label: 'AI' },
  { id: 'action', label: 'Åtgärder' },
]

function CategoryIcon({ category, size = 14 }: { category: WorkflowNodeCategory; size?: number }) {
  if (category === 'data') return <Database size={size} />
  if (category === 'ai') return <Sparkles size={size} />
  return <CheckCircle2 size={size} />
}

const TEMPLATE_MOLDS: { mall: string; täcker: string }[] = [
  { mall: 'Data: query',                       täcker: 'tabell + filter + kolumner — täcker "läs från databas"' },
  { mall: 'Action: insert / update / delete',  täcker: 'tabell + fältmappning från context — täcker "skriv till databas"' },
  { mall: 'Action: HTTP',                      täcker: 'metod + URL med {{vars}} + headers + body — täcker extern integration' },
  { mall: 'AI: prompt',                        täcker: 'assistent + promptmall med {{vars}} — finns redan som ai:generate' },
  { mall: 'Action: skicka e-post',             täcker: 'alias + mall + refs — finns redan som action:send-epost' },
  { mall: 'Logic: branch',                     täcker: 'villkor → fortsätt eller hoppa över — för förgrening' },
  { mall: 'Logic: transform',                  täcker: 'pick / rename / filter av context-nycklar — för omformning' },
]

function InfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-elevated border border-border rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-elevated">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted">Framtida funktion</p>
            <h3 className="text-base font-semibold text-fg">Anpassade noder via mallar</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-muted hover:text-fg hover:bg-hover transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5 text-sm text-fg">
          <section>
            <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Problem</p>
            <p className="text-muted leading-relaxed">
              Användare i appen behöver ibland en specifik nod som inte finns inbyggd. I en multi-user-app kan vi <strong>inte</strong> låta dem skriva råkod (eval) — det skulle ge full Node-access (filsystem, nätverk, Supabase service key, andra användares data).
            </p>
          </section>

          <section>
            <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Lösning — deklarativa mallar</p>
            <p className="text-muted leading-relaxed mb-3">
              Vi definierar några få väldesignade <em>mallar</em>. Användaren skapar nya noder genom att välja en mall och fylla i fält. <strong>Ingen kod.</strong> Användaren ger noden ett namn, en kategori och konfiguration — den dyker sen upp i workflow-editorn precis som en inbyggd nod.
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-bg">
                  <tr className="text-left text-muted">
                    <th className="px-3 py-2 font-medium">Mall</th>
                    <th className="px-3 py-2 font-medium">Täcker</th>
                  </tr>
                </thead>
                <tbody>
                  {TEMPLATE_MOLDS.map((row) => (
                    <tr key={row.mall} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-fg whitespace-nowrap">{row.mall}</td>
                      <td className="px-3 py-2 text-muted">{row.täcker}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-subtle mt-2">
              Med dessa 6–7 mallar täcker vi ~80 % av verksamhetsfall. HTTP-mallen ensam låser upp integration med vilken extern tjänst som helst.
            </p>
          </section>

          <section>
            <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Arkitektur</p>
            <ol className="list-decimal pl-5 text-muted leading-relaxed space-y-1">
              <li>Tabell <code className="bg-bg px-1 rounded font-mono text-[11px]">workflow_custom_nodes</code> i Supabase med <code className="bg-bg px-1 rounded font-mono text-[11px]">type</code>, <code className="bg-bg px-1 rounded font-mono text-[11px]">label</code>, <code className="bg-bg px-1 rounded font-mono text-[11px]">category</code>, <code className="bg-bg px-1 rounded font-mono text-[11px]">mall_typ</code>, <code className="bg-bg px-1 rounded font-mono text-[11px]">config</code></li>
              <li>Motorn <code className="bg-bg px-1 rounded font-mono text-[11px]">workflows.ts</code>: när en nodtyp inte finns i <code className="bg-bg px-1 rounded font-mono text-[11px]">NODE_EXECUTORS</code>, slå upp i <code className="bg-bg px-1 rounded font-mono text-[11px]">workflow_custom_nodes</code> och kör motsvarande mall-executor med användarens config</li>
              <li>Renderer slår ihop <code className="bg-bg px-1 rounded font-mono text-[11px]">NODE_META</code> (inbyggda) med <code className="bg-bg px-1 rounded font-mono text-[11px]">db:custom-nodes:list</code> så båda visas i editorn</li>
              <li>Ny vy "Skapa anpassad nod" här i Avancerat → välj mall, fyll i fält, spara</li>
            </ol>
          </section>

          <section>
            <p className="text-[11px] uppercase tracking-widest text-muted mb-2">När?</p>
            <p className="text-muted leading-relaxed">
              Bygg när det börjar göra ont. Tills dess: användare rapporterar behov → vi implementerar noden inbyggt och släpper i ny version. När 3+ förfrågningar passar samma mönster, då bygger vi mallen.
            </p>
          </section>

          <section>
            <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Uppskattning</p>
            <p className="text-muted leading-relaxed">
              ~150 LoC för motorn (registry + dispatcher) + en executor och en config-vy per mall. Kan börja med 2 mallar (HTTP + Query) och växa utifrån användning.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export function WorkflowNodesPanel() {
  const [sources, setSources] = useState<Record<string, string> | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<WorkflowNodeCategory | 'all'>('all')
  const [copied, setCopied] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    window.api.invoke('db:workflow-nodes:list')
      .then((data) => setSources(data as Record<string, string>))
      .catch(() => setSources({}))
  }, [])

  function toggle(type: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  async function copy(type: string, code: string) {
    await navigator.clipboard.writeText(code)
    setCopied(type)
    setTimeout(() => setCopied(c => (c === type ? null : c)), 1500)
  }

  if (sources === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={18} className="text-muted animate-spin" />
      </div>
    )
  }

  const allTypes = Object.keys(NODE_META) as WorkflowNodeType[]
  const types = filter === 'all'
    ? allTypes
    : allTypes.filter(t => NODE_META[t].category === filter)

  return (
    <div className="px-8 py-6 flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              filter === f.id
                ? 'border-border bg-elevated text-fg'
                : 'border-transparent text-muted hover:text-fg hover:bg-hover'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-subtle">{types.length} noder</span>
        <button
          onClick={() => setShowInfo(true)}
          title="Framtida funktion — anpassade noder"
          className="p-1.5 rounded text-muted hover:text-fg hover:bg-hover transition-colors"
        >
          <Info size={14} />
        </button>
      </div>

      {showInfo && <InfoDialog onClose={() => setShowInfo(false)} />}

      <div className="flex flex-col gap-2">
        {types.map(type => {
          const meta = NODE_META[type]
          const styles = CATEGORY_STYLES[meta.category]
          const isExpanded = expanded.has(type)
          const code = sources[type] ?? '(källkod hittades inte i workflows.ts)'
          const hasSource = sources[type] !== undefined
          return (
            <div key={type} className={`border border-border border-l-2 ${styles.border} bg-elevated rounded-lg overflow-hidden`}>
              <button
                onClick={() => toggle(type)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-hover transition-colors text-left"
              >
                <span className={styles.icon}><CategoryIcon category={meta.category} /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-fg truncate">{meta.label}</p>
                    <code className="text-[10px] text-subtle font-mono truncate">{type}</code>
                  </div>
                  <p className="text-xs text-muted truncate mt-0.5">{meta.description}</p>
                </div>
                {!hasSource && (
                  <span className="text-[10px] text-amber-400 shrink-0">ingen källkod</span>
                )}
                {isExpanded
                  ? <ChevronDown size={14} className="text-subtle shrink-0" />
                  : <ChevronRight size={14} className="text-subtle shrink-0" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border">
                  <div className="flex items-center justify-end px-3 py-1.5 border-b border-border bg-bg">
                    <button
                      onClick={() => copy(type, code)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-muted hover:text-fg hover:bg-hover transition-colors"
                    >
                      {copied === type ? <Check size={11} /> : <Copy size={11} />}
                      {copied === type ? 'Kopierad' : 'Kopiera'}
                    </button>
                  </div>
                  <pre className="px-4 py-3 text-[11px] font-mono text-fg overflow-auto bg-bg whitespace-pre">{code}</pre>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
