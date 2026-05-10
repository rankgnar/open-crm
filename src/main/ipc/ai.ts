import { ipcMain } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '../supabase'
import { executeChatWithAssistent } from './ai-chat-fn'
import type { AiProviderSlug, AiProvider, AiAssistent, AiTestResult, AiChatMessage } from '../../renderer/src/sections/installningar/types'

const OPENROUTER_DEFAULT_BASE = 'https://openrouter.ai/api/v1'

interface TranslatorConfig {
  slug: AiProviderSlug
  apiKey: string
  baseUrl: string
  modelId: string
  systemPrompt: string
  maxTokens: number
  temperature: number
}
let translatorCache: TranslatorConfig | null = null

const MODELS: Record<AiProviderSlug, string[]> = {
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-6', 'claude-haiku-3-5'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3', 'o3-mini'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash-001'],
  openrouter: [
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-haiku-4.5',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'google/gemini-2.5-pro',
    'meta-llama/llama-3.3-70b-instruct',
    'deepseek/deepseek-chat'
  ]
}

let openrouterModelsCache: { ts: number; models: string[] } | null = null

function maskApiKey(raw: string): string {
  if (!raw) return ''
  if (raw.length <= 4) return '••••'
  return '•'.repeat(Math.min(8, raw.length - 4)) + raw.slice(-4)
}

function isMasked(val: string): boolean {
  return val.startsWith('•')
}

async function getProviderRaw(slug: AiProviderSlug): Promise<{ api_key: string; base_url: string } | null> {
  const { data, error } = await supabase
    .from('ai_providers')
    .select('api_key, base_url')
    .eq('provider_slug', slug)
    .single()
  if (error || !data) return null
  return data
}

export function registerAiHandlers(): void {
  // ── Providers ──────────────────────────────────────────────────────────────

  ipcMain.handle('ai:providers:list', async () => {
    const { data, error } = await supabase
      .from('ai_providers')
      .select('*')
      .order('sortering')
    if (error) throw new Error(error.message)
    return (data as AiProvider[]).map((p) => ({ ...p, api_key: maskApiKey(p.api_key) }))
  })

  ipcMain.handle('ai:providers:update', async (_, input: { id: string; api_key?: string; base_url?: string; aktiv?: boolean }) => {
    const update: Record<string, unknown> = {}
    if (input.base_url !== undefined) update.base_url = input.base_url
    if (input.aktiv !== undefined) update.aktiv = input.aktiv
    if (input.api_key !== undefined && !isMasked(input.api_key)) {
      update.api_key = input.api_key
    }
    if (Object.keys(update).length === 0) {
      const { data } = await supabase.from('ai_providers').select('*').eq('id', input.id).single()
      return { ...(data as AiProvider), api_key: maskApiKey((data as AiProvider).api_key) }
    }
    const { data, error } = await supabase
      .from('ai_providers')
      .update(update)
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return { ...(data as AiProvider), api_key: maskApiKey((data as AiProvider).api_key) }
  })

  ipcMain.handle('ai:providers:test', async (_, { provider_slug }: { provider_slug: AiProviderSlug }): Promise<AiTestResult> => {
    const raw = await getProviderRaw(provider_slug)
    if (!raw) return { ok: false, latency_ms: 0, error: 'Proveedor no encontrado' }

    const start = Date.now()
    try {
      if (provider_slug === 'anthropic') {
        if (!raw.api_key) return { ok: false, latency_ms: 0, error: 'API key saknas' }
        const client = new Anthropic({ apiKey: raw.api_key })
        await client.messages.create({ model: 'claude-haiku-3-5', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] })
      } else if (provider_slug === 'openai') {
        if (!raw.api_key) return { ok: false, latency_ms: 0, error: 'API key saknas' }
        const client = new OpenAI({ apiKey: raw.api_key })
        await client.chat.completions.create({ model: 'gpt-4o-mini', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] })
      } else if (provider_slug === 'google') {
        if (!raw.api_key) return { ok: false, latency_ms: 0, error: 'API key saknas' }
        const client = new GoogleGenAI({ apiKey: raw.api_key })
        await client.models.generateContent({ model: 'gemini-2.5-flash', contents: 'hi' })
      } else if (provider_slug === 'openrouter') {
        if (!raw.api_key) return { ok: false, latency_ms: 0, error: 'API key saknas' }
        const baseUrl = raw.base_url || OPENROUTER_DEFAULT_BASE
        const res = await fetch(`${baseUrl}/auth/key`, {
          headers: { Authorization: `Bearer ${raw.api_key}` }
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      }
      return { ok: true, latency_ms: Date.now() - start }
    } catch (err) {
      return { ok: false, latency_ms: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('ai:providers:models', async (_, { provider_slug }: { provider_slug: AiProviderSlug }): Promise<string[]> => {
    if (provider_slug === 'openrouter') {
      try {
        const raw = await getProviderRaw('openrouter')
        if (!raw?.api_key) return MODELS.openrouter
        if (openrouterModelsCache && Date.now() - openrouterModelsCache.ts < 15 * 60_000) {
          return openrouterModelsCache.models
        }
        const baseUrl = raw.base_url || OPENROUTER_DEFAULT_BASE
        const res = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${raw.api_key}` }
        })
        if (!res.ok) return MODELS.openrouter
        const json = (await res.json()) as { data: { id: string }[] }
        const ids = json.data.map((m) => m.id).sort()
        openrouterModelsCache = { ts: Date.now(), models: ids }
        return ids.length > 0 ? ids : MODELS.openrouter
      } catch {
        return MODELS.openrouter
      }
    }
    if (provider_slug === 'google') {
      try {
        const raw = await getProviderRaw('google')
        if (!raw?.api_key) return MODELS.google
        const client = new GoogleGenAI({ apiKey: raw.api_key })
        const names: string[] = []
        for await (const m of await client.models.list({ config: { pageSize: 50 } })) {
          const name = m.name?.replace('models/', '') ?? ''
          if (name.startsWith('gemini-') && m.supportedActions?.includes('generateContent')) {
            names.push(name)
          }
        }
        return names.length > 0 ? names : MODELS.google
      } catch {
        return MODELS.google
      }
    }
    return MODELS[provider_slug] ?? []
  })

  // ── Asistenter ─────────────────────────────────────────────────────────────

  ipcMain.handle('ai:asistenter:list', async () => {
    const { data, error } = await supabase
      .from('ai_asistenter')
      .select('*, provider:ai_providers(provider_slug, display_name)')
      .order('sortering')
    if (error) throw new Error(error.message)
    return data as AiAssistent[]
  })

  ipcMain.handle('ai:asistenter:create', async (_, input: Omit<AiAssistent, 'id' | 'skapad_at' | 'uppdaterad_at' | 'provider'>) => {
    const { data, error } = await supabase
      .from('ai_asistenter')
      .insert(input)
      .select('*, provider:ai_providers(provider_slug, display_name)')
      .single()
    if (error) throw new Error(error.message)
    return data as AiAssistent
  })

  ipcMain.handle('ai:asistenter:update', async (_, input: { id: string } & Partial<AiAssistent>) => {
    const { id, provider, skapad_at, uppdaterad_at, ...fields } = input
    const { data, error } = await supabase
      .from('ai_asistenter')
      .update(fields)
      .eq('id', id)
      .select('*, provider:ai_providers(provider_slug, display_name)')
      .single()
    if (error) throw new Error(error.message)
    translatorCache = null
    return data as AiAssistent
  })

  ipcMain.handle('ai:asistenter:delete', async (_, id: string) => {
    const { error } = await supabase.from('ai_asistenter').delete().eq('id', id)
    if (error) throw new Error(error.message)
    translatorCache = null
  })

  ipcMain.handle('ai:asistenter:set-standard', async (_, id: string) => {
    await supabase.from('ai_asistenter').update({ ar_standard: false }).neq('id', id)
    const { error } = await supabase.from('ai_asistenter').update({ ar_standard: true }).eq('id', id)
    if (error) throw new Error(error.message)
  })

  // ── Chat ───────────────────────────────────────────────────────────────────

  ipcMain.handle('ai:chat', async (_, { assistent_id, messages }: { assistent_id: string; messages: AiChatMessage[] }): Promise<string> => {
    return executeChatWithAssistent(assistent_id, messages)
  })

  // ── Translate ──────────────────────────────────────────────────────────────

  ipcMain.handle('ai:translate', async (_, { text, direction }: { text: string; direction: 'sv-es' | 'es-sv' }): Promise<string> => {
    if (!translatorCache) {
      const { data, error } = await supabase
        .from('ai_asistenter')
        .select('model_id, system_prompt, max_tokens, temperature, provider:ai_providers(provider_slug, api_key, base_url)')
        .eq('namn', 'Translator')
        .eq('aktiv', true)
        .single()
      if (error || !data) throw new Error('Assistant "Translator" not found. Create it in Avancerat → IA-Assistent.')
      const p = data.provider as unknown as { provider_slug: AiProviderSlug; api_key: string; base_url: string }
      translatorCache = {
        slug: p.provider_slug,
        apiKey: p.api_key,
        baseUrl: p.base_url,
        modelId: data.model_id,
        systemPrompt: data.system_prompt,
        maxTokens: data.max_tokens,
        temperature: Number(data.temperature)
      }
    }

    const { slug, apiKey, baseUrl, modelId, systemPrompt, maxTokens, temperature } = translatorCache
    const userMessage = direction === 'sv-es'
      ? `Translate to Spanish:\n\n${text}`
      : `Translate to Swedish:\n\n${text}`

    if (slug === 'anthropic') {
      const client = new Anthropic({ apiKey })
      const res = await client.messages.create({
        model: modelId,
        max_tokens: maxTokens,
        system: systemPrompt || undefined,
        messages: [{ role: 'user', content: userMessage }]
      })
      const block = res.content[0]
      return block.type === 'text' ? block.text : ''
    }

    if (slug === 'openai' || slug === 'openrouter') {
      const client = new OpenAI({
        apiKey,
        baseURL: baseUrl || (slug === 'openrouter' ? OPENROUTER_DEFAULT_BASE : undefined),
        ...(slug === 'openrouter' ? { defaultHeaders: { 'HTTP-Referer': 'https://open-crm.local', 'X-Title': 'open-crm' } } : {})
      })
      const res = await client.chat.completions.create({
        model: modelId,
        max_tokens: maxTokens,
        temperature,
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user', content: userMessage }
        ]
      })
      return res.choices[0]?.message?.content ?? ''
    }

    if (slug === 'google') {
      const client = new GoogleGenAI({ apiKey })
      const res = await client.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {})
      })
      return res.text ?? ''
    }

    throw new Error(`Provider not supported: ${slug}`)
  })
}
