import { ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { supabase } from '../supabase'

const CHANNELS = [
  'db:revisor-deadlines:list',
  'db:revisor-deadlines:create',
  'db:revisor-deadlines:update',
  'db:revisor-deadlines:delete',
  'db:revisor-anteckningar:list',
  'db:revisor-anteckningar:create',
  'db:revisor-anteckningar:update',
  'db:revisor-anteckningar:delete',
  'db:revisor-dokument:list',
  'db:revisor-dokument:upload',
  'db:revisor-dokument:delete',
  'db:revisor-dokument:open',
]

export function registerRevisorHandlers(): void {
  // Deadlines
  ipcMain.handle('db:revisor-deadlines:list', async () => {
    const { data, error } = await supabase
      .from('revisor_deadlines')
      .select('*')
      .order('datum', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:revisor-deadlines:create', async (_, input: { titel: string; datum: string; typ: string; notat?: string }) => {
    const { data, error } = await supabase
      .from('revisor_deadlines')
      .insert(input)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:revisor-deadlines:update', async (_, input: { id: string } & Record<string, unknown>) => {
    const { id, ...rest } = input
    const { error } = await supabase
      .from('revisor_deadlines')
      .update({ ...rest, uppdaterad_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:revisor-deadlines:delete', async (_, id: string) => {
    const { error } = await supabase.from('revisor_deadlines').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  // Anteckningar
  ipcMain.handle('db:revisor-anteckningar:list', async () => {
    const { data, error } = await supabase
      .from('revisor_anteckningar')
      .select('*')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:revisor-anteckningar:create', async (_, input: { titel: string; innehall: string; farg: string }) => {
    const { data, error } = await supabase
      .from('revisor_anteckningar')
      .insert(input)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:revisor-anteckningar:update', async (_, input: { id: string; titel: string; innehall: string; farg: string }) => {
    const { id, ...rest } = input
    const { error } = await supabase
      .from('revisor_anteckningar')
      .update({ ...rest, uppdaterad_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:revisor-anteckningar:delete', async (_, id: string) => {
    const { error } = await supabase.from('revisor_anteckningar').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  // Dokument
  ipcMain.handle('db:revisor-dokument:list', async () => {
    const { data, error } = await supabase
      .from('revisor_dokument')
      .select('*')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:revisor-dokument:upload', async (_, input: { filePath: string; fileName: string; mimeType: string; size: number }) => {
    const buffer = await fs.readFile(input.filePath)
    const ext = path.extname(input.fileName)
    const baseName = path.basename(input.fileName, ext)
    const safeBase = baseName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `revisor/${Date.now()}_${safeBase}${ext}`
    const { error: storageError } = await supabase.storage
      .from('revisor-dokument')
      .upload(storagePath, buffer, { contentType: input.mimeType, upsert: false })
    if (storageError) throw new Error(storageError.message)
    const { data, error: dbError } = await supabase
      .from('revisor_dokument')
      .insert({ filnamn: input.fileName, mime_type: input.mimeType, storlek: input.size, storage_path: storagePath })
      .select('*')
      .single()
    if (dbError) throw new Error(dbError.message)
    return data
  })

  ipcMain.handle('db:revisor-dokument:delete', async (_, input: { id: string; storagePath: string }) => {
    await supabase.storage.from('revisor-dokument').remove([input.storagePath])
    const { error } = await supabase.from('revisor_dokument').delete().eq('id', input.id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:revisor-dokument:open', async (_, storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('revisor-dokument')
      .createSignedUrl(storagePath, 60)
    if (error) throw new Error(error.message)
    await shell.openExternal(data.signedUrl)
  })
}

export function unregisterRevisorHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)
}
