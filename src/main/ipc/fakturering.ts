import { ipcMain } from 'electron'
import { supabase } from '../supabase'
import { broadcastChange } from '../broadcast'

const CHANNELS = [
  'db:fakturering:list',
  'db:fakturering:list-by-projekt',
  'db:fakturering:get',
  'db:fakturering:generate',
  'db:fakturering:delete',
] as const

interface EtappInput {
  pct: number
  beskrivning: string
  forfall_date?: string
}

interface SnapshotEtapp {
  pct: number
  beskrivning: string
  forfall_date?: string | null
  netto: number
  rot: number
  moms: number
  att_betala: number
}

export function registerFaktureringHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  ipcMain.handle('db:fakturering:list', async () => {
    const { data, error } = await supabase
      .from('fakturering_snapshots')
      .select('*')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:fakturering:list-by-projekt', async (_, projekt_id: string) => {
    const { data, error } = await supabase
      .from('fakturering_snapshots')
      .select('*')
      .eq('projekt_id', projekt_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:fakturering:get', async (_, id: string) => {
    const { data, error } = await supabase
      .from('fakturering_snapshots')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:fakturering:delete', async (_, id: string) => {
    const { error } = await supabase.from('fakturering_snapshots').delete().eq('id', id)
    if (error) throw new Error(error.message)
    broadcastChange('fakturering')
  })

  ipcMain.handle('db:fakturering:generate', async (_, forslag_id: string, etapper: EtappInput[]) => {
    const { data: forslag, error: fErr } = await supabase.from('forslag').select('*').eq('id', forslag_id).single()
    if (fErr) throw new Error(fErr.message)

    const { data: projekt, error: pErr } = await supabase
      .from('projekt')
      .select('*')
      .eq('id', forslag.projekt_id)
      .single()
    if (pErr) throw new Error(pErr.message)

    const { data: faser } = await supabase.from('forslag_faser').select('id').eq('forslag_id', forslag_id)
    const fasIds = (faser ?? []).map((f: { id: string }) => f.id)
    const subfasIds: string[] = []
    if (fasIds.length) {
      const { data: subfaser } = await supabase.from('forslag_subfaser').select('id').in('fas_id', fasIds)
      subfasIds.push(...(subfaser ?? []).map((s: { id: string }) => s.id))
    }

    const [{ data: arbete }, { data: material }, { data: ue }] = await Promise.all([
      subfasIds.length ? supabase.from('forslag_arbetskostnad').select('antal_timmar,timpris,rot_berattigad').in('subfas_id', subfasIds) : Promise.resolve({ data: [] }),
      subfasIds.length ? supabase.from('forslag_materialkostnad').select('antal,a_pris').in('subfas_id', subfasIds) : Promise.resolve({ data: [] }),
      subfasIds.length ? supabase.from('forslag_underentreprenorer').select('kostnad').in('subfas_id', subfasIds) : Promise.resolve({ data: [] }),
    ])

    const totalArbete = (arbete ?? []).reduce((s: number, r: { antal_timmar: number; timpris: number }) => s + r.antal_timmar * r.timpris, 0)
    const rotEligible = projekt.rot_avdrag
      ? (arbete ?? []).reduce((s: number, r: { antal_timmar: number; timpris: number; rot_berattigad: boolean }) => s + (r.rot_berattigad ? r.antal_timmar * r.timpris : 0), 0)
      : 0
    const totalMaterial = (material ?? []).reduce((s: number, r: { antal: number; a_pris: number }) => s + r.antal * r.a_pris, 0)
    const totalUE = (ue ?? []).reduce((s: number, r: { kostnad: number }) => s + r.kostnad, 0)
    const totalNetto = totalArbete + totalMaterial + totalUE
    const moms = forslag.moms_procent ?? 25

    const snapshotEtapper: SnapshotEtapp[] = etapper.map((etapp) => {
      const pct = etapp.pct / 100
      const etappNetto = Math.round(totalNetto * pct * 100) / 100
      // ROT = 30% of eligible labour inkl moms (Skatteverket convention), capped at 50 000 per etapp
      const etappRot = Math.round(Math.min(rotEligible * pct * 1.25 * 0.30, 50000) * 100) / 100
      const etappMoms = Math.round(etappNetto * (moms / 100) * 100) / 100
      const etappAtt = Math.round((etappNetto + etappMoms - etappRot) * 100) / 100
      return {
        pct: etapp.pct,
        beskrivning: etapp.beskrivning,
        forfall_date: etapp.forfall_date ?? null,
        netto: etappNetto,
        rot: etappRot,
        moms: etappMoms,
        att_betala: etappAtt,
      }
    })

    const rotAvdragTotalt = Math.round(snapshotEtapper.reduce((s, e) => s + e.rot, 0) * 100) / 100
    const momsTotalt = Math.round(totalNetto * (moms / 100) * 100) / 100
    const attBetalaTotalt = Math.round((totalNetto + momsTotalt - rotAvdragTotalt) * 100) / 100

    const { data: snapshot, error: sErr } = await supabase
      .from('fakturering_snapshots')
      .upsert({
        projekt_id: forslag.projekt_id,
        forslag_id,
        forslag_nummer: forslag.forslag_nummer,
        forslag_titel: forslag.titel,
        total_arbete: Math.round(totalArbete * 100) / 100,
        total_material: Math.round(totalMaterial * 100) / 100,
        total_ue: Math.round(totalUE * 100) / 100,
        total_netto: Math.round(totalNetto * 100) / 100,
        rot_eligible: Math.round(rotEligible * 100) / 100,
        rot_avdrag: rotAvdragTotalt,
        moms_totalt: momsTotalt,
        att_betala_totalt: attBetalaTotalt,
        etapper: snapshotEtapper,
        skapad_at: new Date().toISOString(),
      }, { onConflict: 'forslag_id' })
      .select('*')
      .single()
    if (sErr) throw new Error(sErr.message)

    broadcastChange('fakturering')
    return snapshot
  })
}
