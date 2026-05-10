import { ipcMain } from 'electron'
import { supabase } from '../supabase'

const CHANNELS = [
  'db:ekonomi-utfall:list',
  'db:ekonomi-utfall:list-all',
  'db:ekonomi-utfall:create',
  'db:ekonomi-utfall:update',
  'db:ekonomi-utfall:delete',
  'db:ekonomi-utfall:create-from-fortnox',
  'db:ekonomi-utfall:list-fortnox-givennumbers',
] as const

type Kategori = 'arbete' | 'material' | 'ue' | 'övrigt'

interface CreateUtfallInput {
  projekt_id: string
  kategori: Kategori
  beskrivning: string
  belopp: number
  datum: string
}

interface FortnoxInvoiceInput {
  GivenNumber: number
  SupplierName: string
  InvoiceNumber: string | null
  InvoiceDate: string
  Total: number
  VAT: number
}

interface CreateFromFortnoxInput {
  projekt_id: string
  kategori: Kategori
  invoices: FortnoxInvoiceInput[]
}

interface CreateFromFortnoxResult {
  inserted: number
  skipped: number
}

export function registerEkonomiHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  ipcMain.handle('db:ekonomi-utfall:list', async (_, projekt_id: string) => {
    const { data, error } = await supabase
      .from('ekonomi_utfall')
      .select('*')
      .eq('projekt_id', projekt_id)
      .order('datum', { ascending: false })
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:ekonomi-utfall:list-all', async () => {
    const { data, error } = await supabase
      .from('ekonomi_utfall')
      .select('*')
      .order('datum', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:ekonomi-utfall:create', async (_, input: CreateUtfallInput) => {
    const { data, error } = await supabase
      .from('ekonomi_utfall')
      .insert(input)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:ekonomi-utfall:update', async (_, id: string, input: Partial<Omit<CreateUtfallInput, 'projekt_id'>>) => {
    const { data, error } = await supabase
      .from('ekonomi_utfall')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:ekonomi-utfall:delete', async (_, id: string) => {
    const { error } = await supabase.from('ekonomi_utfall').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:ekonomi-utfall:list-fortnox-givennumbers', async (): Promise<number[]> => {
    const { data, error } = await supabase
      .from('ekonomi_utfall')
      .select('fortnox_givennumber')
      .not('fortnox_givennumber', 'is', null)
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => r.fortnox_givennumber as number)
  })

  ipcMain.handle('db:ekonomi-utfall:create-from-fortnox', async (_, input: CreateFromFortnoxInput): Promise<CreateFromFortnoxResult> => {
    if (!input.invoices.length) return { inserted: 0, skipped: 0 }

    const givenNumbers = input.invoices.map((i) => i.GivenNumber)
    const { data: existing, error: existingErr } = await supabase
      .from('ekonomi_utfall')
      .select('fortnox_givennumber')
      .in('fortnox_givennumber', givenNumbers)
    if (existingErr) throw new Error(existingErr.message)

    const alreadyImported = new Set((existing ?? []).map((r) => r.fortnox_givennumber as number))
    const toInsert = input.invoices
      .filter((inv) => !alreadyImported.has(inv.GivenNumber))
      .map((inv) => ({
        projekt_id: input.projekt_id,
        kategori: input.kategori,
        beskrivning: `${inv.SupplierName}${inv.InvoiceNumber ? ` — ${inv.InvoiceNumber}` : ''}`,
        belopp: Number(((inv.Total ?? 0) - (inv.VAT ?? 0)).toFixed(2)),
        datum: inv.InvoiceDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        fortnox_givennumber: inv.GivenNumber,
      }))

    if (toInsert.length === 0) {
      return { inserted: 0, skipped: input.invoices.length }
    }

    const { error: insertErr } = await supabase.from('ekonomi_utfall').insert(toInsert)
    if (insertErr) throw new Error(insertErr.message)

    return { inserted: toInsert.length, skipped: input.invoices.length - toInsert.length }
  })
}
