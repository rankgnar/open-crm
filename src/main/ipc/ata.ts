import { ipcMain } from 'electron'
import { supabase } from '../supabase'

const CHANNELS = [
  'db:ata:list',
  'db:ata:list-by-projekt',
  'db:ata:get',
  'db:ata:create',
  'db:ata:update',
  'db:ata:delete',
  'db:ata:delete-many',
  'db:ata:sign',
  'db:ata:set-status',
  'db:ata-rader:create',
  'db:ata-rader:update',
  'db:ata-rader:delete',
  'db:ata-rader:reorder',
  'db:ata-nummer:peek',
  'db:ata-nummer:set',
] as const

const MOMS_PROCENT = 25

interface CreateAtaInput {
  projekt_id: string
  titel: string
  beskrivning?: string
  villkor?: string
  fas_id?: string | null
  subfas_id?: string | null
  rader?: CreateAtaRadInput[]
}

interface CreateAtaRadInput {
  beskrivning: string
  antal?: number
  enhet?: string
  a_pris?: number
  sortering?: number
}

interface UpdateAtaInput {
  titel?: string
  beskrivning?: string
  villkor?: string | null
  fas_id?: string | null
  subfas_id?: string | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function recomputeAtaTotals(ata_id: string): Promise<void> {
  const { data: rader, error } = await supabase
    .from('ata_rader')
    .select('antal, a_pris')
    .eq('ata_id', ata_id)
  if (error) throw new Error(error.message)
  const netto = round2((rader ?? []).reduce((s, r) => s + r.antal * r.a_pris, 0))
  const moms = round2(netto * (MOMS_PROCENT / 100))
  const total = round2(netto + moms)
  const { error: uErr } = await supabase
    .from('ata')
    .update({ belopp_netto: netto, belopp_moms: moms, belopp_total: total })
    .eq('id', ata_id)
  if (uErr) throw new Error(uErr.message)
}

export function registerAtaHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  ipcMain.handle('db:ata:list', async () => {
    const { data, error } = await supabase
      .from('ata')
      .select('*, projekt:projekt_id(id, projekt_nummer, namn), fas:fas_id(id, namn), subfas:subfas_id(id, namn)')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:ata:list-by-projekt', async (_, projekt_id: string) => {
    const { data, error } = await supabase
      .from('ata')
      .select('*')
      .eq('projekt_id', projekt_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:ata:get', async (_, id: string) => {
    const { data: ata, error } = await supabase
      .from('ata')
      .select('*, fas:fas_id(id, namn), subfas:subfas_id(id, namn), projekt:projekt_id(id, projekt_nummer, namn), kund:kund_id(email)')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)

    const { data: rader, error: rErr } = await supabase
      .from('ata_rader')
      .select('*')
      .eq('ata_id', id)
      .order('sortering', { ascending: true })
      .order('skapad_at', { ascending: true })
    if (rErr) throw new Error(rErr.message)

    return { ...ata, rader: rader ?? [] }
  })

  ipcMain.handle('db:ata:create', async (_, input: CreateAtaInput) => {
    const { data: projekt, error: pErr } = await supabase
      .from('projekt')
      .select('kund_id, kunder(id, namn, org_nummer, ata_std_villkor)')
      .eq('id', input.projekt_id)
      .single()
    if (pErr) throw new Error(pErr.message)
    const kundRaw = projekt.kunder as unknown
    const kund = (Array.isArray(kundRaw) ? kundRaw[0] : kundRaw) as { id: string; namn: string | null; org_nummer: string | null; ata_std_villkor: string | null } | null
    if (!kund) throw new Error('Projekt saknar kopplad kund')

    const { data: numData, error: numErr } = await supabase.rpc('nextval_ata_nummer')
    if (numErr) throw new Error(numErr.message)
    const ata_nummer = `ÄTA-${String(numData as number).padStart(4, '0')}`

    // Cascade: input → kund → global → ''
    let villkorSnapshot = (input.villkor ?? '').trim()
    if (!villkorSnapshot) {
      const fromKund = (kund.ata_std_villkor ?? '').trim()
      if (fromKund) {
        villkorSnapshot = fromKund
      } else {
        const { data: settings } = await supabase
          .from('app_installningar')
          .select('ata_std_villkor')
          .limit(1)
          .single()
        villkorSnapshot = (settings?.ata_std_villkor ?? '').trim()
      }
    }

    const { data: ata, error: oErr } = await supabase
      .from('ata')
      .insert({
        ata_nummer,
        projekt_id: input.projekt_id,
        kund_id: kund.id,
        kund_namn: kund.namn ?? '',
        kund_org_nr: kund.org_nummer ?? '',
        titel: input.titel,
        beskrivning: input.beskrivning ?? '',
        villkor: villkorSnapshot,
        fas_id: input.fas_id ?? null,
        subfas_id: input.subfas_id ?? null,
        status: 'Utkast',
      })
      .select('*')
      .single()
    if (oErr) throw new Error(oErr.message)

    if (input.rader && input.rader.length > 0) {
      const radRows = input.rader.map((r, i) => {
        const antal = r.antal ?? 1
        const a_pris = r.a_pris ?? 0
        return {
          ata_id: ata.id,
          beskrivning: r.beskrivning,
          antal,
          enhet: r.enhet ?? 'st',
          a_pris,
          belopp: round2(antal * a_pris),
          sortering: r.sortering ?? i,
        }
      })
      const { error: rErr } = await supabase.from('ata_rader').insert(radRows)
      if (rErr) throw new Error(rErr.message)
      await recomputeAtaTotals(ata.id)
    }

    return ata
  })

  ipcMain.handle('db:ata:update', async (_, id: string, patch: UpdateAtaInput) => {
    const { data, error } = await supabase
      .from('ata')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:ata:delete', async (_, id: string) => {
    const { error } = await supabase.from('ata').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:ata:delete-many', async (_, ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    const { error } = await supabase.from('ata').delete().in('id', ids)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:ata:sign', async (_, id: string, godkand_av: string, signatur_data: string) => {
    if (!godkand_av.trim()) throw new Error('Godkännarens namn krävs')
    if (!signatur_data) throw new Error('Signatur saknas')
    const { data, error } = await supabase
      .from('ata')
      .update({
        status: 'Godkänd',
        godkand_av: godkand_av.trim(),
        godkand_datum: new Date().toISOString(),
        signatur_data,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:ata:set-status', async (_, id: string, status: string) => {
    if (status === 'Godkänd') {
      throw new Error('Godkänd kan endast sättas via signering')
    }
    if (!['Utkast', 'Skickad', 'Avvisad'].includes(status)) {
      throw new Error(`Ogiltig status: ${status}`)
    }
    const { data: current, error: cErr } = await supabase
      .from('ata')
      .select('status')
      .eq('id', id)
      .single()
    if (cErr) throw new Error(cErr.message)

    const update: Record<string, unknown> = { status }
    if (current.status === 'Godkänd' && status !== 'Godkänd') {
      update.signatur_data = null
      update.godkand_av = null
      update.godkand_datum = null
    }
    const { data, error } = await supabase
      .from('ata')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:ata-rader:create', async (_, ata_id: string, input: CreateAtaRadInput) => {
    const antal = input.antal ?? 1
    const a_pris = input.a_pris ?? 0
    const { data, error } = await supabase
      .from('ata_rader')
      .insert({
        ata_id,
        beskrivning: input.beskrivning,
        antal,
        enhet: input.enhet ?? 'st',
        a_pris,
        belopp: round2(antal * a_pris),
        sortering: input.sortering ?? 0,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    await recomputeAtaTotals(ata_id)
    return data
  })

  ipcMain.handle('db:ata-rader:update', async (_, id: string, patch: Partial<CreateAtaRadInput>) => {
    const update: Record<string, unknown> = { ...patch }
    if (patch.antal !== undefined || patch.a_pris !== undefined) {
      const { data: current } = await supabase
        .from('ata_rader')
        .select('antal, a_pris, ata_id')
        .eq('id', id)
        .single()
      if (!current) throw new Error('Rad finns inte')
      const antal = patch.antal ?? current.antal
      const a_pris = patch.a_pris ?? current.a_pris
      update.belopp = round2(antal * a_pris)
    }
    const { data, error } = await supabase
      .from('ata_rader')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    await recomputeAtaTotals(data.ata_id)
    return data
  })

  ipcMain.handle('db:ata-rader:delete', async (_, id: string) => {
    const { data: current } = await supabase
      .from('ata_rader')
      .select('ata_id')
      .eq('id', id)
      .single()
    const { error } = await supabase.from('ata_rader').delete().eq('id', id)
    if (error) throw new Error(error.message)
    if (current) await recomputeAtaTotals(current.ata_id)
  })

  ipcMain.handle('db:ata-rader:reorder', async (_, ata_id: string, orderedIds: string[]) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from('ata_rader').update({ sortering: index }).eq('id', id).eq('ata_id', ata_id)
      )
    )
  })

  ipcMain.handle('db:ata-nummer:peek', async () => {
    const { data, error } = await supabase.rpc('peek_ata_nummer')
    if (error) throw new Error(error.message)
    return data as number
  })

  ipcMain.handle('db:ata-nummer:set', async (_, value: number) => {
    const n = Math.max(1, Math.floor(value))
    const { error } = await supabase.rpc('setval_ata_nummer', { new_value: n })
    if (error) throw new Error(error.message)
    return n
  })
}
