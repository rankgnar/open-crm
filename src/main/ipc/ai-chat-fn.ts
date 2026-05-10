import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenAI, type Tool } from '@google/genai'
import { supabase } from '../supabase'
import type { AiProviderSlug } from '../../renderer/src/sections/installningar/types'

const OPENROUTER_DEFAULT_BASE = 'https://openrouter.ai/api/v1'
const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://open-crm.local',
  'X-Title': 'open-crm'
}

export async function executeChatWithAssistent(
  assistent_id: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const { data: assistent, error: aErr } = await supabase
    .from('ai_asistenter')
    .select('*, provider:ai_providers(provider_slug, api_key, base_url)')
    .eq('id', assistent_id)
    .single()
  if (aErr || !assistent) throw new Error('Assistent inte hittad')

  const slug: AiProviderSlug = assistent.provider.provider_slug
  const apiKey: string = assistent.provider.api_key
  const baseUrl: string = assistent.provider.base_url
  const systemPrompt: string = assistent.system_prompt
  const modelId: string = assistent.model_id
  const maxTokens: number = assistent.max_tokens
  const temperature: number = Number(assistent.temperature)

  if (slug === 'anthropic') {
    const client = new Anthropic({ apiKey })
    const res = await client.messages.create({
      model: modelId,
      max_tokens: maxTokens,
      system: systemPrompt || undefined,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    })
    const block = res.content[0]
    return block.type === 'text' ? block.text : ''
  }

  if (slug === 'openai' || slug === 'openrouter') {
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl || (slug === 'openrouter' ? OPENROUTER_DEFAULT_BASE : undefined),
      ...(slug === 'openrouter' ? { defaultHeaders: OPENROUTER_HEADERS } : {})
    })
    const res = await client.chat.completions.create({
      model: modelId,
      max_tokens: maxTokens,
      temperature,
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      ]
    })
    return res.choices[0]?.message?.content ?? ''
  }

  if (slug === 'google') {
    const client = new GoogleGenAI({ apiKey })
    const res = await client.models.generateContent({
      model: modelId,
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {})
    })
    return res.text ?? ''
  }

  throw new Error(`Okänd provider: ${slug}`)
}

// ── Google Search grounding ────────────────────────────────────────────────
// Only works with Google/Gemini provider. Falls back to regular chat for others.

export async function executeChatWithWebSearch(
  assistent_id: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const { data: assistent, error: aErr } = await supabase
    .from('ai_asistenter')
    .select('*, provider:ai_providers(provider_slug, api_key, base_url)')
    .eq('id', assistent_id)
    .single()
  if (aErr || !assistent) throw new Error('Assistent inte hittad')

  const slug: AiProviderSlug = assistent.provider.provider_slug

  if (slug !== 'google') {
    return executeChatWithAssistent(assistent_id, messages)
  }

  const apiKey: string = assistent.provider.api_key
  const systemPrompt: string = assistent.system_prompt
  const modelId: string = assistent.model_id
  const maxTokens: number = assistent.max_tokens

  const client = new GoogleGenAI({ apiKey })
  const groundingTools: Tool[] = [{ googleSearch: {} }]

  const res = await client.models.generateContent({
    model: modelId,
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    config: {
      tools: groundingTools,
      maxOutputTokens: maxTokens,
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    },
  })
  return res.text ?? ''
}

// ── File attachment support ────────────────────────────────────────────────

export interface FileAttachment {
  filnamn: string
  mime_type: string
  data_base64: string
}

export async function executeChatWithFiles(
  assistent_id: string,
  prompt: string,
  filer: FileAttachment[]
): Promise<string> {
  const { data: assistent, error: aErr } = await supabase
    .from('ai_asistenter')
    .select('*, provider:ai_providers(provider_slug, api_key, base_url)')
    .eq('id', assistent_id)
    .single()
  if (aErr || !assistent) throw new Error('Assistent inte hittad')

  const slug: AiProviderSlug = assistent.provider.provider_slug
  const apiKey: string = assistent.provider.api_key
  const baseUrl: string = assistent.provider.base_url
  const systemPrompt: string = assistent.system_prompt
  const modelId: string = assistent.model_id
  const maxTokens: number = assistent.max_tokens

  const images = filer.filter((f) => f.mime_type.startsWith('image/'))
  const pdfs = filer.filter((f) => f.mime_type === 'application/pdf')

  if (slug === 'anthropic') {
    const client = new Anthropic({ apiKey })
    type ContentBlock =
      | Anthropic.ImageBlockParam
      | Anthropic.DocumentBlockParam
      | Anthropic.TextBlockParam
    const content: ContentBlock[] = [
      ...images.map((f): Anthropic.ImageBlockParam => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: f.mime_type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: f.data_base64,
        },
      })),
      ...pdfs.map((f): Anthropic.DocumentBlockParam => ({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: f.data_base64 },
      })),
      { type: 'text', text: prompt },
    ]
    const res = await client.messages.create({
      model: modelId,
      max_tokens: maxTokens,
      system: systemPrompt || undefined,
      messages: [{ role: 'user', content }],
    })
    const block = res.content[0]
    return block.type === 'text' ? block.text : ''
  }

  if (slug === 'openai' || slug === 'openrouter') {
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl || (slug === 'openrouter' ? OPENROUTER_DEFAULT_BASE : undefined),
      ...(slug === 'openrouter' ? { defaultHeaders: OPENROUTER_HEADERS } : {})
    })
    type OaiContent =
      | OpenAI.Chat.ChatCompletionContentPartImage
      | OpenAI.Chat.ChatCompletionContentPartText
    const providerLabel = slug === 'openrouter' ? 'OpenRouter' : 'OpenAI'
    const content: OaiContent[] = [
      ...images.map((f): OpenAI.Chat.ChatCompletionContentPartImage => ({
        type: 'image_url',
        image_url: { url: `data:${f.mime_type};base64,${f.data_base64}` },
      })),
      { type: 'text', text: pdfs.length > 0 ? `${prompt}\n\n(OBS: PDF-analys stöds inte för ${providerLabel} via denna nod.)` : prompt },
    ]
    const res = await client.chat.completions.create({
      model: modelId,
      max_tokens: maxTokens,
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content },
      ],
    })
    return res.choices[0]?.message?.content ?? ''
  }

  if (slug === 'google') {
    const client = new GoogleGenAI({ apiKey })
    const parts: object[] = [
      ...images.map((f) => ({ inlineData: { mimeType: f.mime_type, data: f.data_base64 } })),
      ...pdfs.map((f) => ({ inlineData: { mimeType: 'application/pdf', data: f.data_base64 } })),
      { text: prompt },
    ]
    const res = await client.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts }],
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    })
    return res.text ?? ''
  }

  throw new Error(`Okänd provider: ${slug}`)
}
