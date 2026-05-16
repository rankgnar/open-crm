import { ipcMain } from 'electron'
import { supabase } from '../supabase'

interface BankTransaktionInput {
  datum: string
  beskrivning: string
  belopp: number
  saldo?: number | null
  referens?: string | null
}

export function registerKassaflodeHandlers(): void {
  ipcMain.handle('db:bank-transaktioner:import-csv', async (_, rows: BankTransaktionInput[]) => {
    if (!rows.length) return 0
    const { error } = await supabase
      .from('bank_transaktioner')
      .upsert(rows, { onConflict: 'datum,beskrivning,belopp', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
    return rows.length
  })

  ipcMain.handle('db:bank-transaktioner:list', async (_, params?: { from?: string; to?: string }) => {
    let q = supabase
      .from('bank_transaktioner')
      .select('*')
      .order('datum', { ascending: false })
    if (params?.from) q = q.gte('datum', params.from)
    if (params?.to) q = q.lte('datum', params.to)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data ?? []
  })

  ipcMain.handle('db:bank-transaktioner:delete', async (_, id: string) => {
    const { error } = await supabase.from('bank_transaktioner').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })
}
