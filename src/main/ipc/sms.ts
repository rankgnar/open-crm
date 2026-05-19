import { ipcMain } from 'electron'
import { supabase } from '../supabase'

const CHANNELS = [
  'db:sms-mallar:list',
  'db:sms-mallar:create',
  'db:sms-mallar:update',
  'db:sms-mallar:delete',
] as const

interface CreateSmsMallInput {
  namn: string
  meddelande?: string
}

export function registerSmsHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  ipcMain.handle('db:sms-mallar:list', async () => {
    const { data, error } = await supabase
      .from('sms_mallar')
      .select('*')
      .order('sortering', { ascending: true })
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:sms-mallar:create', async (_, input: CreateSmsMallInput) => {
    const { data: last } = await supabase
      .from('sms_mallar')
      .select('sortering')
      .order('sortering', { ascending: false })
      .limit(1)
      .single()
    const sortering = last ? (last as { sortering: number }).sortering + 1 : 0
    const { data, error } = await supabase
      .from('sms_mallar')
      .insert({ ...input, sortering })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:sms-mallar:update', async (_, id: string, input: Partial<CreateSmsMallInput>) => {
    const { data, error } = await supabase
      .from('sms_mallar')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:sms-mallar:delete', async (_, id: string) => {
    const { error } = await supabase.from('sms_mallar').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })
}
