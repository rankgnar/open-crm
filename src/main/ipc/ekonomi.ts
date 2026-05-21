import { ipcMain } from 'electron'
import { supabase } from '../supabase'
import { broadcastChange } from '../broadcast'

const CHANNELS = [
  'db:ekonomi-utfall:list',
  'db:ekonomi-utfall:list-all',
  'db:ekonomi-utfall:create',
  'db:ekonomi-utfall:update',
  'db:ekonomi-utfall:delete',
] as const

type Kategori = 'arbete' | 'material' | 'ue' | 'övrigt'

interface CreateUtfallInput {
  projekt_id: string
  kategori: Kategori
  beskrivning: string
  belopp: number
  datum: string
}

export function registerEkonomiHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  ipcMain.handle('db:ekonomi-utfall:list', async (_, projekt_id: string) => {
    const { data, error } = await supabase
      .from('ekonomi_utfall')
      .select('*')
      .eq('projekt_id', projekt_id)
      .order('datum', { ascending: false })
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:ekonomi-utfall:list-all', async () => {
    const { data, error } = await supabase
      .from('ekonomi_utfall')
      .select('*')
      .order('datum', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:ekonomi-utfall:create', async (_, input: CreateUtfallInput) => {
    const { data, error } = await supabase
      .from('ekonomi_utfall')
      .insert(input)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('ekonomi')
    return data
  })

  ipcMain.handle('db:ekonomi-utfall:update', async (_, id: string, input: Partial<Omit<CreateUtfallInput, 'projekt_id'>>) => {
    const { data, error } = await supabase
      .from('ekonomi_utfall')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('ekonomi')
    return data
  })

  ipcMain.handle('db:ekonomi-utfall:delete', async (_, id: string) => {
    const { error } = await supabase.from('ekonomi_utfall').delete().eq('id', id)
    if (error) throw new Error(error.message)
    broadcastChange('ekonomi')
  })

}
