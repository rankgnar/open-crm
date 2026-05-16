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
    .select('avslut_feedback_aktiv, foretag_namn')
    .single()

  if (!installningar?.avslut_feedback_aktiv) return

  const { data: kund } = await supabase
    .from('kunder')
    .select('email, namn, avslut_questions_template')
    .eq('id', kund_id)
    .single()

  if (!kund?.email?.trim()) return

  const base = (readDbConfig().form_app_url ?? '').replace(/\/+$/, '')
  if (!base) return

  const token = randomBytes(32).toString('hex')

  const { data: mall } = await supabase
    .from('epost_mallar')
    .select('amne, kropp_html, alias_id, questions_json')
    .eq('system_kod', 'projekt_avslut_feedback')
    .eq('aktiv', true)
    .limit(1)
    .maybeSingle()

  const questions =
    (kund.avslut_questions_template as typeof AVSLUT_QUESTIONS | null) ??
    (mall?.questions_json as typeof AVSLUT_QUESTIONS | null) ??
    AVSLUT_QUESTIONS

  const { error: insertErr } = await supabase.from('kund_avslutsfeedback').insert({
    kund_id,
    projekt_namn,
    token,
    questions_json: questions,
  })
  if (insertErr) throw new Error(insertErr.message)

  const formulärLänk = `${base}/avslut/${token}`

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

  ipcMain.handle('db:kund-avslut:get-global-template', async () => {
    const { data } = await supabase
      .from('epost_mallar')
      .select('questions_json')
      .eq('system_kod', 'projekt_avslut_feedback')
      .eq('aktiv', true)
      .maybeSingle()
    return (data?.questions_json as typeof AVSLUT_QUESTIONS | null) ?? AVSLUT_QUESTIONS
  })

  ipcMain.handle('db:kund-avslut:get-kund-template', async (_, kund_id: string) => {
    const { data } = await supabase
      .from('kunder')
      .select('avslut_questions_template')
      .eq('id', kund_id)
      .single()
    return (data?.avslut_questions_template as typeof AVSLUT_QUESTIONS | null) ?? null
  })

  ipcMain.handle('db:kund-avslut:save-kund-template', async (_, kund_id: string, questions: typeof AVSLUT_QUESTIONS | null) => {
    const { error } = await supabase
      .from('kunder')
      .update({ avslut_questions_template: questions })
      .eq('id', kund_id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:kund-avslut:send-manual', async (_, kund_id: string, email: string) => {
    if (!email?.trim()) throw new Error('Kunden saknar e-postadress')

    const { data: kund } = await supabase
      .from('kunder')
      .select('namn, avslut_questions_template')
      .eq('id', kund_id)
      .maybeSingle()

    const base = (readDbConfig().form_app_url ?? '').replace(/\/+$/, '')
    if (!base) throw new Error('form_app_url inte konfigurerad')

    const { data: mall } = await supabase
      .from('epost_mallar')
      .select('amne, kropp_html, alias_id, questions_json')
      .eq('system_kod', 'projekt_avslut_feedback')
      .eq('aktiv', true)
      .limit(1)
      .maybeSingle()

    const questions =
      (kund?.avslut_questions_template as typeof AVSLUT_QUESTIONS | null) ??
      (mall?.questions_json as typeof AVSLUT_QUESTIONS | null) ??
      AVSLUT_QUESTIONS

    const token = randomBytes(32).toString('hex')

    const { error: insertErr } = await supabase.from('kund_avslutsfeedback').insert({
      kund_id,
      projekt_namn: '',
      token,
      questions_json: questions,
    })
    if (insertErr) throw new Error(insertErr.message)

    const { data: installningar } = await supabase
      .from('app_installningar')
      .select('foretag_namn')
      .maybeSingle()

    const formulärLänk = `${base}/avslut/${token}`
    const namn = kund?.namn ?? ''
    const vars: Record<string, string> = {
      kund_namn: namn,
      projekt_namn: '',
      'formulär_länk': formulärLänk,
      foretag_namn: installningar?.foretag_namn ?? '',
      datum: new Date().toLocaleDateString('sv-SE'),
    }
    const interpolate = (s: string) =>
      s.replace(/\{\{([\wÄÖÅäöå_]+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`)

    const amne = mall ? interpolate(mall.amne) : 'Hur kan vi bli bättre?'
    const kropp_html = mall
      ? interpolate(mall.kropp_html)
      : `<p>Hej ${namn},</p><p>Klicka <a href="${formulärLänk}">här</a> för att besvara ett kort formulär.</p>`

    const alias = await loadAlias(mall?.alias_id ?? null)
    if (!alias) throw new Error('Ingen aktiv e-postalias konfigurerad')

    await sendEpost({ alias, till: email.trim(), amne, kropp: kropp_html })
  })
}
