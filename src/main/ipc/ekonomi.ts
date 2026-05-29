import { ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { supabase } from '../supabase'
import { broadcastChange } from '../broadcast'
import { executeChatWithFiles } from './ai-chat-fn'

const BUCKET = 'kostnader-fakturor'

const CHANNELS = [
  'db:ekonomi-utfall:list',
  'db:ekonomi-utfall:list-all',
  'db:ekonomi-utfall:create',
  'db:ekonomi-utfall:update',
  'db:ekonomi-utfall:delete',
  'db:ekonomi-utfall:upload-pdf',
  'db:ekonomi-utfall:parse-faktura',
  'db:ekonomi-utfall:open-pdf',
] as const

type Kategori = 'arbete' | 'material' | 'ue' | 'övrigt'

interface CreateUtfallInput {
  projekt_id: string
  kategori: Kategori
  beskrivning: string
  belopp: number
  datum: string
  faktura_pdf_path?: string | null
  faktura_pdf_namn?: string | null
}

interface UploadPdfInput {
  filePath: string
  fileName: string
  mimeType: string
  size: number
  projektId: string
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

  ipcMain.handle('db:ekonomi-utfall:upload-pdf', async (_, input: UploadPdfInput) => {
    const buffer = await fs.readFile(input.filePath)
    const ext = path.extname(input.fileName)
    const baseName = path.basename(input.fileName, ext)
    const safeBase = baseName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${input.projektId}/${Date.now()}_${safeBase}${ext}`
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: input.mimeType, upsert: false })
    if (storageError) throw new Error(storageError.message)
    return { path: storagePath, namn: input.fileName }
  })

  ipcMain.handle('db:ekonomi-utfall:parse-faktura', async (_, input: { filePath: string }) => {
    const { data: assistent } = await supabase
      .from('ai_asistenter')
      .select('id')
      .eq('system_kod', 'kostnader_faktura_parser')
      .single()
    if (!assistent) throw new Error('Faktura-parser-assistent saknas. Kontrollera Avancerat → Asistenter.')

    const buffer = await fs.readFile(input.filePath)
    const fileName = path.basename(input.filePath)
    const raw = await executeChatWithFiles(
      assistent.id,
      'Extract datum, kategori, beskrivning and belopp from this invoice. Return ONLY valid JSON.',
      [{ filnamn: fileName, mime_type: 'application/pdf', data_base64: buffer.toString('base64') }]
    )

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  })

  ipcMain.handle('db:ekonomi-utfall:open-pdf', async (_, input: { storagePath: string }) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(input.storagePath, 60)
    if (error) throw new Error(error.message)
    await shell.openExternal(data.signedUrl)
  })

}
