import { ipcMain } from 'electron'
import { randomBytes } from 'crypto'
import { supabase } from '../supabase'
import { readDbConfig } from '../config-store'
import { sendEpost, loadAlias } from './epost'

const AVSLUT_QUESTIONS = [
  {
    id: 'q1',
    label: 'Varför valde ni inte att gå vidare med oss?',
    type: 'select' as const,
    required: true,
    options: ['Priset var för högt', 'Valde en annan leverantör', 'Projektet är pausat', 'Annan anledning'],
  },
  {
    id: 'q2',
    label: 'Vad var den viktigaste faktorn i ert beslut?',
    type: 'textarea' as const,
    required: false,
    options: null,
  },
  {
    id: 'q3',
    label: 'Skulle ni kunna tänka er att anlita oss i framtiden?',
    type: 'boolean' as const,
    required: true,
    options: null,
  },
  {
    id: 'q4',
    label: 'Har ni något övrigt att dela med er?',
    type: 'textarea' as const,
    required: false,
    options: null,
  },
]

export async function triggerAvslutFeedback(kund_id: string, projekt_namn: string): Promise<void> {
  const { data: installningar } = await supabase
    .from('app_installningar')
    .select('avslut_feedback_aktiv, foretag_namn')
    .single()

  if (!installningar?.avslut_feedback_aktiv) return

  const { data: kund } = await supabase
    .from('kunder')
    .select('email, namn')
    .eq('id', kund_id)
    .single()

  if (!kund?.email?.trim()) return

  const base = (readDbConfig().form_app_url ?? '').replace(/\/+$/, '')
  if (!base) return

  const token = randomBytes(32).toString('hex')

  const { error: insertErr } = await supabase.from('kund_avslutsfeedback').insert({
    kund_id,
    projekt_namn,
    token,
    questions_json: AVSLUT_QUESTIONS,
  })
  if (insertErr) throw new Error(insertErr.message)

  const formulärLänk = `${base}/avslut/${token}`

  const { data: mall } = await supabase
    .from('epost_mallar')
    .select('amne, kropp_html, alias_id')
    .eq('system_kod', 'projekt_avslut_feedback')
    .eq('aktiv', true)
    .limit(1)
    .maybeSingle()

  const vars: Record<string, string> = {
    kund_namn: kund.namn ?? '',
    projekt_namn,
    'formulär_länk': formulärLänk,
    foretag_namn: installningar.foretag_namn ?? '',
    datum: new Date().toLocaleDateString('sv-SE'),
  }
  const interpolate = (s: string) =>
    s.replace(/\{\{([\wÄÖÅäöå_]+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`)

  const amne = mall ? interpolate(mall.amne) : `Vi beklagar att vi inte fick möjligheten – ${projekt_namn}`
  const kropp_html = mall
    ? interpolate(mall.kropp_html)
    : `<p>Hej ${kund.namn},</p><p>Klicka <a href="${formulärLänk}">här</a> för att besvara ett kort formulär.</p>`
  const alias_id = mall?.alias_id ?? null

  const alias = await loadAlias(alias_id)
  if (!alias) return

  await sendEpost({ alias, till: kund.email, amne, kropp: kropp_html })
}

export function registerKundAvslutHandlers(): void {
  ipcMain.handle('db:kund-avslut:list-by-kund', async (_, kund_id: string) => {
    const { data, error } = await supabase
      .from('kund_avslutsfeedback')
      .select('*')
      .eq('kund_id', kund_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })
}
