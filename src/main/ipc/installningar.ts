import { ipcMain } from 'electron'
import { supabase } from '../supabase'

const CHANNELS = [
  'db:installningar:get',
  'db:installningar:update',
  'db:arbets-roller:list',
  'db:arbets-roller:create',
  'db:arbets-roller:update',
  'db:arbets-roller:delete',
  'db:arbets-roller:import-csv',
  'db:artiklar:list',
  'db:artiklar:create',
  'db:artiklar:update',
  'db:artiklar:delete',
  'db:artiklar:import-csv',
  'db:leverantorer:list',
  'db:leverantorer:create',
  'db:leverantorer:update',
  'db:leverantorer:delete',
  'db:leverantorer:import-csv',
  'db:fas-mallar:list',
  'db:fas-mallar:create',
  'db:fas-mallar:update',
  'db:fas-mallar:delete',
  'db:fas-mall-faser:list',
  'db:fas-mall-faser:create',
  'db:fas-mall-faser:update',
  'db:fas-mall-faser:delete',
  'db:fas-mall-subfaser:list',
  'db:fas-mall-subfaser:create',
  'db:fas-mall-subfaser:update',
  'db:fas-mall-subfaser:delete',
  'db:fas-mall:import-csv',
  'db:kund-statusar:list',
  'db:kund-statusar:create',
  'db:kund-statusar:update',
  'db:kund-statusar:delete',
  'db:forslag-statusar:list',
  'db:forslag-statusar:create',
  'db:forslag-statusar:update',
  'db:forslag-statusar:delete',
  'db:aktivitetslogg:list',
  'db:aktivitetslogg:toggle',
] as const

export function registerInstallningarHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  // ── App settings (single row) ──────────────────────────────────────────────

  ipcMain.handle('db:installningar:get', async () => {
    const { data, error } = await supabase
      .from('app_installningar')
      .select('*')
      .limit(1)
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:installningar:update', async (_, input: Record<string, unknown>) => {
    const { data: existing } = await supabase.from('app_installningar').select('id').limit(1).single()
    if (!existing) throw new Error('No settings row found')
    const { data, error } = await supabase
      .from('app_installningar')
      .update(input)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  // ── Arbets roller ──────────────────────────────────────────────────────────

  ipcMain.handle('db:arbets-roller:list', async () => {
    const { data, error } = await supabase
      .from('arbets_roller')
      .select('*')
      .eq('aktiv', true)
      .order('sortering', { ascending: true })
      .order('namn', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:arbets-roller:create', async (_, input: { namn: string; timpris?: number; enhet?: string }) => {
    const { data: existing } = await supabase.from('arbets_roller').select('sortering').eq('aktiv', true).order('sortering', { ascending: false }).limit(1).single()
    const sortering = existing ? existing.sortering + 1 : 0
    const { data, error } = await supabase.from('arbets_roller').insert({ ...input, sortering }).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:arbets-roller:update', async (_, id: string, input: Partial<{ namn: string; timpris: number; enhet: string }>) => {
    const { data, error } = await supabase.from('arbets_roller').update(input).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:arbets-roller:delete', async (_, id: string) => {
    const { error } = await supabase.from('arbets_roller').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:arbets-roller:import-csv', async (_, rows: Array<{ namn: string; timpris?: number; enhet?: string }>) => {
    let success = 0
    const errors: Array<{ index: number; message: string }> = []
    const { data: existing } = await supabase.from('arbets_roller').select('sortering').eq('aktiv', true).order('sortering', { ascending: false }).limit(1).single()
    let sortering = existing ? existing.sortering + 1 : 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const { error } = await supabase.from('arbets_roller').insert({ ...row, sortering })
      if (error) errors.push({ index: i, message: error.message })
      else { success++; sortering++ }
    }
    return { success, errors }
  })

  // ── Artiklar ───────────────────────────────────────────────────────────────

  ipcMain.handle('db:artiklar:list', async () => {
    const { data, error } = await supabase
      .from('artiklar')
      .select('*')
      .eq('aktiv', true)
      .order('beskrivning', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:artiklar:create', async (_, input: { beskrivning: string; article_number?: string; enhet?: string; a_pris?: number; moms_procent?: number; account_number?: number }) => {
    const { data, error } = await supabase.from('artiklar').insert(input).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:artiklar:update', async (_, id: string, input: Record<string, unknown>) => {
    const { data, error } = await supabase.from('artiklar').update(input).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:artiklar:delete', async (_, id: string) => {
    const { error } = await supabase.from('artiklar').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:artiklar:import-csv', async (_, rows: Array<{ beskrivning: string; article_number?: string; enhet?: string; a_pris?: number; moms_procent?: number; account_number?: number }>) => {
    let success = 0
    const errors: Array<{ index: number; message: string }> = []
    for (let i = 0; i < rows.length; i++) {
      const { error } = await supabase.from('artiklar').insert(rows[i])
      if (error) errors.push({ index: i, message: error.message })
      else success++
    }
    return { success, errors }
  })

  // ── Leverantörer ───────────────────────────────────────────────────────────

  ipcMain.handle('db:leverantorer:list', async () => {
    const { data, error } = await supabase
      .from('leverantorer')
      .select('*')
      .eq('aktiv', true)
      .order('namn', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:leverantorer:create', async (_, input: { namn: string; kontaktperson?: string; email?: string; telefon?: string; webbadress?: string; org_nummer?: string; anteckning?: string }) => {
    const { data, error } = await supabase.from('leverantorer').insert(input).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:leverantorer:update', async (_, id: string, input: Record<string, unknown>) => {
    const { data, error } = await supabase.from('leverantorer').update(input).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:leverantorer:delete', async (_, id: string) => {
    const { error } = await supabase.from('leverantorer').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:leverantorer:import-csv', async (_, rows: Array<{ namn: string; kontaktperson?: string; email?: string; telefon?: string; org_nummer?: string; webbadress?: string; anteckning?: string }>, mode: 'skip' | 'overwrite' = 'skip') => {
    const { data: existing } = await supabase.from('leverantorer').select('id, namn').eq('aktiv', true)
    const byNamn = new Map((existing ?? []).map(l => [l.namn.toLowerCase(), l.id as string]))

    let success = 0, skipped = 0
    const errors: Array<{ index: number; message: string }> = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const existingId = byNamn.get(row.namn.toLowerCase())
      if (existingId) {
        if (mode === 'skip') { skipped++; continue }
        const { error } = await supabase.from('leverantorer').update(row).eq('id', existingId)
        if (error) errors.push({ index: i, message: error.message })
        else success++
      } else {
        const { error } = await supabase.from('leverantorer').insert(row)
        if (error) errors.push({ index: i, message: error.message })
        else success++
      }
    }
    return { success, skipped, errors }
  })

  // ── Fas-mallar ─────────────────────────────────────────────────────────────

  ipcMain.handle('db:fas-mallar:list', async () => {
    const { data, error } = await supabase
      .from('fas_mallar')
      .select('*')
      .eq('aktiv', true)
      .order('sortering', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:fas-mallar:create', async (_, input: { namn: string; beskrivning?: string }) => {
    const { data: existing } = await supabase.from('fas_mallar').select('sortering').eq('aktiv', true).order('sortering', { ascending: false }).limit(1).single()
    const sortering = existing ? existing.sortering + 1 : 0
    const { data, error } = await supabase.from('fas_mallar').insert({ ...input, sortering }).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:fas-mallar:update', async (_, id: string, input: Partial<{ namn: string; beskrivning: string }>) => {
    const { data, error } = await supabase.from('fas_mallar').update(input).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:fas-mallar:delete', async (_, id: string) => {
    const { error } = await supabase.from('fas_mallar').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  // ── Fas-mall faser ─────────────────────────────────────────────────────────

  ipcMain.handle('db:fas-mall-faser:list', async (_, mall_id: string) => {
    const { data, error } = await supabase
      .from('fas_mall_faser')
      .select('*')
      .eq('mall_id', mall_id)
      .order('sortering', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:fas-mall-faser:create', async (_, input: { mall_id: string; namn: string }) => {
    const { data: existing } = await supabase.from('fas_mall_faser').select('sortering').eq('mall_id', input.mall_id).order('sortering', { ascending: false }).limit(1).single()
    const sortering = existing ? existing.sortering + 1 : 0
    const { data, error } = await supabase.from('fas_mall_faser').insert({ ...input, sortering }).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:fas-mall-faser:update', async (_, id: string, input: Partial<{ namn: string }>) => {
    const { data, error } = await supabase.from('fas_mall_faser').update(input).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:fas-mall-faser:delete', async (_, id: string) => {
    const { error } = await supabase.from('fas_mall_faser').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  // ── Fas-mall subfaser ──────────────────────────────────────────────────────

  ipcMain.handle('db:fas-mall-subfaser:list', async (_, fas_id: string) => {
    const { data, error } = await supabase
      .from('fas_mall_subfaser')
      .select('*')
      .eq('fas_id', fas_id)
      .order('sortering', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:fas-mall-subfaser:create', async (_, input: { fas_id: string; namn: string }) => {
    const { data: existing } = await supabase.from('fas_mall_subfaser').select('sortering').eq('fas_id', input.fas_id).order('sortering', { ascending: false }).limit(1).single()
    const sortering = existing ? existing.sortering + 1 : 0
    const { data, error } = await supabase.from('fas_mall_subfaser').insert({ ...input, sortering }).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:fas-mall-subfaser:update', async (_, id: string, input: Partial<{ namn: string }>) => {
    const { data, error } = await supabase.from('fas_mall_subfaser').update(input).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:fas-mall-subfaser:delete', async (_, id: string) => {
    const { error } = await supabase.from('fas_mall_subfaser').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:fas-mall:import-csv', async (_, mall_id: string, rows: { fas: string; subfas: string }[]) => {
    // Delete existing faser (cascades to subfaser)
    const { error: delErr } = await supabase.from('fas_mall_faser').delete().eq('mall_id', mall_id)
    if (delErr) throw new Error(delErr.message)

    // Group rows by fas name preserving order
    const fasByName = new Map<string, string[]>()
    for (const row of rows) {
      const fasNamn = row.fas.trim()
      if (!fasNamn) continue
      if (!fasByName.has(fasNamn)) fasByName.set(fasNamn, [])
      const subfasNamn = row.subfas.trim()
      if (subfasNamn) fasByName.get(fasNamn)!.push(subfasNamn)
    }

    let fasCount = 0
    let subfasCount = 0
    let fasSortering = 0

    for (const [fasNamn, subfaser] of fasByName) {
      const { data: fas, error: fasErr } = await supabase
        .from('fas_mall_faser')
        .insert({ mall_id, namn: fasNamn, sortering: fasSortering++ })
        .select('id')
        .single()
      if (fasErr) throw new Error(fasErr.message)
      fasCount++

      if (subfaser.length > 0) {
        const { error: subErr } = await supabase
          .from('fas_mall_subfaser')
          .insert(subfaser.map((namn, i) => ({ fas_id: fas.id, namn, sortering: i })))
        if (subErr) throw new Error(subErr.message)
        subfasCount += subfaser.length
      }
    }

    return { fasCount, subfasCount }
  })

  // ── Kund statusar ──────────────────────────────────────────────────────────

  ipcMain.handle('db:kund-statusar:list', async () => {
    const { data, error } = await supabase
      .from('kund_statusar')
      .select('*')
      .order('sortering', { ascending: true })
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:kund-statusar:create', async (_, input: { namn: string; farg: string }) => {
    const { data: last } = await supabase.from('kund_statusar').select('sortering').order('sortering', { ascending: false }).limit(1).single()
    const sortering = last ? last.sortering + 1 : 0
    const { data, error } = await supabase.from('kund_statusar').insert({ ...input, sortering }).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:kund-statusar:update', async (_, id: string, input: { namn?: string; farg?: string }) => {
    const { data, error } = await supabase.from('kund_statusar').update(input).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:kund-statusar:delete', async (_, id: string) => {
    const { error } = await supabase.from('kund_statusar').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  // ── Förslag statusar ───────────────────────────────────────────────────────

  ipcMain.handle('db:forslag-statusar:list', async () => {
    const { data, error } = await supabase
      .from('forslag_statusar')
      .select('*')
      .order('sortering', { ascending: true })
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-statusar:create', async (_, input: { namn: string; farg: string }) => {
    const { data: last } = await supabase.from('forslag_statusar').select('sortering').order('sortering', { ascending: false }).limit(1).single()
    const sortering = last ? last.sortering + 1 : 0
    const { data, error } = await supabase.from('forslag_statusar').insert({ ...input, sortering }).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-statusar:update', async (_, id: string, input: { namn?: string; farg?: string }) => {
    const { data, error } = await supabase.from('forslag_statusar').update(input).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-statusar:delete', async (_, id: string) => {
    const { error } = await supabase.from('forslag_statusar').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:aktivitetslogg:list', async () => {
    const { data, error } = await supabase.from('aktivitetslogg_installningar').select('*')
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:aktivitetslogg:toggle', async (_, handelse: string, aktiv: boolean) => {
    const { error } = await supabase.from('aktivitetslogg_installningar').update({ aktiv }).eq('handelse', handelse)
    if (error) throw new Error(error.message)
  })
}
