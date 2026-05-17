import { useState, useRef, useEffect } from 'react'
import { Database, Sparkles, CheckCircle2, ChevronUp, ChevronDown, Pencil, X, Save, Plus } from 'lucide-react'
import type { WorkflowNode, WorkflowNodeType, WorkflowNodeCategory, AiAssistent } from '../types'
import type { EpostMall, EpostAlias } from '../../epost/types'
import { SelectField } from '@/components/SelectField'

// ── Node metadata ──────────────────────────────────────────────────────────

export interface NodeMeta {
  label: string
  category: WorkflowNodeCategory
  description: string
}

export const NODE_META: Record<WorkflowNodeType, NodeMeta> = {
  'data:projekt':              { label: 'Projekt',             category: 'data',   description: 'Hämtar projektdata med kund och ROT-inställningar' },
  'data:projekt:anteckningar': { label: 'Projektanteckningar', category: 'data',   description: 'Hämtar alla anteckningar för projektet' },
  'data:projekt:dokument':     { label: 'Projektfiler',        category: 'data',   description: 'Hämtar och laddar ner alla filer kopplade till projektet' },
  'data:projekt:dokument-text':{ label: 'Projektfiler — text', category: 'data',   description: 'Extraherar plain text från alla PDF-filer på projektet (fungerar med alla AI-providers, även de som inte stöder PDF-blobs)' },
  'data:projekt:text-files':   { label: 'Projektfiler — alla dokument', category: 'data', description: 'Läser alla textbaserade dokument (PDF, .md, .txt) och returnerar innehållet. Används av Generera faser.' },
  'data:fas-mallar':           { label: 'Fas-mallar',          category: 'data',   description: 'Hämtar alla aktiva fas-mallar med faser och subfaser' },
  'data:yrkesroller':          { label: 'Yrkesroller',         category: 'data',   description: 'Hämtar alla aktiva yrkesroller med timpris' },
  'data:context':              { label: 'Hämta kontext',       category: 'data',   description: 'Läser ett sparat värde från projektets kontext' },
  'data:forslag-faser':        { label: 'Förslag — faser & timmar', category: 'data', description: 'Hämtar faser, subfaser och arbetstimmar från det senaste utkastförslaget' },
  'data:forslag-faser-for-ai': { label: 'Förslag — faser för AI', category: 'data', description: 'Konverterar ett specifikt förslags struktur till projekt_faser_urval + arbetskostnad_urval kompatibelt med Materialbehovsestimator' },
  'data:forslag-komplett':     { label: 'Förslag — nuläge komplett', category: 'data', description: 'Hämtar ett specifikt förslag med alla faser, subfaser, material och arbete som läsbar text för AI' },
  'ai:generate':               { label: 'AI — Generera',       category: 'ai',     description: 'Skickar insamlad data till AI och returnerar svar' },
  'ai:analyze-bilder':         { label: 'AI — Analysera bilder', category: 'ai',   description: 'Analyserar projektbilder med AI-vision' },
  'ai:analyze-pdf':            { label: 'AI — Analysera PDF',  category: 'ai',     description: 'Analyserar PDF-dokument och extraherar relevant information' },
  'action:save-context':           { label: 'Spara kontext',             category: 'action', description: 'Sparar ett värde till projektets kontext för framtida workflows' },
  'action:create-forslag':         { label: 'Skapa förslag',             category: 'action', description: 'Skapar ett nytt förslag kopplat till projektet' },
  'action:use-mall-direct':        { label: 'Ladda mall direkt',          category: 'action', description: 'Laddar vald fas-mall med alla faser och subfaser utan AI-urval' },
  'action:add-faser-to-forslag':   { label: 'Lägg till faser i förslag', category: 'action', description: 'Lägger till valda faser och subfaser i det skapade förslaget' },
  'action:match-material-katalog': { label: 'Matcha material mot katalog',    category: 'action', description: 'Söker varje estimerat material i katalogen och berikar med pris och leverantör' },
  'action:search-web-price':         { label: 'Sök pris på webben',              category: 'action', description: 'Hämtar pris från webben för material som saknas i katalogen' },
  'action:fill-forslag-kostnader':   { label: 'Fyll i förslag med kostnader',    category: 'action', description: 'Skapar material- och arbetskostnadsrader i det senaste utkastförslaget' },
  'action:apply-revisor-corrections':{ label: 'Applicera revisorns korrigeringar', category: 'action', description: 'Läser ai_output.korrigeringar och applicerar dem på arbete/material/material_webb-listorna i kontext' },
  'action:create-tidplan':           { label: 'Skapa tidplan',                   category: 'action', description: 'Skapar kalenderhändelser per fas och uppdaterar förslaget med start/slut-datum' },
  'action:import-forslag-from-extraction': { label: 'Importera förslag från extraktion', category: 'action', description: 'Skapar förslag, faser, subfaser, arbete, material och kalenderhändelser ordagrant från AI-extraherad PDF-struktur' },
  'action:send-epost':               { label: 'Skicka e-post',                   category: 'action', description: 'Skickar e-post med vald mall direkt via Zoho' },
  'action:queue-epost':              { label: 'Köa e-post',                      category: 'action', description: 'Lägger e-post i kön för schemalagt utskick' },
  'action:create-fas-mall-from-ai':  { label: 'Skapa fas-mall',                  category: 'action', description: 'Skapar en ny fas-mall i Inställningar med faser och subfaser från AI-output' },
  'action:add-missing-to-forslag':           { label: 'Lägg till saknade poster',            category: 'action', description: 'Lägger till faser, subfaser, material och arbete som saknas i förslaget — tar aldrig bort befintligt innehåll' },
  'action:fill-missing-forslag-kostnader':   { label: 'Fyll i saknade materialkostnader',    category: 'action', description: 'Infogar katalogmatchade material ENBART i subfaser som saknar materialrader — rör aldrig befintligt innehåll' },
}

const CATEGORY_STYLES: Record<WorkflowNodeCategory, { border: string; icon: string }> = {
  data:   { border: 'border-l-blue-400/70',    icon: 'text-blue-400' },
  ai:     { border: 'border-l-violet-400/70',  icon: 'text-violet-400' },
  action: { border: 'border-l-emerald-400/70', icon: 'text-emerald-400' },
}

function CategoryIcon({ category, size = 14 }: { category: WorkflowNodeCategory; size?: number }) {
  if (category === 'data') return <Database size={size} />
  if (category === 'ai') return <Sparkles size={size} />
  return <CheckCircle2 size={size} />
}

// ── Config components ──────────────────────────────────────────────────────

function AiGenerateConfig({
  config,
  asistenter,
  onChange
}: {
  config: Record<string, unknown>
  asistenter: AiAssistent[]
  onChange: (patch: Record<string, unknown>) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">AI-assistent</label>
        <SelectField
          value={(config.assistent_id as string) ?? ''}
          onChange={(v) => onChange({ assistent_id: v })}
          placeholder="Välj assistent..."
          options={asistenter.map((a) => ({ value: a.id, label: a.namn }))}
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Prompt-mall</label>
        <p className="text-[10px] text-subtle mb-1.5">
          Använd <code className="bg-elevated px-0.5 rounded">{`{{variabel}}`}</code> för att infoga data från tidigare noder.
        </p>
        <textarea
          value={(config.prompt_template as string) ?? ''}
          onChange={(e) => onChange({ prompt_template: e.target.value })}
          rows={8}
          placeholder="PROJEKT: {{namn}}&#10;KUND: {{kunder.namn}}"
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-muted font-mono resize-none focus:outline-none focus:border-blue-400/60 placeholder:text-subtle"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Hoppa över om tomt</label>
        <p className="text-[10px] text-subtle mb-1.5">
          Komma-separerade nycklar. Om alla är tomma strängar körs inte AI-anropet.
        </p>
        <input
          value={Array.isArray(config.skip_if_empty) ? (config.skip_if_empty as string[]).join(', ') : ''}
          onChange={(e) => {
            const keys = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
            onChange({ skip_if_empty: keys.length > 0 ? keys : undefined })
          }}
          placeholder="t.ex. bild_analys, pdf_analys"
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-muted font-mono focus:outline-none focus:border-blue-400/60 placeholder:text-subtle"
        />
      </div>
    </div>
  )
}

function AiAnalysisConfig({
  config,
  asistenter,
  onChange,
  placeholder
}: {
  config: Record<string, unknown>
  asistenter: AiAssistent[]
  onChange: (patch: Record<string, unknown>) => void
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">AI-assistent</label>
        <SelectField
          value={(config.assistent_id as string) ?? ''}
          onChange={(v) => onChange({ assistent_id: v })}
          placeholder="Välj assistent..."
          options={asistenter.map((a) => ({ value: a.id, label: a.namn }))}
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Instruktion</label>
        <textarea
          value={(config.prompt as string) ?? ''}
          onChange={(e) => onChange({ prompt: e.target.value })}
          rows={5}
          placeholder={placeholder}
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-muted font-mono resize-none focus:outline-none focus:border-blue-400/60 placeholder:text-subtle"
        />
      </div>
    </div>
  )
}

function CreateForslagConfig({
  config,
  onChange
}: {
  config: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Giltighetstid (dagar)</label>
        <input
          type="number"
          min={1}
          value={(config.giltig_dagar as number) ?? 30}
          onChange={(e) => onChange({ giltig_dagar: parseInt(e.target.value) || 30 })}
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-muted focus:outline-none focus:border-blue-400/60"
        />
        <p className="text-[10px] text-subtle mt-1">Antal dagar från körning tills förslaget går ut.</p>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Moms (%)</label>
        <input
          type="number"
          min={0}
          max={100}
          value={(config.moms_procent as number) ?? 25}
          onChange={(e) => onChange({ moms_procent: parseInt(e.target.value) || 25 })}
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-muted focus:outline-none focus:border-blue-400/60"
        />
      </div>
    </div>
  )
}

function ContextKeyConfig({
  config,
  onChange,
  hint
}: {
  config: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
  hint: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Nyckel</label>
        <input
          value={(config.nyckel as string) ?? ''}
          onChange={(e) => onChange({ nyckel: e.target.value })}
          placeholder="t.ex. scope_analys"
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-muted font-mono focus:outline-none focus:border-blue-400/60 placeholder:text-subtle"
        />
        <p className="text-[10px] text-subtle mt-1">{hint}</p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={(config.optional as boolean) ?? false}
          onChange={(e) => onChange({ optional: e.target.checked })}
          className="accent-blue-400"
        />
        <span className="text-xs text-muted">Valfri — fortsätt om nyckeln saknas</span>
      </label>
    </div>
  )
}

function TidplanConfig({
  config,
  onChange
}: {
  config: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Startdatum</label>
        <input
          type="date"
          value={(config.startdatum as string) ?? ''}
          onChange={(e) => onChange({ startdatum: e.target.value })}
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-muted focus:outline-none focus:border-blue-400/60"
        />
        <p className="text-[10px] text-subtle mt-1">Lämna tomt för att använda idag som startdatum.</p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={(config.rensa_befintliga as boolean) !== false}
          onChange={(e) => onChange({ rensa_befintliga: e.target.checked })}
          className="accent-blue-400"
        />
        <span className="text-xs text-muted">Ta bort befintliga heldag-events för projektet innan generering</span>
      </label>
    </div>
  )
}

function EpostConfig({
  config,
  mallar,
  alias,
  onChange,
  showSchema,
}: {
  config: Record<string, unknown>
  mallar: EpostMall[]
  alias: EpostAlias[]
  onChange: (patch: Record<string, unknown>) => void
  showSchema: boolean
}) {
  const tillSource = (config.till_source as string) || 'kund_email'
  const aktivaMallar = mallar.filter(m => m.aktiv)
  const aktivaAlias = alias.filter(a => a.aktiv)
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">E-postmall</label>
        <SelectField
          value={(config.mall_id as string) ?? ''}
          onChange={(v) => onChange({ mall_id: v })}
          placeholder="Välj mall..."
          options={aktivaMallar.map((m) => ({ value: m.id, label: m.namn }))}
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Alias (valfritt — annars mallens eller standard)</label>
        <SelectField
          value={(config.alias_id as string) ?? ''}
          onChange={(v) => onChange({ alias_id: v })}
          placeholder="— mallen eller standard —"
          options={aktivaAlias.map((a) => ({ value: a.id, label: a.etikett || a.fran_adress }))}
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Mottagare</label>
        <SelectField
          value={tillSource}
          onChange={(v) => onChange({ till_source: v })}
          options={[
            { value: 'kund_email', label: 'Projektets kund (kund_email)' },
            { value: 'manual', label: 'Manuell adress' },
          ]}
        />
      </div>
      {tillSource === 'manual' && (
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Manuell mottagaradress</label>
          <input
            value={(config.till_manual as string) ?? ''}
            onChange={(e) => onChange({ till_manual: e.target.value })}
            placeholder="namn@exempel.se"
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-muted focus:outline-none focus:border-blue-400/60 placeholder:text-subtle"
          />
        </div>
      )}
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">CC (valfritt)</label>
        <input
          value={(config.cc as string) ?? ''}
          onChange={(e) => onChange({ cc: e.target.value })}
          placeholder="kopia@exempel.se"
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-muted focus:outline-none focus:border-blue-400/60 placeholder:text-subtle"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Bilaga från kontextnyckel (valfritt)</label>
        <input
          value={(config.bilaga_kalla as string) ?? ''}
          onChange={(e) => onChange({ bilaga_kalla: e.target.value })}
          placeholder="t.ex. bilagor"
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-muted font-mono focus:outline-none focus:border-blue-400/60 placeholder:text-subtle"
        />
        <p className="text-[10px] text-subtle mt-1">Namn på en variabel som tidigare nod lagt i collectedData som EpostBilagaRef[].</p>
      </div>
      {showSchema && (
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Schemalägg om (minuter)</label>
          <input
            type="number"
            min={0}
            value={(config.schemalagd_om_minuter as number) ?? 60}
            onChange={(e) => onChange({ schemalagd_om_minuter: parseInt(e.target.value) || 0 })}
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-muted focus:outline-none focus:border-blue-400/60"
          />
          <p className="text-[10px] text-subtle mt-1">Antal minuter från körning tills e-posten skickas.</p>
        </div>
      )}
    </div>
  )
}

// ── NodeCard ───────────────────────────────────────────────────────────────

interface Props {
  node: WorkflowNode
  index: number
  total: number
  asistenter: AiAssistent[]
  mallar: EpostMall[]
  alias: EpostAlias[]
  onUpdate: (id: string, patch: Partial<WorkflowNode>) => void
  onDelete: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export function NodeCard({ node, index, total, asistenter, mallar, alias, onUpdate, onDelete, onMoveUp, onMoveDown }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editLabel, setEditLabel] = useState(node.label)
  const [editConfig, setEditConfig] = useState(node.config)

  const meta = NODE_META[node.type] ?? { label: node.type, category: 'data' as WorkflowNodeCategory, description: '' }
  const styles = CATEGORY_STYLES[meta.category]

  function handleSave() {
    onUpdate(node.id, { label: editLabel, config: editConfig })
    setExpanded(false)
  }

  function handleConfigChange(patch: Record<string, unknown>) {
    setEditConfig((prev) => ({ ...prev, ...patch }))
  }

  function configSummary(): string {
    if (node.type === 'ai:generate' || node.type === 'ai:analyze-bilder' || node.type === 'ai:analyze-pdf') {
      const a = asistenter.find((x) => x.id === node.config.assistent_id)
      return a ? a.namn : 'Ingen assistent vald'
    }
    if (node.type === 'data:context') {
      return `Nyckel: ${(node.config.nyckel as string) || '(ej vald)'}`
    }
    if (node.type === 'action:save-context') {
      const src = (node.config.source_key as string) || 'ai_raw'
      const key = (node.config.nyckel as string) || '(ej namngiven)'
      return `${src} → ${key}`
    }
    if (node.type === 'action:create-forslag') {
      const d = (node.config.giltig_dagar as number) ?? 30
      const m = (node.config.moms_procent as number) ?? 25
      return `Giltig: ${d} dagar · Moms: ${m}%`
    }
    if (node.type === 'action:match-material-katalog' || node.type === 'action:search-web-price') {
      const a = asistenter.find((x) => x.id === node.config.assistent_id)
      return a ? `AI-fallback: ${a.namn}` : 'Ingen AI-fallback konfigurerad'
    }
    if (node.type === 'action:create-tidplan') {
      const d = (node.config.startdatum as string) || ''
      return d ? `Startdatum: ${d}` : 'Startdatum: idag vid körning'
    }
    if (node.type === 'action:send-epost' || node.type === 'action:queue-epost') {
      const m = mallar.find(x => x.id === node.config.mall_id)
      const tillKalla = (node.config.till_source as string) === 'manual'
        ? ((node.config.till_manual as string) || '(ingen adress)')
        : 'kund'
      const namn = m?.namn ?? '(ingen mall)'
      if (node.type === 'action:queue-epost') {
        const min = (node.config.schemalagd_om_minuter as number) ?? 60
        return `${namn} → ${tillKalla} · +${min} min`
      }
      return `${namn} → ${tillKalla}`
    }
    return meta.description
  }

  return (
    <div className={`border border-border border-l-2 ${styles.border} bg-elevated rounded-lg overflow-hidden transition-all`}>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <span className={styles.icon}>
          <CategoryIcon category={meta.category} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-fg truncate">{node.label}</p>
          {!expanded && (
            <p className="text-[11px] text-muted truncate mt-0.5">{configSummary()}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onMoveUp(node.id)} disabled={index === 0}
            className="p-1 rounded hover:bg-hover text-subtle hover:text-fg disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
            <ChevronUp size={13} />
          </button>
          <button onClick={() => onMoveDown(node.id)} disabled={index === total - 1}
            className="p-1 rounded hover:bg-hover text-subtle hover:text-fg disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
            <ChevronDown size={13} />
          </button>
          <button
            onClick={() => { setExpanded(!expanded); setEditLabel(node.label); setEditConfig(node.config) }}
            className={`p-1 rounded hover:bg-hover transition-colors ${expanded ? 'text-fg' : 'text-subtle hover:text-fg'}`}>
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(node.id)}
            className="p-1 rounded hover:bg-hover text-subtle hover:text-red-400 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-3.5 py-3 flex flex-col gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">Nod-etikett</label>
            <input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-muted focus:outline-none focus:border-blue-400/60"
            />
          </div>
          {node.type === 'ai:generate' && (
            <AiGenerateConfig config={editConfig} asistenter={asistenter} onChange={handleConfigChange} />
          )}
          {node.type === 'ai:analyze-bilder' && (
            <AiAnalysisConfig
              config={editConfig}
              asistenter={asistenter}
              onChange={handleConfigChange}
              placeholder="Beskriv vad du ser i dessa byggprojektbilder: utrymmen, mått, material, installationer och allt relevant för ett renoverings- eller byggprojekt."
            />
          )}
          {node.type === 'ai:analyze-pdf' && (
            <AiAnalysisConfig
              config={editConfig}
              asistenter={asistenter}
              onChange={handleConfigChange}
              placeholder="Analysera detta dokument och extrahera: mått, tekniska specifikationer, krav och allt relevant för ett bygge- eller renoveringsprojekt."
            />
          )}
          {node.type === 'action:create-forslag' && (
            <CreateForslagConfig config={editConfig} onChange={handleConfigChange} />
          )}
          {node.type === 'data:context' && (
            <ContextKeyConfig config={editConfig} onChange={handleConfigChange} hint="Läser värdet med detta namn från projektets kontext." />
          )}
          {node.type === 'action:save-context' && (
            <ContextKeyConfig config={editConfig} onChange={handleConfigChange} hint="Sparar AI-svaret under detta namn i projektets kontext." />
          )}
          {node.type === 'action:create-tidplan' && (
            <TidplanConfig config={editConfig} onChange={handleConfigChange} />
          )}
          {(node.type === 'action:send-epost' || node.type === 'action:queue-epost') && (
            <EpostConfig
              config={editConfig}
              mallar={mallar}
              alias={alias}
              onChange={handleConfigChange}
              showSchema={node.type === 'action:queue-epost'}
            />
          )}
          {(node.type === 'action:match-material-katalog' || node.type === 'action:search-web-price') && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">AI-assistent för fallback (valfritt)</label>
              <SelectField
                value={(editConfig.assistent_id as string) ?? ''}
                onChange={(v) => handleConfigChange({ assistent_id: v })}
                placeholder="Ingen AI-fallback"
                options={asistenter.map((a) => ({ value: a.id, label: a.namn }))}
              />
              <p className="text-[10px] text-subtle mt-1">
                {node.type === 'action:match-material-katalog'
                  ? 'Om katalogmatchning misslyckas ber AI välja eller estimera pris.'
                  : 'Om webbsökning misslyckas estimerar AI ett realistiskt marknadspris.'}
              </p>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-elevated border border-border rounded text-xs text-fg hover:bg-hover transition-colors">
              <Save size={12} />
              Spara
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Connector ──────────────────────────────────────────────────────────────

export function NodeConnector({ animating = false }: { animating?: boolean }) {
  return (
    <div className="flex flex-col items-center py-0.5">
      <div className={`w-px h-4 ${animating ? 'bg-blue-400/60' : 'bg-border'} transition-colors`} />
      <ChevronDown size={12} className={animating ? 'text-blue-400' : 'text-subtle'} />
    </div>
  )
}

// ── Add node dropdown ──────────────────────────────────────────────────────

export const NODE_GROUPS: { label: string; types: WorkflowNodeType[] }[] = [
  { label: 'Data',     types: ['data:projekt', 'data:projekt:anteckningar', 'data:projekt:dokument', 'data:projekt:dokument-text', 'data:fas-mallar', 'data:yrkesroller', 'data:context', 'data:forslag-faser'] },
  { label: 'AI',       types: ['ai:generate', 'ai:analyze-bilder', 'ai:analyze-pdf'] },
  { label: 'Åtgärder', types: ['action:save-context', 'action:create-forslag', 'action:add-faser-to-forslag', 'action:match-material-katalog', 'action:search-web-price', 'action:fill-forslag-kostnader', 'action:apply-revisor-corrections', 'action:create-tidplan', 'action:import-forslag-from-extraction', 'action:send-epost', 'action:queue-epost', 'action:create-fas-mall-from-ai'] },
]

const TAB_CONFIG: { cat: WorkflowNodeCategory; label: string; border: string }[] = [
  { cat: 'data',   label: 'Data',      border: 'border-blue-400' },
  { cat: 'ai',     label: 'AI',        border: 'border-violet-400' },
  { cat: 'action', label: 'Åtgärder',  border: 'border-emerald-400' },
]

const GROUP_BY_CAT: Record<WorkflowNodeCategory, WorkflowNodeType[]> = {
  data:   NODE_GROUPS.find(g => g.label === 'Data')!.types,
  ai:     NODE_GROUPS.find(g => g.label === 'AI')!.types,
  action: NODE_GROUPS.find(g => g.label === 'Åtgärder')!.types,
}

export function AddNodeButton({ onAdd }: { onAdd: (type: WorkflowNodeType) => void }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkflowNodeCategory>('data')
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, openUp: false })
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const PANEL_HEIGHT = 300

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const openUp = r.bottom + PANEL_HEIGHT > window.innerHeight - 32
      setPanelPos({
        top: openUp ? r.top - PANEL_HEIGHT - 8 : r.bottom + 8,
        left: r.left + r.width / 2,
        openUp,
      })
    }
    setOpen(v => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded-lg text-xs text-muted hover:text-fg hover:border-subtle transition-colors"
      >
        <Plus size={12} />
        Lägg till nod
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed z-50 bg-elevated border border-border rounded-xl shadow-xl w-[400px]"
          style={{ top: panelPos.top, left: panelPos.left, transform: 'translateX(-50%)', transformOrigin: panelPos.openUp ? 'bottom center' : 'top center' }}
        >
          {/* Tab bar */}
          <div className="flex border-b border-border">
            {TAB_CONFIG.map(({ cat, label, border }) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === cat
                    ? `text-fg border-b-2 -mb-px ${border}`
                    : 'text-muted hover:text-fg'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Node grid */}
          <div className="p-2 grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
            {GROUP_BY_CAT[activeTab].map((type) => {
              const m = NODE_META[type]
              const s = CATEGORY_STYLES[m.category]
              return (
                <button
                  key={type}
                  onClick={() => { onAdd(type); setOpen(false) }}
                  className="text-left p-2.5 rounded-lg hover:bg-hover transition-colors flex items-start gap-2"
                >
                  <span className={`${s.icon} mt-0.5 shrink-0`}>
                    <CategoryIcon category={m.category} size={13} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-fg leading-tight">{m.label}</p>
                    <p className="text-[10px] text-subtle mt-0.5 leading-snug line-clamp-2">{m.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
