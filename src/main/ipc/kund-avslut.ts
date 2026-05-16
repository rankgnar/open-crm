import { ipcMain } from 'electron'
import { randomBytes } from 'crypto'
import { supabase } from '../supabase'
import { readDbConfig } from '../config-store'
import { sendEpost, loadAlias } from './epost'

const AVSLUT_QUESTIONS = [
  {
    id: 'q1',
    label: 'Vad påverkade ert beslut mest?',
    type: 'select' as const,
    required: true,
    options: ['Priset passade inte oss', 'Vi valde en annan leverantör', 'Projektet är pausat tillfälligt', 'Vi fick ett bättre erbjudande', 'Annat'],
  },
  {
    id: 'q2',
    label: 'Hur upplevde ni kontakten med oss?',
    type: 'select' as const,
    required: false,
    options: ['Mycket bra', 'Bra', 'Det gick bra', 'Kunde vara bättre'],
  },
  {
    id: 'q3',
    label: 'Får vi hålla kontakt och skicka er erbjudanden i framtiden?',
    type: 'boolean' as const,
    required: true,
    options: null,
  },
]

export async function triggerAvslutFeedback(kund_id: string, projekt_namn: string): Promise<void> {
  const { data: installningar } = await supabase
    .from('app_installningar')
    .select('avslut_feedback_aktiv, foretag_namn, avslut_questions_template')
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

  const questions = (installningar.avslut_questions_template as typeof AVSLUT_QUESTIONS | null) ?? AVSLUT_QUESTIONS

  const { error: insertErr } = await supabase.from('kund_avslutsfeedback').insert({
    kund_id,
    projekt_namn,
    token,
    questions_json: questions,
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

  const amne = mall ? interpolate(mall.amne) : `Hur kan vi bli bättre? – ${projekt_namn}`
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

  ipcMain.handle('db:kund-avslut:delete', async (_, id: string) => {
    const { error } = await supabase.from('kund_avslutsfeedback').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:kund-avslut:get-questions-template', async () => {
    const { data } = await supabase
      .from('app_installningar')
      .select('avslut_questions_template')
      .single()
    return (data?.avslut_questions_template as typeof AVSLUT_QUESTIONS | null) ?? AVSLUT_QUESTIONS
  })

  ipcMain.handle('db:kund-avslut:save-questions-template', async (_, questions: typeof AVSLUT_QUESTIONS) => {
    const { data: existing } = await supabase.from('app_installningar').select('id').limit(1).single()
    if (!existing) throw new Error('No settings row found')
    const { error } = await supabase
      .from('app_installningar')
      .update({ avslut_questions_template: questions })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
  })
}
