import { ipcMain } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '../supabase'
import { executeChatWithAssistent } from './ai-chat-fn'
import type { AiProviderSlug, AiProvider, AiAssistent, AiTestResult, AiChatMessage } from '../../renderer/src/sections/installningar/types'

const OPENROUTER_DEFAULT_BASE = 'https://openrouter.ai/api/v1'

const MODELS: Record<AiProviderSlug, string[]> = {
  anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
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
    if (!raw) return { ok: false, latency_ms: 0, error: 'Leverantör hittades inte' }

    const start = Date.now()
    try {
      if (provider_slug === 'anthropic') {
        if (!raw.api_key) return { ok: false, latency_ms: 0, error: 'API key saknas' }
        const client = new Anthropic({ apiKey: raw.api_key })
        await client.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] })
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
    return data as AiAssistent
  })

  ipcMain.handle('ai:asistenter:delete', async (_, id: string) => {
    const { error } = await supabase.from('ai_asistenter').delete().eq('id', id)
    if (error) throw new Error(error.message)
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

}
