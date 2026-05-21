import { ipcMain } from 'electron'
import { supabase } from '../supabase'
import { getEpostInkorgStats } from './epost'

const CHANNELS = [
  'db:workspace:overview',
] as const

interface StatusCount { status: string; count: number }
interface DayBucket { datum: string; count: number }
interface MonthBucket { manad: string; belopp: number }

export interface WorkspaceOverview {
  kunder: { total: number; nya_senaste_vecka: number; sparkline_30d: DayBucket[] }
  projekt: { total: number; per_status: StatusCount[] }
  forslag: { total: number; per_status: StatusCount[] }
  ordrar: { total: number; per_status: StatusCount[]; belopp_aktiva: number }
  ata: { total: number; per_status: StatusCount[]; belopp_utestaende: number }
  signatur: { vantande: number; signerade_30d: number }
  tidplan: { per_dag_denna_vecka: DayBucket[]; idag: number; imorgon: number }
  kostnader: { denna_manad: number; foregaende_manad: number; sparkline_12m: MonthBucket[] }
  epost: {
    olasta: number
    inkorg_status: 'ok' | 'ej_ansluten' | 'fel'
    i_kon: number
    misslyckade: number
  }
  kalender: { idag: number; nasta_handelser: { id: string; titel: string; start: string }[] }
  personal: {
    aktiva: number
    total: number
    tidrapporter_inskickade: number
    ledighet_inskickade: number
    lediga_idag: number
  }
  fakturering: {
    antal_planer: number
    total_planerat: number
    nasta_forfall: { datum: string; belopp: number; beskrivning: string } | null
  }
  ai: {
    leverantorer: { slug: string; namn: string; status: 'ok' | 'no_key' | 'inaktiv' }[]
    assistenter_aktiva: number
    workflows_aktiva: number
    kontext_count: number
    noder_count: number
  }
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay() // 0 = sön
  const diff = (day === 0 ? 6 : day - 1)
  x.setDate(x.getDate() - diff)
  return x
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d)
  const e = new Date(s)
  e.setDate(e.getDate() + 7)
  return e
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function groupBy<T, K extends string>(rows: T[], pick: (r: T) => K): Record<K, number> {
  const acc = {} as Record<K, number>
  for (const r of rows) {
    const k = pick(r)
    acc[k] = (acc[k] ?? 0) + 1
  }
  return acc
}

function toStatusCount(map: Record<string, number>): StatusCount[] {
  return Object.entries(map).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)
}

async function fetchKunder(): Promise<WorkspaceOverview['kunder']> {
  const { data, error } = await supabase.from('kunder').select('id, skapad_at')
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const now = new Date()
  const veckaSedan = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const tjugogoSedan = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const buckets = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    buckets.set(ymd(d), 0)
  }
  let nyaVecka = 0
  for (const r of rows) {
    if (!r.skapad_at) continue
    const d = new Date(r.skapad_at)
    if (d >= veckaSedan) nyaVecka++
    if (d >= tjugogoSedan) {
      const k = ymd(d)
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1)
    }
  }
  return {
    total: rows.length,
    nya_senaste_vecka: nyaVecka,
    sparkline_30d: Array.from(buckets.entries()).map(([datum, count]) => ({ datum, count })),
  }
}

async function fetchProjekt(): Promise<WorkspaceOverview['projekt']> {
  const { data, error } = await supabase.from('projekt').select('status')
  if (error) throw new Error(error.message)
  const rows = data ?? []
  return { total: rows.length, per_status: toStatusCount(groupBy(rows, (r) => (r.status ?? 'okänd') as string)) }
}

async function fetchForslag(): Promise<WorkspaceOverview['forslag']> {
  const { data, error } = await supabase.from('forslag').select('status')
  if (error) throw new Error(error.message)
  const rows = data ?? []
  return { total: rows.length, per_status: toStatusCount(groupBy(rows, (r) => (r.status ?? 'okänd') as string)) }
}

async function fetchOrdrar(): Promise<WorkspaceOverview['ordrar']> {
  const { data, error } = await supabase.from('ordrar').select('status, belopp_total')
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const aktivaSet = new Set(['Skickad', 'Godkänd'])
  const beloppAktiva = rows
    .filter((r) => aktivaSet.has(r.status as string))
    .reduce((s, r) => s + Number(r.belopp_total ?? 0), 0)
  return {
    total: rows.length,
    per_status: toStatusCount(groupBy(rows, (r) => (r.status ?? 'okänd') as string)),
    belopp_aktiva: beloppAktiva,
  }
}

async function fetchAta(): Promise<WorkspaceOverview['ata']> {
  const { data, error } = await supabase.from('ata').select('status, belopp_total')
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const utestaende = rows
    .filter((r) => r.status !== 'Godkänd' && r.status !== 'Avvisad')
    .reduce((s, r) => s + Number(r.belopp_total ?? 0), 0)
  return {
    total: rows.length,
    per_status: toStatusCount(groupBy(rows, (r) => (r.status ?? 'okänd') as string)),
    belopp_utestaende: utestaende,
  }
}

async function fetchSignatur(): Promise<WorkspaceOverview['signatur']> {
  const tjugogoSedan = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [vantande, signerade] = await Promise.all([
    supabase.from('signatur_lankar').select('id', { count: 'exact', head: true })
      .is('signerad_at', null).is('revoked_at', null),
    supabase.from('signatur_lankar').select('id', { count: 'exact', head: true })
      .gte('signerad_at', tjugogoSedan),
  ])
  if (vantande.error) throw new Error(vantande.error.message)
  if (signerade.error) throw new Error(signerade.error.message)
  return { vantande: vantande.count ?? 0, signerade_30d: signerade.count ?? 0 }
}

async function fetchTidplan(): Promise<WorkspaceOverview['tidplan']> {
  const now = new Date()
  const start = startOfWeek(now)
  const end = endOfWeek(now)
  const idag = ymd(now)
  const imorgonD = new Date(now); imorgonD.setDate(imorgonD.getDate() + 1)
  const imorgon = ymd(imorgonD)
  const { data, error } = await supabase
    .from('kalender_events')
    .select('id, start')
    .gte('start', start.toISOString())
    .lt('start', end.toISOString())
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const buckets = new Map<string, number>()
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i)
    buckets.set(ymd(d), 0)
  }
  let countIdag = 0
  let countImorgon = 0
  for (const r of rows) {
    if (!r.start) continue
    const k = ymd(new Date(r.start))
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1)
    if (k === idag) countIdag++
    if (k === imorgon) countImorgon++
  }
  return {
    per_dag_denna_vecka: Array.from(buckets.entries()).map(([datum, count]) => ({ datum, count })),
    idag: countIdag,
    imorgon: countImorgon,
  }
}

async function fetchKostnader(): Promise<WorkspaceOverview['kostnader']> {
  const now = new Date()
  const tolvManaderSedan = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const { data, error } = await supabase
    .from('ekonomi_utfall')
    .select('belopp, datum')
    .gte('datum', ymd(tolvManaderSedan))
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const buckets = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.set(ym(d), 0)
  }
  for (const r of rows) {
    if (!r.datum) continue
    const k = ym(new Date(r.datum))
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + Number(r.belopp ?? 0))
  }
  const arr = Array.from(buckets.entries()).map(([manad, belopp]) => ({ manad, belopp }))
  const dennaManad = arr[arr.length - 1]?.belopp ?? 0
  const foregaende = arr[arr.length - 2]?.belopp ?? 0
  return { denna_manad: dennaManad, foregaende_manad: foregaende, sparkline_12m: arr }
}

async function fetchEpost(): Promise<WorkspaceOverview['epost']> {
  const [konRes, failRes, inkorg] = await Promise.all([
    supabase.from('epost_ko').select('id', { count: 'exact', head: true }).eq('status', 'väntar'),
    supabase.from('epost_ko').select('id', { count: 'exact', head: true }).eq('status', 'misslyckades'),
    getEpostInkorgStats(),
  ])
  return {
    olasta: inkorg.olasta,
    inkorg_status: inkorg.status,
    i_kon: konRes.error ? 0 : (konRes.count ?? 0),
    misslyckade: failRes.error ? 0 : (failRes.count ?? 0),
  }
}

async function fetchKalender(): Promise<WorkspaceOverview['kalender']> {
  const now = new Date()
  const idagStart = new Date(now); idagStart.setHours(0, 0, 0, 0)
  const idagSlut = new Date(idagStart); idagSlut.setDate(idagSlut.getDate() + 1)
  const [idag, nasta] = await Promise.all([
    supabase.from('kalender_events').select('id', { count: 'exact', head: true })
      .gte('start', idagStart.toISOString()).lt('start', idagSlut.toISOString()),
    supabase.from('kalender_events').select('id, titel, start')
      .gte('start', now.toISOString()).order('start', { ascending: true }).limit(3),
  ])
  if (nasta.error) throw new Error(nasta.error.message)
  return {
    idag: idag.count ?? 0,
    nasta_handelser: (nasta.data ?? []) as { id: string; titel: string; start: string }[],
  }
}

async function fetchPersonal(): Promise<WorkspaceOverview['personal']> {
  const idag = new Date().toISOString().slice(0, 10)
  const empty = { aktiva: 0, total: 0, tidrapporter_inskickade: 0, ledighet_inskickade: 0, lediga_idag: 0 }
  const [statusarRes, personalRes, tidrappRes, ledighetInsRes, ledighetIdagRes] = await Promise.all([
    supabase.from('personal_statusar').select('namn, farg'),
    supabase.from('personal').select('status'),
    supabase.from('personal_tidrapport').select('id', { count: 'exact', head: true }).eq('status', 'inskickad'),
    supabase.from('personal_ledighet').select('id', { count: 'exact', head: true }).eq('status', 'inskickad'),
    supabase
      .from('personal_ledighet')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'godkänd')
      .lte('startdatum', idag)
      .gte('slutdatum', idag),
  ])
  if (personalRes.error) return empty

  const aktivNamn = new Set(
    (statusarRes.data ?? [])
      .filter((s) => s.farg === 'emerald')
      .map((s) => ((s.namn as string) ?? '').toLowerCase()),
  )
  if (aktivNamn.size === 0) aktivNamn.add('aktiv')

  const rows = personalRes.data ?? []
  const aktiva = rows.filter((r) => aktivNamn.has(((r.status as string) ?? '').toLowerCase())).length

  return {
    aktiva,
    total: rows.length,
    tidrapporter_inskickade: tidrappRes.count ?? 0,
    ledighet_inskickade: ledighetInsRes.count ?? 0,
    lediga_idag: ledighetIdagRes.count ?? 0,
  }
}

async function fetchAi(): Promise<WorkspaceOverview['ai']> {
  const [providers, assistenter, workflows, kontext] = await Promise.all([
    supabase.from('ai_providers').select('provider_slug, display_name, aktiv, api_key, sortering').order('sortering', { ascending: true }),
    supabase.from('ai_asistenter').select('id', { count: 'exact', head: true }).eq('aktiv', true),
    supabase.from('workflows').select('definition, aktiv').eq('aktiv', true),
    supabase.from('projekt_context').select('id', { count: 'exact', head: true }),
  ])

  const leverantorer = (providers.data ?? []).map((p) => {
    const aktiv = p.aktiv as boolean
    const hasKey = ((p.api_key as string) ?? '').length > 0
    const status: 'ok' | 'no_key' | 'inaktiv' =
      !aktiv ? 'inaktiv' : hasKey ? 'ok' : 'no_key'
    return {
      slug: p.provider_slug as string,
      namn: (p.display_name as string) || (p.provider_slug as string),
      status,
    }
  })

  let noder = 0
  for (const wf of workflows.data ?? []) {
    const def = wf.definition as { nodes?: unknown[] } | null
    if (def && Array.isArray(def.nodes)) noder += def.nodes.length
  }

  return {
    leverantorer,
    assistenter_aktiva: assistenter.error ? 0 : (assistenter.count ?? 0),
    workflows_aktiva: (workflows.data ?? []).length,
    kontext_count: kontext.error ? 0 : (kontext.count ?? 0),
    noder_count: noder,
  }
}

async function fetchFakturering(): Promise<WorkspaceOverview['fakturering']> {
  const empty = { antal_planer: 0, total_planerat: 0, nasta_forfall: null }
  const { data, error } = await supabase
    .from('fakturering_snapshots')
    .select('att_betala_totalt, etapper')
  if (error) return empty
  const rows = data ?? []
  const total_planerat = rows.reduce((sum, r) => sum + Number(r.att_betala_totalt ?? 0), 0)

  const idag = ymd(new Date())
  let nasta: { datum: string; belopp: number; beskrivning: string } | null = null
  for (const r of rows) {
    const etapper = (r.etapper as Array<{ forfall_date?: string; att_betala?: number; beskrivning?: string }> | null) ?? []
    for (const e of etapper) {
      const datum = e.forfall_date
      if (!datum || datum < idag) continue
      if (!nasta || datum < nasta.datum) {
        nasta = {
          datum,
          belopp: Number(e.att_betala ?? 0),
          beskrivning: e.beskrivning ?? '',
        }
      }
    }
  }
  return { antal_planer: rows.length, total_planerat, nasta_forfall: nasta }
}

export function registerWorkspaceHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  ipcMain.handle('db:workspace:overview', async (): Promise<WorkspaceOverview> => {
    const [
      kunder, projekt, forslag, ordrar, ata, signatur,
      tidplan, kostnader, epost, kalender, personal, fakturering, ai,
    ] = await Promise.all([
      fetchKunder(), fetchProjekt(), fetchForslag(), fetchOrdrar(), fetchAta(), fetchSignatur(),
      fetchTidplan(), fetchKostnader(), fetchEpost(), fetchKalender(),
      fetchPersonal(), fetchFakturering(), fetchAi(),
    ])
    return { kunder, projekt, forslag, ordrar, ata, signatur, tidplan, kostnader, epost, kalender, personal, fakturering, ai }
  })
}
