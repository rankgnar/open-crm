import { ipcMain } from 'electron'
import { supabase } from '../supabase'
import { broadcastChange } from '../broadcast'

const CHANNELS = [
  'db:kunder:list',
  'db:kunder:get',
  'db:kunder:preview-nummer',
  'db:kunder:create',
  'db:kunder:update',
  'db:kunder:delete',
  'db:kunder:delete-many',
  'db:kunder:import-csv',
  'db:kunder:projekt-counts',
  'db:kunder:forslag-counts',
  'db:kunder-nummer:get',
  'db:kunder-nummer:set',
  'db:kund:set-kalender-farg',
] as const

interface CreateKundInput {
  kundnummer?: string
  namn: string
  email?: string | null
  telefon?: string | null
  telefon_2?: string | null
  fax?: string | null
  webbadress?: string | null
  adress?: string | null
  adress_2?: string | null
  postnummer?: string | null
  stad?: string | null
  land?: string | null
  landskod?: string | null
  org_nummer?: string | null
  personnummer?: string | null
  fastighetsbeteckning?: string | null
  brf_org_nummer?: string | null
  medsokande_namn?: string | null
  medsokande_personnummer?: string | null
  order_std_villkor?: string
  ata_std_villkor?: string
  login_anteckning?: string | null
}

type UpdateKundInput = Partial<CreateKundInput>

function normalizePhone(raw: string | null | undefined): string | null | undefined {
  if (raw == null || !raw.trim()) return raw
  const s = raw.trim()
  let digits = s.replace(/[^\d]/g, '')
  if (s.startsWith('+46')) digits = '0' + digits.slice(2)
  else if (digits.startsWith('0046')) digits = '0' + digits.slice(4)
  else if (digits.length === 11 && digits.startsWith('46')) digits = '0' + digits.slice(2)
  if (digits.length === 10 && digits.startsWith('0'))
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`
  return digits || raw
}

async function nextKundnummer(): Promise<string> {
  const { data, error } = await supabase.rpc('nextval_kunder_nummer')
  if (error) throw new Error(error.message)
  return `K-${String(data as number).padStart(4, '0')}`
}

export function registerKunderHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)
  ipcMain.handle('db:kunder:list', async () => {
    const { data, error } = await supabase
      .from('kunder')
      .select('*')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:kunder:get', async (_, id: string) => {
    const { data, error } = await supabase
      .from('kunder')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:kunder:preview-nummer', async () => {
    const { data, error } = await supabase.rpc('peek_kunder_nummer')
    if (error) throw new Error(error.message)
    return `K-${String(data as number).padStart(4, '0')}`
  })

  ipcMain.handle('db:kunder:create', async (_, input: CreateKundInput) => {
    const kundnummer = input.kundnummer?.trim() || await nextKundnummer()
    const { data, error } = await supabase
      .from('kunder')
      .insert({ ...input, kundnummer, telefon: normalizePhone(input.telefon), telefon_2: normalizePhone(input.telefon_2) })
      .select()
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('kunder')
    return data
  })

  ipcMain.handle('db:kunder:update', async (_, id: string, input: UpdateKundInput) => {
    const patch = { ...input }
    if (patch.telefon !== undefined) patch.telefon = normalizePhone(patch.telefon)
    if (patch.telefon_2 !== undefined) patch.telefon_2 = normalizePhone(patch.telefon_2)
    const { data, error } = await supabase
      .from('kunder')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('kunder')
    return data
  })

  ipcMain.handle('db:kunder:delete', async (_, id: string) => {
    const { error } = await supabase.from('kunder').delete().eq('id', id)
    if (error) throw new Error(error.message)
    broadcastChange('kunder')
  })

  ipcMain.handle('db:kunder:delete-many', async (_, ids: string[]) => {
    const { error } = await supabase.from('kunder').delete().in('id', ids)
    if (error) throw new Error(error.message)
    broadcastChange('kunder')
  })



  ipcMain.handle('db:kunder:import-csv', async (_, rows: CreateKundInput[]) => {
    type ImportResult = { success: number; errors: Array<{ index: number; message: string }> }
    const result: ImportResult = { success: 0, errors: [] }

    const needsNum = rows.filter(r => !r.kundnummer?.trim()).length
    let nextNum = 0
    if (needsNum > 0) {
      const { data: peek, error: peekErr } = await supabase.rpc('peek_kunder_nummer')
      if (peekErr) throw new Error(peekErr.message)
      nextNum = peek as number
      const { error: setErr } = await supabase.rpc('setval_kunder_nummer', { new_value: nextNum + needsNum })
      if (setErr) throw new Error(setErr.message)
    }

    let autoIdx = 0
    const records = rows.map(row => ({
      ...row,
      kundnummer: row.kundnummer?.trim() || `K-${String(nextNum + autoIdx++).padStart(4, '0')}`,
      telefon: normalizePhone(row.telefon),
      telefon_2: normalizePhone(row.telefon_2),
    }))

    const BATCH = 100
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)
      const { error: batchErr } = await supabase.from('kunder').insert(batch)
      if (!batchErr) { result.success += batch.length; continue }
      for (let j = 0; j < batch.length; j++) {
        const { error: rowErr } = await supabase.from('kunder').insert(batch[j])
        if (!rowErr) result.success++
        else result.errors.push({ index: i + j, message: rowErr.message })
      }
    }

    broadcastChange('kunder')
    return result
  })

  ipcMain.handle('db:kunder-nummer:get', async () => {
    const { data, error } = await supabase.rpc('peek_kunder_nummer')
    if (error) throw new Error(error.message)
    return data as number
  })

  ipcMain.handle('db:kunder-nummer:set', async (_, value: number) => {
    const n = Math.max(1, Math.floor(value))
    const { error } = await supabase.rpc('setval_kunder_nummer', { new_value: n })
    if (error) throw new Error(error.message)
    return n
  })

  ipcMain.handle('db:kunder:projekt-counts', async () => {
    const { data, error } = await supabase
      .from('projekt')
      .select('id, kund_id, projekt_nummer, namn, skapad_at')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    const last: Record<string, { id: string; projekt_nummer: string; namn: string }> = {}
    for (const row of data ?? []) {
      if (!last[row.kund_id]) {
        last[row.kund_id] = { id: row.id, projekt_nummer: row.projekt_nummer, namn: row.namn }
      }
    }
    return last
  })

  ipcMain.handle('db:kunder:forslag-counts', async () => {
    const { data, error } = await supabase
      .from('forslag')
      .select('id, forslag_nummer, titel, status, skapad_at, projekt!inner(kund_id)')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    const last: Record<string, { id: string; forslag_nummer: string; titel: string; status: string }> = {}
    for (const row of data ?? []) {
      const kund_id = (row.projekt as unknown as { kund_id: string }).kund_id
      if (!last[kund_id]) {
        last[kund_id] = { id: row.id, forslag_nummer: row.forslag_nummer, titel: row.titel, status: row.status }
      }
    }
    return last
  })

  ipcMain.handle('db:kund:set-kalender-farg', async (_, kund_id: string, farg: string | null) => {
    const { error } = await supabase
      .from('kunder')
      .update({ kalender_farg: farg })
      .eq('id', kund_id)
    if (error) throw new Error(error.message)
    broadcastChange('kunder')
  })
}
