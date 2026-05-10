import { ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { supabase } from '../supabase'

const BUCKET = 'kvitton'

const CHANNELS = [
  'db:kvitto:list',
  'db:kvitto:get',
  'db:kvitto:create',
  'db:kvitto:update',
  'db:kvitto:delete',
  'db:kvitto:delete-many',
  'db:kvitto:upload',
  'db:kvitto:open',
  'db:kvitto:signed-url',
  'db:kvitto:set-status',
]

interface UploadInput {
  filePath: string
  fileName: string
  mimeType: string
  size: number
}

interface CreateInput {
  datum: string
  leverantor: string
  belopp: number
  moms?: number | null
  kategori?: string | null
  beskrivning?: string | null
  projekt_id?: string | null
  fil_storage_path: string
  fil_namn: string
  mime_type: string
  storlek: number
}

interface UpdateInput {
  id: string
  datum?: string
  leverantor?: string
  belopp?: number
  moms?: number | null
  kategori?: string | null
  beskrivning?: string | null
  projekt_id?: string | null
  status?: 'att_hantera' | 'hanterade'
}

export function registerKvittoHandlers(): void {
  ipcMain.handle('db:kvitto:list', async () => {
    const { data, error } = await supabase
      .from('kvitton')
      .select('*, projekt:projekt_id (projekt_nummer, namn)')
      .order('datum', { ascending: false })
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: Record<string, unknown>) => {
      const projekt = row.projekt as { projekt_nummer?: string; namn?: string } | null
      const { projekt: _omit, ...rest } = row
      return {
        ...rest,
        projekt_nummer: projekt?.projekt_nummer ?? null,
        projekt_titel:  projekt?.namn ?? null,
      }
    })
  })

  ipcMain.handle('db:kvitto:get', async (_, id: string) => {
    const { data, error } = await supabase
      .from('kvitton')
      .select('*, projekt:projekt_id (projekt_nummer, namn)')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    const projekt = data.projekt as { projekt_nummer?: string; namn?: string } | null
    const { projekt: _omit, ...rest } = data
    return {
      ...rest,
      projekt_nummer: projekt?.projekt_nummer ?? null,
      projekt_titel:  projekt?.namn ?? null,
    }
  })

  ipcMain.handle('db:kvitto:upload', async (_, input: UploadInput) => {
    const buffer = await fs.readFile(input.filePath)
    const ext = path.extname(input.fileName)
    const baseName = path.basename(input.fileName, ext)
    const safeBase = baseName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${new Date().getFullYear()}/${Date.now()}_${safeBase}${ext}`
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: input.mimeType, upsert: false })
    if (storageError) throw new Error(storageError.message)
    return {
      fil_storage_path: storagePath,
      fil_namn: input.fileName,
      mime_type: input.mimeType,
      storlek: input.size,
    }
  })

  ipcMain.handle('db:kvitto:create', async (_, input: CreateInput) => {
    const { data, error } = await supabase
      .from('kvitton')
      .insert(input)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:kvitto:update', async (_, input: UpdateInput) => {
    const { id, ...rest } = input
    const { error } = await supabase
      .from('kvitton')
      .update(rest)
      .eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:kvitto:set-status', async (_, input: { id: string; status: 'att_hantera' | 'hanterade' }) => {
    const { error } = await supabase
      .from('kvitton')
      .update({ status: input.status })
      .eq('id', input.id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:kvitto:delete', async (_, input: { id: string; storagePath: string }) => {
    if (input.storagePath) {
      await supabase.storage.from(BUCKET).remove([input.storagePath])
    }
    const { error } = await supabase.from('kvitton').delete().eq('id', input.id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:kvitto:delete-many', async (_, ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    const { data: rows, error: selectErr } = await supabase
      .from('kvitton')
      .select('fil_storage_path')
      .in('id', ids)
    if (selectErr) throw new Error(selectErr.message)
    const paths = (rows ?? []).map((r) => r.fil_storage_path).filter((p): p is string => !!p)
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths)
    }
    const { error } = await supabase.from('kvitton').delete().in('id', ids)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:kvitto:open', async (_, storagePath: string) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60)
    if (error) throw new Error(error.message)
    await shell.openExternal(data.signedUrl)
  })

  ipcMain.handle('db:kvitto:signed-url', async (_, input: { storagePath: string; ttl?: number }) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(input.storagePath, input.ttl ?? 3600)
    if (error) throw new Error(error.message)
    return data.signedUrl
  })
}

export function unregisterKvittoHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)
}
