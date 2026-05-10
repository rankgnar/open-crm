import { ipcMain } from 'electron'
import { supabase } from '../supabase'

const CHANNELS = [
  'db:order:list',
  'db:order:list-by-projekt',
  'db:order:get',
  'db:order:create',
  'db:order:update',
  'db:order:delete',
  'db:order:delete-many',
  'db:order:sign',
  'db:order:set-status',
  'db:order-rader:create',
  'db:order-rader:update',
  'db:order-rader:delete',
  'db:order-rader:reorder',
  'db:order-nummer:peek',
  'db:order-nummer:set',
] as const

const MOMS_PROCENT = 25

interface CreateOrderInput {
  projekt_id: string
  titel: string
  beskrivning?: string
  villkor?: string
  fas_id?: string | null
  subfas_id?: string | null
  rader?: CreateOrderRadInput[]
}

interface CreateOrderRadInput {
  beskrivning: string
  antal?: number
  enhet?: string
  a_pris?: number
  sortering?: number
}

interface UpdateOrderInput {
  titel?: string
  beskrivning?: string
  villkor?: string | null
  fas_id?: string | null
  subfas_id?: string | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function recomputeOrderTotals(order_id: string): Promise<void> {
  const { data: rader, error } = await supabase
    .from('order_rader')
    .select('antal, a_pris')
    .eq('order_id', order_id)
  if (error) throw new Error(error.message)
  const netto = round2((rader ?? []).reduce((s, r) => s + r.antal * r.a_pris, 0))
  const moms = round2(netto * (MOMS_PROCENT / 100))
  const total = round2(netto + moms)
  const { error: uErr } = await supabase
    .from('ordrar')
    .update({ belopp_netto: netto, belopp_moms: moms, belopp_total: total })
    .eq('id', order_id)
  if (uErr) throw new Error(uErr.message)
}

export function registerOrderHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  ipcMain.handle('db:order:list', async () => {
    const { data, error } = await supabase
      .from('ordrar')
      .select('*, projekt:projekt_id(id, projekt_nummer, namn), fas:fas_id(id, namn), subfas:subfas_id(id, namn)')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:order:list-by-projekt', async (_, projekt_id: string) => {
    const { data, error } = await supabase
      .from('ordrar')
      .select('*')
      .eq('projekt_id', projekt_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:order:get', async (_, id: string) => {
    const { data: order, error } = await supabase
      .from('ordrar')
      .select('*, fas:fas_id(id, namn), subfas:subfas_id(id, namn), projekt:projekt_id(id, projekt_nummer, namn), kund:kund_id(email)')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)

    const { data: rader, error: rErr } = await supabase
      .from('order_rader')
      .select('*')
      .eq('order_id', id)
      .order('sortering', { ascending: true })
      .order('skapad_at', { ascending: true })
    if (rErr) throw new Error(rErr.message)

    return { ...order, rader: rader ?? [] }
  })

  ipcMain.handle('db:order:create', async (_, input: CreateOrderInput) => {
    const { data: projekt, error: pErr } = await supabase
      .from('projekt')
      .select('kund_id, kunder(id, namn, org_nummer, order_std_villkor)')
      .eq('id', input.projekt_id)
      .single()
    if (pErr) throw new Error(pErr.message)
    const kundRaw = projekt.kunder as unknown
    const kund = (Array.isArray(kundRaw) ? kundRaw[0] : kundRaw) as { id: string; namn: string | null; org_nummer: string | null; order_std_villkor: string | null } | null
    if (!kund) throw new Error('Projekt saknar kopplad kund')

    const { data: numData, error: numErr } = await supabase.rpc('nextval_order_nummer')
    if (numErr) throw new Error(numErr.message)
    const order_nummer = `O-${String(numData as number).padStart(4, '0')}`

    // Snapshot villkor at creation time. Cascade: input → kund → global → ''.
    let villkorSnapshot = (input.villkor ?? '').trim()
    if (!villkorSnapshot) {
      const fromKund = (kund.order_std_villkor ?? '').trim()
      if (fromKund) {
        villkorSnapshot = fromKund
      } else {
        const { data: settings } = await supabase
          .from('app_installningar')
          .select('order_std_villkor')
          .limit(1)
          .single()
        villkorSnapshot = (settings?.order_std_villkor ?? '').trim()
      }
    }

    const { data: order, error: oErr } = await supabase
      .from('ordrar')
      .insert({
        order_nummer,
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
          order_id: order.id,
          beskrivning: r.beskrivning,
          antal,
          enhet: r.enhet ?? 'st',
          a_pris,
          belopp: round2(antal * a_pris),
          sortering: r.sortering ?? i,
        }
      })
      const { error: rErr } = await supabase.from('order_rader').insert(radRows)
      if (rErr) throw new Error(rErr.message)
      await recomputeOrderTotals(order.id)
    }

    return order
  })

  ipcMain.handle('db:order:update', async (_, id: string, patch: UpdateOrderInput) => {
    const { data, error } = await supabase
      .from('ordrar')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:order:delete', async (_, id: string) => {
    const { error } = await supabase.from('ordrar').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:order:delete-many', async (_, ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    const { error } = await supabase.from('ordrar').delete().in('id', ids)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:order:sign', async (_, id: string, godkand_av: string, signatur_data: string) => {
    if (!godkand_av.trim()) throw new Error('Godkännarens namn krävs')
    if (!signatur_data) throw new Error('Signatur saknas')
    const { data, error } = await supabase
      .from('ordrar')
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

  ipcMain.handle('db:order:set-status', async (_, id: string, status: string) => {
    if (status === 'Godkänd') {
      throw new Error('Godkänd kan endast sättas via signering')
    }
    if (!['Utkast', 'Skickad', 'Avvisad'].includes(status)) {
      throw new Error(`Ogiltig status: ${status}`)
    }
    const { data: current, error: cErr } = await supabase
      .from('ordrar')
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
      .from('ordrar')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:order-rader:create', async (_, order_id: string, input: CreateOrderRadInput) => {
    const antal = input.antal ?? 1
    const a_pris = input.a_pris ?? 0
    const { data, error } = await supabase
      .from('order_rader')
      .insert({
        order_id,
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
    await recomputeOrderTotals(order_id)
    return data
  })

  ipcMain.handle('db:order-rader:update', async (_, id: string, patch: Partial<CreateOrderRadInput>) => {
    const update: Record<string, unknown> = { ...patch }
    if (patch.antal !== undefined || patch.a_pris !== undefined) {
      const { data: current } = await supabase
        .from('order_rader')
        .select('antal, a_pris, order_id')
        .eq('id', id)
        .single()
      if (!current) throw new Error('Rad finns inte')
      const antal = patch.antal ?? current.antal
      const a_pris = patch.a_pris ?? current.a_pris
      update.belopp = round2(antal * a_pris)
    }
    const { data, error } = await supabase
      .from('order_rader')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    await recomputeOrderTotals(data.order_id)
    return data
  })

  ipcMain.handle('db:order-rader:delete', async (_, id: string) => {
    const { data: current } = await supabase
      .from('order_rader')
      .select('order_id')
      .eq('id', id)
      .single()
    const { error } = await supabase.from('order_rader').delete().eq('id', id)
    if (error) throw new Error(error.message)
    if (current) await recomputeOrderTotals(current.order_id)
  })

  ipcMain.handle('db:order-rader:reorder', async (_, order_id: string, orderedIds: string[]) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from('order_rader').update({ sortering: index }).eq('id', id).eq('order_id', order_id)
      )
    )
  })

  ipcMain.handle('db:order-nummer:peek', async () => {
    const { data, error } = await supabase.rpc('peek_order_nummer')
    if (error) throw new Error(error.message)
    return data as number
  })

  ipcMain.handle('db:order-nummer:set', async (_, value: number) => {
    const n = Math.max(1, Math.floor(value))
    const { error } = await supabase.rpc('setval_order_nummer', { new_value: n })
    if (error) throw new Error(error.message)
    return n
  })
}
