import { ipcMain } from 'electron'
import { supabase } from '../supabase'

const PAGE_SIZE = 500

const CHANNELS = [
  'db:material-katalog:list',
  'db:material-katalog:search',
  'db:material-katalog:count-by-leverantor',
  'db:material-import-config:get',
  'db:material-import-config:save',
  'db:material-katalog:import',
  'db:material-katalog:update',
  'db:material-katalog:delete',
  'db:material-katalog:delete-by-leverantor',
] as const

interface ImportMaterialRow {
  leverantor_id: string
  artikel_nummer?: string | null
  namn: string
  namn2?: string | null
  kategori1?: string | null
  kategori2?: string | null
  kategori3?: string | null
  kategori4?: string | null
  enhet?: string | null
  a_pris: number
  bredd?: number | null
  tjocklek?: number | null
  langd?: number | null
  bild_url?: string | null
}

interface SaveImportConfigInput {
  leverantor_id: string
  mappings: Record<string, string>
}

export function registerMaterialerHandlers(): void {
  // Remove any existing handlers (safe on first run, prevents duplicate-registration on hot-reload)
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  ipcMain.handle('db:material-katalog:list', async (_, leverantor_id?: string, page = 0) => {
    let q = supabase
      .from('material_katalog')
      .select('*')
      .eq('aktiv', true)
      .order('namn', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (leverantor_id) q = q.eq('leverantor_id', leverantor_id)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:material-katalog:search', async (_, query: string, leverantor_id?: string) => {
    let q = supabase
      .from('material_katalog')
      .select('*')
      .eq('aktiv', true)
      .ilike('namn', `%${query}%`)
      .limit(500)
    if (leverantor_id) q = q.eq('leverantor_id', leverantor_id)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:material-katalog:count-by-leverantor', async () => {
    const { data: levs, error: levErr } = await supabase
      .from('leverantorer')
      .select('id')
      .eq('aktiv', true)
    if (levErr) throw new Error(levErr.message)

    const counts: Record<string, number> = {}
    await Promise.all(
      levs.map(async ({ id }) => {
        const { count } = await supabase
          .from('material_katalog')
          .select('*', { count: 'exact', head: true })
          .eq('leverantor_id', id)
        counts[id] = count ?? 0
      })
    )
    return counts
  })

  ipcMain.handle('db:material-import-config:get', async (_, leverantor_id: string) => {
    const { data, error } = await supabase
      .from('material_import_config')
      .select('mappings')
      .eq('leverantor_id', leverantor_id)
      .single()
    if (error && error.code !== 'PGRST116') throw new Error(error.message)
    return (data?.mappings as Record<string, string>) ?? null
  })

  ipcMain.handle('db:material-import-config:save', async (_, input: SaveImportConfigInput) => {
    const { error } = await supabase
      .from('material_import_config')
      .upsert(
        { leverantor_id: input.leverantor_id, mappings: input.mappings, delimiter: ',', decimal_separator: '.', skip_rows: 0 },
        { onConflict: 'leverantor_id' }
      )
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:material-katalog:import', async (_, leverantor_id: string, rows: ImportMaterialRow[]) => {
    await supabase.from('material_katalog').delete().eq('leverantor_id', leverantor_id)

    const BATCH = 500
    let inserted = 0
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map((r) => ({ ...r, leverantor_id }))
      const { error } = await supabase.from('material_katalog').insert(batch)
      if (error) throw new Error(error.message)
      inserted += batch.length
    }
    return { inserted }
  })

  ipcMain.handle('db:material-katalog:update', async (_, id: string, patch: { namn?: string; a_pris?: number }) => {
    const { data, error } = await supabase
      .from('material_katalog')
      .update({ ...patch, uppdaterad_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:material-katalog:delete', async (_, id: string) => {
    const { error } = await supabase.from('material_katalog').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:material-katalog:delete-by-leverantor', async (_, leverantor_id: string) => {
    const { error } = await supabase
      .from('material_katalog')
      .delete()
      .eq('leverantor_id', leverantor_id)
    if (error) throw new Error(error.message)
  })
}
