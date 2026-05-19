import { ipcMain } from 'electron'
import { supabase } from '../supabase'
import { broadcastChange } from '../broadcast'

const CHANNELS = [
  'db:forslag:list',
  'db:forslag:list-by-projekt',
  'db:forslag:get',
  'db:forslag:preview-nummer',
  'db:forslag:create',
  'db:forslag:update',
  'db:forslag:delete',
  'db:forslag:delete-many',
  'db:forslag:duplicate',
  'db:forslag-faser:list',
  'db:forslag-faser:create',
  'db:forslag-faser:update',
  'db:forslag-faser:delete',
  'db:forslag-faser:swap',
  'db:forslag-subfaser:list',
  'db:forslag-subfaser:list-by-forslag',
  'db:forslag-subfaser:create',
  'db:forslag-subfaser:update',
  'db:forslag-subfaser:delete',
  'db:forslag-subfaser:swap',
  'db:forslag-arbete:list',
  'db:forslag-arbete:list-by-forslag',
  'db:forslag-arbete:create',
  'db:forslag-arbete:update',
  'db:forslag-arbete:delete',
  'db:forslag-arbete:bulk-update-timpris',
  'db:forslag-material:list',
  'db:forslag-material:list-by-forslag',
  'db:forslag-material:create',
  'db:forslag-material:update',
  'db:forslag-material:delete',
  'db:forslag-ue:list',
  'db:forslag-ue:list-by-forslag',
  'db:forslag-ue:create',
  'db:forslag-ue:update',
  'db:forslag-ue:delete',
  'db:forslag:apply-mall',
  'db:forslag:get-totals',
  'db:forslag-nummer:get',
  'db:forslag-nummer:set',
  'db:forslag:get-hours-by-fas',
  'db:forslag-epost:list',
  'db:forslag-epost:create',
  'db:forslag-epost:delete',
  'db:forslag:status-summary',
] as const

type ForslagStatus = 'utkast' | 'skickat' | 'accepterat' | 'avvisat'

interface CreateForslagInput {
  forslag_nummer?: string
  projekt_id: string
  titel: string
  status?: ForslagStatus
  giltig_till?: string
  moms_procent?: number
  sammanfattning?: string
}

const SELECT_WITH_PROJEKT = `
  *,
  projekt!inner(kund_id, namn, projekt_nummer, beskrivning, status, startdatum, slutdatum, arbetsplats_adress, arbetsplats_postnummer, arbetsplats_stad, rot_avdrag, rot_procent, rot_inkludera_medsokande, villkor, betalningsvillkor,
    kunder!inner(namn, kundnummer, email, telefon, telefon_2, adress, adress_2, postnummer, stad, org_nummer, personnummer, fastighetsbeteckning, login_anteckning)
  )
`

async function nextForslagNummer(): Promise<string> {
  const { data, error } = await supabase.rpc('nextval_forslag_nummer')
  if (error) throw new Error(error.message)
  return `F-${String(data as number).padStart(4, '0')}`
}

export function registerForslagHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  // --- Forslag ---

  ipcMain.handle('db:forslag:list', async () => {
    const { data, error } = await supabase
      .from('forslag')
      .select(SELECT_WITH_PROJEKT)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag:list-by-projekt', async (_, projekt_id: string) => {
    const { data, error } = await supabase
      .from('forslag')
      .select(SELECT_WITH_PROJEKT)
      .eq('projekt_id', projekt_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag:get', async (_, id: string) => {
    const { data, error } = await supabase
      .from('forslag')
      .select(SELECT_WITH_PROJEKT)
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag:preview-nummer', async () => {
    const { data, error } = await supabase.rpc('peek_forslag_nummer')
    if (error) throw new Error(error.message)
    return `F-${String(data as number).padStart(4, '0')}`
  })

  ipcMain.handle('db:forslag:create', async (_, input: CreateForslagInput) => {
    const forslag_nummer = input.forslag_nummer?.trim() || await nextForslagNummer()
    const { data, error } = await supabase
      .from('forslag')
      .insert({ ...input, forslag_nummer })
      .select(SELECT_WITH_PROJEKT)
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
    return data
  })

  ipcMain.handle('db:forslag:update', async (_, id: string, input: Partial<CreateForslagInput> & { ai_analys?: string }) => {
    const { data, error } = await supabase
      .from('forslag')
      .update(input)
      .eq('id', id)
      .select(SELECT_WITH_PROJEKT)
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
    return data
  })

  ipcMain.handle('db:forslag:delete', async (_, id: string) => {
    const { data: faser, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id')
      .eq('forslag_id', id)
    if (fasErr) throw new Error(fasErr.message)
    const fasIds = (faser ?? []).map(f => f.id as string)
    if (fasIds.length > 0) {
      const { error: kalErr } = await supabase
        .from('kalender_events')
        .delete()
        .in('fas_id', fasIds)
      if (kalErr) throw new Error(kalErr.message)
    }
    const { error } = await supabase.from('forslag').delete().eq('id', id)
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
  })

  ipcMain.handle('db:forslag:delete-many', async (_, ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    // Hämta alla fas-id för att städa bort kopplade kalender_events
    // (FK är SET NULL men lämnar föräldralösa rader i Kalender annars).
    const { data: faser, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id')
      .in('forslag_id', ids)
    if (fasErr) throw new Error(fasErr.message)
    const fasIds = (faser ?? []).map((f) => f.id as string)
    if (fasIds.length > 0) {
      const { error: kalErr } = await supabase
        .from('kalender_events')
        .delete()
        .in('fas_id', fasIds)
      if (kalErr) throw new Error(kalErr.message)
    }
    const { error } = await supabase.from('forslag').delete().in('id', ids)
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
  })

  ipcMain.handle('db:forslag:duplicate', async (_, input: { source_id: string; target_projekt_id: string; titel: string }) => {
    const { data: src, error: srcErr } = await supabase
      .from('forslag').select('*').eq('id', input.source_id).single()
    if (srcErr) throw new Error(srcErr.message)

    const forslag_nummer = await nextForslagNummer()
    const { data: newF, error: newFErr } = await supabase
      .from('forslag')
      .insert({
        projekt_id: input.target_projekt_id,
        forslag_nummer,
        titel: input.titel,
        status: 'Utkast',
        moms_procent: src.moms_procent,
        sammanfattning: src.sammanfattning,
      })
      .select(SELECT_WITH_PROJEKT)
      .single()
    if (newFErr) throw new Error(newFErr.message)

    const { data: faser } = await supabase
      .from('forslag_faser').select('*').eq('forslag_id', src.id).order('sortering')

    for (const fas of faser ?? []) {
      const { data: newFas, error: fasErr } = await supabase
        .from('forslag_faser')
        .insert({ forslag_id: newF.id, namn: fas.namn, beskrivning: fas.beskrivning, sortering: fas.sortering, notat: fas.notat, aktiv: fas.aktiv })
        .select('id').single()
      if (fasErr) throw new Error(fasErr.message)

      const { data: subfaser } = await supabase
        .from('forslag_subfaser').select('*').eq('fas_id', fas.id).order('sortering')

      for (const subfas of subfaser ?? []) {
        const { data: newSub, error: subErr } = await supabase
          .from('forslag_subfaser')
          .insert({ fas_id: newFas.id, namn: subfas.namn, beskrivning: subfas.beskrivning, sortering: subfas.sortering })
          .select('id').single()
        if (subErr) throw new Error(subErr.message)

        const [{ data: arbeten }, { data: material }, { data: ues }] = await Promise.all([
          supabase.from('forslag_arbetskostnad').select('*').eq('subfas_id', subfas.id),
          supabase.from('forslag_materialkostnad').select('*').eq('subfas_id', subfas.id),
          supabase.from('forslag_underentreprenorer').select('*').eq('subfas_id', subfas.id),
        ])

        if (arbeten?.length) {
          await supabase.from('forslag_arbetskostnad').insert(
            arbeten.map(a => ({ subfas_id: newSub.id, beskrivning: a.beskrivning, yrkesroll: a.yrkesroll, antal_timmar: a.antal_timmar, timpris: a.timpris, rot_berattigad: a.rot_berattigad }))
          )
        }
        if (material?.length) {
          await supabase.from('forslag_materialkostnad').insert(
            material.map(m => ({ subfas_id: newSub.id, beskrivning: m.beskrivning, enhet: m.enhet, antal: m.antal, a_pris: m.a_pris, leverantor: m.leverantor }))
          )
        }
        if (ues?.length) {
          await supabase.from('forslag_underentreprenorer').insert(
            ues.map(u => ({ subfas_id: newSub.id, namn: u.namn, beskrivning: u.beskrivning, inkl_material: u.inkl_material, kostnad: u.kostnad }))
          )
        }
      }
    }

    broadcastChange('forslag')
    return newF
  })

  // --- Faser ---

  ipcMain.handle('db:forslag-faser:list', async (_, forslag_id: string) => {
    const { data, error } = await supabase
      .from('forslag_faser')
      .select('*')
      .eq('forslag_id', forslag_id)
      .order('sortering', { ascending: true })
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-faser:create', async (_, input: { forslag_id: string; namn: string }) => {
    const { data: existing } = await supabase
      .from('forslag_faser')
      .select('sortering')
      .eq('forslag_id', input.forslag_id)
      .order('sortering', { ascending: false })
      .limit(1)
      .single()
    const sortering = existing ? (existing.sortering + 1) : 0
    const { data, error } = await supabase
      .from('forslag_faser')
      .insert({ ...input, sortering })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
    return data
  })

  ipcMain.handle('db:forslag-faser:update', async (_, id: string, input: { namn?: string; beskrivning?: string; start_datum?: string | null; slut_datum?: string | null; notat?: string | null; aktiv?: boolean }) => {
    const { data, error } = await supabase
      .from('forslag_faser')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
    return data
  })

  ipcMain.handle('db:forslag-faser:delete', async (_, id: string) => {
    const { error: kalErr } = await supabase
      .from('kalender_events')
      .delete()
      .eq('fas_id', id)
    if (kalErr) throw new Error(kalErr.message)
    const { error } = await supabase.from('forslag_faser').delete().eq('id', id)
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
  })

  ipcMain.handle('db:forslag-faser:swap', async (_, id_a: string, id_b: string) => {
    const { data: rows, error: readErr } = await supabase
      .from('forslag_faser')
      .select('id, sortering')
      .in('id', [id_a, id_b])
    if (readErr) throw new Error(readErr.message)
    if (!rows || rows.length !== 2) throw new Error('faser not found')
    const a = rows.find((r: { id: string; sortering: number }) => r.id === id_a)!
    const b = rows.find((r: { id: string; sortering: number }) => r.id === id_b)!
    const { error: e1 } = await supabase.from('forslag_faser').update({ sortering: b.sortering }).eq('id', id_a)
    if (e1) throw new Error(e1.message)
    const { error: e2 } = await supabase.from('forslag_faser').update({ sortering: a.sortering }).eq('id', id_b)
    if (e2) throw new Error(e2.message)
  })

  // --- Subfaser ---

  ipcMain.handle('db:forslag-subfaser:list', async (_, fas_id: string) => {
    const { data, error } = await supabase
      .from('forslag_subfaser')
      .select('*')
      .eq('fas_id', fas_id)
      .order('sortering', { ascending: true })
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-subfaser:list-by-forslag', async (_, forslag_id: string) => {
    const { data: faser, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id')
      .eq('forslag_id', forslag_id)
    if (fasErr) throw new Error(fasErr.message)
    if (!faser || faser.length === 0) return []
    const fasIds = faser.map((f: { id: string }) => f.id)
    const { data, error } = await supabase
      .from('forslag_subfaser')
      .select('*')
      .in('fas_id', fasIds)
      .order('sortering', { ascending: true })
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-subfaser:create', async (_, input: { fas_id: string; namn: string }) => {
    const { data: existing } = await supabase
      .from('forslag_subfaser')
      .select('sortering')
      .eq('fas_id', input.fas_id)
      .order('sortering', { ascending: false })
      .limit(1)
      .single()
    const sortering = existing ? (existing.sortering + 1) : 0
    const { data, error } = await supabase
      .from('forslag_subfaser')
      .insert({ ...input, sortering })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
    return data
  })

  ipcMain.handle('db:forslag-subfaser:update', async (_, id: string, input: { namn?: string; beskrivning?: string }) => {
    const { data, error } = await supabase
      .from('forslag_subfaser')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
    return data
  })

  ipcMain.handle('db:forslag-subfaser:delete', async (_, id: string) => {
    const { error } = await supabase.from('forslag_subfaser').delete().eq('id', id)
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
  })

  ipcMain.handle('db:forslag-subfaser:swap', async (_, id_a: string, id_b: string) => {
    const { data: rows, error: readErr } = await supabase
      .from('forslag_subfaser')
      .select('id, sortering')
      .in('id', [id_a, id_b])
    if (readErr) throw new Error(readErr.message)
    if (!rows || rows.length !== 2) throw new Error('subfaser not found')
    const a = rows.find((r: { id: string; sortering: number }) => r.id === id_a)!
    const b = rows.find((r: { id: string; sortering: number }) => r.id === id_b)!
    const { error: e1 } = await supabase.from('forslag_subfaser').update({ sortering: b.sortering }).eq('id', id_a)
    if (e1) throw new Error(e1.message)
    const { error: e2 } = await supabase.from('forslag_subfaser').update({ sortering: a.sortering }).eq('id', id_b)
    if (e2) throw new Error(e2.message)
  })

  // --- Arbetskostnad (now linked to subfas) ---

  ipcMain.handle('db:forslag-arbete:list', async (_, subfas_id: string) => {
    const { data, error } = await supabase
      .from('forslag_arbetskostnad')
      .select('*')
      .eq('subfas_id', subfas_id)
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-arbete:list-by-forslag', async (_, forslag_id: string) => {
    const { data: faser, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id')
      .eq('forslag_id', forslag_id)
    if (fasErr) throw new Error(fasErr.message)
    if (!faser || faser.length === 0) return []
    const fasIds = faser.map((f: { id: string }) => f.id)
    const { data: subfaser, error: subErr } = await supabase
      .from('forslag_subfaser')
      .select('id')
      .in('fas_id', fasIds)
    if (subErr) throw new Error(subErr.message)
    if (!subfaser || subfaser.length === 0) return []
    const subfasIds = subfaser.map((s: { id: string }) => s.id)
    const { data, error } = await supabase
      .from('forslag_arbetskostnad')
      .select('*')
      .in('subfas_id', subfasIds)
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-arbete:create', async (_, subfas_id: string) => {
    const { data, error } = await supabase
      .from('forslag_arbetskostnad')
      .insert({ subfas_id })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
    return data
  })

  ipcMain.handle('db:forslag-arbete:update', async (_, id: string, input: {
    beskrivning?: string; yrkesroll?: string; antal_timmar?: number; timpris?: number; rot_berattigad?: boolean
  }) => {
    const { data, error } = await supabase
      .from('forslag_arbetskostnad')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
    return data
  })

  ipcMain.handle('db:forslag-arbete:delete', async (_, id: string) => {
    const { error } = await supabase.from('forslag_arbetskostnad').delete().eq('id', id)
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
  })

  ipcMain.handle('db:forslag-arbete:apply-rot', async (_, forslag_id: string) => {
    const { data: forslag, error: fErr } = await supabase
      .from('forslag').select('projekt_id').eq('id', forslag_id).single()
    if (fErr || !forslag) throw new Error(fErr?.message ?? 'Förslag finns inte')

    const { data: projekt, error: pErr } = await supabase
      .from('projekt').select('rot_avdrag').eq('id', forslag.projekt_id).single()
    if (pErr || !projekt) throw new Error(pErr?.message ?? 'Projekt finns inte')

    const { data: faser } = await supabase
      .from('forslag_faser').select('id').eq('forslag_id', forslag_id)
    const fasIds = (faser ?? []).map((f: { id: string }) => f.id)
    if (!fasIds.length) return { updated: 0, rot_avdrag: !!projekt.rot_avdrag }

    const { data: subfaser } = await supabase
      .from('forslag_subfaser').select('id').in('fas_id', fasIds)
    const subfasIds = (subfaser ?? []).map((s: { id: string }) => s.id)
    if (!subfasIds.length) return { updated: 0, rot_avdrag: !!projekt.rot_avdrag }

    const { data: updated, error: uErr } = await supabase
      .from('forslag_arbetskostnad')
      .update({ rot_berattigad: !!projekt.rot_avdrag })
      .in('subfas_id', subfasIds)
      .select('id')
    if (uErr) throw new Error(uErr.message)

    return { updated: updated?.length ?? 0, rot_avdrag: !!projekt.rot_avdrag }
  })

  ipcMain.handle(
    'db:forslag-arbete:bulk-update-timpris',
    async (_, forslag_id: string, updates: { yrkesroll: string; timpris: number }[]) => {
      if (!Array.isArray(updates) || updates.length === 0) return { updated: 0 }

      const { data: faser } = await supabase
        .from('forslag_faser').select('id').eq('forslag_id', forslag_id)
      const fasIds = (faser ?? []).map((f: { id: string }) => f.id)
      if (!fasIds.length) return { updated: 0 }

      const { data: subfaser } = await supabase
        .from('forslag_subfaser').select('id').in('fas_id', fasIds)
      const subfasIds = (subfaser ?? []).map((s: { id: string }) => s.id)
      if (!subfasIds.length) return { updated: 0 }

      let totalUpdated = 0
      for (const { yrkesroll, timpris } of updates) {
        const { data, error } = await supabase
          .from('forslag_arbetskostnad')
          .update({ timpris })
          .in('subfas_id', subfasIds)
          .eq('yrkesroll', yrkesroll)
          .select('id')
        if (error) throw new Error(error.message)
        totalUpdated += data?.length ?? 0
      }
      broadcastChange('forslag')
      return { updated: totalUpdated }
    }
  )

  // --- Materialkostnad (now linked to subfas) ---

  ipcMain.handle('db:forslag-material:list', async (_, subfas_id: string) => {
    const { data, error } = await supabase
      .from('forslag_materialkostnad')
      .select('*')
      .eq('subfas_id', subfas_id)
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-material:list-by-forslag', async (_, forslag_id: string) => {
    const { data: faser, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id')
      .eq('forslag_id', forslag_id)
    if (fasErr) throw new Error(fasErr.message)
    if (!faser || faser.length === 0) return []
    const fasIds = faser.map((f: { id: string }) => f.id)
    const { data: subfaser, error: subErr } = await supabase
      .from('forslag_subfaser')
      .select('id')
      .in('fas_id', fasIds)
    if (subErr) throw new Error(subErr.message)
    if (!subfaser || subfaser.length === 0) return []
    const subfasIds = subfaser.map((s: { id: string }) => s.id)
    const { data, error } = await supabase
      .from('forslag_materialkostnad')
      .select('*')
      .in('subfas_id', subfasIds)
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-material:create', async (_, subfas_id: string) => {
    const { data, error } = await supabase
      .from('forslag_materialkostnad')
      .insert({ subfas_id })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
    return data
  })

  ipcMain.handle('db:forslag-material:update', async (_, id: string, input: {
    beskrivning?: string; enhet?: string; antal?: number; a_pris?: number; leverantor?: string
  }) => {
    const { data, error } = await supabase
      .from('forslag_materialkostnad')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
    return data
  })

  ipcMain.handle('db:forslag-material:delete', async (_, id: string) => {
    const { error } = await supabase.from('forslag_materialkostnad').delete().eq('id', id)
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
  })

  // --- Underentreprenörer (subfas-level) ---

  ipcMain.handle('db:forslag-ue:list', async (_, subfas_id: string) => {
    const { data, error } = await supabase
      .from('forslag_underentreprenorer')
      .select('*')
      .eq('subfas_id', subfas_id)
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-ue:list-by-forslag', async (_, forslag_id: string) => {
    const { data: faser, error: fasErr } = await supabase
      .from('forslag_faser')
      .select('id')
      .eq('forslag_id', forslag_id)
    if (fasErr) throw new Error(fasErr.message)
    if (!faser || faser.length === 0) return []
    const fasIds = faser.map((f: { id: string }) => f.id)
    const { data: subfaser, error: subErr } = await supabase
      .from('forslag_subfaser')
      .select('id')
      .in('fas_id', fasIds)
    if (subErr) throw new Error(subErr.message)
    if (!subfaser || subfaser.length === 0) return []
    const subfasIds = subfaser.map((s: { id: string }) => s.id)
    const { data, error } = await supabase
      .from('forslag_underentreprenorer')
      .select('*')
      .in('subfas_id', subfasIds)
      .order('skapad_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-ue:create', async (_, subfas_id: string) => {
    const { data, error } = await supabase
      .from('forslag_underentreprenorer')
      .insert({ subfas_id })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
    return data
  })

  ipcMain.handle('db:forslag-ue:update', async (_, id: string, input: {
    namn?: string; beskrivning?: string; inkl_material?: boolean; kostnad?: number
  }) => {
    const { data, error } = await supabase
      .from('forslag_underentreprenorer')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
    return data
  })

  ipcMain.handle('db:forslag-ue:delete', async (_, id: string) => {
    const { error } = await supabase.from('forslag_underentreprenorer').delete().eq('id', id)
    if (error) throw new Error(error.message)
    broadcastChange('forslag')
  })

  ipcMain.handle('db:forslag:apply-mall', async (_, forslag_id: string, mall_id: string) => {
    const { data: mallFaser, error: fasErr } = await supabase
      .from('fas_mall_faser')
      .select('id, namn, sortering')
      .eq('mall_id', mall_id)
      .order('sortering', { ascending: true })
    if (fasErr) throw new Error(fasErr.message)

    for (const mallFas of mallFaser) {
      const { data: fas, error: createFasErr } = await supabase
        .from('forslag_faser')
        .insert({ forslag_id, namn: mallFas.namn, sortering: mallFas.sortering })
        .select('id')
        .single()
      if (createFasErr) throw new Error(createFasErr.message)

      const { data: mallSubfaser, error: subErr } = await supabase
        .from('fas_mall_subfaser')
        .select('namn, sortering')
        .eq('fas_id', mallFas.id)
        .order('sortering', { ascending: true })
      if (subErr) throw new Error(subErr.message)

      if (mallSubfaser.length > 0) {
        const { error: createSubErr } = await supabase
          .from('forslag_subfaser')
          .insert(mallSubfaser.map((s) => ({ fas_id: fas.id, namn: s.namn, sortering: s.sortering })))
        if (createSubErr) throw new Error(createSubErr.message)
      }
    }

    return { fasCount: mallFaser.length }
  })

  ipcMain.handle('db:forslag-nummer:get', async () => {
    const { data, error } = await supabase.rpc('peek_forslag_nummer')
    if (error) throw new Error(error.message)
    return data as number
  })

  ipcMain.handle('db:forslag-nummer:set', async (_, value: number) => {
    const n = Math.max(1, Math.floor(value))
    // Reject if a forslag with this number already exists — setval(..., false) makes nextval return n exactly
    const { data: conflict } = await supabase.from('forslag').select('id').eq('forslag_nummer', String(n)).maybeSingle()
    if (conflict) throw new Error(`Numret ${n} är redan använt av ett befintligt förslag`)
    const { error } = await supabase.rpc('setval_forslag_nummer', { new_value: n })
    if (error) throw new Error(error.message)
    return n
  })

  ipcMain.handle('db:forslag:get-hours-by-fas', async (_, forslag_id: string) => {
    const { data: faser } = await supabase.from('forslag_faser').select('id').eq('forslag_id', forslag_id)
    if (!faser?.length) return {}
    const fasIds = faser.map((f: { id: string }) => f.id)
    const { data: subfaser } = await supabase.from('forslag_subfaser').select('id, fas_id').in('fas_id', fasIds)
    if (!subfaser?.length) return {}
    const subfasIds = subfaser.map((s: { id: string }) => s.id)
    const { data: arbete } = await supabase.from('forslag_arbetskostnad').select('subfas_id, antal_timmar').in('subfas_id', subfasIds)
    const subfasToFas: Record<string, string> = {}
    subfaser.forEach((s: { id: string; fas_id: string }) => { subfasToFas[s.id] = s.fas_id })
    const result: Record<string, number> = {}
    fasIds.forEach((id: string) => { result[id] = 0 })
    ;(arbete ?? []).forEach((a: { subfas_id: string; antal_timmar: number }) => {
      const fasId = subfasToFas[a.subfas_id]
      if (fasId) result[fasId] = (result[fasId] || 0) + (a.antal_timmar || 0)
    })
    return result
  })

  ipcMain.handle('db:forslag:get-totals', async (_, forslag_id: string) => {
    const empty = { totalArbete: 0, rotEligible: 0, totalMaterial: 0, totalUE: 0, totalNetto: 0 }

    const { data: forslag } = await supabase.from('forslag').select('projekt_id').eq('id', forslag_id).single()
    if (!forslag) return empty

    const { data: projekt } = await supabase.from('projekt').select('rot_avdrag').eq('id', forslag.projekt_id).single()

    const { data: faser } = await supabase.from('forslag_faser').select('id').eq('forslag_id', forslag_id)
    if (!faser?.length) return empty

    const fasIds = faser.map((f: { id: string }) => f.id)
    const { data: subfaser } = await supabase.from('forslag_subfaser').select('id').in('fas_id', fasIds)
    if (!subfaser?.length) return empty

    const subfasIds = subfaser.map((s: { id: string }) => s.id)

    const [{ data: arbete }, { data: material }, { data: ue }] = await Promise.all([
      supabase.from('forslag_arbetskostnad').select('antal_timmar, timpris, rot_berattigad').in('subfas_id', subfasIds),
      supabase.from('forslag_materialkostnad').select('antal, a_pris').in('subfas_id', subfasIds),
      supabase.from('forslag_underentreprenorer').select('kostnad').in('subfas_id', subfasIds),
    ])

    const totalArbete = (arbete ?? []).reduce((s: number, r: { antal_timmar: number; timpris: number }) => s + r.antal_timmar * r.timpris, 0)
    const rotEligible = projekt?.rot_avdrag
      ? (arbete ?? []).reduce((s: number, r: { antal_timmar: number; timpris: number; rot_berattigad: boolean }) => s + (r.rot_berattigad ? r.antal_timmar * r.timpris : 0), 0)
      : 0
    const totalMaterial = (material ?? []).reduce((s: number, r: { antal: number; a_pris: number }) => s + r.antal * r.a_pris, 0)
    const totalUE = (ue ?? []).reduce((s: number, r: { kostnad: number }) => s + r.kostnad, 0)
    const totalNetto = totalArbete + totalMaterial + totalUE

    return { totalArbete, rotEligible, totalMaterial, totalUE, totalNetto }
  })

  ipcMain.handle('db:forslag-epost:list', async (_, forslag_id: string) => {
    const { data, error } = await supabase
      .from('forslag_epost_refs')
      .select('*')
      .eq('forslag_id', forslag_id)
      .order('datum', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  })

  ipcMain.handle('db:forslag-epost:create', async (_, input: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('forslag_epost_refs')
      .insert(input)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:forslag-epost:delete', async (_, id: string) => {
    const { error } = await supabase.from('forslag_epost_refs').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

  ipcMain.handle('db:forslag:status-summary', async () => {
    const [{ data: forslag, error }, { data: statusar }] = await Promise.all([
      supabase.from('forslag').select('projekt_id, status, forslag_nummer, skapad_at').order('skapad_at', { ascending: false }),
      supabase.from('forslag_statusar').select('namn, farg'),
    ])
    if (error) throw new Error(error.message)
    const fargMap: Record<string, string> = {}
    for (const s of statusar ?? []) fargMap[s.namn] = s.farg
    const result: Record<string, { status: string; farg: string; forslag_nummer: string }> = {}
    for (const f of forslag ?? []) {
      if (!result[f.projekt_id]) {
        result[f.projekt_id] = { status: f.status, farg: fargMap[f.status] ?? 'muted', forslag_nummer: f.forslag_nummer }
      }
    }
    return result
  })
}
