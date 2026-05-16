import { ipcMain, shell, dialog } from 'electron'
import { promises as fs } from 'fs'
import * as path from 'path'
import { supabase } from '../supabase'
import { broadcast } from '../broadcast'
import { buildIcs } from '../lib/icsBuilder'
import { sendEpost, loadAlias, zohoUploadAttachment } from './epost'

const KALENDER_CHANGED = 'kalender:changed'

interface CreateKalenderEventInput {
  titel: string
  beskrivning?: string
  plats?: string
  url?: string
  start: string
  slut: string
  hel_dag?: boolean
  aterkommer?: boolean
  kund_id?: string | null
  projekt_id?: string | null
  fas_id?: string | null
  kalender_id?: string | null
  farg?: string
  epost_ref?: Record<string, unknown> | null
}

interface UpdateKalenderEventInput extends Partial<CreateKalenderEventInput> {
  id: string
}

export function registerKalenderHandlers(): void {
  ipcMain.handle('db:kalender:list', async (_, params?: { start?: string; slut?: string }) => {
    let query = supabase
      .from('kalender_events')
      .select('*')
      .order('start', { ascending: true })

    if (params?.start) query = query.gte('start', params.start)
    if (params?.slut) query = query.lte('start', params.slut)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:kalender:get', async (_, id: string) => {
    const { data, error } = await supabase
      .from('kalender_events')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:kalender:create', async (_, input: CreateKalenderEventInput) => {
    const { data, error } = await supabase
      .from('kalender_events')
      .insert({
        titel: input.titel,
        beskrivning: input.beskrivning ?? '',
        plats: input.plats ?? '',
        url: input.url ?? '',
        start: input.start,
        slut: input.slut,
        hel_dag: input.hel_dag ?? false,
        aterkommer: input.aterkommer ?? false,
        kund_id: input.kund_id ?? null,
        projekt_id: input.projekt_id ?? null,
        fas_id: input.fas_id ?? null,
        kalender_id: input.kalender_id ?? null,
        farg: input.farg ?? '#6366f1',
        epost_ref: input.epost_ref ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
    return data
  })

  ipcMain.handle('db:kalender:update', async (_, input: UpdateKalenderEventInput) => {
    const { id, ...fields } = input
    const { data, error } = await supabase
      .from('kalender_events')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
    return data
  })

  ipcMain.handle('db:kalender:delete', async (_, id: string) => {
    const { error } = await supabase
      .from('kalender_events')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
  })

  ipcMain.handle('db:kalender:toggle-slutford', async (_, id: string, slutford: boolean) => {
    const { data, error } = await supabase
      .from('kalender_events')
      .update({ slutford })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
    return data
  })

  ipcMain.handle('db:kalender:delete-many', async (_, ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    const { error } = await supabase
      .from('kalender_events')
      .delete()
      .in('id', ids)
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
  })

  // ── Dokument ─────────────────────────────────────────────────────────────────

  ipcMain.handle('db:kalender-dokument:list', async (_, event_id: string) => {
    const { data, error } = await supabase
      .from('kalender_event_dokument')
      .select('*')
      .eq('event_id', event_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:kalender-dokument:upload', async (_, input: { eventId: string; filePath: string; fileName: string; mimeType: string; size: number }) => {
    const buffer = await fs.readFile(input.filePath)
    const ext = path.extname(input.fileName)
    const baseName = path.basename(input.fileName, ext)
    const safeBase = baseName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${input.eventId}/${Date.now()}_${safeBase}${ext}`
    const { error: storageError } = await supabase.storage
      .from('kalender-dokument')
      .upload(storagePath, buffer, { contentType: input.mimeType, upsert: false })
    if (storageError) throw new Error(storageError.message)
    const { data, error: dbError } = await supabase
      .from('kalender_event_dokument')
      .insert({ event_id: input.eventId, filnamn: input.fileName, mime_type: input.mimeType, storlek: input.size, storage_path: storagePath })
      .select('*')
      .single()
    if (dbError) throw new Error(dbError.message)
    broadcast(KALENDER_CHANGED)
    return data
  })

  ipcMain.handle('db:kalender-dokument:delete', async (_, input: { id: string; storagePath: string }) => {
    await supabase.storage.from('kalender-dokument').remove([input.storagePath])
    const { error } = await supabase.from('kalender_event_dokument').delete().eq('id', input.id)
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
  })

  ipcMain.handle('db:kalender-dokument:open', async (_, storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('kalender-dokument')
      .createSignedUrl(storagePath, 60)
    if (error) throw new Error(error.message)
    await shell.openExternal(data.signedUrl)
  })

  // ── Tidplan sync ─────────────────────────────────────────────────────────────

  ipcMain.handle('db:tidplan:synka', async (_, input: {
    projekt_id: string
    projekt_nummer: string
    faser: Array<{ id: string; namn: string; start_datum: string; slut_datum: string }>
  }) => {
    const { data: existing } = await supabase
      .from('kalender_events')
      .select('id, fas_id')
      .eq('projekt_id', input.projekt_id)
      .not('fas_id', 'is', null)

    const existingMap = new Map<string, string>((existing ?? []).map(e => [e.fas_id as string, e.id as string]))
    const inputFasIds = new Set(input.faser.map(f => f.id))

    // Delete events whose phase was removed
    for (const [fasId, eventId] of existingMap) {
      if (!inputFasIds.has(fasId)) {
        await supabase.from('kalender_events').delete().eq('id', eventId)
      }
    }

    const synkade: string[] = []
    const titel = (namn: string) => `${input.projekt_nummer} — ${namn}`

    for (const fas of input.faser) {
      const startIso = new Date(fas.start_datum).toISOString()
      const slutIso  = new Date(fas.slut_datum + 'T23:59:59').toISOString()

      if (existingMap.has(fas.id)) {
        await supabase
          .from('kalender_events')
          .update({ titel: titel(fas.namn), start: startIso, slut: slutIso })
          .eq('id', existingMap.get(fas.id)!)
      } else {
        await supabase.from('kalender_events').insert({
          titel: titel(fas.namn),
          start: startIso,
          slut: slutIso,
          hel_dag: true,
          projekt_id: input.projekt_id,
          fas_id: fas.id,
          farg: '#10b981',
          beskrivning: '',
          plats: '',
          url: '',
          aterkommer: false,
        })
      }
      synkade.push(fas.id)
    }

    broadcast(KALENDER_CHANGED)
    return synkade
  })

  ipcMain.handle('db:tidplan:synka-status', async (_, projekt_id: string) => {
    const { data } = await supabase
      .from('kalender_events')
      .select('fas_id')
      .eq('projekt_id', projekt_id)
      .not('fas_id', 'is', null)
    return (data ?? []).map(e => e.fas_id as string)
  })

  ipcMain.handle('db:tidplan:desynka', async (_, projekt_id: string) => {
    const { error } = await supabase
      .from('kalender_events')
      .delete()
      .eq('projekt_id', projekt_id)
      .not('fas_id', 'is', null)
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
  })

  ipcMain.handle('db:tidplan:synka-fas', async (_, input: {
    fas_id: string; start_datum: string; slut_datum: string
  }) => {
    const startIso = new Date(input.start_datum).toISOString()
    const slutIso  = new Date(input.slut_datum + 'T23:59:59').toISOString()
    await supabase
      .from('kalender_events')
      .update({ start: startIso, slut: slutIso })
      .eq('fas_id', input.fas_id)
    broadcast(KALENDER_CHANGED)
  })

  ipcMain.handle('db:tidplan:desynka-fas', async (_, fas_id: string) => {
    const { error } = await supabase
      .from('kalender_events')
      .delete()
      .eq('fas_id', fas_id)
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
  })

  ipcMain.handle('db:tidplan:desynka-forslag', async (_, forslag_id: string) => {
    const { data: faser, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id')
      .eq('forslag_id', forslag_id)
    if (fasErr) throw new Error(fasErr.message)
    const ids = (faser ?? []).map(f => f.id as string)
    if (ids.length === 0) return
    const { error } = await supabase
      .from('kalender_events')
      .delete()
      .in('fas_id', ids)
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
  })

  // ── Manual calendars (kalendrar) ─────────────────────────────────────────────

  ipcMain.handle('db:kalendrar:list', async () => {
    const { data, error } = await supabase
      .from('kalendrar')
      .select('*')
      .order('sortering', { ascending: true })
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:kalendrar:create', async (_, input: { namn: string; farg?: string }) => {
    const { data, error } = await supabase
      .from('kalendrar')
      .insert({ namn: input.namn, farg: input.farg ?? '#6366f1' })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:kalendrar:update', async (_, id: string, patch: { namn?: string; farg?: string; sortering?: number }) => {
    const { data, error } = await supabase
      .from('kalendrar')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
    return data
  })

  ipcMain.handle('db:kalendrar:delete', async (_, id: string) => {
    const { error } = await supabase.from('kalendrar').delete().eq('id', id)
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
  })

  ipcMain.handle('db:kalendrar:empty', async (_, id: string) => {
    const { error } = await supabase
      .from('kalender_events')
      .delete()
      .eq('kalender_id', id)
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
  })

  // ── Bulk delete by group ─────────────────────────────────────────────────────

  ipcMain.handle('db:kalender:empty-kund', async (_, kund_id: string) => {
    const { error } = await supabase
      .from('kalender_events')
      .delete()
      .eq('kund_id', kund_id)
      .is('projekt_id', null)
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
  })

  ipcMain.handle('db:kalender:empty-projekt', async (_, projekt_id: string) => {
    const { error } = await supabase
      .from('kalender_events')
      .delete()
      .eq('projekt_id', projekt_id)
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
  })

  ipcMain.handle('db:kalender:empty-lokal', async () => {
    const { error } = await supabase
      .from('kalender_events')
      .delete()
      .is('kund_id', null)
      .is('projekt_id', null)
      .is('kalender_id', null)
    if (error) throw new Error(error.message)
    broadcast(KALENDER_CHANGED)
  })

  // ── Export / share .ics ──────────────────────────────────────────────────────

  type IcsFilter =
    | { kalender_id: string }
    | { kund_id: string }
    | { projekt_id: string }
    | { lokal: true }

  async function fetchEventsForFilter(filter: IcsFilter): Promise<Array<{ id: string; titel: string; beskrivning: string | null; plats: string | null; start: string; slut: string; hel_dag: boolean }>> {
    let query = supabase.from('kalender_events').select('id, titel, beskrivning, plats, start, slut, hel_dag').order('start', { ascending: true })
    if ('kalender_id' in filter) query = query.eq('kalender_id', filter.kalender_id)
    else if ('kund_id' in filter) query = query.eq('kund_id', filter.kund_id).is('projekt_id', null)
    else if ('projekt_id' in filter) query = query.eq('projekt_id', filter.projekt_id)
    else query = query.is('kund_id', null).is('projekt_id', null).is('kalender_id', null)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data ?? []
  }

  function safeFilename(name: string): string {
    return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_')
  }

  ipcMain.handle('db:kalender:export-ics', async (_, input: { filter: IcsFilter; calendarName: string }) => {
    const events = await fetchEventsForFilter(input.filter)
    const ics = buildIcs(input.calendarName, events)
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: `kalender_${safeFilename(input.calendarName)}.ics`,
      filters: [{ name: 'iCalendar', extensions: ['ics'] }],
    })
    if (canceled || !filePath) return null
    await fs.writeFile(filePath, ics, 'utf8')
    return filePath
  })

  ipcMain.handle('db:kalender:share-email', async (_, input: { filter: IcsFilter; calendarName: string; till: string; meddelande?: string }) => {
    const events = await fetchEventsForFilter(input.filter)
    const ics = buildIcs(input.calendarName, events)
    const buffer = Buffer.from(ics, 'utf8')
    const filename = `kalender_${safeFilename(input.calendarName)}.ics`
    const attachmentRef = await zohoUploadAttachment(filename, buffer)

    const alias = await loadAlias(null)
    if (!alias) throw new Error('Inget e-postalias konfigurerat')

    const subject = `Kalender: ${input.calendarName}`
    const meddelande = (input.meddelande ?? '').trim()
    const body = `<p>${meddelande ? meddelande.replace(/\n/g, '<br>') : `Bifogat hittar du kalendern <strong>${input.calendarName}</strong> som .ics-fil. Importera den i din kalenderapp.`}</p>`

    await sendEpost({
      alias,
      till: input.till,
      amne: subject,
      kropp: body,
      bilagor: [{ ...attachmentRef, storlek: buffer.byteLength, kalla: 'fil' }],
    })
  })
}
