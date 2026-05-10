import { dialog, ipcMain } from 'electron'
import { readFile } from 'fs/promises'
import sharp from 'sharp'
import { supabase } from '../supabase'

const BUCKET = 'branding'

const SIZES = [
  { col: 'branding_favicon_16_url',       path: 'ikon/favicon-16.png',         px: 16 },
  { col: 'branding_favicon_32_url',       path: 'ikon/favicon-32.png',         px: 32 },
  { col: 'branding_apple_touch_icon_url', path: 'ikon/apple-touch-icon.png',   px: 180 },
  { col: 'branding_android_192_url',      path: 'ikon/android-chrome-192.png', px: 192 },
  { col: 'branding_android_512_url',      path: 'ikon/android-chrome-512.png', px: 512 },
] as const

const MASTER_PATH = 'ikon/master.png'
const MASTER_PX = 1024

const ALL_PATHS = [MASTER_PATH, ...SIZES.map(s => s.path)]

async function uploadPng(path: string, buffer: Buffer): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(`Uppladdning misslyckades (${path}): ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

export function registerBrandingHandlers(): void {
  ipcMain.removeHandler('branding:upload-ikon')
  ipcMain.removeHandler('branding:remove-ikon')

  ipcMain.handle('branding:upload-ikon', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Välj ikon (kvadratisk bild, 512×512 eller större)',
      filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return null

    const sourceBuffer = await readFile(filePaths[0])
    const meta = await sharp(sourceBuffer).metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    if (width < 192 || height < 192) {
      throw new Error(`Bilden är för liten (${width}×${height}). Minst 192×192 krävs, helst 512×512 för bästa kvalitet.`)
    }

    const masterPng = await sharp(sourceBuffer)
      .resize(MASTER_PX, MASTER_PX, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer()
    const updates: Record<string, string> = {}
    updates['branding_ikon_master_url'] = await uploadPng(MASTER_PATH, masterPng)

    for (const { col, path, px } of SIZES) {
      const buf = await sharp(masterPng).resize(px, px, { fit: 'cover' }).png().toBuffer()
      updates[col] = await uploadPng(path, buf)
    }

    const { data: existing } = await supabase.from('app_installningar').select('id').limit(1).single()
    if (!existing) throw new Error('Inga inställningar hittades')

    const { data, error } = await supabase
      .from('app_installningar')
      .update(updates)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('branding:remove-ikon', async () => {
    const { error: removeErr } = await supabase.storage.from(BUCKET).remove(ALL_PATHS)
    if (removeErr) throw new Error(removeErr.message)

    const cleared = {
      branding_ikon_master_url: '',
      branding_favicon_16_url: '',
      branding_favicon_32_url: '',
      branding_apple_touch_icon_url: '',
      branding_android_192_url: '',
      branding_android_512_url: '',
    }

    const { data: existing } = await supabase.from('app_installningar').select('id').limit(1).single()
    if (!existing) throw new Error('Inga inställningar hittades')

    const { data, error } = await supabase
      .from('app_installningar')
      .update(cleared)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })
}
