import { ipcMain } from 'electron'
import { supabase } from '../supabase'
import { executeChatWithAssistent } from './ai-chat-fn'
import { readDbConfig } from '../config-store'
import type { FragaFalt, Frageblankett } from '../../renderer/src/sections/projekt/types'

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

export function registerFrageblanktterHandlers(): void {
  ipcMain.handle('db:frageblankett:generate-from-text', async (_, txt: string) => {
    const { data: assistent, error: aErr } = await supabase
      .from('ai_asistenter')
      .select('id')
      .contains('uppgifter', ['frageblankett'])
      .eq('aktiv', true)
      .limit(1)
      .single()
    if (aErr || !assistent) throw new Error('Ingen Formulärgenerator-assistent konfigurerad. Gå till Inställningar → AI och skapa en med uppgiften "Formulärgenerator".')
    const raw = await executeChatWithAssistent(assistent.id, [
      { role: 'user', content: txt.trim() }
    ])
    const cleaned = stripJsonFences(raw)
    const parsed = JSON.parse(cleaned) as FragaFalt[]
    if (!Array.isArray(parsed)) throw new Error('AI returned unexpected format')
    return parsed
  })

  ipcMain.handle('db:frageblankett:create', async (_, { projekt_id, titel, questions_json }: { projekt_id: string; titel: string; questions_json: FragaFalt[] }) => {
    const { data, error } = await supabase
      .from('projekt_frageblankett')
      .insert({ projekt_id, titel, questions_json })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as Frageblankett
  })

  ipcMain.handle('db:frageblankett:list-by-projekt', async (_, projekt_id: string) => {
    const { data, error } = await supabase
      .from('projekt_frageblankett')
      .select('*')
      .eq('projekt_id', projekt_id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data as Frageblankett[]
  })

  ipcMain.handle('db:frageblankett:get', async (_, id: string) => {
    const { data, error } = await supabase
      .from('projekt_frageblankett')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data as Frageblankett
  })

  ipcMain.handle('db:frageblankett:delete', async (_, id: string) => {
    const { error } = await supabase.from('projekt_frageblankett').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })

  ipcMain.handle('db:frageblankett:get-link', async (_, id: string) => {
    const { data, error } = await supabase
      .from('projekt_frageblankett')
      .select('token')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    const base = (readDbConfig().form_app_url ?? '').replace(/\/+$/, '')
    if (!base) throw new Error('Form-appens URL är inte konfigurerad. Sätt den i Inställningar → Databas → Form-app URL.')
    return `${base}/f/${data.token}`
  })

  ipcMain.handle('db:frageblankett:get-epost-draft', async (_, blankett_id: string) => {
    const { data: blankett, error: bErr } = await supabase
      .from('projekt_frageblankett')
      .select('token, titel, projekt_id')
      .eq('id', blankett_id)
      .single()
    if (bErr || !blankett) throw new Error('Formulär hittades inte.')

    const { data: projekt, error: pErr } = await supabase
      .from('projekt')
      .select('namn, kund_id')
      .eq('id', blankett.projekt_id)
      .single()
    if (pErr || !projekt) throw new Error('Projekt hittades inte.')

    const { data: kund, error: kErr } = await supabase
      .from('kunder')
      .select('namn, email')
      .eq('id', projekt.kund_id)
      .single()
    if (kErr || !kund) throw new Error('Kund hittades inte.')
    if (!kund.email) throw new Error('Kunden har ingen e-postadress registrerad.')

    const { data: installningar } = await supabase
      .from('app_installningar')
      .select('foretag_namn')
      .limit(1)
      .maybeSingle()

    const base = (readDbConfig().form_app_url ?? '').replace(/\/+$/, '')
    if (!base) throw new Error('Form-appens URL är inte konfigurerad.')
    const formulärLänk = `${base}/f/${blankett.token}`

    const { data: mall } = await supabase
      .from('epost_mallar')
      .select('amne, kropp_html, alias_id')
      .eq('system_kod', 'frageblankett_link')
      .eq('aktiv', true)
      .limit(1)
      .maybeSingle()

    const vars: Record<string, string> = {
      kund_namn: kund.namn ?? '',
      projekt_namn: projekt.namn ?? '',
      'formulär_länk': formulärLänk,
      foretag_namn: installningar?.foretag_namn ?? '',
      datum: new Date().toLocaleDateString('sv-SE'),
    }
    const interpolate = (s: string) =>
      s.replace(/\{\{([\wÄÖÅäöå_]+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`)

    return {
      till: kund.email,
      amne: mall ? interpolate(mall.amne) : `Frågeformulär — ${projekt.namn}`,
      kropp_html: mall
        ? interpolate(mall.kropp_html)
        : `<p>Hej ${kund.namn},</p><p><a href="${formulärLänk}">${formulärLänk}</a></p>`,
      alias_id: mall?.alias_id ?? null,
      kund_namn: kund.namn ?? '',
      projekt_id: blankett.projekt_id,
      kund_id: projekt.kund_id,
    }
  })

  ipcMain.handle('db:frageblankett:save-as-dokument', async (_, id: string) => {
    const { data: blankett, error: bErr } = await supabase
      .from('projekt_frageblankett')
      .select('*')
      .eq('id', id)
      .single()
    if (bErr) throw new Error(bErr.message)
    if (blankett.status !== 'besvarat') throw new Error('Formuläret är inte besvarat ännu.')

    const questions = blankett.questions_json as FragaFalt[]
    const answers = (blankett.answers_json ?? {}) as Record<string, string>
    const lines: string[] = [
      `# Kundsvar — ${blankett.titel}`,
      `Besvarat: ${new Date(blankett.besvarat_at).toLocaleString('sv-SE')}`,
      '',
    ]
    for (const q of questions) {
      lines.push(`## ${q.label}`)
      lines.push(answers[q.id] ?? '—')
      lines.push('')
    }
    const content = lines.join('\n')
    const buffer = Buffer.from(content, 'utf-8')

    const ts = Date.now()
    const storagePath = `${blankett.projekt_id}/questions/${ts}_svar.md`
    const { error: storageErr } = await supabase.storage
      .from('projekt-dokument')
      .upload(storagePath, buffer, { contentType: 'text/markdown', upsert: true })
    if (storageErr) throw new Error(storageErr.message)

    const { data: dok, error: dbErr } = await supabase
      .from('projekt_dokument')
      .insert({
        projekt_id: blankett.projekt_id,
        filnamn: `${blankett.titel}_svar.md`,
        mime_type: 'text/markdown',
        storlek: buffer.byteLength,
        storage_path: storagePath,
        kategori: 'dokument',
        carpeta: 'questions',
        synlig_for_kund: false,
      })
      .select('*')
      .single()
    if (dbErr) throw new Error(dbErr.message)
    return dok
  })
}
