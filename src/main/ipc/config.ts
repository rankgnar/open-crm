import { ipcMain } from 'electron'
import { readDbConfig, writeDbConfig, sanitize, type DbConfig } from '../config-store'
import { invalidateSupabaseClient } from '../supabase'

export interface TestConnectionResult {
  ok: boolean
  latency_ms: number
  error?: string
}

export function registerConfigHandlers(): void {
  ipcMain.handle('config:db:get', () => readDbConfig())

  ipcMain.handle('config:db:is-ready', (): boolean => {
    const config = readDbConfig()
    const url = config.supabase_url || process.env.SUPABASE_URL || ''
    return Boolean(url)
  })

  ipcMain.handle('config:db:set', (_, config: DbConfig) => {
    writeDbConfig(config)
    invalidateSupabaseClient()
    return true
  })

  ipcMain.handle('config:db:test', async (_, config: DbConfig): Promise<TestConnectionResult> => {
    const start = Date.now()
    try {
      const supabase_url = sanitize(config.supabase_url)
      const supabase_anon_key = sanitize(config.supabase_anon_key)

      if (!supabase_url || !supabase_anon_key) {
        return { ok: false, latency_ms: 0, error: 'URL och API-nyckel krävs' }
      }
      try {
        new URL(supabase_url)
      } catch {
        return { ok: false, latency_ms: 0, error: 'Ogiltig URL — kontrollera att du klistrade in API URL korrekt' }
      }
      const url = supabase_url.replace(/\/$/, '')
      const resp = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: supabase_anon_key }
      })
      if (resp.status >= 500) throw new Error(`Server svarade med ${resp.status}`)
      return { ok: true, latency_ms: Date.now() - start }
    } catch (err) {
      return { ok: false, latency_ms: Date.now() - start, error: (err as Error).message }
    }
  })
}
