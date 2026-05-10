import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export interface DbConfig {
  supabase_url: string
  supabase_anon_key: string
  supabase_service_role_key: string
  web_app_url: string
  client_app_url: string
  form_app_url: string
}

const DEFAULTS: DbConfig = {
  supabase_url: '',
  supabase_anon_key: '',
  supabase_service_role_key: '',
  web_app_url: '',
  client_app_url: '',
  form_app_url: ''
}

// Strip non-printable-ASCII chars (em-dash, smart quotes, NBSP, etc.) that sneak
// in via copy/paste from terminals — they break fetch headers (ByteString error).
export function sanitize(s: unknown): string {
  if (typeof s !== 'string') return ''
  return s.replace(/[^\x20-\x7E]/g, '').trim()
}

function sanitizeConfig(raw: Partial<DbConfig>): DbConfig {
  return {
    supabase_url: sanitize(raw.supabase_url),
    supabase_anon_key: sanitize(raw.supabase_anon_key),
    supabase_service_role_key: sanitize(raw.supabase_service_role_key),
    web_app_url: sanitize(raw.web_app_url),
    client_app_url: sanitize(raw.client_app_url),
    form_app_url: raw.form_app_url ? sanitize(raw.form_app_url) : DEFAULTS.form_app_url,
  }
}

function configPath(): string {
  return join(app.getPath('userData'), 'db-config.json')
}

export function readDbConfig(): DbConfig {
  try {
    const path = configPath()
    if (!existsSync(path)) return { ...DEFAULTS }
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<DbConfig>
    return sanitizeConfig(parsed)
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeDbConfig(config: DbConfig): void {
  const clean = sanitizeConfig(config)
  writeFileSync(configPath(), JSON.stringify(clean, null, 2), 'utf-8')
}
