import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { supabase } from '../supabase'
import { triggerAvslutFeedback } from './kund-avslut'

const CHANNELS = [
  'db:projekt:list',
  'db:projekt:list-by-kund',
  'db:projekt:list-fas-tree',
  'db:projekt:get',
  'db:projekt:preview-nummer',
  'db:projekt:create',
  'db:projekt:update',
  'db:projekt:delete',
  'db:projekt:import-csv',
  'db:projekt:delete-many',
  'db:projekt:update-status-many',
  'db:projekt-anteckningar:list',
  'db:projekt-anteckningar:create',
  'db:projekt-anteckningar:update',
  'db:projekt-anteckningar:delete',
  'db:projekt-nummer:get',
  'db:projekt-nummer:set',
  'db:projekt-statusar:list',
  'db:projekt-statusar:create',
  'db:projekt-statusar:update',
  'db:projekt-statusar:delete',
  'dialog:open-file',
  'db:projekt-dokument:list',
  'db:projekt-dokument:upload',
  'db:projekt-dokument:delete',
  'db:projekt-dokument:open',
  'db:projekt-dokument:get-url',
  'db:projekt-dokument:get-data',
  'db:projekt-dokument:set-visibility',
  'db:projekt-dokument:rename',
  'db:projekt-aktivitet:list',
  'db:projekt-aktivitet:create',
  'db:projekt:set-kalender-farg',
  'db:projekt:frageblankett-summary',
  'db:projekt:last-anteckning',
] as const

interface CreateProjektInput {
  projekt_nummer?: string
  kund_id: string
  namn: string
  beskrivning?: string
  status?: string
  startdatum?: string
  slutdatum?: string
  budget_total?: number
  betalningsvillkor?: string
  villkor?: string
  rot_avdrag?: boolean
  rot_procent?: number
  rot_inkludera_medsokande?: boolean
  arbetsplats_adress?: string
  arbetsplats_postnummer?: string
  arbetsplats_stad?: string
}

type UpdateProjektInput = Partial<Omit<CreateProjektInput, 'kund_id'>>

const SELECT_WITH_KUND = `
  *,
  kunder!inner(namn, kundnummer, webbadress, telefon)
`

async function nextProjektNummer(): Promise<string> {
  const { data, error } = await supabase.rpc('nextval_projekt_nummer')
  if (error) throw new Error(error.message)
  return `P-${String(data as number).padStart(4, '0')}`
}

export function registerProjektHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)
  ipcMain.handle('db:projekt:list', async () => {
    const { data, error } = await supabase
      .from('projekt')
      .select(SELECT_WITH_KUND)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt:list-by-kund', async (_, kund_id: string) => {
    const { data, error } = await supabase
      .from('projekt')
      .select(SELECT_WITH_KUND)
      .eq('kund_id', kund_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt:list-fas-tree', async (_, projekt_id: string) => {
    const { data: forslag, error: fErr } = await supabase
      .from('forslag')
      .select('id, titel, forslag_nummer')
      .eq('projekt_id', projekt_id)
      .order('skapad_at', { ascending: false })
    if (fErr) throw new Error(fErr.message)
    if (!forslag || forslag.length === 0) return []

    const forslagIds = forslag.map((f: { id: string }) => f.id)
    const { data: faser, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id, forslag_id, namn, sortering')
      .in('forslag_id', forslagIds)
      .order('sortering', { ascending: true })
    if (fasErr) throw new Error(fasErr.message)
    if (!faser || faser.length === 0) return []

    const fasIds = faser.map((f: { id: string }) => f.id)
    const { data: subfaser, error: sErr } = await supabase
      .from('forslag_subfaser')
      .select('id, fas_id, namn, sortering')
      .in('fas_id', fasIds)
      .order('sortering', { ascending: true })
    if (sErr) throw new Error(sErr.message)

    type Forslag = { id: string; titel: string; forslag_nummer: string }
    type Fas = { id: string; forslag_id: string; namn: string; sortering: number }
    type Subfas = { id: string; fas_id: string; namn: string; sortering: number }

    const forslagMap = new Map((forslag as Forslag[]).map((f) => [f.id, f]))
    const subfaserByFas: Record<string, { id: string; namn: string }[]> = {}
    for (const s of (subfaser ?? []) as Subfas[]) {
      if (!subfaserByFas[s.fas_id]) subfaserByFas[s.fas_id] = []
      subfaserByFas[s.fas_id].push({ id: s.id, namn: s.namn })
    }

    return (faser as Fas[]).map((f) => {
      const fl = forslagMap.get(f.forslag_id)
      return {
        id: f.id,
        namn: f.namn,
        forslag_id: f.forslag_id,
        forslag_titel: fl?.titel ?? '',
        forslag_nummer: fl?.forslag_nummer ?? '',
        subfaser: subfaserByFas[f.id] ?? [],
      }
    })
  })

  ipcMain.handle('db:projekt:get', async (_, id: string) => {
    const { data, error } = await supabase
      .from('projekt')
      .select(SELECT_WITH_KUND)
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt:preview-nummer', async () => {
    const { data, error } = await supabase.rpc('peek_projekt_nummer')
    if (error) throw new Error(error.message)
    return `P-${String(data as number).padStart(4, '0')}`
  })

  ipcMain.handle('db:projekt:create', async (_, input: CreateProjektInput) => {
    const projekt_nummer = input.projekt_nummer?.trim() || await nextProjektNummer()
    const { data, error } = await supabase
      .from('projekt')
      .insert({ ...input, projekt_nummer })
      .select(SELECT_WITH_KUND)
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt:update', async (_, id: string, input: UpdateProjektInput) => {
    const { data, error } = await supabase
      .from('projekt')
      .update(input)
      .eq('id', id)
      .select(SELECT_WITH_KUND)
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt:delete', async (_, id: string) => {
    const { data: projekt } = await supabase
      .from('projekt')
      .select('namn, kund_id')
      .eq('id', id)
      .single()

    if (projekt?.kund_id && projekt?.namn) {
      try {
        await triggerAvslutFeedback(projekt.kund_id, projekt.namn)
      } catch {
        // Email failure must not block the delete
      }
    }

    const { error } = await supabase.from('projekt').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:projekt:import-csv', async (_, rows: Array<Record<string, string>>) => {
    type ImportResult = { success: number; errors: Array<{ index: number; message: string }> }
    const result: ImportResult = { success: 0, errors: [] }

    const kundNamnSet = [...new Set(rows.map(r => r['kund_namn']).filter(Boolean))]
    const kundByNamn = new Map<string, string>()
    if (kundNamnSet.length > 0) {
      const { data } = await supabase.from('kunder').select('id, namn').in('namn', kundNamnSet)
      if (data) for (const k of data) kundByNamn.set(k.namn.toLowerCase(), k.id)
    }

    const needsAutoNum = rows.filter(r => !r['projekt_nummer']?.trim()).length
    let nextNum = 0
    if (needsAutoNum > 0) {
      const { data: peek, error: peekErr } = await supabase.rpc('peek_projekt_nummer')
      if (peekErr) throw new Error(peekErr.message)
      nextNum = peek as number
      const { error: setErr } = await supabase.rpc('setval_projekt_nummer', { new_value: nextNum + needsAutoNum })
      if (setErr) throw new Error(setErr.message)
    }

    let autoIdx = 0
    const records: Array<Record<string, unknown>> = []
    const recordOriginalIndex: number[] = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const kund_id = kundByNamn.get((row['kund_namn'] ?? '').toLowerCase())
      if (!kund_id) {
        result.errors.push({ index: i, message: `Kund "${row['kund_namn']}" hittades inte` })
        continue
      }
      const projekt_nummer = row['projekt_nummer']?.trim() || `P-${String(nextNum + autoIdx++).padStart(4, '0')}`
      const rec: Record<string, unknown> = {
        namn: row['namn'],
        kund_id,
        projekt_nummer,
      }
      if (row['status']) rec['status'] = row['status']
      if (row['startdatum']) rec['startdatum'] = row['startdatum']
      if (row['slutdatum']) rec['slutdatum'] = row['slutdatum']
      if (row['budget_total']) { const n = parseFloat(row['budget_total'].replace(',', '.')); if (!isNaN(n)) rec['budget_total'] = n }
      if (row['arbetsplats_adress']) rec['arbetsplats_adress'] = row['arbetsplats_adress']
      if (row['arbetsplats_postnummer']) rec['arbetsplats_postnummer'] = row['arbetsplats_postnummer']
      if (row['arbetsplats_stad']) rec['arbetsplats_stad'] = row['arbetsplats_stad']
      if (row['rot_avdrag']) rec['rot_avdrag'] = row['rot_avdrag'].toLowerCase() === 'ja'
      if (row['rot_procent']) { const n = parseInt(row['rot_procent']); if (!isNaN(n)) rec['rot_procent'] = n }
      if (row['rot_inkludera_medsokande']) rec['rot_inkludera_medsokande'] = row['rot_inkludera_medsokande'].toLowerCase() === 'ja'
      if (row['beskrivning']) rec['beskrivning'] = row['beskrivning']
      if (row['betalningsvillkor']) rec['betalningsvillkor'] = row['betalningsvillkor']
      if (row['villkor']) rec['villkor'] = row['villkor']
      records.push(rec)
      recordOriginalIndex.push(i)
    }

    const BATCH = 100
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)
      const { error: batchErr } = await supabase.from('projekt').insert(batch)
      if (!batchErr) { result.success += batch.length; continue }
      for (let j = 0; j < batch.length; j++) {
        const { error: rowErr } = await supabase.from('projekt').insert(batch[j])
        if (!rowErr) result.success++
        else result.errors.push({ index: recordOriginalIndex[i + j], message: rowErr.message })
      }
    }

    return result
  })

  ipcMain.handle('db:projekt:delete-many', async (_, ids: string[]) => {
    const { error } = await supabase.from('projekt').delete().in('id', ids)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:projekt:update-status-many', async (_, ids: string[], status: string) => {
    const { error } = await supabase.from('projekt').update({ status }).in('id', ids)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:projekt-anteckningar:list', async (_, projekt_id: string) => {
    const { data, error } = await supabase
      .from('projekt_anteckningar')
      .select('*')
      .eq('projekt_id', projekt_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt-anteckningar:create', async (_, input: { projekt_id: string; titel: string; innehall: string; farg: string }) => {
    const { data, error } = await supabase
      .from('projekt_anteckningar')
      .insert(input)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt-anteckningar:update', async (_, id: string, input: { titel: string; innehall: string; farg: string }) => {
    const { data, error } = await supabase
      .from('projekt_anteckningar')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt-anteckningar:delete', async (_, id: string) => {
    const { error } = await supabase.from('projekt_anteckningar').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:projekt-nummer:get', async () => {
    const { data, error } = await supabase.rpc('peek_projekt_nummer')
    if (error) throw new Error(error.message)
    return data as number
  })

  ipcMain.handle('db:projekt-nummer:set', async (_, value: number) => {
    const n = Math.max(1, Math.floor(value))
    const { error } = await supabase.rpc('setval_projekt_nummer', { new_value: n })
    if (error) throw new Error(error.message)
    return n
  })

  ipcMain.handle('db:projekt-statusar:list', async () => {
    const { data, error } = await supabase
      .from('projekt_statusar')
      .select('*')
      .order('sortering', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt-statusar:create', async (_, input: { namn: string; farg: string; sortering?: number }) => {
    const { data, error } = await supabase
      .from('projekt_statusar')
      .insert(input)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt-statusar:update', async (_, id: string, patch: { namn?: string; farg?: string; sortering?: number }) => {
    const { data, error } = await supabase
      .from('projekt_statusar')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt-statusar:delete', async (_, id: string) => {
    const { error } = await supabase.from('projekt_statusar').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff', heic: 'image/heic',
    pdf: 'application/pdf',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain', csv: 'text/csv', xml: 'application/xml', json: 'application/json',
    zip: 'application/zip', rar: 'application/x-rar-compressed', '7z': 'application/x-7z-compressed',
    dwg: 'application/acad', dxf: 'image/vnd.dxf',
  }

  ipcMain.handle('dialog:open-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const stat = await fs.stat(filePath)
    const fileName = path.basename(filePath)
    const ext = path.extname(fileName).toLowerCase().slice(1)
    return { filePath, fileName, mimeType: mimeMap[ext] ?? 'application/octet-stream', size: stat.size }
  })

  ipcMain.handle('dialog:open-files', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
    })
    if (result.canceled || result.filePaths.length === 0) return []
    return Promise.all(result.filePaths.map(async (filePath) => {
      const stat = await fs.stat(filePath)
      const fileName = path.basename(filePath)
      const ext = path.extname(fileName).toLowerCase().slice(1)
      return { filePath, fileName, mimeType: mimeMap[ext] ?? 'application/octet-stream', size: stat.size }
    }))
  })

  ipcMain.handle('db:projekt-dokument:list', async (_, projekt_id: string) => {
    const { data, error } = await supabase
      .from('projekt_dokument')
      .select('*')
      .eq('projekt_id', projekt_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt-dokument:upload', async (_, input: { projektId: string; filePath: string; fileName: string; mimeType: string; size: number; kategori?: 'dokument' | 'faktura' | 'order' | 'ata'; carpeta?: string | null }) => {
    const buffer = await fs.readFile(input.filePath)
    const ext = path.extname(input.fileName)
    const baseName = path.basename(input.fileName, ext)
    const safeBase = baseName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    const kategori = input.kategori ?? 'dokument'
    const storagePath = `${input.projektId}/${Date.now()}_${safeBase}${ext}`
    const { error: storageError } = await supabase.storage
      .from('projekt-dokument')
      .upload(storagePath, buffer, { contentType: input.mimeType, upsert: false })
    if (storageError) throw new Error(storageError.message)
    const { data, error: dbError } = await supabase
      .from('projekt_dokument')
      .insert({ projekt_id: input.projektId, filnamn: input.fileName, mime_type: input.mimeType, storlek: input.size, storage_path: storagePath, kategori, carpeta: input.carpeta ?? null })
      .select('*')
      .single()
    if (dbError) throw new Error(dbError.message)
    return data
  })

  ipcMain.handle('db:projekt-dokument:create-text', async (_, input: { projektId: string; fileName: string; content: string; carpeta?: string | null }) => {
    const rawName = input.fileName.endsWith('.txt') ? input.fileName : `${input.fileName}.txt`
    const safeName = rawName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    const buffer = Buffer.from(input.content, 'utf8')
    const storagePath = `${input.projektId}/${Date.now()}_${safeName}`
    const { error: storageError } = await supabase.storage
      .from('projekt-dokument')
      .upload(storagePath, buffer, { contentType: 'text/plain', upsert: false })
    if (storageError) throw new Error(storageError.message)
    const { data, error: dbError } = await supabase
      .from('projekt_dokument')
      .insert({ projekt_id: input.projektId, filnamn: rawName, mime_type: 'text/plain', storlek: buffer.length, storage_path: storagePath, kategori: 'dokument', carpeta: input.carpeta ?? null })
      .select('*')
      .single()
    if (dbError) throw new Error(dbError.message)
    return data
  })

  ipcMain.handle('db:projekt-dokument:clear-carpeta', async (_, { projektId, carpeta }: { projektId: string; carpeta: string }) => {
    const { error } = await supabase
      .from('projekt_dokument')
      .update({ carpeta: null })
      .eq('projekt_id', projektId)
      .eq('carpeta', carpeta)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:projekt-dokument:move-carpeta', async (_, { id, carpeta }: { id: string; carpeta: string | null }) => {
    const { data, error } = await supabase
      .from('projekt_dokument')
      .update({ carpeta })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt-dokument:delete', async (_, input: { id: string; storagePath: string }) => {
    await supabase.storage.from('projekt-dokument').remove([input.storagePath])
    const { error } = await supabase.from('projekt_dokument').delete().eq('id', input.id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:projekt-dokument:open', async (_, storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('projekt-dokument')
      .createSignedUrl(storagePath, 60)
    if (error) throw new Error(error.message)
    await shell.openExternal(data.signedUrl)
  })

  ipcMain.handle('db:projekt-dokument:get-url', async (_, storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('projekt-dokument')
      .createSignedUrl(storagePath, 3600)
    if (error) throw new Error(error.message)
    return data.signedUrl
  })

  ipcMain.handle('db:projekt-aktivitet:list', async (_, projekt_id: string) => {
    const { data, error } = await supabase
      .from('projekt_aktiviteter')
      .select('*')
      .eq('projekt_id', projekt_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt-aktivitet:create', async (_, input: { projekt_id: string; handelse: string; text: string }) => {
    const { data: setting } = await supabase
      .from('aktivitetslogg_installningar')
      .select('aktiv')
      .eq('handelse', input.handelse)
      .single()
    if (!setting?.aktiv) return
    await supabase.from('projekt_aktiviteter').insert({ projekt_id: input.projekt_id, text: input.text })
  })

  ipcMain.handle('db:projekt-dokument:rename', async (_, input: { id: string; filnamn: string }) => {
    const { data, error } = await supabase
      .from('projekt_dokument')
      .update({ filnamn: input.filnamn.trim() })
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:projekt-dokument:set-visibility', async (_, input: { id: string; synlig_for_kund: boolean }) => {
    const { data, error } = await supabase
      .from('projekt_dokument')
      .update({ synlig_for_kund: input.synlig_for_kund })
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  // Downloads file, writes to temp, opens in a native Electron window
  ipcMain.handle('db:projekt-dokument:get-data', async (_, input: { storagePath: string; mimeType: string }) => {
    const { data, error } = await supabase.storage
      .from('projekt-dokument')
      .download(input.storagePath)
    if (error) throw new Error(error.message)
    const buffer = Buffer.from(await data.arrayBuffer())
    const tmpFile = path.join(os.tmpdir(), path.basename(input.storagePath))
    await fs.writeFile(tmpFile, buffer)
    const win = new BrowserWindow({
      width: 1100,
      height: 850,
      autoHideMenuBar: true,
      backgroundColor: '#121212',
    })
    await win.loadURL(`file://${tmpFile}`)
    win.show()
  })

  ipcMain.handle('db:projekt:set-kalender-farg', async (_, projekt_id: string, farg: string | null) => {
    const { error } = await supabase
      .from('projekt')
      .update({ kalender_farg: farg })
      .eq('id', projekt_id)
    if (error) throw new Error(error.message)
  })

  // Returns the most advanced frageblankett status per projekt_id
  // Priority: besvarat > skickat > utkast
  ipcMain.handle('db:projekt:frageblankett-summary', async () => {
    const { data, error } = await supabase
      .from('projekt_frageblankett')
      .select('projekt_id, status')
    if (error) throw new Error(error.message)
    const PRIORITY: Record<string, number> = { besvarat: 2, skickat: 1, utkast: 0 }
    const best: Record<string, string> = {}
    for (const row of data ?? []) {
      const cur = best[row.projekt_id]
      if (!cur || (PRIORITY[row.status] ?? -1) > (PRIORITY[cur] ?? -1)) {
        best[row.projekt_id] = row.status
      }
    }
    return best
  })

  // Returns the latest anteckning (by skapad_at) per projekt_id
  ipcMain.handle('db:projekt:last-anteckning', async () => {
    const { data, error } = await supabase
      .from('projekt_anteckningar')
      .select('projekt_id, titel, farg, skapad_at')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    const latest: Record<string, { titel: string; farg: string }> = {}
    for (const row of data ?? []) {
      if (!latest[row.projekt_id]) {
        latest[row.projekt_id] = { titel: row.titel, farg: row.farg }
      }
    }
    return latest
  })
}
