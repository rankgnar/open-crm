import { ipcMain, BrowserWindow } from 'electron'
import { randomBytes, createHash } from 'crypto'
import fs from 'node:fs/promises'
import { supabase } from '../supabase'
import { buildSignatureUrl } from '../lib/signaturUrl'

const CHANNELS = [
  'db:signera:list',
  'db:signera:get',
  'db:signera:create',
  'db:signera:archive-to-projekt',
  'db:signera:delete-many',
] as const

interface CreateSigneraInput {
  projekt_id:              string
  titel:                   string
  filnamn:                 string
  mime_type:               string
  filePath:                string
  storlek:                 number
  kund_email:              string
  giltig_dagar:            number
  meddelande?:             string
  mall_id?:                string | null
  skapad_av?:              string
  auto_invite_kund_portal?: boolean
}

function tokenStr(): string {
  return randomBytes(24).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function injectVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

// Convert a non-PDF buffer (image, html-able) to PDF using printToPDF on a
// hidden BrowserWindow. Office docs (Word/Excel) aren't supported — caller
// should reject those at the UI level.
async function convertToPdf(buffer: Buffer, mime: string): Promise<Buffer> {
  if (mime === 'application/pdf') return buffer

  if (mime.startsWith('image/')) {
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;background:#fff}
      .page{display:flex;align-items:center;justify-content:center;width:100vw;height:100vh}
      img{max-width:95vw;max-height:95vh;object-fit:contain}
    </style></head><body><div class="page"><img src="${dataUrl}"/></div></body></html>`
    const win = new BrowserWindow({ show: false, width: 800, height: 1131, webPreferences: { sandbox: false } })
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      })
      return pdf
    } finally {
      win.close()
    }
  }

  throw new Error(`Filtypen "${mime}" stöds ej. Konvertera till PDF först.`)
}

async function pickEmailMall(mall_id: string | null | undefined): Promise<{
  amne: string; kropp_html: string; alias_id: string | null
} | null> {
  if (mall_id) {
    const { data } = await supabase
      .from('epost_mallar')
      .select('amne, kropp_html, alias_id')
      .eq('id', mall_id).maybeSingle()
    if (data) return data as { amne: string; kropp_html: string; alias_id: string | null }
  }
  const { data } = await supabase
    .from('epost_mallar')
    .select('amne, kropp_html, alias_id')
    .eq('system_kod', 'signatur_begaran_dokument')
    .eq('aktiv', true)
    .maybeSingle()
  return (data as { amne: string; kropp_html: string; alias_id: string | null } | null) ?? null
}

function buildMeddelandeBlock(meddelande: string | null | undefined): string {
  const m = meddelande?.trim()
  if (!m) return ''
  return `<div style="margin:20px 0;padding:14px 16px;background:#f5f5f5;border-left:3px solid #5363f2;border-radius:4px;font-size:14px;color:#444;line-height:1.5"><strong style="display:block;margin:0 0 6px;color:#1a1a1a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Meddelande från avsändaren</strong>${m.replace(/\n/g, '<br>')}</div>`
}

function buildDokumentTitelBlock(titel: string | null | undefined): string {
  const t = titel?.trim()
  if (!t) return ''
  return ` <span style="color:#666;font-weight:400">— ${t}</span>`
}

async function aliasSignaturOrEmpty(alias_id: string | null): Promise<string> {
  if (!alias_id) return ''
  const { data } = await supabase.from('epost_alias').select('signatur_html').eq('id', alias_id).maybeSingle()
  return (data as { signatur_html: string | null } | null)?.signatur_html ?? ''
}

export function registerSigneraHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  // ── List all 'fritt' requests with joined projekt + dokument info ─────────
  ipcMain.handle('db:signera:list', async () => {
    const { data: lankar, error } = await supabase
      .from('signatur_lankar')
      .select('*')
      .eq('dokument_typ', 'fritt')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    if (!lankar || lankar.length === 0) return []

    const docIds = Array.from(new Set(lankar.map((l) => l.dokument_id)))
    const { data: docs } = await supabase
      .from('signatur_fritta_dokument')
      .select('*, projekt:projekt_id (id, namn, projekt_nummer, kunder:kund_id (id, namn))')
      .in('id', docIds)

    const docMap = new Map<string, unknown>()
    for (const d of (docs ?? [])) docMap.set((d as { id: string }).id, d)

    return lankar.map((l) => {
      const d = docMap.get(l.dokument_id) as {
        id: string; projekt_id: string; titel: string; filnamn: string;
        mime_type: string; storlek: number; storage_path: string;
        arkiverad_dokument_id: string | null; arkiverad_at: string | null;
        skapad_at: string;
        projekt: { id: string; namn: string; projekt_nummer: string; kunder: { id: string; namn: string } | null } | null
      } | undefined
      return {
        lank: l,
        dokument: d ? {
          id: d.id, projekt_id: d.projekt_id, titel: d.titel,
          filnamn: d.filnamn, mime_type: d.mime_type, storlek: d.storlek,
          storage_path: d.storage_path,
          arkiverad_dokument_id: d.arkiverad_dokument_id,
          arkiverad_at: d.arkiverad_at,
          skapad_at: d.skapad_at,
        } : null,
        projekt: d?.projekt ? {
          id: d.projekt.id, namn: d.projekt.namn, projekt_nummer: d.projekt.projekt_nummer,
        } : null,
        kund: d?.projekt?.kunder ?? null,
      }
    })
  })

  // ── Detail of a single request by lank id ─────────────────────────────────
  ipcMain.handle('db:signera:get', async (_, lank_id: string) => {
    const { data: lank, error } = await supabase
      .from('signatur_lankar').select('*').eq('id', lank_id).single()
    if (error || !lank) throw new Error(error?.message ?? 'Länken finns ej')
    const { data: dok } = await supabase
      .from('signatur_fritta_dokument')
      .select('*, projekt:projekt_id (id, namn, projekt_nummer, kunder:kund_id (id, namn))')
      .eq('id', lank.dokument_id).maybeSingle()
    return { lank, dokument: dok }
  })

  // ── Create: upload file → insert dokument row → insert lank → queue email ─
  ipcMain.handle('db:signera:create', async (_, input: CreateSigneraInput) => {
    if (!input.projekt_id) throw new Error('Projekt krävs')
    if (!input.titel.trim()) throw new Error('Titel krävs')
    if (!input.kund_email?.includes('@')) throw new Error('Giltig kund-email krävs')
    if (!input.filePath) throw new Error('Fil saknas')

    // Read file + convert to PDF if needed
    const raw = await fs.readFile(input.filePath)
    const pdfBuffer = await convertToPdf(raw, input.mime_type)

    const token = tokenStr()

    // Upload converted PDF to signing-pdfs/{token}/document.pdf so the portal
    // can render it directly.
    const pdfPath = `${token}/document.pdf`
    const { error: upErr } = await supabase.storage
      .from('signing-pdfs')
      .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
    if (upErr) throw new Error(`Storage-uppladdning misslyckades: ${upErr.message}`)
    const { data: { publicUrl } } = supabase.storage.from('signing-pdfs').getPublicUrl(pdfPath)

    // Resolve kund_id from projekt
    const { data: proj, error: projErr } = await supabase
      .from('projekt')
      .select('id, namn, kund_id, kunder:kund_id (id, namn)')
      .eq('id', input.projekt_id).single()
    if (projErr || !proj) throw new Error(projErr?.message ?? 'Projektet hittades inte')
    const projTyped = proj as unknown as {
      id: string; namn: string; kund_id: string;
      kunder: { id: string; namn: string } | null
    }

    // Insert dokument row (storage_path points at the signing-pdfs path so
    // we can re-read the original later if needed)
    const { data: dok, error: dokErr } = await supabase
      .from('signatur_fritta_dokument')
      .insert({
        projekt_id:   input.projekt_id,
        titel:        input.titel.trim(),
        filnamn:      input.filnamn,
        mime_type:    input.mime_type,
        storlek:      input.storlek,
        storage_path: pdfPath,
      })
      .select('*').single()
    if (dokErr || !dok) throw new Error(dokErr?.message ?? 'Kunde inte spara dokumentet')

    // Insert lank
    const hash = createHash('sha256').update(JSON.stringify({
      typ: 'fritt', titel: input.titel, projekt: projTyped.namn, kund: projTyped.kunder?.namn ?? '',
    })).digest('hex')
    const expiry = input.giltig_dagar > 0
      ? new Date(Date.now() + input.giltig_dagar * 86400_000)
      : new Date('2099-12-31T23:59:59Z')

    const { data: lank, error: lankErr } = await supabase
      .from('signatur_lankar')
      .insert({
        token,
        dokument_typ:            'fritt',
        dokument_id:             (dok as { id: string }).id,
        kund_id:                 projTyped.kunder?.id ?? null,
        kund_email:              input.kund_email.trim(),
        dokument_hash:           hash,
        meddelande:              input.meddelande?.trim() || null,
        skapad_av:               input.skapad_av || null,
        gar_ut_at:               expiry.toISOString(),
        document_pdf_url:        publicUrl,
        auto_invite_kund_portal: input.auto_invite_kund_portal ?? false,
      })
      .select('*').single()
    if (lankErr) {
      await supabase.from('signatur_fritta_dokument').delete().eq('id', (dok as { id: string }).id)
      await supabase.storage.from('signing-pdfs').remove([pdfPath])
      throw new Error(lankErr.message)
    }

    // Queue the email (uses system_kod='signatur_begaran_dokument')
    const mall = await pickEmailMall(input.mall_id ?? null)
    if (!mall) {
      throw new Error("Ingen e-postmall hittades med system_kod='signatur_begaran_dokument'. Kontrollera Inställningar → E-post mallar.")
    }
    const aliasSig = await aliasSignaturOrEmpty(mall.alias_id)
    const vars: Record<string, string> = {
      kund_namn:               projTyped.kunder?.namn ?? '',
      projekt_namn:            projTyped.namn,
      forslag_nummer:          '',
      order_nummer:            '',
      ata_nummer:              '',
      dokument_titel:          input.titel.trim(),
      dokument_titel_block:    buildDokumentTitelBlock(input.titel),
      signatur_lank:           buildSignatureUrl(token),
      signatur_giltigt_till:   expiry.toISOString().slice(0, 10),
      meddelande:              input.meddelande ?? '',
      meddelande_block:        buildMeddelandeBlock(input.meddelande),
      alias_signatur:          aliasSig,
    }
    await supabase.from('epost_ko').insert({
      alias_id:        mall.alias_id,
      till:            input.kund_email.trim(),
      amne:            injectVars(mall.amne, vars),
      kropp_html:      injectVars(mall.kropp_html, vars),
      kund_id:         projTyped.kunder?.id ?? null,
      projekt_id:      input.projekt_id,
      forslag_id:      null,
      schemalagd_till: new Date().toISOString(),
      status:          'väntar',
    })

    return { lank, dokument: dok }
  })

  // ── Archive a signed request into the project's DocumentPanel ─────────────
  // Downloads signed_pdf_url, uploads to projekt-dokument bucket, inserts a
  // projekt_dokument row, updates signatur_fritta_dokument.arkiverad_*.
  ipcMain.handle('db:signera:archive-to-projekt', async (_, lank_id: string) => {
    const { data: lank, error: lankErr } = await supabase
      .from('signatur_lankar').select('*').eq('id', lank_id).single()
    if (lankErr || !lank) throw new Error(lankErr?.message ?? 'Länken finns ej')
    if (lank.dokument_typ !== 'fritt') throw new Error('Endast fritta dokument kan arkiveras härifrån')
    if (!lank.signerad_at) throw new Error('Dokumentet är inte signerat ännu')

    const { data: dok, error: dokErr } = await supabase
      .from('signatur_fritta_dokument').select('*').eq('id', lank.dokument_id).single()
    if (dokErr || !dok) throw new Error(dokErr?.message ?? 'Dokumentet hittades inte')
    if (dok.arkiverad_dokument_id) {
      // Idempotent: already archived
      return { already_archived: true, projekt_dokument_id: dok.arkiverad_dokument_id }
    }

    const sourceUrl = lank.signed_pdf_url || lank.document_pdf_url
    if (!sourceUrl) throw new Error('Ingen PDF att arkivera (saknar signed_pdf_url)')

    const res = await fetch(sourceUrl)
    if (!res.ok) throw new Error(`Kunde inte ladda ner PDF: HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())

    const safeBase = dok.titel.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    const archiveName = `[Signerat] ${dok.titel}.pdf`
    const storagePath = `${dok.projekt_id}/${Date.now()}_signerat_${safeBase}.pdf`

    const { error: upErr } = await supabase.storage
      .from('projekt-dokument')
      .upload(storagePath, buf, { contentType: 'application/pdf', upsert: false })
    if (upErr) throw new Error(`Uppladdning misslyckades: ${upErr.message}`)

    const { data: pd, error: pdErr } = await supabase
      .from('projekt_dokument')
      .insert({
        projekt_id: dok.projekt_id,
        filnamn: archiveName,
        mime_type: 'application/pdf',
        storlek: buf.length,
        storage_path: storagePath,
      })
      .select('*').single()
    if (pdErr) {
      await supabase.storage.from('projekt-dokument').remove([storagePath])
      throw new Error(pdErr.message)
    }

    await supabase
      .from('signatur_fritta_dokument')
      .update({
        arkiverad_dokument_id: (pd as { id: string }).id,
        arkiverad_at:          new Date().toISOString(),
      })
      .eq('id', dok.id)

    return { already_archived: false, projekt_dokument_id: (pd as { id: string }).id }
  })

  // ── Bulk delete: removes lankar + their fritta dokument + storage files ───
  ipcMain.handle('db:signera:delete-many', async (_, lank_ids: string[]) => {
    if (!Array.isArray(lank_ids) || lank_ids.length === 0) return

    const { data: lankar, error: lErr } = await supabase
      .from('signatur_lankar')
      .select('id, token, dokument_id, dokument_typ')
      .in('id', lank_ids)
    if (lErr) throw new Error(lErr.message)
    if (!lankar || lankar.length === 0) return

    const fritta = (lankar as { id: string; token: string; dokument_id: string; dokument_typ: string }[])
      .filter((l) => l.dokument_typ === 'fritt')
    if (fritta.length === 0) return

    const fritIds = fritta.map((l) => l.id)
    const tokens  = fritta.map((l) => l.token).filter(Boolean)
    const dokIds  = Array.from(new Set(fritta.map((l) => l.dokument_id)))

    const { error: dlErr } = await supabase.from('signatur_lankar').delete().in('id', fritIds)
    if (dlErr) throw new Error(dlErr.message)

    if (dokIds.length > 0) {
      const { data: remaining } = await supabase
        .from('signatur_lankar').select('dokument_id').in('dokument_id', dokIds)
      const stillRef = new Set(((remaining ?? []) as { dokument_id: string }[]).map((r) => r.dokument_id))
      const toDelete = dokIds.filter((d) => !stillRef.has(d))
      if (toDelete.length > 0) {
        await supabase.from('signatur_fritta_dokument').delete().in('id', toDelete)
      }
    }

    for (const token of tokens) {
      try {
        const { data: files } = await supabase.storage.from('signing-pdfs').list(token)
        if (files && files.length > 0) {
          await supabase.storage.from('signing-pdfs')
            .remove(files.map((f) => `${token}/${f.name}`))
        }
      } catch { /* best effort */ }
    }
  })
}
