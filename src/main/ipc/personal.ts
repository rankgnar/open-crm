import { ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { supabase } from '../supabase'
import { broadcastChange } from '../broadcast'
import { executeChatWithAssistent } from './ai-chat-fn'
import { readDbConfig } from '../config-store'

const CHANNELS = [
  'db:personal:list',
  'db:personal:get',
  'db:personal:preview-nummer',
  'db:personal:create',
  'db:personal:update',
  'db:personal:delete',
  'db:personal:delete-many',
  'db:personal:import-csv',
  'db:personal-anteckningar:list',
  'db:personal-anteckningar:create',
  'db:personal-anteckningar:update',
  'db:personal-anteckningar:delete',
  'db:personal-dokument:list',
  'db:personal-dokument:upload',
  'db:personal-dokument:delete',
  'db:personal-dokument:open',
  'db:personal-ledighet:list',
  'db:personal-ledighet:list-all',
  'db:personal-ledighet:create',
  'db:personal-ledighet:update',
  'db:personal-ledighet:approve',
  'db:personal-ledighet:reject',
  'db:personal-ledighet:delete',
  'db:personal-ledighet:delete-many',
  'db:personal-tidrapport:list',
  'db:personal-tidrapport:list-all',
  'db:personal-tidrapport:bilder',
  'db:personal-tidrapport:translate',
  'db:personal-tidrapport:create',
  'db:personal-tidrapport:approve',
  'db:personal-tidrapport:reject',
  'db:personal-tidrapport:delete',
  'db:personal-tidrapport:delete-many',
  'db:personal-tidrapport:report',
  'db:personal-loneposter:list',
  'db:personal-loneposter:list-all',
  'db:personal-loneposter:report',
  'db:personal-loneposter:create',
  'db:personal-loneposter:delete',
  'db:personal-loneposter:delete-many',
  'db:personal-statusar:list',
  'db:personal-statusar:create',
  'db:personal-statusar:update',
  'db:personal-statusar:delete',
  'db:personal-nummer:get',
  'db:personal-nummer:set',
  'db:personal-projekt:list',
  'db:personal-projekt:list-available',
  'db:personal-projekt:assign',
  'db:personal-projekt:remove',
  'db:personal:send-invite',
  'db:personal:send-password-reset',
] as const

interface CreatePersonalInput {
  personal_nummer?: string
  fortnox_id?: string
  namn: string
  personnummer?: string
  roll?: string
  personaltyp?: string
  loneform?: string
  anstallningsform?: string
  email?: string
  telefon?: string
  postadress?: string
  postnummer?: string
  ort?: string
  anstallningsdatum?: string
  slutdatum?: string
  'manadslön'?: number
  'timlön'?: number
  sysselsattningsgrad?: number
  clearingnummer?: string
  kontonummer?: string
  bank?: string
  status?: string
}

type UpdatePersonalInput = Partial<CreatePersonalInput>

async function nextPersonalNummer(): Promise<string> {
  const { data, error } = await supabase.rpc('nextval_personal_nummer')
  if (error) throw new Error(error.message)
  return `EMP-${String(data as number).padStart(4, '0')}`
}

export function registerPersonalHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  ipcMain.handle('db:personal:list', async () => {
    const { data, error } = await supabase
      .from('personal')
      .select('*')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal:get', async (_, id: string) => {
    const { data, error } = await supabase
      .from('personal')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal:preview-nummer', async () => {
    const { data, error } = await supabase.rpc('peek_personal_nummer')
    if (error) throw new Error(error.message)
    return `EMP-${String(data as number).padStart(4, '0')}`
  })

  ipcMain.handle('db:personal:create', async (_, input: CreatePersonalInput) => {
    const personal_nummer = input.personal_nummer?.trim() || await nextPersonalNummer()
    const { data, error } = await supabase
      .from('personal')
      .insert({ ...input, personal_nummer })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('personal')
    return data
  })

  ipcMain.handle('db:personal:update', async (_, id: string, input: UpdatePersonalInput) => {
    const { data, error } = await supabase
      .from('personal')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('personal')
    return data
  })

  ipcMain.handle('db:personal:delete', async (_, id: string) => {
    const { data: row } = await supabase
      .from('personal')
      .select('supabase_user_id')
      .eq('id', id)
      .maybeSingle()
    const authId = (row as { supabase_user_id: string | null } | null)?.supabase_user_id ?? null

    const { error } = await supabase.from('personal').delete().eq('id', id)
    if (error) throw new Error(error.message)

    if (authId) {
      await supabase.auth.admin.deleteUser(authId).catch(() => {})
    }
    broadcastChange('personal')
  })

  ipcMain.handle('db:personal:delete-many', async (_, ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    const { data: rows } = await supabase
      .from('personal')
      .select('supabase_user_id')
      .in('id', ids)
    const authIds = ((rows ?? []) as { supabase_user_id: string | null }[])
      .map((r) => r.supabase_user_id)
      .filter((v): v is string => !!v)

    const { error } = await supabase.from('personal').delete().in('id', ids)
    if (error) throw new Error(error.message)

    for (const authId of authIds) {
      await supabase.auth.admin.deleteUser(authId).catch(() => {})
    }
    broadcastChange('personal')
  })

  // CSV import from Fortnox personalregister
  ipcMain.handle('db:personal:import-csv', async (_, filePath: string) => {
    const result = { importados: 0, omitidos: 0, errores: [] as string[] }

    const raw = await fs.readFile(filePath, 'utf-8')
    const lines = raw.split('\n').filter(l => l.trim())
    if (lines.length < 2) return result

    // Parse CSV header
    const headers = parseCSVLine(lines[0])

    // Pre-load existing fortnox_ids and personnummer for duplicate detection
    const { data: existing } = await supabase
      .from('personal')
      .select('fortnox_id, personnummer')
    const existingFortnoxIds = new Set((existing ?? []).map(r => r.fortnox_id).filter(Boolean))
    const existingPersNr = new Set((existing ?? []).map(r => r.personnummer).filter(Boolean))

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      if (cols.length < 5) continue

      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = cols[idx] ?? '' })

      const fortnox_id = row['Anställnings-ID']?.trim() || null
      const personnummer = row['Personnummer']?.trim() || null

      // Skip duplicates
      if (fortnox_id && existingFortnoxIds.has(fortnox_id)) {
        result.omitidos++
        continue
      }
      if (personnummer && existingPersNr.has(personnummer)) {
        result.omitidos++
        continue
      }

      const fornamn = row['Förnamn']?.trim() || ''
      const efternamn = row['Efternamn']?.trim() || ''
      const namn = [fornamn, efternamn].filter(Boolean).join(' ')
      if (!namn) { result.errores.push(`Rad ${i}: saknar namn`); continue }

      const mobiltelefon = row['Mobiltelefon']?.trim()
      const telefon = mobiltelefon || row['Telefon']?.trim() || null

      const aktiv = row['Aktiv']?.trim()
      const slutat = row['Slutat']?.trim()
      const status = aktiv === '1' && slutat !== '1' ? 'aktiv' : 'inaktiv'

      const anstallningsdatum = parseDate(row['Anställd'])
      const slutdatum = parseDate(row['Anställd t.o.m'])

      const sysselsattningsgrad = parseNum(row['Sysselsättningsgrad (%)'])
      const manadslön = parseNum(row['Månadslon'])
      const timlön = parseNum(row['Timlön'])

      const personal_nummer = await nextPersonalNummer()

      const record: Record<string, unknown> = {
        personal_nummer,
        namn,
        status,
      }
      if (fortnox_id) record['fortnox_id'] = fortnox_id
      if (personnummer) record['personnummer'] = personnummer
      if (row['Befattning']?.trim()) record['roll'] = row['Befattning'].trim()
      if (row['Personaltyp']?.trim()) record['personaltyp'] = row['Personaltyp'].trim()
      if (row['Löneform']?.trim()) record['loneform'] = row['Löneform'].trim()
      if (row['Anställningsform']?.trim()) record['anstallningsform'] = row['Anställningsform'].trim()
      if (row['E-post']?.trim()) record['email'] = row['E-post'].trim()
      if (telefon) record['telefon'] = telefon
      if (row['Postadress']?.trim()) record['postadress'] = row['Postadress'].trim()
      if (row['Postnr']?.trim()) record['postnummer'] = row['Postnr'].trim()
      if (row['Ort']?.trim()) record['ort'] = row['Ort'].trim()
      if (anstallningsdatum) record['anstallningsdatum'] = anstallningsdatum
      if (slutdatum) record['slutdatum'] = slutdatum
      if (sysselsattningsgrad !== null) record['sysselsattningsgrad'] = sysselsattningsgrad
      if (manadslön !== null && manadslön > 0) record['manadslön'] = manadslön
      if (timlön !== null && timlön > 0) record['timlön'] = timlön

      const { error } = await supabase.from('personal').insert(record)
      if (error) {
        result.errores.push(`Rad ${i} (${namn}): ${error.message}`)
      } else {
        result.importados++
        if (fortnox_id) existingFortnoxIds.add(fortnox_id)
        if (personnummer) existingPersNr.add(personnummer)
      }
    }

    broadcastChange('personal')
    return result
  })

  // Anteckningar
  ipcMain.handle('db:personal-anteckningar:list', async (_, personal_id: string) => {
    const { data, error } = await supabase
      .from('personal_anteckningar')
      .select('*')
      .eq('personal_id', personal_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-anteckningar:create', async (_, input: { personal_id: string; titel: string; innehall: string; farg: string }) => {
    const { data, error } = await supabase
      .from('personal_anteckningar')
      .insert(input)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('personal')
    return data
  })

  ipcMain.handle('db:personal-anteckningar:update', async (_, id: string, input: { titel: string; innehall: string; farg: string }) => {
    const { data, error } = await supabase
      .from('personal_anteckningar')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('personal')
    return data
  })

  ipcMain.handle('db:personal-anteckningar:delete', async (_, id: string) => {
    const { error } = await supabase.from('personal_anteckningar').delete().eq('id', id)
    if (error) throw new Error(error.message)
    broadcastChange('personal')
  })

  // Dokument
  ipcMain.handle('db:personal-dokument:list', async (_, personal_id: string) => {
    const { data, error } = await supabase
      .from('personal_dokument')
      .select('*')
      .eq('personal_id', personal_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-dokument:upload', async (_, input: { personalId: string; kategori?: 'lonespec' | 'dokument'; filePath: string; fileName: string; mimeType: string; size: number }) => {
    const kategori = input.kategori ?? 'dokument'
    const buffer = await fs.readFile(input.filePath)
    const ext = path.extname(input.fileName)
    const baseName = path.basename(input.fileName, ext)
    const safeBase = baseName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${input.personalId}/${kategori}/${Date.now()}_${safeBase}${ext}`
    const { error: storageError } = await supabase.storage
      .from('personal-dokument')
      .upload(storagePath, buffer, { contentType: input.mimeType, upsert: false })
    if (storageError) throw new Error(storageError.message)
    const { data, error: dbError } = await supabase
      .from('personal_dokument')
      .insert({ personal_id: input.personalId, kategori, filnamn: input.fileName, mime_type: input.mimeType, storlek: input.size, storage_path: storagePath })
      .select('*')
      .single()
    if (dbError) throw new Error(dbError.message)
    broadcastChange('personal')
    return data
  })

  ipcMain.handle('db:personal-dokument:delete', async (_, input: { id: string; storagePath: string }) => {
    await supabase.storage.from('personal-dokument').remove([input.storagePath])
    const { error } = await supabase.from('personal_dokument').delete().eq('id', input.id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:personal-dokument:open', async (_, storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('personal-dokument')
      .createSignedUrl(storagePath, 60)
    if (error) throw new Error(error.message)
    await shell.openExternal(data.signedUrl)
  })

  // Ledighet
  ipcMain.handle('db:personal-ledighet:list', async (_, personal_id: string) => {
    const { data, error } = await supabase
      .from('personal_ledighet')
      .select('*')
      .eq('personal_id', personal_id)
      .order('startdatum', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-ledighet:create', async (_, input: { personal_id: string; typ: string; startdatum: string; slutdatum: string; godkand?: boolean; kommentar?: string }) => {
    const { data, error } = await supabase
      .from('personal_ledighet')
      .insert(input)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-ledighet:update', async (_, id: string, input: Partial<{ typ: string; startdatum: string; slutdatum: string; godkand: boolean; kommentar: string }>) => {
    const { data, error } = await supabase
      .from('personal_ledighet')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-ledighet:delete', async (_, id: string) => {
    const { error } = await supabase.from('personal_ledighet').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:personal-ledighet:delete-many', async (_, ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    const { error } = await supabase.from('personal_ledighet').delete().in('id', ids)
    if (error) throw new Error(error.message)
  })

  // Tidrapport
  ipcMain.handle('db:personal-tidrapport:list', async (_, personal_id: string) => {
    const { data, error } = await supabase
      .from('personal_tidrapport')
      .select('*')
      .eq('personal_id', personal_id)
      .order('datum', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-tidrapport:list-all', async (_, filters?: { status?: string; manad?: string }) => {
    // Avoid Swedish chars in select string to prevent Supabase type-parser errors;
    // timlön / manadslön are fetched separately in the approve handler.
    let q = supabase
      .from('personal_tidrapport')
      .select('*, personal(namn, personal_nummer, loneform), projekt(namn, projekt_nummer)')
      .order('datum', { ascending: false })
    if (filters?.status) q = q.eq('status', filters.status)
    if (filters?.manad) {
      const [y, m] = filters.manad.split('-').map(Number)
      const start = `${y}-${String(m).padStart(2, '0')}-01`
      const end = new Date(y, m, 0).toISOString().split('T')[0]
      q = q.gte('datum', start).lte('datum', end)
    }
    const { data, error } = await q
    if (error) throw new Error(error.message)

    // Count attached photos per row, keyed by (personal_id|projekt_id|datum).
    // The UNIQUE(personal_id, datum) constraint on personal_tidrapport
    // means this triple maps to exactly one tidrapport.
    const rows = (data ?? []) as Array<{ id: string; personal_id: string; projekt_id: string | null; datum: string }>
    const result = rows.map((r) => ({ ...r, bilder_antal: 0 }))
    if (rows.length > 0) {
      const dates = rows.map((r) => r.datum).sort()
      const personalIds = [...new Set(rows.map((r) => r.personal_id))]
      const projektIds = [...new Set(rows.map((r) => r.projekt_id).filter((v): v is string => !!v))]

      if (personalIds.length > 0 && projektIds.length > 0) {
        const { data: docs } = await supabase
          .from('projekt_dokument')
          .select('uppladdad_av_personal_id, projekt_id, skapad_at')
          .in('uppladdad_av_personal_id', personalIds)
          .in('projekt_id', projektIds)
          .gte('skapad_at', `${dates[0]}T00:00:00`)
          .lte('skapad_at', `${dates[dates.length - 1]}T23:59:59.999`)

        const counts = new Map<string, number>()
        for (const d of (docs ?? []) as Array<{ uppladdad_av_personal_id: string; projekt_id: string; skapad_at: string }>) {
          if (!d.uppladdad_av_personal_id) continue
          const datum = d.skapad_at.split('T')[0]
          const key = `${d.uppladdad_av_personal_id}|${d.projekt_id}|${datum}`
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        for (const r of result) {
          if (!r.projekt_id) continue
          const key = `${r.personal_id}|${r.projekt_id}|${r.datum}`
          r.bilder_antal = counts.get(key) ?? 0
        }
      }
    }
    return result
  })

  ipcMain.handle('db:personal-tidrapport:report', async (_, input: {
    from: string
    to: string
    status?: string
    personal_ids?: string[]
  }) => {
    let q = supabase
      .from('personal_tidrapport')
      .select('*, personal(namn, personal_nummer, loneform), projekt(namn, projekt_nummer)')
      .gte('datum', input.from)
      .lte('datum', input.to)
      .order('datum', { ascending: true })
      .order('personal_id', { ascending: true })
    if (input.status) q = q.eq('status', input.status)
    if (input.personal_ids && input.personal_ids.length > 0) q = q.in('personal_id', input.personal_ids)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => ({ ...r, bilder_antal: 0 }))
  })

  ipcMain.handle('db:personal-tidrapport:bilder', async (_, input: { personalId: string; projektId: string; datum: string }) => {
    const start = `${input.datum}T00:00:00`
    const end = `${input.datum}T23:59:59.999`
    const { data, error } = await supabase
      .from('projekt_dokument')
      .select('id, filnamn, mime_type, storage_path, skapad_at')
      .eq('uppladdad_av_personal_id', input.personalId)
      .eq('projekt_id', input.projektId)
      .gte('skapad_at', start)
      .lte('skapad_at', end)
      .like('mime_type', 'image/%')
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)

    const rows = (data ?? []) as Array<{ id: string; filnamn: string; mime_type: string; storage_path: string; skapad_at: string }>
    const withUrls = await Promise.all(rows.map(async (d) => {
      const { data: signed } = await supabase.storage
        .from('projekt-dokument')
        .createSignedUrl(d.storage_path, 300)
      return { ...d, signed_url: signed?.signedUrl ?? null }
    }))
    return withUrls
  })

  ipcMain.handle('db:personal-tidrapport:translate', async (_, id: string) => {
    const { data: rowData, error: rowErr } = await supabase
      .from('personal_tidrapport')
      .select('id, beskrivning, beskrivning_oversatt, beskrivning_sprak, beskrivning_oversatt_at')
      .eq('id', id)
      .single()
    if (rowErr) throw new Error(rowErr.message)
    const row = rowData as {
      id: string
      beskrivning: string | null
      beskrivning_oversatt: string | null
      beskrivning_sprak: string | null
      beskrivning_oversatt_at: string | null
    }
    if (!row.beskrivning?.trim()) throw new Error('Ingen beskrivning att översätta')
    if (row.beskrivning_oversatt) return row

    const { data: assistData, error: aErr } = await supabase
      .from('ai_asistenter')
      .select('id')
      .contains('uppgifter', ['tidrapport_oversattning'])
      .eq('aktiv', true)
      .order('sortering', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (aErr) throw new Error(aErr.message)
    if (!assistData) throw new Error('Ingen aktiv översättningsassistent. Skapa en under Inställningar → Asistenter med uppgift "tidrapport_oversattning".')

    const raw = await executeChatWithAssistent((assistData as { id: string }).id, [
      { role: 'user', content: row.beskrivning },
    ])

    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    let parsed: { sprak?: unknown; oversattning?: unknown }
    try { parsed = JSON.parse(cleaned) } catch {
      throw new Error(`AI-svaret kunde inte tolkas som JSON: ${raw.slice(0, 200)}`)
    }
    if (typeof parsed.sprak !== 'string' || typeof parsed.oversattning !== 'string') {
      throw new Error('AI-svaret saknar förväntade fält "sprak" och "oversattning"')
    }

    const { data: updated, error: upErr } = await supabase
      .from('personal_tidrapport')
      .update({
        beskrivning_oversatt: parsed.oversattning,
        beskrivning_sprak: parsed.sprak.toUpperCase().slice(0, 5),
        beskrivning_oversatt_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, beskrivning_oversatt, beskrivning_sprak, beskrivning_oversatt_at')
      .single()
    if (upErr) throw new Error(upErr.message)
    return updated
  })

  ipcMain.handle('db:personal-tidrapport:create', async (_, input: { personal_id: string; projekt_id?: string; datum: string; timmar: number; typ?: string; beskrivning?: string }) => {
    const { data, error } = await supabase
      .from('personal_tidrapport')
      .insert({ ...input, status: 'inskickad' })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-tidrapport:approve', async (_, id: string) => {
    // Fetch minimal data needed to compute cost — avoid Swedish chars in select type parser
    const { data: tidRaw, error: tidErr } = await supabase
      .from('personal_tidrapport')
      .select('timmar, projekt_id, datum, personal_id')
      .eq('id', id)
      .single()
    if (tidErr) throw new Error(tidErr.message)
    const tid = tidRaw as { timmar: number; projekt_id: string | null; datum: string; personal_id: string }

    const { data: persRaw } = await supabase
      .from('personal')
      .select('timlön, manadslön, loneform')
      .eq('id', tid.personal_id)
      .single()
    const p = persRaw as { timlön: number | null; manadslön: number | null; loneform: string | null } | null
    let timlön = p?.timlön ?? 0
    if (!timlön && p?.loneform === 'MAN' && p?.manadslön) timlön = Math.round(p.manadslön / 173)
    const belopp = tid.timmar * timlön

    if (tid.projekt_id) {
      const { error: utfallErr } = await supabase
        .from('ekonomi_utfall')
        .insert({ projekt_id: tid.projekt_id, kategori: 'arbete', beskrivning: `Tidrapport ${tid.datum}`, belopp, datum: tid.datum, tidrapport_id: id })
      if (utfallErr) throw new Error(utfallErr.message)
    }

    const { data, error } = await supabase
      .from('personal_tidrapport')
      .update({ status: 'godkänd', godkand_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-tidrapport:reject', async (_, id: string) => {
    await supabase.from('ekonomi_utfall').delete().eq('tidrapport_id', id)
    const { data, error } = await supabase
      .from('personal_tidrapport')
      .update({ status: 'nekad', godkand_at: null })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-tidrapport:delete', async (_, id: string) => {
    const { error } = await supabase.from('personal_tidrapport').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:personal-tidrapport:delete-many', async (_, ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    const { error } = await supabase.from('personal_tidrapport').delete().in('id', ids)
    if (error) throw new Error(error.message)
  })

  // Ledighet global list and approval
  ipcMain.handle('db:personal-ledighet:list-all', async (_, filters?: { status?: string; manad?: string }) => {
    let q = supabase
      .from('personal_ledighet')
      .select('*, personal(namn, personal_nummer)')
      .order('startdatum', { ascending: false })
    if (filters?.status) q = q.eq('status', filters.status)
    if (filters?.manad) {
      const [y, m] = filters.manad.split('-').map(Number)
      const start = `${y}-${String(m).padStart(2, '0')}-01`
      const end = new Date(y, m, 0).toISOString().split('T')[0]
      q = q.gte('startdatum', start).lte('startdatum', end)
    }
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-ledighet:approve', async (_, id: string) => {
    const { data, error } = await supabase
      .from('personal_ledighet')
      .update({ godkand: true, status: 'godkänd' })
      .eq('id', id)
      .select('*, personal(namn, personal_nummer)')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-ledighet:reject', async (_, id: string) => {
    const { data, error } = await supabase
      .from('personal_ledighet')
      .update({ godkand: false, status: 'nekad' })
      .eq('id', id)
      .select('*, personal(namn, personal_nummer)')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  // Löneposter: salary supplements, advances, deductions
  ipcMain.handle('db:personal-loneposter:list', async (_, personal_id: string) => {
    const { data, error } = await supabase
      .from('personal_loneposter')
      .select('*')
      .eq('personal_id', personal_id)
      .order('datum', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-loneposter:list-all', async (_, manad?: string) => {
    let q = supabase
      .from('personal_loneposter')
      .select('*, personal(namn, personal_nummer)')
      .order('datum', { ascending: false })
    if (manad) q = q.eq('manad', manad)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-loneposter:report', async (_, input: {
    from: string
    to: string
    personal_ids?: string[]
    includeAllForskott?: boolean
  }) => {
    // Main query: date-filtered. When includeAllForskott, exclude förskott here
    // so they are not double-counted when fetched without date restriction below.
    let q = supabase
      .from('personal_loneposter')
      .select('*, personal(namn, personal_nummer)')
      .gte('manad', input.from.slice(0, 7))
      .lte('manad', input.to.slice(0, 7))
      .order('manad', { ascending: true })
      .order('personal_id', { ascending: true })
    if (input.includeAllForskott) q = q.neq('typ', 'förskott')
    if (input.personal_ids && input.personal_ids.length > 0) q = q.in('personal_id', input.personal_ids)
    const { data, error } = await q
    if (error) throw new Error(error.message)

    type Row = Record<string, unknown>
    const result: Row[] = (data ?? []) as Row[]

    if (input.includeAllForskott) {
      // Fetch ALL förskott for these employees regardless of date
      let fq = supabase
        .from('personal_loneposter')
        .select('*, personal(namn, personal_nummer)')
        .eq('typ', 'förskott')
        .order('manad', { ascending: true })
      if (input.personal_ids && input.personal_ids.length > 0) fq = fq.in('personal_id', input.personal_ids)
      const { data: fData, error: fError } = await fq
      if (fError) throw new Error(fError.message)
      result.push(...((fData ?? []) as Row[]))
    }

    return result
  })

  ipcMain.handle('db:personal-loneposter:create', async (_, input: { personal_id: string; typ: string; belopp: number; beskrivning?: string; datum: string; manad: string }) => {
    const { data, error } = await supabase
      .from('personal_loneposter')
      .insert(input)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-loneposter:delete', async (_, id: string) => {
    const { error } = await supabase.from('personal_loneposter').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:personal-loneposter:delete-many', async (_, ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    const { error } = await supabase.from('personal_loneposter').delete().in('id', ids)
    if (error) throw new Error(error.message)
  })

  // Statusar
  ipcMain.handle('db:personal-statusar:list', async () => {
    const { data, error } = await supabase
      .from('personal_statusar')
      .select('*')
      .order('sortering', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-statusar:create', async (_, input: { namn: string; farg: string }) => {
    const { data: last } = await supabase
      .from('personal_statusar')
      .select('sortering')
      .order('sortering', { ascending: false })
      .limit(1)
      .single()
    const sortering = last ? last.sortering + 1 : 0
    const { data, error } = await supabase
      .from('personal_statusar')
      .insert({ ...input, sortering })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-statusar:update', async (_, id: string, input: { namn?: string; farg?: string }) => {
    const { data, error } = await supabase
      .from('personal_statusar')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-statusar:delete', async (_, id: string) => {
    const { error } = await supabase.from('personal_statusar').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:personal-nummer:get', async () => {
    const { data, error } = await supabase.rpc('peek_personal_nummer')
    if (error) throw new Error(error.message)
    return data as number
  })

  ipcMain.handle('db:personal-nummer:set', async (_, value: number) => {
    const n = Math.max(1, Math.floor(value))
    const { error } = await supabase.rpc('setval_personal_nummer', { new_value: n })
    if (error) throw new Error(error.message)
    return n
  })

  // Projekt-personal assignment
  ipcMain.handle('db:personal-projekt:list', async (_, personal_id: string) => {
    const { data, error } = await supabase
      .from('projekt_personal')
      .select('id, projekt_id, projekt(id, projekt_nummer, namn)')
      .eq('personal_id', personal_id)
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-projekt:list-available', async (_, personal_id: string) => {
    const { data: assigned } = await supabase
      .from('projekt_personal')
      .select('projekt_id')
      .eq('personal_id', personal_id)
    const assignedIds = (assigned ?? []).map((r) => (r as { projekt_id: string }).projekt_id)
    let q = supabase.from('projekt').select('id, projekt_nummer, namn').order('skapad_at', { ascending: false })
    if (assignedIds.length > 0) q = q.not('id', 'in', `(${assignedIds.join(',')})`)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:personal-projekt:assign', async (_, personal_id: string, projekt_id: string) => {
    const { error } = await supabase.from('projekt_personal').insert({ personal_id, projekt_id })
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:personal-projekt:remove', async (_, personal_id: string, projekt_id: string) => {
    const { error } = await supabase.from('projekt_personal').delete().eq('personal_id', personal_id).eq('projekt_id', projekt_id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:personal:send-invite', async (_, personal_id: string) => {
    return queuePersonalAuthEmail(personal_id, 'invite')
  })

  ipcMain.handle('db:personal:send-password-reset', async (_, personal_id: string) => {
    return queuePersonalAuthEmail(personal_id, 'recovery')
  })
}

type PersonalAuthAction = 'invite' | 'recovery'

function appUrl(): string {
  const fromConfig = readDbConfig().web_app_url?.trim()
  if (fromConfig) return fromConfig.replace(/\/+$/, '')
  const fromEnv = process.env.OPEN_CRM_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  throw new Error('Web-appens URL är inte konfigurerad. Sätt den i Avancerat → DataBase, eller via env-variabeln OPEN_CRM_APP_URL.')
}

function injectVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

async function queuePersonalAuthEmail(
  personal_id: string,
  action: PersonalAuthAction
): Promise<{ status: 'queued'; user_id: string }> {
  const { data: pData, error: pErr } = await supabase
    .from('personal')
    .select('id, namn, email, supabase_user_id')
    .eq('id', personal_id)
    .single()
  if (pErr) throw new Error(pErr.message)

  const personal = pData as { id: string; namn: string; email: string | null; supabase_user_id: string | null }
  const email = personal.email?.trim()
  if (!email) throw new Error('Anställd saknar e-postadress')

  // If admin re-sends an "invite" but the auth user already exists,
  // generateLink({ type: 'invite' }) fails. Fall back to recovery so the
  // button is idempotent — the welcome template still works for that flow.
  let linkType: PersonalAuthAction = action
  if (action === 'invite' && personal.supabase_user_id) linkType = 'recovery'

  const redirectTo =
    action === 'invite'
      ? `${appUrl()}/?action=set-password`
      : `${appUrl()}/?action=reset-password`

  let { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: linkType,
    email,
    options: { redirectTo }
  })

  // Email might already exist in auth (e.g. anställd was deleted but auth user
  // wasn't, or another personal row used the same email). Recover by switching
  // to 'recovery' so the welcome flow still works.
  if (linkErr && /already.*registered|already exists/i.test(linkErr.message) && linkType === 'invite') {
    linkType = 'recovery'
    const retry = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo }
    })
    linkData = retry.data
    linkErr = retry.error
  }

  if (linkErr) throw new Error(linkErr.message)

  const action_link =
    (linkData as { properties?: { action_link?: string } } | null)?.properties?.action_link
  const auth_user_id =
    (linkData as { user?: { id?: string } } | null)?.user?.id
  if (!action_link) throw new Error('Kunde inte generera inloggningslänk')

  if (auth_user_id && auth_user_id !== personal.supabase_user_id) {
    await supabase.from('personal').update({ supabase_user_id: auth_user_id }).eq('id', personal_id)
  }

  const system_kod = action === 'invite' ? 'personal_valkommen' : 'personal_losenord_aterstall'

  const { data: mallData, error: mallErr } = await supabase
    .from('epost_mallar')
    .select('amne, kropp_html, alias_id')
    .eq('system_kod', system_kod)
    .eq('aktiv', true)
    .maybeSingle()
  if (mallErr) throw new Error(mallErr.message)
  if (!mallData) {
    throw new Error(`Mallen '${system_kod}' saknas. Kontrollera Inställningar → E-post mallar.`)
  }
  const mall = mallData as { amne: string; kropp_html: string; alias_id: string | null }

  let alias_id = mall.alias_id
  if (!alias_id) {
    const { data: aliasData } = await supabase
      .from('epost_alias')
      .select('id')
      .eq('aktiv', true)
      .order('standard', { ascending: false, nullsFirst: false })
      .order('sortering', { ascending: true })
      .limit(1)
      .maybeSingle()
    alias_id = (aliasData as { id: string } | null)?.id ?? null
  }

  let alias_signatur = ''
  if (alias_id) {
    const { data: sigData } = await supabase
      .from('epost_alias')
      .select('signatur_html')
      .eq('id', alias_id)
      .maybeSingle()
    alias_signatur = (sigData as { signatur_html: string | null } | null)?.signatur_html ?? ''
  }

  const { data: foretag } = await supabase
    .from('app_installningar')
    .select('foretag_namn')
    .limit(1)
    .maybeSingle()
  const foretag_namn = (foretag as { foretag_namn: string | null } | null)?.foretag_namn ?? ''

  const vars: Record<string, string> = {
    personal_namn: personal.namn,
    personal_email: email,
    foretag_namn,
    action_link,
    alias_signatur,
  }

  const { error: insErr } = await supabase.from('epost_ko').insert({
    alias_id,
    till: email,
    amne: injectVars(mall.amne, vars),
    kropp_html: injectVars(mall.kropp_html, vars),
    schemalagd_till: new Date().toISOString(),
    status: 'väntar',
  })
  if (insErr) throw new Error(insErr.message)

  return { status: 'queued', user_id: auth_user_id ?? personal.supabase_user_id ?? '' }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseDate(val: string | undefined): string | null {
  if (!val?.trim()) return null
  const d = new Date(val.trim())
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

function parseNum(val: string | undefined): number | null {
  if (!val?.trim()) return null
  const n = parseFloat(val.trim().replace(',', '.'))
  return isNaN(n) ? null : n
}
