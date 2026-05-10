import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { readDbConfig, sanitize } from './config-store'

let _client: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const config = readDbConfig()
    const url = sanitize(config.supabase_url || process.env.SUPABASE_URL || '')
    // Prefer service_role to bypass RLS — main process is trusted and acts as admin.
    const key = sanitize(
      config.supabase_service_role_key ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      config.supabase_anon_key ||
      process.env.SUPABASE_ANON_KEY ||
      ''
    )
    if (url && key) {
      try { new URL(url) } catch {
        throw new Error(`Ogiltig Supabase URL i inställningar: "${url}"`)
      }
    }
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  }
  return _client
}

export function invalidateSupabaseClient(): void {
  _client = null
}

// Proxy so all existing imports keep working without changes
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string | symbol) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop]
  }
})
