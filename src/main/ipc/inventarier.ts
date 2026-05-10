import { ipcMain } from 'electron'
import { supabase } from '../supabase'

interface CreateInput {
  kategori: string
  benamning: string
  tillverkare_modell: string
  serienr: string
  antal: number
  skick: string
  placering: string
}

interface UpdateInput extends Partial<CreateInput> {
  id: string
}

export function registerInventarierHandlers(): void {
  ipcMain.handle('db:inventarier:list', async () => {
    const { data, error } = await supabase
      .from('inventarier')
      .select('*')
      .order('lopnr', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  })

  ipcMain.handle('db:inventarier:create', async (_, input: CreateInput) => {
    const { data, error } = await supabase
      .from('inventarier')
      .insert(input)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:inventarier:update', async (_, { id, ...patch }: UpdateInput) => {
    const { data, error } = await supabase
      .from('inventarier')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:inventarier:delete', async (_, id: string) => {
    const { error } = await supabase
      .from('inventarier')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:inventarier:delete-many', async (_, ids: string[]) => {
    if (ids.length === 0) return
    const { error } = await supabase
      .from('inventarier')
      .delete()
      .in('id', ids)
    if (error) throw new Error(error.message)
  })
}
