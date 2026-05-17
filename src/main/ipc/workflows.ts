import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { supabase } from '../supabase'
import { broadcast } from '../broadcast'
import { executeChatWithAssistent, executeChatWithFiles, executeChatWithWebSearch } from './ai-chat-fn'
import type { FileAttachment } from './ai-chat-fn'
import { sendEpost, applyMall, resolveContext, loadAlias, loggEpostAnteckning } from './epost'
import type { EpostBilagaRef } from './epost'
import type {
  Workflow,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowNodeResult,
  WorkflowRunStatus,
  WorkflowProgressEvent,
  WorkflowRunResult,
  WorkflowRunInput,
} from '../../renderer/src/sections/installningar/types'

// ── Template interpolation ─────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

const ENHET_ALIAS: Record<string, string> = {
  'st': 'st', 'styck': 'st', 'stk': 'st', 'pcs': 'st',
  'm': 'm', 'meter': 'm', 'lpm': 'm', 'löpmeter': 'm', 'lm': 'm',
  'm2': 'm²', 'm²': 'm²', 'kvm': 'm²', 'kvadratmeter': 'm²',
  'm3': 'm³', 'm³': 'm³', 'kbm': 'm³',
  'kg': 'kg', 'kilo': 'kg', 'kilogram': 'kg',
  'liter': 'liter', 'l': 'liter', 'lit': 'liter',
  'förp': 'förp', 'forp': 'förp', 'förpackning': 'förp', 'paket': 'förp',
  'säck': 'säck', 'sack': 'säck', 'säc': 'säck', 'sac': 'säck',
  'rulle': 'rulle', 'rle': 'rulle',
  'burk': 'burk', 'brk': 'burk', 'hink': 'burk',
  'set': 'set', 'kit': 'set',
}

function normalizeEnhet(raw?: string): string {
  if (!raw) return 'st'
  const key = raw.trim().toLowerCase().replace(/\.$/, '')
  if (ENHET_ALIAS[key]) return ENHET_ALIAS[key]
  if (/^kr(\/.*)?$/.test(key) || /^sek/.test(key)) return 'st'
  return key
}

function expectsJson(prompt: string): boolean {
  if (/\b(inga?|inget|ej|ingen|utan)\s+json/i.test(prompt)) return false
  return /\bjson\b/i.test(prompt)
}

// Coerce a context value (which may be a string with fences left over from older
// runs, or already a parsed JSON object) into a structured object. Throws with a
// readable error if the string cannot be parsed.
function parseContextValue<T>(raw: unknown, label: string): T {
  if (raw === null || raw === undefined) {
    throw new Error(`${label} saknas i kontext`)
  }
  if (typeof raw !== 'string') return raw as T
  const parsed = tryParseJson(raw)
  if (parsed === undefined) {
    const head = raw.slice(0, 100).replace(/\s+/g, ' ')
    throw new Error(`${label} kunde inte parsas som JSON. Början: "${head}..."`)
  }
  return parsed as T
}

function tryParseJson(text: string): unknown {
  // Strip code fences anywhere (LLMs sometimes prepend "Here is the JSON:\n```json")
  const stripped = text
    .replace(/```(?:json|JSON)?\s*/g, '')
    .replace(/```/g, '')
    .trim()
  try { return JSON.parse(stripped) } catch { /* fall through */ }
  const first = stripped.search(/[\[{]/)
  if (first < 0) return undefined
  const open = stripped[first]
  const close = open === '{' ? '}' : ']'
  const last = stripped.lastIndexOf(close)
  if (last <= first) return undefined
  try { return JSON.parse(stripped.slice(first, last + 1)) } catch { return undefined }
}

function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const val = getNestedValue(data, path.trim())
    if (val === undefined || val === null) return ''
    if (typeof val === 'boolean') return val ? 'Ja' : 'Nej'
    if (typeof val === 'object') return JSON.stringify(val, null, 2)
    return String(val)
  })
}

// ── Node context ───────────────────────────────────────────────────────────

interface NodeContext {
  run_id: string
  workflowInput: Record<string, unknown>
  collectedData: Record<string, unknown>
  nodeConfig: Record<string, unknown>
  aiChat: (assistent_id: string, messages: { role: 'user' | 'assistant'; content: string }[]) => Promise<string>
}

type NodeExecutorFn = (ctx: NodeContext) => Promise<Record<string, unknown>>

// ── Node executors ─────────────────────────────────────────────────────────

const NODE_EXECUTORS: Partial<Record<WorkflowNodeType, NodeExecutorFn>> = {
  // ── Projekt ───────────────────────────────────────────────────────────────

  'data:projekt': async ({ workflowInput }) => {
    const id = workflowInput.projekt_id as string
    if (!id) throw new Error('projekt_id saknas i workflow input')
    const { data, error } = await supabase
      .from('projekt')
      .select('*, kunder(*)')
      .eq('id', id)
      .single()
    if (error || !data) throw new Error(`Projekt inte hittad: ${error?.message ?? ''}`)
    return data as Record<string, unknown>
  },

  'data:projekt:anteckningar': async ({ workflowInput, collectedData }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')
    const { data, error } = await supabase
      .from('projekt_anteckningar')
      .select('*')
      .eq('projekt_id', projekt_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    const rows = data ?? []
    const anteckningar_text = rows.length > 0
      ? rows.map((a: Record<string, unknown>) => `[${a.titel}]\n${a.innehall}`).join('\n\n')
      : '(inga anteckningar)'
    return { anteckningar: rows, anteckningar_text }
  },

  // ── Projektfiler ─────────────────────────────────────────────────────────

  'data:projekt:dokument': async ({ workflowInput, collectedData }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')

    const { data: rows, error } = await supabase
      .from('projekt_dokument')
      .select('id, filnamn, mime_type, storlek, storage_path, skapad_at')
      .eq('projekt_id', projekt_id)
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)

    const dokument_lista = rows ?? []
    const bilder: FileAttachment[] = []
    const pdf_filer: FileAttachment[] = []

    for (const row of dokument_lista) {
      const isImage = (row.mime_type as string).startsWith('image/')
      const isPdf = row.mime_type === 'application/pdf'
      if (!isImage && !isPdf) continue

      const { data: blob, error: dlErr } = await supabase.storage
        .from('projekt-dokument')
        .download(row.storage_path as string)
      if (dlErr || !blob) continue

      const arrayBuffer = await blob.arrayBuffer()
      const data_base64 = Buffer.from(arrayBuffer).toString('base64')
      const attachment: FileAttachment = {
        filnamn: row.filnamn as string,
        mime_type: row.mime_type as string,
        data_base64,
      }
      if (isImage) bilder.push(attachment)
      else pdf_filer.push(attachment)
    }

    return {
      dokument_lista,
      bilder,
      pdf_filer,
      antal_bilder: bilder.length,
      antal_pdf: pdf_filer.length,
    }
  },

  // ── Projektfiler — extrahera text från PDF:er ──────────────────────────────
  // Reads PDFs uploaded under the project and extracts plain text using
  // pdfjs-dist (no native deps). Returns the concatenated text so that any
  // provider — even ones that don't accept document blobs (OpenAI/OpenRouter
  // text-only chat APIs) — can consume the content via an ai:generate node.

  'data:projekt:dokument-text': async ({ workflowInput, collectedData }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')

    const { data: rows, error } = await supabase
      .from('projekt_dokument')
      .select('id, filnamn, mime_type, storage_path, skapad_at')
      .eq('projekt_id', projekt_id)
      .eq('mime_type', 'application/pdf')
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)

    const pdfRows = rows ?? []
    if (pdfRows.length === 0) {
      return { pdf_text: '', antal_pdf: 0, pdf_filnamn: [] as string[] }
    }

    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')

    const sections: string[] = []
    const filnamn: string[] = []
    for (const row of pdfRows) {
      const { data: blob, error: dlErr } = await supabase.storage
        .from('projekt-dokument')
        .download(row.storage_path as string)
      if (dlErr || !blob) continue

      const arrayBuffer = await blob.arrayBuffer()
      const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise

      const pageTexts: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items
          .map((it) => (it as { str?: string }).str ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (pageText) pageTexts.push(`--- Sida ${i} ---\n${pageText}`)
      }
      filnamn.push(row.filnamn as string)
      sections.push(`=== ${row.filnamn} (${pdf.numPages} sidor) ===\n${pageTexts.join('\n\n')}`)
      try { await pdf.destroy() } catch { /* ignore */ }
    }

    return {
      pdf_text: sections.join('\n\n'),
      antal_pdf: pdfRows.length,
      pdf_filnamn: filnamn,
    }
  },

  // ── Text-based project documents (pdf + md/txt) ───────────────────────────
  // Reads all readable documents uploaded under the project and returns their
  // text content. PDFs are extracted with pdfjs; .md/.txt are read directly.
  // Used by "Generera faser" so fases-subfases.md (or .pdf) is included in
  // the AI prompt instead of being silently skipped.

  'data:projekt:text-files': async ({ workflowInput, collectedData }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')

    const { data: rows, error } = await supabase
      .from('projekt_dokument')
      .select('id, filnamn, mime_type, storage_path')
      .eq('projekt_id', projekt_id)
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)

    const isReadable = (mime: string, name: string): boolean => {
      if (mime === 'application/pdf') return true
      if (mime.startsWith('text/')) return true
      const ext = name.split('.').pop()?.toLowerCase() ?? ''
      return ext === 'md' || ext === 'txt' || ext === 'csv'
    }

    const sections: string[] = []
    const filnamn: string[] = []

    for (const row of (rows ?? [])) {
      const mime = row.mime_type as string
      const name = row.filnamn as string
      if (!isReadable(mime, name)) continue

      const { data: blob, error: dlErr } = await supabase.storage
        .from('projekt-dokument')
        .download(row.storage_path as string)
      if (dlErr || !blob) continue

      let text = ''

      if (mime === 'application/pdf') {
        const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
        const arrayBuffer = await blob.arrayBuffer()
        const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise
        const pages: string[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          const pageText = content.items
            .map((it) => (it as { str?: string }).str ?? '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()
          if (pageText) pages.push(pageText)
        }
        try { await pdf.destroy() } catch { /* ignore */ }
        text = pages.join('\n\n')
      } else {
        text = await blob.text()
      }

      if (!text.trim()) continue
      filnamn.push(name)
      sections.push(`=== ${name} ===\n${text}`)
    }

    return {
      text_dokument: sections.join('\n\n'),
      antal_text: filnamn.length,
      text_filnamn: filnamn,
    }
  },

  // ── AI bildanalys ─────────────────────────────────────────────────────────

  'ai:analyze-bilder': async ({ nodeConfig, collectedData, workflowInput }) => {
    const bilder = (collectedData.bilder as FileAttachment[] | undefined) ?? []
    if (bilder.length === 0) {
      return { bild_analys: '', bilder_analyserade: 0 }
    }
    const assistent_id = (nodeConfig.assistent_id as string) || (workflowInput.assistent_id as string)
    if (!assistent_id) throw new Error('Ingen AI-assistent vald för bildanalys.')
    const prompt = (nodeConfig.prompt as string) ||
      'Beskriv vad du ser i dessa byggprojektbilder: utrymmen, mått, material, installationer och allt relevant för ett renoverings- eller byggprojekt.'
    const text = await executeChatWithFiles(assistent_id, prompt, bilder)
    return { bild_analys: text, bilder_analyserade: bilder.length }
  },

  // ── AI PDF-analys ─────────────────────────────────────────────────────────

  'ai:analyze-pdf': async ({ nodeConfig, collectedData, workflowInput }) => {
    const pdf_filer = (collectedData.pdf_filer as FileAttachment[] | undefined) ?? []
    if (pdf_filer.length === 0) {
      return { pdf_analys: '', pdf_analyserade: 0 }
    }
    const assistent_id = (nodeConfig.assistent_id as string) || (workflowInput.assistent_id as string)
    if (!assistent_id) throw new Error('Ingen AI-assistent vald för PDF-analys.')
    const prompt = (nodeConfig.prompt as string) ||
      'Analysera detta dokument och extrahera: mått, tekniska specifikationer, krav och allt relevant för ett bygge- eller renoveringsprojekt.'
    const text = await executeChatWithFiles(assistent_id, prompt, pdf_filer)
    return { pdf_analys: text, pdf_analyserade: pdf_filer.length }
  },

  // ── Fas-mallar ────────────────────────────────────────────────────────────

  'data:fas-mallar': async () => {
    const { data: mallar, error } = await supabase
      .from('fas_mallar')
      .select(`
        id, namn, beskrivning,
        faser:fas_mall_faser(
          id, namn, sortering,
          subfaser:fas_mall_subfaser(id, namn, sortering)
        )
      `)
      .eq('aktiv', true)
      .order('sortering')
    if (error) throw new Error(error.message)

    if (!mallar || mallar.length === 0) {
      return {
        fas_mallar: [],
        fas_text: '(Inga fas-mallar hittades. Lägg till fas-mallar i Inställningar → Fas-Subfas.)',
      }
    }

    const lines: string[] = []
    for (const mall of mallar) {
      lines.push(`MALL: ${mall.namn}`)
      const faser = [...((mall.faser as { id: string; namn: string; sortering: number; subfaser: { id: string; namn: string; sortering: number }[] }[]) ?? [])].sort((a, b) => a.sortering - b.sortering)
      for (const fas of faser) {
        lines.push(`  FAS: ${fas.namn}`)
        const subfaser = [...(fas.subfaser ?? [])].sort((a, b) => a.sortering - b.sortering)
        for (const sf of subfaser) {
          lines.push(`    - ${sf.namn}`)
        }
      }
      lines.push('')
    }

    return {
      fas_mallar: mallar,
      fas_text: lines.join('\n').trim(),
    }
  },

  // ── Yrkesroller ──────────────────────────────────────────────────────────

  'data:yrkesroller': async () => {
    const { data, error } = await supabase
      .from('arbets_roller')
      .select('id, namn, timpris, enhet')
      .eq('aktiv', true)
      .order('sortering')
    if (error) throw new Error(error.message)
    const rows = data ?? []
    if (rows.length === 0) {
      return {
        yrkesroller: [],
        yrkesroller_text: '(Inga yrkesroller hittades. Lägg till roller i Inställningar → Timpris.)',
      }
    }
    const yrkesroller_text = rows
      .map((r: { namn: string; timpris: number; enhet: string }) => `${r.namn} — ${r.timpris} kr/${r.enhet}`)
      .join('\n')
    return { yrkesroller: rows, yrkesroller_text }
  },

  // ── Kontext ───────────────────────────────────────────────────────────────

  'data:context': async ({ nodeConfig, collectedData, workflowInput }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')
    const nyckel = nodeConfig.nyckel as string
    if (!nyckel) throw new Error('nyckel saknas i data:context konfiguration')
    const optional = (nodeConfig.optional as boolean) ?? false
    const { data, error } = await supabase
      .from('projekt_context')
      .select('varde')
      .eq('projekt_id', projekt_id)
      .eq('nyckel', nyckel)
      .order('skapad_at', { ascending: false })
      .limit(1)
      .single()
    if (error || !data) {
      if (optional) return { [nyckel]: '' }
      throw new Error(`Ingen kontext hittad för nyckel: "${nyckel}"`)
    }
    let varde: unknown = data.varde
    if (typeof data.varde === 'string') {
      const parsed = tryParseJson(data.varde)
      if (parsed !== undefined) varde = parsed
    }
    // Empty string means the save-context node was skipped — treat as not found
    if (varde === '' || varde === null) {
      if (optional) return { [nyckel]: '' }
      throw new Error(`Ingen kontext hittad för nyckel: "${nyckel}"`)
    }
    return { [nyckel]: varde }
  },

  'action:save-context': async ({ run_id, nodeConfig, collectedData, workflowInput }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')
    const nyckel = nodeConfig.nyckel as string
    if (!nyckel) throw new Error('nyckel saknas i action:save-context konfiguration')
    const source_key = (nodeConfig.source_key as string) || 'ai_raw'
    const value = source_key.includes('.')
      ? getNestedValue(collectedData, source_key)
      : collectedData[source_key]
    if (value === undefined) throw new Error(`Nyckel "${source_key}" finns inte i insamlad data`)
    const varde = typeof value === 'string' ? value : JSON.stringify(value)
    if (nodeConfig.skip_if_empty_source === true && varde.trim() === '') {
      return { context_skipped: nyckel, context_source: source_key }
    }
    const { error } = await supabase
      .from('projekt_context')
      .insert({ projekt_id, nyckel, varde, workflow_run_id: run_id })
    if (error) throw new Error(`Kunde inte spara kontext: ${error.message}`)
    return { context_saved: nyckel, context_source: source_key }
  },

  // ── Förslag ───────────────────────────────────────────────────────────────

  'action:create-forslag': async ({ nodeConfig, collectedData, workflowInput }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')

    // Parse projekt_faser_urval — must exist and have a matched mall
    const raw = collectedData.projekt_faser_urval
    if (!raw) throw new Error('projekt_faser_urval saknas i kontext. Kör workflow "Identifiera projekttyp och faser" först.')
    const urval = parseContextValue<Record<string, unknown>>(raw, 'projekt_faser_urval')
    if (urval.saknar_mall === true) {
      throw new Error(
        `Ingen fas-mall hittades för projekttypen "${urval.projekt_typ ?? ''}". ` +
        'Lägg till en lämplig mall i Inställningar → Fas-Subfas och kör om workflow 3.'
      )
    }

    const giltig_dagar = (nodeConfig.giltig_dagar as number) ?? 30
    const moms_procent = (nodeConfig.moms_procent as number) ?? 25
    const projekt_namn = (collectedData.namn as string) || ''
    const kund_namn = ((collectedData.kunder as Record<string, unknown>)?.namn as string) || ''

    const titel = projekt_namn

    const scope = (collectedData.scope_analys as string) || (urval.motivering as string) || ''
    const sammanfattning = scope.length > 600 ? scope.slice(0, 597) + '…' : scope

    const giltig_till = new Date(Date.now() + giltig_dagar * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]

    let forslag: { id: string; forslag_nummer: string; titel: string } | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: numData, error: numErr } = await supabase.rpc('nextval_forslag_nummer')
      if (numErr) throw new Error(`Kunde inte generera förslagnummer: ${numErr.message}`)
      const candidate = String(numData as number)
      const { data: result, error: insertErr } = await supabase
        .from('forslag')
        .insert({ projekt_id, forslag_nummer: candidate, titel, sammanfattning, giltig_till, moms_procent, status: 'utkast' })
        .select('id, forslag_nummer, titel')
        .single()
      if (result && !insertErr) { forslag = result as { id: string; forslag_nummer: string; titel: string }; break }
      // Only retry on unique constraint violation (sequence manually reset to existing value)
      if ((insertErr as { code?: string } | null)?.code !== '23505') throw new Error(`Kunde inte skapa förslag: ${insertErr?.message ?? ''}`)
    }
    if (!forslag) throw new Error('Kunde inte skapa förslag: sekvensnummerkollision')

    await supabase.from('projekt_anteckningar').insert({
      projekt_id,
      titel: `Förslag skapat: ${forslag.forslag_nummer}`,
      innehall: `Förslaget "${forslag.titel}" skapades automatiskt via workflow.\nGiltigt till ${giltig_till}. Moms ${moms_procent}%.`,
      farg: 'emerald',
    }).then(() => {})

    return {
      forslag_id: forslag.id,
      forslag_nummer: forslag.forslag_nummer,
      forslag_titel: forslag.titel,
      forslag_kund: kund_namn,
    }
  },

  'action:use-mall-direct': async ({ workflowInput, collectedData }) => {
    const mall_id = (workflowInput.fas_mall_id ?? collectedData.fas_mall_id) as string
    if (!mall_id) throw new Error('fas_mall_id saknas — välj en fas-mall i kördialogens inmatningsfält')

    type MallFas = { id: string; namn: string; sortering: number; subfaser: { id: string; namn: string; sortering: number }[] }
    const { data: mall, error } = await supabase
      .from('fas_mallar')
      .select('id, namn, beskrivning, faser:fas_mall_faser(id, namn, sortering, subfaser:fas_mall_subfaser(id, namn, sortering))')
      .eq('id', mall_id)
      .single()
    if (error || !mall) throw new Error(`Fas-mall hittades inte: ${error?.message ?? 'okänd mall'}`)

    const faser = [...((mall.faser as MallFas[]) ?? [])].sort((a, b) => a.sortering - b.sortering)
    const valda_faser = faser.map(f => f.namn)
    const valda_subfaser = faser.map(f => ({
      fas: f.namn,
      subfaser: [...(f.subfaser ?? [])].sort((a, b) => a.sortering - b.sortering).map(s => s.namn),
    }))

    const projekt_faser_urval = {
      projekt_typ: (mall as { namn: string }).namn,
      vald_mall: (mall as { namn: string }).namn,
      valda_faser,
      valda_subfaser,
      saknade_faser: [],
      saknar_mall: false,
      motivering: `Manuellt vald mall: ${(mall as { namn: string }).namn}`,
    }

    return { projekt_faser_urval }
  },

  'action:add-faser-to-forslag': async ({ collectedData }) => {
    const forslag_id = collectedData.forslag_id as string
    if (!forslag_id) throw new Error('forslag_id saknas. Lägg till noden "Skapa förslag" före denna.')

    const raw = collectedData.projekt_faser_urval
    if (!raw) throw new Error('projekt_faser_urval saknas i kontext.')
    const urval = parseContextValue<Record<string, unknown>>(raw, 'projekt_faser_urval')

    const vald_mall = (urval.vald_mall as string) || ''
    const valda_faser = (urval.valda_faser as string[]) ?? []
    const valda_subfaser = (urval.valda_subfaser as { fas: string; subfaser: string[] }[]) ?? []

    // Load the matched mall and its faser/subfaser from DB
    // Strip " — <beskrivning>" suffix if AI concatenated name+description
    const mallNamnClean = vald_mall.replace(/\s+—\s+.+$/, '').trim()
    let { data: mall, error: mallErr } = await supabase
      .from('fas_mallar')
      .select('id')
      .ilike('namn', mallNamnClean)
      .single()
    if (mallErr || !mall) throw new Error(`Fas-mall "${vald_mall}" hittades inte. Kontrollera stavningen i Inställningar → Fas-Subfas.`)

    const { data: mallFaser, error: faserErr } = await supabase
      .from('fas_mall_faser')
      .select('id, namn, subfaser:fas_mall_subfaser(id, namn)')
      .eq('mall_id', mall.id)
      .order('sortering')
    if (faserErr) throw new Error(faserErr.message)

    type MallFas = { id: string; namn: string; subfaser: { id: string; namn: string }[] }
    const faserMap = new Map<string, MallFas>((mallFaser as MallFas[]).map((f) => [f.namn.toLowerCase(), f]))

    let faser_tillagda = 0
    let subfaser_tillagda = 0
    const forslagFasMap = new Map<string, string>() // mall_fas_namn → forslag_fas_id

    for (let i = 0; i < valda_faser.length; i++) {
      const fasNamn = valda_faser[i]
      const mallFas = faserMap.get(fasNamn.toLowerCase())
      if (!mallFas) throw new Error(
        `Fasen "${fasNamn}" finns inte i mall "${vald_mall}". ` +
        'Lägg till den i Inställningar → Fas-Subfas eller ta bort den från workflow 3.'
      )

      const { data: forslagFas, error: fasErr } = await supabase
        .from('forslag_faser')
        .insert({ forslag_id, namn: mallFas.namn, sortering: i })
        .select('id')
        .single()
      if (fasErr || !forslagFas) throw new Error(`Kunde inte skapa fas "${fasNamn}": ${fasErr?.message ?? ''}`)

      forslagFasMap.set(fasNamn.toLowerCase(), forslagFas.id)
      faser_tillagda++
    }

    for (const { fas: fasNamn, subfaser } of valda_subfaser) {
      const forslagFasId = forslagFasMap.get(fasNamn.toLowerCase())
      if (!forslagFasId) continue // fas was not selected, skip its subfaser

      const mallFas = faserMap.get(fasNamn.toLowerCase())
      const subfaserMap = new Map<string, string>((mallFas?.subfaser ?? []).map((s) => [s.namn.toLowerCase(), s.namn]))

      for (let j = 0; j < subfaser.length; j++) {
        const sfNamn = subfaser[j]
        const canonicalNamn = subfaserMap.get(sfNamn.toLowerCase())
        if (!canonicalNamn) throw new Error(
          `Subfasen "${sfNamn}" finns inte under fas "${fasNamn}" i mall "${vald_mall}". ` +
          'Lägg till den i Inställningar → Fas-Subfas.'
        )

        const { error: sfErr } = await supabase
          .from('forslag_subfaser')
          .insert({ fas_id: forslagFasId, namn: canonicalNamn, sortering: j })
        if (sfErr) throw new Error(`Kunde inte skapa subfas "${sfNamn}": ${sfErr.message}`)
        subfaser_tillagda++
      }
    }

    return { faser_tillagda, subfaser_tillagda, forslag_id }
  },

  // ── Material katalog ──────────────────────────────────────────────────────

  'action:match-material-katalog': async ({ run_id, nodeConfig, collectedData, workflowInput, aiChat }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')

    const raw = collectedData.material_behov_urval
    if (!raw) throw new Error('material_behov_urval saknas i kontext. Kör workflow "Estimera materialbehov" först.')

    const assistent_id = (nodeConfig.assistent_id as string) || (workflowInput.assistent_id as string) || null

    interface MaterialItem {
      fas: string
      subfas: string
      beskrivning: string
      enhet: string
      antal: number
      sokterm: string
      motivering?: string
    }

    interface KatalogRow {
      id: string
      artikel_nummer: string | null
      namn: string
      enhet: string | null
      a_pris: number
      leverantor_id: string
      similarity_score?: number
    }

    interface MatchResult extends KatalogRow {
      leverantor_namn: string
      match_strategy: 'exact' | 'starts_with' | 'contains' | 'trigram' | 'ai_katalog' | 'ai_pris'
    }

    const behov = parseContextValue<{ material: MaterialItem[] }>(raw, 'material_behov_urval')
    const items = behov.material ?? []

    async function leverantorNamn(leverantor_id: string): Promise<string> {
      const { data } = await supabase.from('leverantorer').select('namn').eq('id', leverantor_id).single()
      return (data as { namn: string } | null)?.namn ?? ''
    }

    const SEL = 'id, artikel_nummer, namn, enhet, a_pris, leverantor_id'

    async function katalogQuery(ilike_pattern: string): Promise<KatalogRow | null> {
      // Try aktiv=true first, then all items (imported catalogs may have aktiv=false)
      const { data: a } = await supabase.from('material_katalog').select(SEL)
        .ilike('namn', ilike_pattern).eq('aktiv', true).limit(1)
      if ((a as KatalogRow[] | null)?.length) return (a as KatalogRow[])[0]
      const { data: b } = await supabase.from('material_katalog').select(SEL)
        .ilike('namn', ilike_pattern).limit(1)
      return (b as KatalogRow[] | null)?.[0] ?? null
    }

    // Plocka första alfabetiska token (≥4 tecken) ur sökterm. Den används som
    // sanity-check att kandidaten faktiskt är samma typ av produkt — annars
    // matchar t.ex. "Brunnsmanschett linjär golvbrunn Purus Line" trigram-mässigt
    // mot själva golvbrunnen (delade ord: linjär, golvbrunn, Purus, Line).
    function pickKeyToken(s: string): string | null {
      for (const tok of s.split(/\s+/)) {
        if (tok.length >= 4 && /^[A-Za-zÅÄÖåäö]+$/.test(tok)) return tok.toLowerCase()
      }
      return null
    }

    async function findBestMatch(item: MaterialItem): Promise<MatchResult | null> {
      const { sokterm, beskrivning, enhet } = item
      const keyToken = pickKeyToken(sokterm)
      const matchesKey = (namn: string): boolean =>
        !keyToken || namn.toLowerCase().includes(keyToken)

      // 1. Exact
      const exact = await katalogQuery(sokterm)
      if (exact) return { ...exact, leverantor_namn: await leverantorNamn(exact.leverantor_id), match_strategy: 'exact' }

      // 2. Starts-with
      const sw = await katalogQuery(`${sokterm}%`)
      if (sw) return { ...sw, leverantor_namn: await leverantorNamn(sw.leverantor_id), match_strategy: 'starts_with' }

      // 3. Contains
      const ct = await katalogQuery(`%${sokterm}%`)
      if (ct) return { ...ct, leverantor_namn: await leverantorNamn(ct.leverantor_id), match_strategy: 'contains' }

      // 4. Trigram similarity ≥ 0.3 — kräver att nyckel-tokenet finns i namn
      const { data: trgm } = await supabase.rpc('find_material_candidates', {
        p_sokterm: sokterm,
        p_min_similarity: 0.3,
        p_limit: 1,
      })
      if (trgm?.length) {
        const row = (trgm as KatalogRow[])[0]
        if (matchesKey(row.namn)) {
          return { ...row, leverantor_namn: await leverantorNamn(row.leverantor_id), match_strategy: 'trigram' }
        }
      }

      // 5. AI picks from catalog candidates (≥ 0.1 similarity)
      if (assistent_id) {
        const { data: candidates } = await supabase.rpc('find_material_candidates', {
          p_sokterm: sokterm,
          p_min_similarity: 0.1,
          p_limit: 10,
        })
        if (candidates?.length) {
          const lista = (candidates as KatalogRow[])
            .map((c, i) => `${i + 1}. ${c.namn} — ${c.a_pris} kr/${c.enhet ?? '?'}`)
            .join('\n')
          const prompt =
            `Välj bäst matchande artikel från katalogen för detta byggmaterial.\n\n` +
            `Sökt: "${beskrivning}" (sökterm: "${sokterm}")\n\n` +
            `Artiklar:\n${lista}\n\n` +
            `Svara ENBART med siffran (1–${(candidates as KatalogRow[]).length}) eller "INGEN" om ingen passar.`
          try {
            const svar = await aiChat(assistent_id, [{ role: 'user', content: prompt }])
            const num = parseInt(svar.trim())
            if (!isNaN(num) && num >= 1 && num <= (candidates as KatalogRow[]).length) {
              const row = (candidates as KatalogRow[])[num - 1]
              if (matchesKey(row.namn)) {
                return { ...row, leverantor_namn: await leverantorNamn(row.leverantor_id), match_strategy: 'ai_katalog' }
              }
            }
          } catch { /* continue to price estimation */ }
        }

        // 6. AI estimates realistic Swedish market price — never stop the workflow
        try {
          const prompt =
            `Estimera ett realistiskt marknadspris i Sverige (exkl. moms) för följande byggmaterial:\n\n` +
            `Beskrivning: "${beskrivning}"\n` +
            `Sökterm: "${sokterm}"\n` +
            `Enhet: "${enhet}"\n\n` +
            `Svara ENBART med ett heltal (pris i SEK per ${enhet}). Inget mer.`
          const svar = await aiChat(assistent_id, [{ role: 'user', content: prompt }])
          const pris = parseFloat(svar.replace(/[^\d.,]/g, '').replace(',', '.'))
          if (!isNaN(pris) && pris > 0) {
            return {
              id: '',
              artikel_nummer: null,
              namn: sokterm,
              enhet,
              a_pris: pris,
              leverantor_id: '',
              leverantor_namn: 'AI-estimat',
              match_strategy: 'ai_pris',
            }
          }
        } catch { /* fall through */ }
      }

      return null
    }

    const enriched: Record<string, unknown>[] = []
    const faltande: { sokterm: string; beskrivning: string; fas: string; subfas: string }[] = []

    for (const item of items) {
      const match = await findBestMatch(item)
      if (match) {
        enriched.push({
          ...item,
          a_pris: match.a_pris,
          enhet: match.enhet ?? item.enhet,
          leverantor: match.leverantor_namn,
          katalog_id: match.id || null,
          artikel_nummer: match.artikel_nummer,
          match_strategy: match.match_strategy,
        })
      } else {
        // No catalog match and no AI available — include with price 0, flagged for review
        enriched.push({
          ...item,
          a_pris: 0,
          leverantor: '',
          katalog_id: null,
          artikel_nummer: null,
          match_strategy: 'okänd',
        })
        faltande.push({ sokterm: item.sokterm, beskrivning: item.beskrivning, fas: item.fas, subfas: item.subfas })
      }
    }

    // Always save material_faltande (items needing catalog import), even if empty
    await supabase.from('projekt_context').insert({
      projekt_id,
      nyckel: 'material_faltande',
      varde: JSON.stringify(faltande),
      workflow_run_id: run_id,
    })

    return {
      materialkostnad_urval: enriched,
      material_faltande: faltande,
      saknar_katalog: faltande.length,
      totalt_material: enriched.length,
    }
  },

  // ── Fyll i förslag ────────────────────────────────────────────────────────

  'action:fill-forslag-kostnader': async ({ collectedData, workflowInput }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')

    const { data: projektRow } = await supabase
      .from('projekt')
      .select('rot_avdrag')
      .eq('id', projekt_id)
      .single()
    const rotEligibleDefault = projektRow?.rot_avdrag === true

    // Find latest utkast förslag for this projekt
    const { data: forslag, error: fErr } = await supabase
      .from('forslag')
      .select('id')
      .eq('projekt_id', projekt_id)
      .eq('status', 'utkast')
      .order('skapad_at', { ascending: false })
      .limit(1)
      .single()
    if (fErr || !forslag) throw new Error(
      'Inget förslag i utkast-status hittades. Kör workflow "Skapa förslag med faser" först.'
    )
    const forslag_id = forslag.id as string

    // Build subfasMap: "fas::subfas" → subfas_id (both tables use subfas_id)
    const { data: fasRows, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id, namn')
      .eq('forslag_id', forslag_id)
    if (fasErr) throw new Error(fasErr.message)

    const fasIds = (fasRows ?? []).map((f: { id: string }) => f.id)
    const fasNamnById = new Map((fasRows ?? []).map((f: { id: string; namn: string }) => [f.id, f.namn]))

    const { data: subfasRows, error: sfErr } = await supabase
      .from('forslag_subfaser')
      .select('id, namn, fas_id')
      .in('fas_id', fasIds.length > 0 ? fasIds : ['__none__'])
    if (sfErr) throw new Error(sfErr.message)

    const subfasMap = new Map<string, string>()
    for (const sf of (subfasRows ?? []) as { id: string; namn: string; fas_id: string }[]) {
      const fasNamn = fasNamnById.get(sf.fas_id) ?? ''
      const key = `${fasNamn.toLowerCase()}::${sf.namn.toLowerCase()}`
      subfasMap.set(key, sf.id)
    }

    if (subfasMap.size === 0) throw new Error(
      `Inga subfaser hittades i förslaget (id: ${forslag_id}). ` +
      'Kör workflow "Skapa förslag med faser" för att skapa faser i förslaget.'
    )

    // Load timpris for each yrkesroll from arbets_roller
    const { data: roller } = await supabase
      .from('arbets_roller')
      .select('namn, timpris')
      .eq('aktiv', true)
    const timprisMap = new Map<string, number>(
      (roller ?? []).map((r: { namn: string; timpris: number }) => [r.namn.toLowerCase(), r.timpris])
    )

    interface MaterialItem {
      fas: string; subfas?: string; beskrivning: string
      enhet?: string; antal: number; a_pris: number; leverantor?: string
      sokterm?: string; katalog_id?: string | null; price_source?: string
    }
    interface ArbetsEstimat {
      fas: string; subfas?: string; yrkesroll: string
      antal_timmar: number; beskrivning?: string
    }

    // Combine materialkostnad_urval + material_webb_urval (webb fills in price=0 items)
    const rawKatalog = collectedData.materialkostnad_urval
    const rawWebb = collectedData.material_webb_urval
    const katalogItems: MaterialItem[] = rawKatalog
      ? parseContextValue<MaterialItem[]>(rawKatalog, 'materialkostnad_urval')
      : []
    const webbItems: MaterialItem[] = rawWebb
      ? parseContextValue<MaterialItem[]>(rawWebb, 'material_webb_urval')
      : []

    const webbPrisMap = new Map<string, number>(
      webbItems.filter(i => i.a_pris > 0).map(i => [i.sokterm ?? i.beskrivning, i.a_pris])
    )
    const allMaterial = katalogItems.map(item => ({
      ...item,
      a_pris: (item.a_pris > 0) ? item.a_pris : (webbPrisMap.get(item.sokterm ?? item.beskrivning) ?? 0),
    }))

    // Clear existing rows (delete by subfas_id)
    const subfasIds = Array.from(subfasMap.values())
    if (subfasIds.length > 0) {
      await supabase.from('forslag_materialkostnad').delete().in('subfas_id', subfasIds)
      await supabase.from('forslag_arbetskostnad').delete().in('subfas_id', subfasIds)
    }

    // Insert material rows
    let material_rader = 0
    let material_skip = 0
    for (const item of allMaterial) {
      const key = `${item.fas.toLowerCase()}::${(item.subfas ?? '').toLowerCase()}`
      const subfas_id = subfasMap.get(key)
      if (!subfas_id) { material_skip++; continue }
      const { error } = await supabase.from('forslag_materialkostnad').insert({
        subfas_id,
        beskrivning: item.beskrivning,
        enhet: normalizeEnhet(item.enhet),
        antal: Number(item.antal) || 0,
        a_pris: Number(item.a_pris) || 0,
        leverantor: item.leverantor ?? '',
      })
      if (error) throw new Error(`Fel vid insättning av materialrad "${item.beskrivning}": ${error.message}`)
      material_rader++
    }

    // Insert labor rows
    const rawArbete = collectedData.arbetskostnad_urval
    let arbets_rader = 0
    let arbets_skip = 0
    if (rawArbete) {
      const arbete = parseContextValue<{ estimat?: ArbetsEstimat[] }>(rawArbete, 'arbetskostnad_urval')
      for (const item of (arbete.estimat ?? [])) {
        const key = `${item.fas.toLowerCase()}::${(item.subfas ?? '').toLowerCase()}`
        const subfas_id = subfasMap.get(key)
        if (!subfas_id) { arbets_skip++; continue }
        const timpris = timprisMap.get(item.yrkesroll.toLowerCase()) ?? 0
        const { error } = await supabase.from('forslag_arbetskostnad').insert({
          subfas_id,
          beskrivning: item.beskrivning ?? item.yrkesroll,
          yrkesroll: item.yrkesroll,
          antal_timmar: Number(item.antal_timmar) || 0,
          timpris,
          rot_berattigad: rotEligibleDefault,
        })
        if (error) throw new Error(`Fel vid insättning av arbetsrad "${item.yrkesroll}/${item.subfas}": ${error.message}`)
        arbets_rader++
      }
    }

    return { forslag_id, material_rader, material_skip, arbets_rader, arbets_skip }
  },

  // ── Fill MISSING forslag costs (additive, no delete) ──────────────────────
  // Like action:fill-forslag-kostnader but targets a specific forslag_id and
  // only inserts for subfaser that currently have zero material rows.

  'action:fill-missing-forslag-kostnader': async ({ collectedData, workflowInput }) => {
    const forslag_id = (collectedData.forslag_id ?? workflowInput.forslag_id) as string
    if (!forslag_id) throw new Error('forslag_id saknas i workflowInput')

    const { data: projektRow } = await supabase
      .from('forslag')
      .select('projekt_id')
      .eq('id', forslag_id)
      .single()
    const projekt_id = (projektRow as { projekt_id: string } | null)?.projekt_id
    if (!projekt_id) throw new Error(`Förslaget ${forslag_id} hittades inte`)

    // Build fas/subfas maps
    const { data: fasRows, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id, namn')
      .eq('forslag_id', forslag_id)
    if (fasErr) throw new Error(fasErr.message)

    const fasIds = (fasRows ?? []).map((f: { id: string }) => f.id)
    const fasNamnById = new Map((fasRows ?? []).map((f: { id: string; namn: string }) => [f.id, f.namn]))

    const { data: sfRows } = await supabase
      .from('forslag_subfaser')
      .select('id, namn, fas_id')
      .in('fas_id', fasIds.length > 0 ? fasIds : ['__none__'])

    const subfasMap = new Map<string, string>()
    for (const sf of (sfRows ?? []) as { id: string; namn: string; fas_id: string }[]) {
      const fasNamn = fasNamnById.get(sf.fas_id) ?? ''
      subfasMap.set(`${fasNamn.toLowerCase()}::${sf.namn.toLowerCase()}`, sf.id)
    }

    // Find which subfaser already have material rows → skip those
    const allSubfasIds = Array.from(subfasMap.values())
    const { data: existingMat } = await supabase
      .from('forslag_materialkostnad')
      .select('subfas_id')
      .in('subfas_id', allSubfasIds.length > 0 ? allSubfasIds : ['__none__'])
    const subfasWithMaterial = new Set(
      (existingMat ?? []).map((r: { subfas_id: string }) => r.subfas_id)
    )

    interface MaterialItem {
      fas: string; subfas?: string; beskrivning: string
      enhet?: string; antal: number; a_pris: number; leverantor?: string
    }

    const rawKatalog = collectedData.materialkostnad_urval
    const rawWebb = collectedData.material_webb_urval
    const katalogItems: MaterialItem[] = rawKatalog
      ? parseContextValue<MaterialItem[]>(rawKatalog, 'materialkostnad_urval')
      : []
    const webbItems: MaterialItem[] = rawWebb
      ? parseContextValue<MaterialItem[]>(rawWebb, 'material_webb_urval')
      : []
    const webbPrisMap = new Map<string, number>(
      webbItems.filter(i => i.a_pris > 0).map(i => [(i as MaterialItem & { sokterm?: string }).sokterm ?? i.beskrivning, i.a_pris])
    )
    const allMaterial = katalogItems.map(item => ({
      ...item,
      a_pris: (item.a_pris > 0) ? item.a_pris : (webbPrisMap.get((item as MaterialItem & { sokterm?: string }).sokterm ?? item.beskrivning) ?? 0),
    }))

    let material_tillagda = 0
    let material_hoppade = 0
    for (const item of allMaterial) {
      const key = `${item.fas.toLowerCase()}::${(item.subfas ?? '').toLowerCase()}`
      const subfas_id = subfasMap.get(key)
      if (!subfas_id) { material_hoppade++; continue }
      if (subfasWithMaterial.has(subfas_id)) { material_hoppade++; continue }
      const { error } = await supabase.from('forslag_materialkostnad').insert({
        subfas_id,
        beskrivning: item.beskrivning,
        enhet: normalizeEnhet(item.enhet),
        antal: Number(item.antal) || 0,
        a_pris: Number(item.a_pris) || 0,
        leverantor: item.leverantor ?? '',
      })
      if (error) throw new Error(`Fel vid insättning av materialrad "${item.beskrivning}": ${error.message}`)
      material_tillagda++
    }

    // Labor rows are not touched — the existing proposal already has its labor.
    // This action only adds MATERIAL to previously empty subfaser.

    return { forslag_id, material_tillagda, material_hoppade }
  },

  // ── Apply revisor corrections ─────────────────────────────────────────────
  // Läser ai_output.korrigeringar (en lista av diffar) och applicerar dem på
  // arbetskostnad_urval / materialkostnad_urval / material_webb_urval. Skriver
  // sedan tillbaka de tre uppdaterade listorna + en revisionslogg som separata
  // rader i projekt_context. Detta gör att revisor-AI:n bara behöver returnera
  // små diffar (några hundra tokens) istället för hela listorna.

  'action:apply-revisor-corrections': async ({ run_id, collectedData, workflowInput }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')

    interface Korrigering {
      lista: 'arbete' | 'material' | 'material_webb'
      index: number
      falt: string
      nytt_varde: unknown
      fran?: unknown
      motivering?: string
    }
    interface AiOutput {
      korrigeringar?: Korrigering[]
      antal_korrigeringar?: number
      kommentar?: string
    }

    const ai_output = collectedData.ai_output as AiOutput | null
    if (!ai_output) throw new Error('ai_output saknas — kör revisor-AI-noden före denna nod.')

    function asObject(v: unknown): Record<string, unknown> {
      if (typeof v === 'string') {
        const p = tryParseJson(v)
        return (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
      }
      return (v ?? {}) as Record<string, unknown>
    }
    function asArray(v: unknown): Record<string, unknown>[] {
      if (Array.isArray(v)) return [...(v as Record<string, unknown>[])]
      if (typeof v === 'string') {
        const p = tryParseJson(v)
        return Array.isArray(p) ? p as Record<string, unknown>[] : []
      }
      return []
    }

    const arbeteWrapper = asObject(collectedData.arbetskostnad_urval)
    const arbeteEstimat = Array.isArray(arbeteWrapper.estimat)
      ? [...(arbeteWrapper.estimat as Record<string, unknown>[])]
      : []
    const material = asArray(collectedData.materialkostnad_urval)
    const webb = asArray(collectedData.material_webb_urval)

    const ALLOWED = new Set(['a_pris', 'antal', 'enhet', 'beskrivning', 'antal_timmar', 'motivering'])
    const applied: Korrigering[] = []
    const skipped: { korr: Korrigering; reason: string }[] = []

    for (const k of ai_output.korrigeringar ?? []) {
      if (!ALLOWED.has(k.falt)) { skipped.push({ korr: k, reason: `falt "${k.falt}" ej tillåtet` }); continue }
      let target: Record<string, unknown>[] | null = null
      if (k.lista === 'arbete') target = arbeteEstimat
      else if (k.lista === 'material') target = material
      else if (k.lista === 'material_webb') target = webb
      else { skipped.push({ korr: k, reason: `okänd lista "${k.lista}"` }); continue }

      const idx = Number(k.index)
      if (!Number.isInteger(idx) || idx < 0 || idx >= target.length) {
        skipped.push({ korr: k, reason: `index ${k.index} utanför listan (längd ${target.length})` })
        continue
      }
      target[idx] = { ...target[idx], [k.falt]: k.nytt_varde }
      applied.push(k)
    }

    const arbeteModified = { ...arbeteWrapper, estimat: arbeteEstimat }
    const revisionsLog = {
      antal_applicerade: applied.length,
      antal_hoppade: skipped.length,
      applied,
      skipped,
      kommentar: ai_output.kommentar ?? '',
    }

    const { error } = await supabase.from('projekt_context').insert([
      { projekt_id, nyckel: 'arbetskostnad_urval',  varde: JSON.stringify(arbeteModified), workflow_run_id: run_id },
      { projekt_id, nyckel: 'materialkostnad_urval', varde: JSON.stringify(material),       workflow_run_id: run_id },
      { projekt_id, nyckel: 'material_webb_urval',   varde: JSON.stringify(webb),           workflow_run_id: run_id },
      { projekt_id, nyckel: 'forslag_revision',      varde: JSON.stringify(revisionsLog),   workflow_run_id: run_id },
    ])
    if (error) throw new Error(`Kunde inte spara korrigeringar: ${error.message}`)

    return {
      applied_count: applied.length,
      skipped_count: skipped.length,
      arbetskostnad_urval: arbeteModified,
      materialkostnad_urval: material,
      material_webb_urval: webb,
      forslag_revision: revisionsLog,
    }
  },

  // ── Add missing items to förslag (additive-only review) ──────────────────

  'action:add-missing-to-forslag': async ({ collectedData, workflowInput }) => {
    const forslag_id = (collectedData.forslag_id ?? workflowInput.forslag_id) as string
    if (!forslag_id) throw new Error('forslag_id saknas')

    interface Addition {
      fas: string
      subfas: string
      typ: 'material' | 'arbete'
      // material fields
      beskrivning?: string
      enhet?: string
      antal?: number
      a_pris?: number
      leverantor?: string
      // arbete fields
      yrkesroll?: string
      antal_timmar?: number
    }

    const ai_output = collectedData.ai_output as { additions?: Addition[]; kommentar?: string } | null
    if (!ai_output) throw new Error('ai_output saknas — kör AI-noden före denna nod.')

    const additions = ai_output.additions ?? []
    if (additions.length === 0) return { faser_skapade: 0, subfaser_skapade: 0, material_tillagda: 0, arbete_tillagda: 0, forslag_id, kommentar: ai_output.kommentar ?? '' }

    // Load existing faser
    const { data: fasRows, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id, namn, sortering')
      .eq('forslag_id', forslag_id)
    if (fasErr) throw new Error(fasErr.message)

    const fasMap = new Map<string, string>()
    let maxFasSortering = 0
    for (const f of (fasRows ?? []) as { id: string; namn: string; sortering: number }[]) {
      fasMap.set(f.namn.toLowerCase(), f.id)
      if (f.sortering > maxFasSortering) maxFasSortering = f.sortering
    }

    // Load existing subfaser
    const allFasIds = Array.from(fasMap.values())
    const { data: sfRows } = await supabase
      .from('forslag_subfaser')
      .select('id, namn, fas_id')
      .in('fas_id', allFasIds.length > 0 ? allFasIds : ['__none__'])
    const subfasMap = new Map<string, string>() // "fasId::subfasNamn" → subfas_id
    const subfasSorteringMap = new Map<string, number>() // fasId → max sortering
    for (const sf of (sfRows ?? []) as { id: string; namn: string; fas_id: string }[]) {
      subfasMap.set(`${sf.fas_id}::${sf.namn.toLowerCase()}`, sf.id)
      const cur = subfasSorteringMap.get(sf.fas_id) ?? 0
      subfasSorteringMap.set(sf.fas_id, cur + 1)
    }

    let faser_skapade = 0
    let subfaser_skapade = 0
    let material_tillagda = 0
    let arbete_tillagda = 0

    for (const item of additions) {
      const fasNamn = (item.fas ?? '').trim()
      const subfasNamn = (item.subfas ?? '').trim()
      if (!fasNamn || !subfasNamn) continue

      // Get or create fas
      let fas_id = fasMap.get(fasNamn.toLowerCase())
      if (!fas_id) {
        maxFasSortering++
        const { data: newFas, error: newFasErr } = await supabase
          .from('forslag_faser')
          .insert({ forslag_id, namn: fasNamn, sortering: maxFasSortering })
          .select('id')
          .single()
        if (newFasErr || !newFas) throw new Error(`Kunde inte skapa fas "${fasNamn}": ${newFasErr?.message ?? ''}`)
        fas_id = (newFas as { id: string }).id
        fasMap.set(fasNamn.toLowerCase(), fas_id)
        subfasSorteringMap.set(fas_id, 0)
        faser_skapade++
      }

      // Get or create subfas
      const sfKey = `${fas_id}::${subfasNamn.toLowerCase()}`
      let subfas_id = subfasMap.get(sfKey)
      if (!subfas_id) {
        const nextSortering = subfasSorteringMap.get(fas_id) ?? 0
        const { data: newSf, error: newSfErr } = await supabase
          .from('forslag_subfaser')
          .insert({ fas_id, namn: subfasNamn, sortering: nextSortering })
          .select('id')
          .single()
        if (newSfErr || !newSf) throw new Error(`Kunde inte skapa subfas "${subfasNamn}": ${newSfErr?.message ?? ''}`)
        subfas_id = (newSf as { id: string }).id
        subfasMap.set(sfKey, subfas_id)
        subfasSorteringMap.set(fas_id, nextSortering + 1)
        subfaser_skapade++
      }

      if (item.typ === 'material') {
        const { error } = await supabase.from('forslag_materialkostnad').insert({
          subfas_id,
          beskrivning: item.beskrivning ?? '',
          enhet: normalizeEnhet(item.enhet),
          antal: Number(item.antal) || 0,
          a_pris: Number(item.a_pris) || 0,
          leverantor: item.leverantor ?? '',
        })
        if (error) throw new Error(`Kunde inte lägga till material "${item.beskrivning}": ${error.message}`)
        material_tillagda++
      } else if (item.typ === 'arbete') {
        const { error } = await supabase.from('forslag_arbetskostnad').insert({
          subfas_id,
          beskrivning: item.beskrivning ?? item.yrkesroll ?? '',
          yrkesroll: item.yrkesroll ?? '',
          antal_timmar: Number(item.antal_timmar) || 0,
          timpris: 0,
          rot_berattigad: false,
        })
        if (error) throw new Error(`Kunde inte lägga till arbete "${item.yrkesroll}": ${error.message}`)
        arbete_tillagda++
      }
    }

    return { faser_skapade, subfaser_skapade, material_tillagda, arbete_tillagda, forslag_id, kommentar: ai_output.kommentar ?? '' }
  },

  // ── Web price search ──────────────────────────────────────────────────────

  'action:search-web-price': async ({ nodeConfig, collectedData, workflowInput }) => {
    const assistent_id = (nodeConfig.assistent_id as string) || (workflowInput.assistent_id as string) || null

    interface FaltandeItem {
      sokterm: string
      beskrivning: string
      fas: string
      subfas: string
      enhet?: string
    }

    const raw = collectedData.material_faltande
    if (!raw) return { material_webb_urval: [], webb_hittade: 0, webb_faltande: 0 }

    const items = parseContextValue<FaltandeItem[]>(raw, 'material_faltande')
    if (items.length === 0) return { material_webb_urval: [], webb_hittade: 0, webb_faltande: 0 }

    async function aiEstimatePrice(item: FaltandeItem): Promise<number | null> {
      if (!assistent_id) return null
      try {
        const enhet = item.enhet ?? 'st'
        const prompt =
          `Vad kostar "${item.beskrivning}" (${item.sokterm}) i Sverige exkl. moms per ${enhet}?\n` +
          `Svara ENBART med ett heltal i SEK.`
        // Use Google Search grounding if provider is Google, otherwise regular chat
        const svar = await executeChatWithWebSearch(assistent_id, [{ role: 'user', content: prompt }])
        const pris = parseFloat(svar.replace(/[^\d.,]/g, '').replace(',', '.'))
        return !isNaN(pris) && pris > 0 ? pris : null
      } catch { return null }
    }

    const enriched: Record<string, unknown>[] = []
    let webb_hittade = 0
    let webb_faltande = 0

    for (const item of items) {
      const aiPris = await aiEstimatePrice(item)
      if (aiPris) {
        enriched.push({ ...item, a_pris: aiPris, leverantor: 'AI-estimat', price_source: 'ai_pris' })
        webb_hittade++
        continue
      }
      enriched.push({ ...item, a_pris: 0, leverantor: '', price_source: 'okänd' })
      webb_faltande++
    }

    return { material_webb_urval: enriched, webb_hittade, webb_faltande }
  },

  // ── Förslag komplett (för kompletteringsworkflow) ─────────────────────────

  'data:forslag-komplett': async ({ workflowInput, collectedData }) => {
    const forslag_id = (collectedData.forslag_id ?? workflowInput.forslag_id) as string
    if (!forslag_id) throw new Error('forslag_id saknas i workflowInput')

    const { data: forslag, error: fErr } = await supabase
      .from('forslag')
      .select('id, titel, forslag_nummer')
      .eq('id', forslag_id)
      .single()
    if (fErr || !forslag) throw new Error(`Förslaget hittades inte (id: ${forslag_id})`)

    const { data: fasRows, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id, namn, sortering')
      .eq('forslag_id', forslag_id)
      .order('sortering', { ascending: true })
    if (fasErr) throw new Error(fasErr.message)
    const faser = (fasRows ?? []) as { id: string; namn: string; sortering: number }[]

    const fasIds = faser.map(f => f.id)
    const { data: subfasRows } = await supabase
      .from('forslag_subfaser')
      .select('id, namn, fas_id')
      .in('fas_id', fasIds.length > 0 ? fasIds : ['__none__'])
    const subfaser = (subfasRows ?? []) as { id: string; namn: string; fas_id: string }[]

    const subfasIds = subfaser.map(s => s.id)
    const [{ data: materialRows }, { data: arbeteRows }] = await Promise.all([
      supabase.from('forslag_materialkostnad')
        .select('subfas_id, beskrivning, enhet, antal, a_pris')
        .in('subfas_id', subfasIds.length > 0 ? subfasIds : ['__none__']),
      supabase.from('forslag_arbetskostnad')
        .select('subfas_id, yrkesroll, antal_timmar, beskrivning')
        .in('subfas_id', subfasIds.length > 0 ? subfasIds : ['__none__']),
    ])

    type MaterialRow = { subfas_id: string; beskrivning: string; enhet: string; antal: number; a_pris: number }
    type ArbeteRow = { subfas_id: string; yrkesroll: string; antal_timmar: number; beskrivning: string }

    const materialBySubfas = new Map<string, MaterialRow[]>()
    for (const m of (materialRows ?? []) as MaterialRow[]) {
      const list = materialBySubfas.get(m.subfas_id) ?? []
      list.push(m)
      materialBySubfas.set(m.subfas_id, list)
    }
    const arbeteBySubfas = new Map<string, ArbeteRow[]>()
    for (const a of (arbeteRows ?? []) as ArbeteRow[]) {
      const list = arbeteBySubfas.get(a.subfas_id) ?? []
      list.push(a)
      arbeteBySubfas.set(a.subfas_id, list)
    }

    const lines: string[] = [
      `FÖRSLAG ${(forslag as { id: string; forslag_nummer: string; titel: string }).forslag_nummer} — ${(forslag as { id: string; forslag_nummer: string; titel: string }).titel}`,
      'FASER:',
    ]
    for (const fas of faser) {
      lines.push(`  ${fas.namn}:`)
      const fasSubfaser = subfaser.filter(s => s.fas_id === fas.id)
      if (fasSubfaser.length === 0) {
        lines.push('    (inga subfaser)')
        continue
      }
      for (const sf of fasSubfaser) {
        const parts: string[] = []
        const mat = materialBySubfas.get(sf.id) ?? []
        const arb = arbeteBySubfas.get(sf.id) ?? []
        for (const m of mat) parts.push(`material: ${m.beskrivning} ${m.antal}${m.enhet}`)
        for (const a of arb) parts.push(`arbete: ${a.yrkesroll} ${a.antal_timmar}h`)
        lines.push(`    - ${sf.namn}: [${parts.join('; ') || 'tomt'}]`)
      }
    }
    if (faser.length === 0) lines.push('  (inga faser)')

    return {
      forslag_id: (forslag as { id: string; forslag_nummer: string; titel: string }).id,
      forslag_nummer: (forslag as { id: string; forslag_nummer: string; titel: string }).forslag_nummer,
      forslag_titel: (forslag as { id: string; forslag_nummer: string; titel: string }).titel,
      forslag_komplett_text: lines.join('\n'),
    }
  },

  // ── Förslag faser → AI-format (for komplettering pipeline) ──────────────

  'data:forslag-faser-for-ai': async ({ workflowInput, collectedData }) => {
    const forslag_id = (collectedData.forslag_id ?? workflowInput.forslag_id) as string
    if (!forslag_id) throw new Error('forslag_id saknas i workflowInput')

    const { data: fasRows, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id, namn, sortering')
      .eq('forslag_id', forslag_id)
      .order('sortering', { ascending: true })
    if (fasErr) throw new Error(fasErr.message)
    const faser = (fasRows ?? []) as { id: string; namn: string; sortering: number }[]

    const fasIds = faser.map(f => f.id)
    const { data: sfRows } = await supabase
      .from('forslag_subfaser')
      .select('id, namn, fas_id')
      .in('fas_id', fasIds.length > 0 ? fasIds : ['__none__'])
    const subfaser = (sfRows ?? []) as { id: string; namn: string; fas_id: string }[]

    const subfasIds = subfaser.map(s => s.id)
    const { data: arbRows } = await supabase
      .from('forslag_arbetskostnad')
      .select('subfas_id, yrkesroll, antal_timmar, beskrivning')
      .in('subfas_id', subfasIds.length > 0 ? subfasIds : ['__none__'])

    type ArbRow = { subfas_id: string; yrkesroll: string; antal_timmar: number; beskrivning: string }

    const fasById = new Map(faser.map(f => [f.id, f.namn]))
    const sfById = new Map(subfaser.map(s => [s.id, { namn: s.namn, fas_id: s.fas_id }]))

    // Build projekt_faser_urval compatible with Materialbehovsestimator prompt
    const valdaFaser = faser.map(f => f.namn)
    const valdaSubfaser = faser.map(f => ({
      fas: f.namn,
      subfaser: subfaser.filter(s => s.fas_id === f.id).map(s => s.namn),
    }))
    const projektFaserUrval = JSON.stringify({
      vald_mall: 'Från befintligt förslag',
      valda_faser: valdaFaser,
      valda_subfaser: valdaSubfaser,
    })

    // Build arbetskostnad_urval from existing labor rows
    const estimat = (arbRows ?? []).map((a: ArbRow) => {
      const sf = sfById.get(a.subfas_id)
      return {
        fas: sf ? (fasById.get(sf.fas_id) ?? '') : '',
        subfas: sf?.namn ?? '',
        yrkesroll: a.yrkesroll,
        antal_timmar: Number(a.antal_timmar) || 0,
        beskrivning: a.beskrivning ?? a.yrkesroll,
      }
    }).filter(e => e.fas)
    const arbetskostnadUrval = JSON.stringify({ estimat })

    return {
      forslag_id,
      projekt_faser_urval: projektFaserUrval,
      arbetskostnad_urval: arbetskostnadUrval,
    }
  },

  // ── Förslag faser ─────────────────────────────────────────────────────────

  'data:forslag-faser': async ({ workflowInput, collectedData }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')

    const { data: forslag, error: fErr } = await supabase
      .from('forslag')
      .select('id, titel, forslag_nummer')
      .eq('projekt_id', projekt_id)
      .eq('status', 'utkast')
      .order('skapad_at', { ascending: false })
      .limit(1)
      .single()
    if (fErr || !forslag) throw new Error('Inget förslag i utkast-status hittades. Skapa ett förslag först.')

    const { data: fasRows, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id, namn, sortering')
      .eq('forslag_id', forslag.id)
      .order('sortering', { ascending: true })
    if (fasErr) throw new Error(fasErr.message)
    const faser = (fasRows ?? []) as { id: string; namn: string; sortering: number }[]

    const fasIds = faser.map(f => f.id)
    const { data: subfasRows } = await supabase
      .from('forslag_subfaser')
      .select('id, namn, fas_id')
      .in('fas_id', fasIds.length > 0 ? fasIds : ['__none__'])
    const subfaser = (subfasRows ?? []) as { id: string; namn: string; fas_id: string }[]

    const subfasIds = subfaser.map(s => s.id)
    const { data: arbetsRows } = await supabase
      .from('forslag_arbetskostnad')
      .select('subfas_id, antal_timmar')
      .in('subfas_id', subfasIds.length > 0 ? subfasIds : ['__none__'])

    const timmarPerSubfas = new Map<string, number>()
    for (const r of (arbetsRows ?? []) as { subfas_id: string; antal_timmar: number }[]) {
      timmarPerSubfas.set(r.subfas_id, (timmarPerSubfas.get(r.subfas_id) ?? 0) + Number(r.antal_timmar))
    }

    const { data: inst } = await supabase
      .from('app_installningar')
      .select('timmar_per_dag, arbetsdagar_per_vecka')
      .limit(1)
      .single()
    const timmar_per_dag = (inst as { timmar_per_dag?: number } | null)?.timmar_per_dag ?? 8
    const arbetsdagar_per_vecka = (inst as { arbetsdagar_per_vecka?: number } | null)?.arbetsdagar_per_vecka ?? 5

    let total_timmar = 0
    const forslag_faser: { fas: string; subfaser: string[]; total_timmar: number }[] = []
    const lines: string[] = []

    for (const fas of faser) {
      const fasSubfaser = subfaser.filter(s => s.fas_id === fas.id)
      const fasTimmar = fasSubfaser.reduce((sum, s) => sum + (timmarPerSubfas.get(s.id) ?? 0), 0)
      total_timmar += fasTimmar
      forslag_faser.push({ fas: fas.namn, subfaser: fasSubfaser.map(s => s.namn), total_timmar: fasTimmar })
      lines.push(`${fas.namn}: ${fasTimmar}h (${fasSubfaser.map(s => s.namn).join(', ')})`)
    }

    return {
      forslag_id: forslag.id,
      forslag_titel: (forslag as { id: string; titel: string; forslag_nummer: string }).titel,
      forslag_nummer: (forslag as { id: string; titel: string; forslag_nummer: string }).forslag_nummer,
      forslag_faser,
      forslag_faser_text: lines.join('\n'),
      total_timmar,
      timmar_per_dag,
      arbetsdagar_per_vecka,
    }
  },

  // ── Skapa tidplan ─────────────────────────────────────────────────────────

  'action:create-tidplan': async ({ nodeConfig, collectedData, workflowInput }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')

    const ai_output = collectedData.ai_output as { faser?: { fas: string; duration_dagar: number }[] } | null
    if (!ai_output?.faser?.length) throw new Error(
      'Ingen tidplan från AI. Lägg till en AI-nod som genererar { "faser": [{ "fas": "...", "duration_dagar": N }] } innan denna nod.'
    )

    const startRaw = (nodeConfig.startdatum as string) || (workflowInput.startdatum as string) || ''
    let currentDate = startRaw ? new Date(`${startRaw}T00:00:00`) : new Date()
    currentDate.setHours(0, 0, 0, 0)
    while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      currentDate = new Date(currentDate.getTime() + 86400000)
    }

    const forslag_id = collectedData.forslag_id as string | null
    const forslagFasMap = new Map<string, string>()
    if (forslag_id) {
      const { data: fasRows } = await supabase
        .from('forslag_faser')
        .select('id, namn')
        .eq('forslag_id', forslag_id)
      for (const fas of (fasRows ?? []) as { id: string; namn: string }[]) {
        forslagFasMap.set(fas.namn.toLowerCase(), fas.id)
      }
    }

    function addWorkingDays(start: Date, days: number): Date {
      const d = new Date(start)
      if (days <= 1) return d
      let remaining = days - 1
      while (remaining > 0) {
        d.setDate(d.getDate() + 1)
        if (d.getDay() !== 0 && d.getDay() !== 6) remaining--
      }
      return d
    }

    function toDateStr(d: Date): string {
      return d.toISOString().split('T')[0]
    }

    let faser_updated = 0
    const firstDate = toDateStr(currentDate)
    let lastDate = firstDate

    for (const item of ai_output.faser) {
      const duration = Math.max(1, Math.round(item.duration_dagar))
      const endDate = addWorkingDays(currentDate, duration)
      const startStr = toDateStr(currentDate)
      const endStr = toDateStr(endDate)
      lastDate = endStr

      const fasId = forslagFasMap.get(item.fas.toLowerCase()) ?? null

      if (fasId) {
        await supabase.from('forslag_faser').update({ start_datum: startStr, slut_datum: endStr }).eq('id', fasId)
        faser_updated++
      }

      // Advance to next working day after endDate
      const next = new Date(endDate.getTime() + 86400000)
      while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1)
      currentDate = next
    }

    await supabase.from('projekt_anteckningar').insert({
      projekt_id,
      titel: `Tidplan skapad`,
      innehall: `Tidplan från ${firstDate} till ${lastDate}.\n${faser_updated} fas(er) uppdaterade. Publicera i Kalender manuellt från Tidplan-vyn.`,
      farg: 'blue',
    }).then(() => {})

    return { faser_updated, tidplan_start: firstDate, tidplan_slut: lastDate }
  },

  // ── PDF-import (verbatim) ─────────────────────────────────────────────────
  // Reads the AI's structured extraction from `pdf_analys` (set by ai:analyze-pdf)
  // and writes it directly to forslag/faser/subfaser/arbete/material/kalender_events
  // without any normalization against fas_mallar or arbets_roller — preserves the
  // original PDF's prices and phase names exactly.

  'action:import-forslag-from-extraction': async ({ collectedData, workflowInput }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')

    // Accept any of these sources, in priority order:
    //   1. ai_output       — parsed JSON from ai:generate (current path)
    //   2. ai_raw          — raw string from ai:generate
    //   3. pdf_analys      — string from ai:analyze-pdf (legacy / Anthropic-only)
    //   4. importerad_pdf_struktur — value loaded via data:context for re-runs
    //      that bypass the AI step entirely
    const raw =
      collectedData.ai_output ??
      collectedData.ai_raw ??
      collectedData.pdf_analys ??
      collectedData.importerad_pdf_struktur
    if (raw === undefined || raw === null || raw === '') throw new Error(
      'Ingen extrahering hittad. Förvänta dig ai_output/ai_raw (från ai:generate), ' +
      'pdf_analys (från ai:analyze-pdf) eller importerad_pdf_struktur (från data:context) ' +
      'i insamlad data.'
    )

    interface ArbeteRow {
      beskrivning?: string
      yrkesroll?: string
      antal_timmar?: number
      timpris?: number
      rot_berattigad?: boolean
    }
    interface MaterialRow {
      beskrivning?: string
      enhet?: string
      antal?: number
      a_pris?: number
      leverantor?: string
    }
    interface SubfasRow {
      namn: string
      sortering?: number
      start_datum?: string
      slut_datum?: string
      arbete?: ArbeteRow[]
      material?: MaterialRow[]
    }
    interface FasRow {
      namn: string
      sortering?: number
      subfaser?: SubfasRow[]
    }
    interface Header {
      titel?: string
      datum?: string
      giltig_dagar?: number
      moms_procent?: number
      rot_avdrag?: boolean
      ursprung_nummer?: string
    }
    interface Extraction {
      header?: Header
      faser?: FasRow[]
      error?: string
    }

    const data = parseContextValue<Extraction>(raw, 'pdf_analys')
    if (data.error) throw new Error(`AI kunde inte tolka PDF:en: ${data.error}`)
    if (!data.header || !Array.isArray(data.faser) || data.faser.length === 0) {
      throw new Error('AI returnerade ingen giltig struktur (header eller faser saknas).')
    }

    const header = data.header
    const titel = (header.titel && header.titel.trim()) || (collectedData.namn as string) || 'Importerat förslag'
    const giltig_dagar = header.giltig_dagar ?? 30
    const moms_procent = header.moms_procent ?? 25

    const baseDate = header.datum ? new Date(`${header.datum}T00:00:00`) : new Date()
    baseDate.setDate(baseDate.getDate() + giltig_dagar)
    const giltig_till = baseDate.toISOString().split('T')[0]

    const ursprung = header.ursprung_nummer
      ? `Importerat från ${header.ursprung_nummer}`
      : 'Importerat från PDF'

    let forslag: { id: string; forslag_nummer: string; titel: string } | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: numData, error: numErr } = await supabase.rpc('nextval_forslag_nummer')
      if (numErr) throw new Error(`Kunde inte generera förslagnummer: ${numErr.message}`)
      const candidate = String(numData as number)
      const { data: result, error: fErr } = await supabase
        .from('forslag')
        .insert({ projekt_id, forslag_nummer: candidate, titel, sammanfattning: ursprung, giltig_till, moms_procent, status: 'utkast' })
        .select('id, forslag_nummer, titel')
        .single()
      if (result && !fErr) { forslag = result as { id: string; forslag_nummer: string; titel: string }; break }
      if ((fErr as { code?: string } | null)?.code !== '23505') throw new Error(`Kunde inte skapa förslag: ${fErr?.message ?? ''}`)
    }
    if (!forslag) throw new Error('Kunde inte skapa förslag: sekvensnummerkollision')
    const forslag_id = forslag.id as string

    let faser_count = 0
    let subfaser_count = 0
    let arbete_count = 0
    let material_count = 0
    let kalender_count = 0

    for (let i = 0; i < data.faser.length; i++) {
      const fas = data.faser[i]
      const subfaserList = Array.isArray(fas.subfaser) ? fas.subfaser : []

      const allDates: string[] = []
      for (const sf of subfaserList) {
        if (sf.start_datum) allDates.push(sf.start_datum)
        if (sf.slut_datum) allDates.push(sf.slut_datum)
      }
      allDates.sort()
      const fasStart = allDates[0] ?? null
      const fasEnd = allDates[allDates.length - 1] ?? null

      const { data: fasRow, error: fasErr } = await supabase
        .from('forslag_faser')
        .insert({
          forslag_id,
          namn: fas.namn,
          sortering: fas.sortering ?? i,
          start_datum: fasStart,
          slut_datum: fasEnd,
        })
        .select('id')
        .single()
      if (fasErr || !fasRow) throw new Error(`Kunde inte skapa fas "${fas.namn}": ${fasErr?.message ?? ''}`)
      const fas_id = fasRow.id as string
      faser_count++

      for (let j = 0; j < subfaserList.length; j++) {
        const sf = subfaserList[j]
        const { data: sfRow, error: sfErr } = await supabase
          .from('forslag_subfaser')
          .insert({
            fas_id,
            namn: sf.namn,
            sortering: sf.sortering ?? j,
          })
          .select('id')
          .single()
        if (sfErr || !sfRow) throw new Error(`Kunde inte skapa subfas "${sf.namn}": ${sfErr?.message ?? ''}`)
        const subfas_id = sfRow.id as string
        subfaser_count++

        for (const ar of (sf.arbete ?? [])) {
          const { error } = await supabase.from('forslag_arbetskostnad').insert({
            subfas_id,
            beskrivning: ar.beskrivning ?? '',
            yrkesroll: ar.yrkesroll ?? '',
            antal_timmar: Number(ar.antal_timmar) || 0,
            timpris: Number(ar.timpris) || 0,
            rot_berattigad: ar.rot_berattigad === true,
          })
          if (error) throw new Error(`Fel vid arbetsrad "${ar.beskrivning ?? ''}": ${error.message}`)
          arbete_count++
        }

        for (const mt of (sf.material ?? [])) {
          const { error } = await supabase.from('forslag_materialkostnad').insert({
            subfas_id,
            beskrivning: mt.beskrivning ?? '',
            enhet: normalizeEnhet(mt.enhet),
            antal: Number(mt.antal) || 0,
            a_pris: Number(mt.a_pris) || 0,
            leverantor: mt.leverantor ?? '',
          })
          if (error) throw new Error(`Fel vid materialrad "${mt.beskrivning ?? ''}": ${error.message}`)
          material_count++
        }

        if (sf.start_datum && sf.slut_datum) {
          const { error: kErr } = await supabase.from('kalender_events').insert({
            titel: sf.namn,
            beskrivning: `${fas.namn} — importerat från PDF`,
            start: `${sf.start_datum}T00:00:00`,
            slut: `${sf.slut_datum}T23:59:59`,
            hel_dag: true,
            projekt_id,
            fas_id,
            farg: '#10b981',
          })
          if (!kErr) kalender_count++
        }
      }
    }

    await supabase.from('projekt_anteckningar').insert({
      projekt_id,
      titel: `Förslag importerat: ${forslag.forslag_nummer}`,
      innehall: `${ursprung}.\nFaser: ${faser_count}, subfaser: ${subfaser_count}, arbetsrader: ${arbete_count}, materialrader: ${material_count}, kalenderhändelser: ${kalender_count}.`,
      farg: 'emerald',
    }).then(() => {})

    if (kalender_count > 0) broadcast('kalender:changed')

    return {
      forslag_id,
      forslag_nummer: forslag.forslag_nummer,
      forslag_titel: forslag.titel,
      faser_tillagda: faser_count,
      subfaser_tillagda: subfaser_count,
      arbete_rader: arbete_count,
      material_rader: material_count,
      kalender_events: kalender_count,
    }
  },

  // ── E-post ────────────────────────────────────────────────────────────────

  'action:send-epost': async ({ nodeConfig, collectedData, workflowInput }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string | null
    const kund = collectedData.kunder as Record<string, unknown> | null
    const kund_id = (kund?.id as string | undefined) ?? null
    const forslag_id = (collectedData.forslag_id as string | undefined) ?? null
    const faktura_id = (collectedData.faktura_id as string | undefined) ?? null

    const mall_id = (nodeConfig.mall_id as string) || ''
    if (!mall_id) throw new Error('Ingen e-postmall vald i noden.')

    const till_source = (nodeConfig.till_source as string) || 'kund_email'
    let till = ''
    if (till_source === 'manual') {
      till = ((nodeConfig.till_manual as string) || '').trim()
    } else {
      till = ((kund?.email as string | undefined) ?? '').trim()
    }
    if (!till) throw new Error(
      till_source === 'manual'
        ? 'Manuell mottagaradress saknas i nodens konfiguration.'
        : 'Kunden saknar e-postadress. Lägg till en data:projekt-nod före denna eller ändra mottagare till manuell.'
    )
    const cc = ((nodeConfig.cc as string) || '').trim() || undefined

    const alias = await loadAlias((nodeConfig.alias_id as string) || null)
    if (!alias) throw new Error('Inget alias konfigurerat — gå till Inställningar → E-post alias')

    const ctx = await resolveContext({ kund_id, projekt_id, forslag_id, faktura_id, alias })
    const m = await applyMall(mall_id, ctx)
    let aliasToUse = alias
    if (m.alias_id) {
      const override = await loadAlias(m.alias_id)
      if (override) aliasToUse = override
    }

    let bilagor: EpostBilagaRef[] | undefined
    const bilaga_key = (nodeConfig.bilaga_kalla as string) || ''
    if (bilaga_key) {
      const raw = collectedData[bilaga_key]
      if (Array.isArray(raw)) bilagor = raw as EpostBilagaRef[]
    }

    await sendEpost({ alias: aliasToUse, till, cc, amne: m.amne, kropp: m.kropp_html, bilagor })
    await loggEpostAnteckning(projekt_id, aliasToUse, till, m.amne).catch(() => {})

    return { epost_skickad: true, epost_till: till, epost_amne: m.amne }
  },

  'action:queue-epost': async ({ nodeConfig, collectedData, workflowInput }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string | null
    const kund = collectedData.kunder as Record<string, unknown> | null
    const kund_id = (kund?.id as string | undefined) ?? null
    const forslag_id = (collectedData.forslag_id as string | undefined) ?? null
    const faktura_id = (collectedData.faktura_id as string | undefined) ?? null

    const mall_id = (nodeConfig.mall_id as string) || ''
    if (!mall_id) throw new Error('Ingen e-postmall vald i noden.')

    const till_source = (nodeConfig.till_source as string) || 'kund_email'
    let till = ''
    if (till_source === 'manual') {
      till = ((nodeConfig.till_manual as string) || '').trim()
    } else {
      till = ((kund?.email as string | undefined) ?? '').trim()
    }
    if (!till) throw new Error(
      till_source === 'manual'
        ? 'Manuell mottagaradress saknas i nodens konfiguration.'
        : 'Kunden saknar e-postadress. Lägg till en data:projekt-nod före denna eller ändra mottagare till manuell.'
    )
    const cc = ((nodeConfig.cc as string) || '').trim() || ''

    const alias = await loadAlias((nodeConfig.alias_id as string) || null)
    if (!alias) throw new Error('Inget alias konfigurerat — gå till Inställningar → E-post alias')

    const ctx = await resolveContext({ kund_id, projekt_id, forslag_id, faktura_id, alias })
    const m = await applyMall(mall_id, ctx)
    const aliasIdToStore = m.alias_id ?? alias.id

    let bilagor: EpostBilagaRef[] = []
    const bilaga_key = (nodeConfig.bilaga_kalla as string) || ''
    if (bilaga_key) {
      const raw = collectedData[bilaga_key]
      if (Array.isArray(raw)) bilagor = raw as EpostBilagaRef[]
    }

    const minuter = Math.max(0, Number(nodeConfig.schemalagd_om_minuter ?? 60))
    const schemalagd_till = new Date(Date.now() + minuter * 60 * 1000).toISOString()

    const { data, error } = await supabase.from('epost_ko').insert({
      alias_id: aliasIdToStore,
      mall_id,
      till,
      cc,
      amne: m.amne,
      kropp_html: m.kropp_html,
      bilagor,
      kund_id,
      projekt_id,
      forslag_id,
      faktura_id,
      schemalagd_till,
    }).select('id').single()
    if (error || !data) throw new Error(`Kunde inte köa e-post: ${error?.message ?? ''}`)

    return {
      epost_kö_id: data.id,
      epost_till: till,
      epost_amne: m.amne,
      schemalagd_till,
    }
  },

  // ── Fas-mall från AI ──────────────────────────────────────────────────────

  'action:create-fas-mall-from-ai': async ({ collectedData, workflowInput }) => {
    const projekt_id = (collectedData.id ?? workflowInput.projekt_id) as string
    if (!projekt_id) throw new Error('projekt_id saknas')

    const ai_output = collectedData.ai_output as {
      mall_namn?: string
      faser?: { namn: string; subfaser?: string[] }[]
    } | null
    if (!ai_output?.faser?.length) throw new Error(
      'AI-svaret innehåller inga faser. Kontrollera att ai:generate-noden körs före denna och returnerar { "mall_namn": "...", "faser": [...] }.'
    )

    const mall_namn = ai_output.mall_namn?.trim() || `Fas-mall ${new Date().toLocaleDateString('sv-SE')}`

    const { data: mall, error: mallErr } = await supabase
      .from('fas_mallar')
      .insert({ namn: mall_namn, beskrivning: 'Genererad av AI' })
      .select('id, namn')
      .single()
    if (mallErr || !mall) throw new Error(`Kunde inte skapa fas-mall: ${mallErr?.message ?? ''}`)

    let fas_count = 0, subfas_count = 0
    for (let i = 0; i < ai_output.faser.length; i++) {
      const { namn, subfaser = [] } = ai_output.faser[i]
      const { data: fas, error: fasErr } = await supabase
        .from('fas_mall_faser')
        .insert({ mall_id: mall.id, namn, sortering: i })
        .select('id')
        .single()
      if (fasErr || !fas) throw new Error(`Kunde inte skapa fas "${namn}": ${fasErr?.message ?? ''}`)
      fas_count++

      if (subfaser.length > 0) {
        const { error: subErr } = await supabase
          .from('fas_mall_subfaser')
          .insert(subfaser.map((s, j) => ({ fas_id: fas.id, namn: s, sortering: j })))
        if (subErr) throw new Error(`Kunde inte skapa subfaser för "${namn}": ${subErr.message}`)
        subfas_count += subfaser.length
      }
    }

    return { mall_id: mall.id, mall_namn: mall.namn, fas_count, subfas_count }
  },

  // ── AI ────────────────────────────────────────────────────────────────────

  'ai:generate': async ({ nodeConfig, collectedData, workflowInput, aiChat }) => {
    const skipKeys = Array.isArray(nodeConfig.skip_if_empty) ? nodeConfig.skip_if_empty as string[] : []
    if (skipKeys.length > 0) {
      // data:context auto-parses JSON-string values to objects, so this check
      // must accept objects/arrays as "present" — only treat null, undefined,
      // empty string, empty array and empty object as "empty".
      const isEmpty = (v: unknown): boolean => {
        if (v === undefined || v === null) return true
        if (typeof v === 'string') return v.trim() === ''
        if (Array.isArray(v)) return v.length === 0
        if (typeof v === 'object') return Object.keys(v as object).length === 0
        return false
      }
      const allEmpty = skipKeys.every((key) => isEmpty(collectedData[key]))
      if (allEmpty) return { ai_output: null, ai_raw: '', ai_skipped: true }
    }
    const assistent_id = (nodeConfig.assistent_id as string) || (workflowInput.assistent_id as string)
    if (!assistent_id) throw new Error('Ingen AI-assistent vald. Välj en assistent i kördialogens "AI-assistent"-fält.')
    const promptTemplate = (nodeConfig.prompt_template as string) ?? ''
    if (!promptTemplate) throw new Error('prompt_template saknas i AI-nod konfiguration')

    // ── Batch mode: split valda_subfaser into groups to avoid max_tokens truncation ──
    // Activate with batch_faser:true in node config. batch_merge_key defaults to "estimat".
    if (nodeConfig.batch_faser === true) {
      const batchSize = Math.max(1, (nodeConfig.batch_size as number) || 5)
      const mergeKey = (nodeConfig.batch_merge_key as string) || 'estimat'
      const raw = collectedData.projekt_faser_urval
      if (!raw) throw new Error('projekt_faser_urval saknas för batch-läge')
      const fasUrval = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>
      const valdaSubfaser = fasUrval.valda_subfaser as Array<{ fas: string; subfaser: string[] }>
      if (!Array.isArray(valdaSubfaser) || valdaSubfaser.length === 0) throw new Error('valda_subfaser är tom')

      const mergedItems: unknown[] = []
      const numericTotals: Record<string, number> = {}
      const arrayExtras: Record<string, unknown[]> = {}

      for (let i = 0; i < valdaSubfaser.length; i += batchSize) {
        const batch = valdaSubfaser.slice(i, i + batchSize)
        const batchUrval = { ...fasUrval, valda_subfaser: batch, valda_faser: batch.map(b => b.fas) }
        const batchData = { ...collectedData, projekt_faser_urval: JSON.stringify(batchUrval) }
        const prompt = interpolateTemplate(promptTemplate, batchData)
        const text = await aiChat(assistent_id, [{ role: 'user', content: prompt }])
        const batchResult = tryParseJson(text) as Record<string, unknown> | undefined
        if (!batchResult) {
          const head = text.slice(0, 200)
          const hint = !text.trimEnd().endsWith('}') && !text.trimEnd().endsWith(']')
            ? ' (avhugget av max_tokens)' : ''
          throw new Error(`Batch-AI-svar (fas ${i / batchSize + 1}) kunde inte parsas. Längd: ${text.length}${hint}.\nBörjan: ${head}`)
        }
        if (Array.isArray(batchResult[mergeKey])) mergedItems.push(...(batchResult[mergeKey] as unknown[]))
        for (const [k, v] of Object.entries(batchResult)) {
          if (k === mergeKey) continue
          if (typeof v === 'number') numericTotals[k] = (numericTotals[k] ?? 0) + v
          else if (Array.isArray(v)) { arrayExtras[k] = arrayExtras[k] ?? []; arrayExtras[k].push(...v) }
        }
      }

      const merged: Record<string, unknown> = { [mergeKey]: mergedItems, ...numericTotals, ...arrayExtras }
      return { ai_output: merged, ai_raw: JSON.stringify(merged) }
    }

    const prompt = interpolateTemplate(promptTemplate, collectedData)
    const text = await aiChat(assistent_id, [{ role: 'user', content: prompt }])
    const parsed = tryParseJson(text)
    if (parsed === undefined && expectsJson(promptTemplate)) {
      const head = text.slice(0, 200)
      const tail = text.length > 400 ? '\n…\n' + text.slice(-200) : ''
      const truncatedHint = !text.trimEnd().endsWith('}') && !text.trimEnd().endsWith(']')
        ? ' (slutar inte med } eller ] — sannolikt avhugget av max_tokens)'
        : ''
      throw new Error(
        `AI-svaret förväntades vara JSON men kunde inte parsas. ` +
        `Längd: ${text.length} tecken${truncatedHint}.\n` +
        `Början: ${head}${tail}`
      )
    }
    // When the AI returned JSON (with or without fences), persist the canonical
    // serialization in ai_raw so downstream nodes that read it as a string can
    // JSON.parse it cleanly. For plain text outputs, keep the original text.
    const ai_raw = parsed !== undefined ? JSON.stringify(parsed) : text
    return { ai_output: parsed ?? null, ai_raw }
  },

}

// ── Run engine ─────────────────────────────────────────────────────────────

// Keys that hold transient binary blobs (base64 attachments produced by
// data:projekt:dokument). They must stay in collectedData during execution
// so AI nodes can read them, but never get persisted to workflow_runs —
// a JSONB row of several MB hits the Supabase API statement_timeout (57014).
const TRANSIENT_BLOB_KEYS = ['bilder', 'pdf_filer', 'dokument_lista'] as const

function stripPersistedBlobs<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj
  const clone: Record<string, unknown> = { ...(obj as Record<string, unknown>) }
  for (const key of TRANSIENT_BLOB_KEYS) delete clone[key]
  return clone as T
}

async function runWorkflow(
  event: IpcMainInvokeEvent,
  workflow_id: string,
  input: Record<string, unknown>,
  trigger_type: string
): Promise<WorkflowRunResult> {
  const { data: wf, error: wfErr } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', workflow_id)
    .single()
  if (wfErr || !wf) throw new Error(`Workflow inte hittad (id=${workflow_id}): ${wfErr?.message ?? 'no row returned'}`)

  const definition = wf.definition as { nodes: WorkflowNode[]; edges: { from: string; to: string }[] }
  const nodes = [...definition.nodes].sort((a, b) => a.position - b.position)

  const { data: run, error: runErr } = await supabase
    .from('workflow_runs')
    .insert({ workflow_id, trigger_type, status: 'kör', input_json: stripPersistedBlobs(input) })
    .select('id')
    .single()
  if (runErr || !run) {
    throw new Error(
      `Kunde inte skapa workflow_run för "${wf.namn}": ${runErr?.message ?? 'no row returned'}` +
      ` | code=${runErr?.code ?? '-'} hint=${runErr?.hint ?? '-'} details=${runErr?.details ?? '-'}`
    )
  }
  const run_id: string = run.id

  const startedAt = Date.now()
  const nodeResults: Record<string, WorkflowNodeResult> = {}
  const collectedData: Record<string, unknown> = { ...input }

  function pushProgress(node_id: string, status: WorkflowRunStatus, output?: Record<string, unknown>, error?: string) {
    const payload: WorkflowProgressEvent = { run_id, node_id, status, output, error }
    if (!event.sender.isDestroyed()) {
      event.sender.send('workflow:progress', payload)
    }
  }

  for (const node of nodes) {
    pushProgress(node.id, 'kör')

    const nodeStart = Date.now()
    const executor = NODE_EXECUTORS[node.type]

    if (!executor) {
      const errMsg = `Ingen executor för nod-typ: ${node.type}`
      nodeResults[node.id] = { status: 'fel', output: null, error: errMsg, duration_ms: 0 }
      pushProgress(node.id, 'fel', undefined, errMsg)

      await supabase.from('workflow_runs').update({
        status: 'fel',
        node_results: nodeResults,
        error_node: node.id,
        error_msg: errMsg,
        avslutad_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt
      }).eq('id', run_id)

      return { run_id, status: 'fel', output: null, error_node: node.id, error_msg: errMsg, duration_ms: Date.now() - startedAt }
    }

    try {
      const output = await executor({
        run_id,
        workflowInput: input,
        collectedData,
        nodeConfig: node.config,
        aiChat: executeChatWithAssistent
      })

      Object.assign(collectedData, output)
      const duration_ms = Date.now() - nodeStart
      nodeResults[node.id] = { status: 'klar', output: stripPersistedBlobs(output), error: null, duration_ms }
      pushProgress(node.id, 'klar', output)

      supabase.from('workflow_runs')
        .update({ node_results: nodeResults })
        .eq('id', run_id)
        .then(() => {})

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const duration_ms = Date.now() - nodeStart
      nodeResults[node.id] = { status: 'fel', output: null, error: errMsg, duration_ms }
      pushProgress(node.id, 'fel', undefined, errMsg)

      await supabase.from('workflow_runs').update({
        status: 'fel',
        node_results: nodeResults,
        error_node: node.id,
        error_msg: errMsg,
        avslutad_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt
      }).eq('id', run_id)

      return { run_id, status: 'fel', output: null, error_node: node.id, error_msg: errMsg, duration_ms: Date.now() - startedAt }
    }
  }

  const duration_ms = Date.now() - startedAt
  await supabase.from('workflow_runs').update({
    status: 'klar',
    node_results: nodeResults,
    output_json: stripPersistedBlobs(collectedData),
    avslutad_at: new Date().toISOString(),
    duration_ms
  }).eq('id', run_id)

  return { run_id, status: 'klar', output: collectedData, error_node: null, error_msg: null, duration_ms }
}

// ── IPC handlers ───────────────────────────────────────────────────────────

const CHANNELS = [
  'db:projekt-context:list',
  'db:projekt-context:delete',
  'db:workflows:list',
  'db:workflows:get',
  'db:workflows:create',
  'db:workflows:update',
  'db:workflows:delete',
  'db:sequences:list',
  'db:sequences:create',
  'db:sequences:update',
  'db:sequences:delete',
  'db:workflow-triggers:list',
  'db:workflow-triggers:create',
  'db:workflow-triggers:delete',
  'db:workflow-runs:list-by-workflow',
  'db:workflow-runs:get',
  'db:sequence-runs:find-resumable',
  'db:sequence-runs:start',
  'db:sequence-runs:advance',
  'db:sequence-runs:finish',
  'db:sequence-runs:cancel',
  'workflow:run',
] as const

export function registerWorkflowHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  // Watchdog: any run still in 'kör' at startup belongs to a previous Electron
  // session that died (crash, force-quit, provider HTTP hang). Mark them as
  // failed so the UI doesn't show eternal spinners.
  void supabase
    .from('workflow_runs')
    .update({
      status: 'fel',
      avslutad_at: new Date().toISOString(),
      error_msg: 'Run övergivet vid app-omstart (tidigare session avslutades innan run var klart).',
    })
    .eq('status', 'kör')
    .then(({ error, count }) => {
      if (error) console.error('[workflow watchdog] cleanup failed:', error.message)
      else if (count) console.log(`[workflow watchdog] cleaned ${count} abandoned run(s)`)
    })

  ipcMain.handle('db:projekt-context:list', async (_, projekt_id: string) => {
    const { data, error } = await supabase
      .from('projekt_context')
      .select('id, nyckel, varde, skapad_at, uppdaterad_at')
      .eq('projekt_id', projekt_id)
      .order('uppdaterad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  })

  ipcMain.handle('db:projekt-context:delete', async (_, id: string) => {
    const { error } = await supabase.from('projekt_context').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:workflows:list', async () => {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .order('sortering')
    if (error) throw new Error(error.message)

    const workflows = data as Workflow[]

    // Augment each workflow with its last run summary
    const withLastRun = await Promise.all(
      workflows.map(async (wf) => {
        const { data: runs } = await supabase
          .from('workflow_runs')
          .select('id, status, startad_at, duration_ms')
          .eq('workflow_id', wf.id)
          .order('startad_at', { ascending: false })
          .limit(1)
        return { ...wf, lastRun: runs?.[0] ?? null }
      })
    )
    return withLastRun
  })

  ipcMain.handle('db:workflows:get', async (_, id: string) => {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:workflows:create', async (_, input: { namn: string; beskrivning?: string; kategori?: string }) => {
    const { data, error } = await supabase
      .from('workflows')
      .insert({
        namn: input.namn,
        beskrivning: input.beskrivning ?? '',
        kategori: input.kategori ?? 'forslag',
        definition: { nodes: [], edges: [] }
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:workflows:update', async (_, id: string, input: {
    namn?: string
    beskrivning?: string
    kategori?: string
    definition?: { nodes: WorkflowNode[]; edges: { from: string; to: string }[] }
    aktiv?: boolean
    sortering?: number
  }) => {
    const { data, error } = await supabase
      .from('workflows')
      .update({ ...input, uppdaterad_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:workflows:delete', async (_, id: string) => {
    const { error } = await supabase.from('workflows').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:sequences:list', async () => {
    const { data, error } = await supabase
      .from('workflow_sequences')
      .select('*')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{ id: string; workflow_ids: string[] } & Record<string, unknown>>
    const allIds = [...new Set(rows.flatMap(r => r.workflow_ids ?? []))]
    let wfMap: Record<string, { id: string; namn: string }> = {}
    if (allIds.length > 0) {
      const { data: wfs } = await supabase.from('workflows').select('id, namn').in('id', allIds)
      for (const wf of wfs ?? []) wfMap[wf.id] = wf
    }
    return rows.map(r => ({
      ...r,
      workflows: (r.workflow_ids ?? []).map((id: string) => wfMap[id]).filter(Boolean),
    }))
  })

  ipcMain.handle('db:sequences:create', async (_, input: { namn: string; beskrivning?: string; workflow_ids: string[] }) => {
    const { data, error } = await supabase
      .from('workflow_sequences')
      .insert({ namn: input.namn, beskrivning: input.beskrivning ?? '', workflow_ids: input.workflow_ids })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:sequences:update', async (_, id: string, patch: { namn?: string; beskrivning?: string; workflow_ids?: string[]; aktiv?: boolean }) => {
    const { data, error } = await supabase
      .from('workflow_sequences')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:sequences:delete', async (_, id: string) => {
    const { error } = await supabase.from('workflow_sequences').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:workflow-triggers:list', async (_, seccion?: string) => {
    let query = supabase
      .from('workflow_triggers')
      .select('*, workflow:workflows(id, namn, definition)')
      .order('sortering')
    if (seccion) query = query.eq('seccion', seccion)
    const { data, error } = await query
    if (error) throw new Error(error.message)

    type TriggerRow = Record<string, unknown> & {
      sequence_id?: string | null
      sequence_ids?: string[] | null
    }
    const rows = (data ?? []) as TriggerRow[]

    // Hydrate sequence entities (new FK)
    const seqIds = [...new Set(rows.map(r => r.sequence_id).filter(Boolean) as string[])]
    let seqMap: Record<string, Record<string, unknown> & { workflow_ids: string[] }> = {}
    if (seqIds.length > 0) {
      const { data: seqs } = await supabase.from('workflow_sequences').select('*').in('id', seqIds)
      for (const s of seqs ?? []) seqMap[s.id] = s as typeof seqMap[string]
    }

    // Hydrate workflow names for both new sequences and legacy sequence_ids
    const allWfIds = [...new Set([
      ...Object.values(seqMap).flatMap(s => s.workflow_ids ?? []),
      ...rows.flatMap(r => r.sequence_ids ?? []),
    ])]
    let wfMap: Record<string, { id: string; namn: string }> = {}
    if (allWfIds.length > 0) {
      const { data: wfs } = await supabase.from('workflows').select('id, namn').in('id', allWfIds)
      for (const wf of wfs ?? []) wfMap[wf.id] = wf
    }

    return rows.map(r => {
      const seq = r.sequence_id ? seqMap[r.sequence_id] : null
      return {
        ...r,
        sequence: seq
          ? { ...seq, workflows: (seq.workflow_ids ?? []).map((id: string) => wfMap[id]).filter(Boolean) }
          : null,
        // legacy
        sequence_workflows: r.sequence_ids
          ? (r.sequence_ids as string[]).map(id => wfMap[id]).filter(Boolean)
          : null,
      }
    })
  })

  ipcMain.handle('db:workflow-triggers:create', async (_, input: {
    workflow_id?: string | null
    sequence_id?: string | null
    sequence_ids?: string[] | null
    seccion: string
    etikett: string
    icon?: string
  }) => {
    const { data, error } = await supabase
      .from('workflow_triggers')
      .insert({
        workflow_id: input.workflow_id ?? null,
        sequence_id: input.sequence_id ?? null,
        sequence_ids: input.sequence_ids ?? null,
        seccion: input.seccion,
        etikett: input.etikett,
        icon: input.icon ?? 'Zap',
      })
      .select('*, workflow:workflows(id, namn, definition)')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:workflow-triggers:delete', async (_, id: string) => {
    const { error } = await supabase.from('workflow_triggers').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:workflow-runs:list-by-workflow', async (_, workflow_id: string, limit = 20) => {
    const { data, error } = await supabase
      .from('workflow_runs')
      .select('id, status, trigger_type, input_json, startad_at, avslutad_at, duration_ms, error_node, error_msg')
      .eq('workflow_id', workflow_id)
      .order('startad_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return data ?? []
  })

  ipcMain.handle('db:workflow-runs:get', async (_, run_id: string) => {
    const { data, error } = await supabase
      .from('workflow_runs')
      .select('*')
      .eq('id', run_id)
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  // ── Sequence runs (chain checkpoint / resume) ─────────────────────────────

  ipcMain.handle('db:sequence-runs:find-resumable', async (
    _,
    sequence_id: string,
    projekt_id: string
  ) => {
    if (!sequence_id || !projekt_id) return null
    const { data, error } = await supabase
      .from('sequence_runs')
      .select('*')
      .eq('sequence_id', sequence_id)
      .eq('projekt_id', projekt_id)
      .eq('status', 'fel')
      .order('uppdaterad_at', { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    return data?.[0] ?? null
  })

  ipcMain.handle('db:sequence-runs:start', async (_, input: {
    sequence_id: string | null
    trigger_id?: string | null
    projekt_id: string | null
    workflow_ids: string[]
    initial_input: Record<string, unknown>
  }) => {
    const { data, error } = await supabase
      .from('sequence_runs')
      .insert({
        sequence_id: input.sequence_id,
        trigger_id: input.trigger_id ?? null,
        projekt_id: input.projekt_id,
        workflow_ids: input.workflow_ids,
        collected_input: input.initial_input,
        current_step: 0,
        status: 'kör',
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:sequence-runs:advance', async (_, input: {
    id: string
    next_step: number
    workflow_run_id: string
    collected_input: Record<string, unknown>
  }) => {
    // Append run id to the array via RPC-less read+write. Acceptable here
    // because there is at most one writer per sequence_run (the renderer
    // that owns the in-flight chain).
    const { data: current, error: readErr } = await supabase
      .from('sequence_runs')
      .select('workflow_run_ids')
      .eq('id', input.id)
      .single()
    if (readErr) throw new Error(readErr.message)
    const ids: string[] = Array.isArray(current?.workflow_run_ids)
      ? (current.workflow_run_ids as string[])
      : []
    ids.push(input.workflow_run_id)

    const { error } = await supabase
      .from('sequence_runs')
      .update({
        current_step: input.next_step,
        workflow_run_ids: ids,
        collected_input: input.collected_input,
        status: 'kör',
        uppdaterad_at: new Date().toISOString(),
      })
      .eq('id', input.id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:sequence-runs:finish', async (_, input: {
    id: string
    status: 'klar' | 'fel' | 'avbruten'
    error_step?: number | null
    error_msg?: string | null
  }) => {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('sequence_runs')
      .update({
        status: input.status,
        error_step: input.error_step ?? null,
        error_msg: input.error_msg ?? null,
        uppdaterad_at: now,
        avslutad_at: now,
      })
      .eq('id', input.id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:sequence-runs:cancel', async (_, id: string) => {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('sequence_runs')
      .update({ status: 'avbruten', uppdaterad_at: now, avslutad_at: now })
      .eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('workflow:run', (event, input: WorkflowRunInput) => {
    return runWorkflow(
      event,
      input.workflow_id,
      input.input,
      input.trigger_type ?? 'manual'
    )
  })
}
