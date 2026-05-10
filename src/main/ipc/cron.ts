import { ipcMain } from 'electron'
import { supabase } from '../supabase'

const CRON_RE = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/

export function registerCronHandlers(): void {
  ipcMain.handle('db:cron:list', async () => {
    const { data, error } = await supabase
      .from('cron_jobs')
      .select('*')
      .order('id', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:cron:toggle', async (_, id: string, enabled: boolean) => {
    const { data, error } = await supabase
      .from('cron_jobs')
      .update({ enabled })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:cron:update-schedule', async (_, id: string, schedule: string) => {
    const trimmed = schedule.trim()
    if (!CRON_RE.test(trimmed)) {
      throw new Error('Ogiltigt cron-uttryck. Förväntat format: "m h dom mon dow" (t.ex. "0 23 * * *").')
    }
    const { data, error } = await supabase
      .from('cron_jobs')
      .update({ schedule: trimmed })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:cron:run-now', async (_, id: string) => {
    const { error: rpcError } = await supabase.rpc('exec_cron_command', { p_id: id })
    if (rpcError) throw new Error(rpcError.message)

    const { data: refreshed, error: refreshError } = await supabase
      .from('cron_jobs')
      .select('*')
      .eq('id', id)
      .single()
    if (refreshError) throw new Error(refreshError.message)
    return refreshed
  })
}
