import { ipcMain, BrowserWindow } from 'electron'
import { randomBytes } from 'crypto'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { supabase } from '../supabase'
import { buildSignatureUrl } from '../lib/signaturUrl'
import { zohoUploadAttachment } from './epost'
import type { EpostBilagaRef } from './epost'

const CHANNELS = [
  'db:signatur-lank:create',
  'db:signatur-lank:list-for-doc',
  'db:signatur-lank:revoke',
  'db:signatur-lank:delete',
  'db:signatur-lank:resend',
  'db:signatur-lank:get-default-mall',
  'db:signatur-lank:render-document-pdf',
  'db:signatur-lank:render-final-document-pdf',
  'db:signatur-lank:clear-change-request',
  'db:signatur-lank:forslag-events',
] as const

export type DokumentTyp = 'forslag' | 'order' | 'fritt' | 'ata'

interface PdfOpts {
  sammanfattad?:  boolean
  splitPdf?:      boolean
  bifogaTidplan?: boolean
}

interface CreateInput {
  dokument_typ:    DokumentTyp
  dokument_id:     string
  kund_email:      string
  giltig_dagar:    number          // 0 = no expiry → far-future date
  meddelande?:     string
  mall_id?:        string | null   // optional: choose epost_mallar row
  skapad_av?:      string
  // Optional file attachments to bundle with the signing email. Each entry
  // is a base64-encoded PDF (or other binary) generated client-side. The
  // handler uploads them to Zoho and stores the resulting refs on the
  // queued email row so the queue worker sends them as real attachments.
  bilagor?:        { filnamn: string; data_base64: string }[]
  pdf_opts?:       PdfOpts
}

interface ResendOpts {
  mall_id?:    string | null
  revised?:    boolean
  reminder?:   boolean
  meddelande?: string
  pdf_opts?:   PdfOpts
}

function tokenStr(): string {
  // 24 random bytes → 32-char URL-safe base64
  return randomBytes(24)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function injectVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

interface DocBundle {
  doc_titel?:        string
  doc_nummer?:       string
  doc_giltig_till?:  string | null
  projekt_id:        string | null
  projekt_namn?:     string
  kund_id:           string | null
  kund_namn?:        string
  kund_email?:       string
}

async function fetchDocBundle(typ: DokumentTyp, id: string): Promise<DocBundle> {
  if (typ === 'fritt') {
    const { data, error } = await supabase
      .from('signatur_fritta_dokument')
      .select('id, titel, projekt:projekt_id (id, namn, kunder:kund_id (id, namn, email))')
      .eq('id', id)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Dokumentet hittades inte')
    const d = data as unknown as {
      titel: string
      projekt: { id: string; namn: string; kunder: { id: string; namn: string; email: string | null } | null } | null
    }
    return {
      doc_titel:    d.titel,
      doc_nummer:   '',
      projekt_id:   d.projekt?.id ?? null,
      projekt_namn: d.projekt?.namn ?? '',
      kund_id:      d.projekt?.kunder?.id ?? null,
      kund_namn:    d.projekt?.kunder?.namn ?? '',
      kund_email:   d.projekt?.kunder?.email ?? '',
    }
  }
  if (typ === 'forslag') {
    const { data, error } = await supabase
      .from('forslag')
      .select('id, forslag_nummer, titel, giltig_till, projekt:projekt_id (id, namn, kunder:kund_id (id, namn, email))')
      .eq('id', id)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Forslag hittades inte')
    const d = data as unknown as {
      titel: string; forslag_nummer: string; giltig_till: string | null;
      projekt: { id: string; namn: string; kunder: { id: string; namn: string; email: string | null } | null } | null
    }
    return {
      doc_titel:       d.titel,
      doc_nummer:      d.forslag_nummer,
      doc_giltig_till: d.giltig_till,
      projekt_id:      d.projekt?.id ?? null,
      projekt_namn:    d.projekt?.namn ?? '',
      kund_id:         d.projekt?.kunder?.id ?? null,
      kund_namn:       d.projekt?.kunder?.namn ?? '',
      kund_email:      d.projekt?.kunder?.email ?? '',
    }
  }
  if (typ === 'ata') {
    const { data, error } = await supabase
      .from('ata')
      .select('id, ata_nummer, titel, projekt_id, kund_id, kund_namn, projekt:projekt_id (namn), kund:kund_id (email)')
      .eq('id', id)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'ÄTA hittades inte')
    const d = data as unknown as {
      titel: string; ata_nummer: string;
      projekt_id: string | null; projekt: { namn: string } | null;
      kund_id: string | null; kund_namn: string | null;
      kund: { email: string | null } | null;
    }
    return {
      doc_titel:    d.titel,
      doc_nummer:   d.ata_nummer,
      projekt_id:   d.projekt_id,
      projekt_namn: d.projekt?.namn ?? '',
      kund_id:      d.kund_id,
      kund_namn:    d.kund_namn ?? '',
      kund_email:   d.kund?.email ?? '',
    }
  }
  const { data, error } = await supabase
    .from('ordrar')
    .select('id, order_nummer, titel, projekt_id, kund_id, kund_namn, projekt:projekt_id (namn), kund:kund_id (email)')
    .eq('id', id)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Order hittades inte')
  const d = data as unknown as {
    titel: string; order_nummer: string;
    projekt_id: string | null; projekt: { namn: string } | null;
    kund_id: string | null; kund_namn: string | null;
    kund: { email: string | null } | null;
  }
  return {
    doc_titel:    d.titel,
    doc_nummer:   d.order_nummer,
    projekt_id:   d.projekt_id,
    projekt_namn: d.projekt?.namn ?? '',
    kund_id:      d.kund_id,
    kund_namn:    d.kund_namn ?? '',
    kund_email:   d.kund?.email ?? '',
  }
}

function begaranSystemKod(typ: DokumentTyp): string {
  // 'fritt' uses the generic 'dokument' template
  return `signatur_begaran_${typ === 'fritt' ? 'dokument' : typ}`
}

async function pickEmailMall(
  mall_id: string | null | undefined,
  typ: DokumentTyp,
  system_kod: string | null = null,
  fallback_kod: string | null = null,
): Promise<{
  amne: string
  kropp_html: string
  alias_id: string | null
} | null> {
  if (mall_id) {
    const { data } = await supabase
      .from('epost_mallar')
      .select('amne, kropp_html, alias_id')
      .eq('id', mall_id)
      .maybeSingle()
    if (data) return data as { amne: string; kropp_html: string; alias_id: string | null }
  }
  const primaryKod = system_kod ?? begaranSystemKod(typ)
  const primary = await supabase
    .from('epost_mallar')
    .select('amne, kropp_html, alias_id')
    .eq('system_kod', primaryKod)
    .eq('aktiv', true)
    .maybeSingle()
  if (primary.data) return primary.data as { amne: string; kropp_html: string; alias_id: string | null }
  if (fallback_kod) {
    const { data } = await supabase
      .from('epost_mallar')
      .select('amne, kropp_html, alias_id')
      .eq('system_kod', fallback_kod)
      .eq('aktiv', true)
      .maybeSingle()
    if (data) return data as { amne: string; kropp_html: string; alias_id: string | null }
  }
  return null
}

function buildMeddelandeBlock(meddelande: string | null | undefined): string {
  const m = meddelande?.trim()
  if (!m) return ''
  return `<div style="margin:20px 0;padding:14px 16px;background:#f5f5f5;border-left:3px solid #5363f2;border-radius:4px;font-size:14px;color:#444;line-height:1.5"><strong style="display:block;margin:0 0 6px;color:#1a1a1a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Meddelande</strong>${m.replace(/\n/g, '<br>')}</div>`
}

function buildDokumentTitelBlock(titel: string | null | undefined): string {
  const t = titel?.trim()
  if (!t) return ''
  return ` <span style="color:#666;font-weight:400">— ${t}</span>`
}

// Renders the customer's last change request as a soft-amber callout in the
// "uppdaterad version" email so the customer sees we addressed what they asked.
// Empty string when there's no recent request to echo back.
function buildAndringResumenBlock(reason: string | null | undefined): string {
  const r = reason?.trim()
  if (!r) return ''
  return `<div style="margin:20px 0;padding:14px 16px;background:#fff7ed;border-left:3px solid #f59e0b;border-radius:4px;font-size:14px;color:#7c2d12;line-height:1.55"><strong style="display:block;margin:0 0 6px;color:#1a1a1a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Din senaste begäran</strong>${r.replace(/\n/g, '<br>')}</div>`
}

export function registerSignaturHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  // ── Create a new signing link + queue the email ────────────────────────────
  ipcMain.handle('db:signatur-lank:create', async (_, input: CreateInput) => {
    if (!input.dokument_typ || !input.dokument_id) throw new Error('dokument_typ + id krävs')
    if (!input.kund_email || !input.kund_email.includes('@')) throw new Error('Giltig kund-email krävs')

    const bundle = await fetchDocBundle(input.dokument_typ, input.dokument_id)
    const token = tokenStr()

    // Lightweight snapshot hash: title + nummer + projekt + kund. Enough for
    // audit ("did the doc shown to client match what's in CRM now?").
    const { createHash } = await import('crypto')
    const hash = createHash('sha256').update(JSON.stringify({
      typ: input.dokument_typ,
      titel: bundle.doc_titel ?? '',
      nummer: bundle.doc_nummer ?? '',
      projekt: bundle.projekt_namn ?? '',
      kund: bundle.kund_namn ?? '',
    })).digest('hex')

    const expiry = input.giltig_dagar > 0
      ? new Date(Date.now() + input.giltig_dagar * 86400_000)
      : new Date('2099-12-31T23:59:59Z')

    const { data: link, error: linkErr } = await supabase
      .from('signatur_lankar')
      .insert({
        token,
        dokument_typ:  input.dokument_typ,
        dokument_id:   input.dokument_id,
        kund_id:       bundle.kund_id,
        kund_email:    input.kund_email.trim(),
        dokument_hash: hash,
        meddelande:    input.meddelande?.trim() || null,
        skapad_av:     input.skapad_av || null,
        gar_ut_at:     expiry.toISOString(),
      })
      .select('*')
      .single()
    if (linkErr) throw new Error(linkErr.message)

    // Defensive status bump: only nudge from draft → sent. Never downgrade
    // an accepted/rejected document. 'fritt' has no source doc to bump.
    if (input.dokument_typ === 'forslag') {
      await supabase.from('forslag')
        .update({ status: 'Skickat' })
        .eq('id', input.dokument_id)
        .in('status', ['utkast', 'Utkast'])
    } else if (input.dokument_typ === 'order') {
      await supabase.from('ordrar')
        .update({ status: 'Skickad' })
        .eq('id', input.dokument_id)
        .eq('status', 'Utkast')
    } else if (input.dokument_typ === 'ata') {
      await supabase.from('ata')
        .update({ status: 'Skickad' })
        .eq('id', input.dokument_id)
        .eq('status', 'Utkast')
    }

    // Optional attachments: upload to Zoho first so the queue worker can
    // forward them with the email. Failures here propagate so the user
    // sees a clear error instead of a silently-link-without-attachment.
    const bilagor: EpostBilagaRef[] = []
    if (input.bilagor && input.bilagor.length > 0) {
      for (const att of input.bilagor) {
        const buf = Buffer.from(att.data_base64, 'base64')
        const ref = await zohoUploadAttachment(att.filnamn, buf)
        bilagor.push({ ...ref, storlek: buf.byteLength, kalla: 'fil' })
      }
    }

    // Queue the email
    const lank = buildSignatureUrl(token)
    await queueSignatureEmail({
      mall_id:      input.mall_id ?? null,
      dokument_typ: input.dokument_typ,
      to:           input.kund_email.trim(),
      kund_id:      bundle.kund_id,
      projekt_id:   bundle.projekt_id,
      forslag_id:   input.dokument_typ === 'forslag' ? input.dokument_id : null,
      bilagor:      bilagor.length > 0 ? bilagor : undefined,
      metadata:     input.pdf_opts,
      vars: {
        kund_namn:               bundle.kund_namn ?? '',
        projekt_namn:            bundle.projekt_namn ?? '',
        forslag_nummer:          input.dokument_typ === 'forslag' ? (bundle.doc_nummer ?? '') : '',
        order_nummer:            input.dokument_typ === 'order'   ? (bundle.doc_nummer ?? '') : '',
        ata_nummer:              input.dokument_typ === 'ata'     ? (bundle.doc_nummer ?? '') : '',
        dokument_titel:          bundle.doc_titel ?? '',
        dokument_titel_block:    buildDokumentTitelBlock(bundle.doc_titel),
        signatur_lank:           lank,
        signatur_giltigt_till:   expiry.toISOString().slice(0, 10),
        meddelande:              input.meddelande ?? '',
        meddelande_block:        buildMeddelandeBlock(input.meddelande),
      },
    })

    return link
  })

  // ── List links for a given doc ────────────────────────────────────────────
  ipcMain.handle('db:signatur-lank:list-for-doc', async (_, typ: DokumentTyp, id: string) => {
    const { data, error } = await supabase
      .from('signatur_lankar')
      .select('*')
      .eq('dokument_typ', typ)
      .eq('dokument_id', id)
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  })

  // ── Revoke (soft — keeps audit) ───────────────────────────────────────────
  ipcMain.handle('db:signatur-lank:revoke', async (_, id: string) => {
    const { error } = await supabase.rpc('revoke_signing_link', { p_id: id })
    if (error) throw new Error(error.message)
  })

  // ── Delete (hard — removes the link row entirely) ─────────────────────────
  // If the link was signed, the RPC also clears godkand_av / signatur_data on
  // the underlying forslag/order and rolls projekt status back from
  // 'Acepterat' → 'Negociacion'. Anteckningar are kept as audit.
  ipcMain.handle('db:signatur-lank:delete', async (_, id: string) => {
    const { error } = await supabase.rpc('delete_signing_link', { p_id: id })
    if (error) throw new Error(error.message)
  })

  // ── Resend the email for an existing (still-valid) link ───────────────────
  // opts.revised=true → uses 'signatur_uppdaterad_version_kund_*' (response-style
  // copy that mentions the customer's request) instead of the original
  // 'signatur_begaran_*' invitation. opts.meddelande overrides the link's stored
  // meddelande for this send only — admins use it to write a follow-up note.
  ipcMain.handle('db:signatur-lank:resend', async (_, id: string, opts: ResendOpts = {}) => {
    const { data: link, error } = await supabase
      .from('signatur_lankar')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !link) throw new Error(error?.message ?? 'Länken finns inte')
    if (link.revoked_at)  throw new Error('Länken är återkallad')
    if (link.signerad_at) throw new Error('Länken är redan signerad')

    const dokTyp = link.dokument_typ as DokumentTyp
    const bundle = await fetchDocBundle(dokTyp, link.dokument_id)
    const lank = buildSignatureUrl(link.token)

    // For revised resends prefer the type-specific "uppdaterad version"
    // template, falling back to the generic 'dokument' one so fritt and
    // any future doc type works out of the box.
    const systemKod = opts.reminder
      ? `signatur_paminnelse_${dokTyp === 'fritt' ? 'dokument' : dokTyp}`
      : opts.revised
        ? `signatur_uppdaterad_version_kund_${dokTyp === 'fritt' ? 'dokument' : dokTyp}`
        : null
    const fallbackKod = opts.reminder
      ? 'signatur_paminnelse_forslag'
      : opts.revised
        ? 'signatur_uppdaterad_version_kund_dokument'
        : null

    const meddelande = (opts.meddelande?.trim() || link.meddelande || '') as string
    const andringHistorik = (link.andring_historik ?? []) as { reason: string }[]
    const lastReason = andringHistorik.length > 0 ? andringHistorik[andringHistorik.length - 1].reason : ''

    await queueSignatureEmail({
      mall_id:        opts.mall_id ?? null,
      system_kod:     systemKod,
      fallback_kod:   fallbackKod,
      dokument_typ:   dokTyp,
      to:             link.kund_email,
      kund_id:        bundle.kund_id,
      projekt_id:     bundle.projekt_id,
      forslag_id:     dokTyp === 'forslag' ? link.dokument_id : null,
      metadata:       opts.pdf_opts,
      vars: {
        kund_namn:               bundle.kund_namn ?? '',
        projekt_namn:            bundle.projekt_namn ?? '',
        forslag_nummer:          dokTyp === 'forslag' ? (bundle.doc_nummer ?? '') : '',
        order_nummer:            dokTyp === 'order'   ? (bundle.doc_nummer ?? '') : '',
        ata_nummer:              dokTyp === 'ata'     ? (bundle.doc_nummer ?? '') : '',
        dokument_titel:          bundle.doc_titel ?? '',
        dokument_titel_block:    buildDokumentTitelBlock(bundle.doc_titel),
        signatur_lank:           lank,
        signatur_giltigt_till:   String(link.gar_ut_at).slice(0, 10),
        meddelande,
        meddelande_block:        buildMeddelandeBlock(meddelande),
        andring_resumen:         lastReason,
        andring_resumen_block:   buildAndringResumenBlock(lastReason),
      },
    })

    if (opts.reminder) {
      const now = new Date().toISOString()
      const existing = (link.paminnelse_historik ?? []) as { at: string }[]
      await supabase
        .from('signatur_lankar')
        .update({ paminnelse_historik: [...existing, { at: now }] })
        .eq('id', id)

      if (bundle.projekt_id) {
        await supabase.from('projekt_aktivitet').insert({
          projekt_id: bundle.projekt_id,
          handelse:   'forslag_paminnelse_skickad',
          text:       `Påminnelse skickad för Förslag ${bundle.doc_nummer ?? ''}`,
        })
      }
    }
  })

  // ── Render the OFFICIAL document PDF (forslag/order template) and upload ──
  // Caller (renderer) builds the HTML using the same logic as handleExportPdf,
  // passes it here. We use Electron printToPDF + service_role upload to the
  // signing-pdfs bucket. Returns the public URL for storing on the link.
  ipcMain.handle('db:signatur-lank:render-document-pdf', async (_, args: { link_id: string; html: string; landscape?: boolean }) => {
    if (!args.link_id || !args.html) throw new Error('link_id + html krävs')

    // Look up the link to get the token (used as the storage folder)
    const { data: link, error: linkErr } = await supabase
      .from('signatur_lankar').select('token, dokument_typ').eq('id', args.link_id).single()
    if (linkErr || !link) throw new Error(linkErr?.message ?? 'Länken finns inte')

    // Render via Electron printToPDF
    const win = new BrowserWindow({
      show: false,
      width: args.landscape ? 1200 : 800,
      height: args.landscape ? 850 : 1131,
      webPreferences: { sandbox: false },
    })
    const tmp1 = join(tmpdir(), `crm-pdf-${Date.now()}.html`)
    await writeFile(tmp1, args.html, 'utf-8')
    try {
      await win.loadFile(tmp1)
      const buffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        landscape: args.landscape ?? false,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      })

      const path = `${link.token}/document.pdf`
      const { error: upErr } = await supabase.storage
        .from('signing-pdfs')
        .upload(path, buffer, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw new Error(`Storage-uppladdning misslyckades: ${upErr.message}`)

      const { data: { publicUrl } } = supabase.storage.from('signing-pdfs').getPublicUrl(path)
      const { error: updErr } = await supabase
        .from('signatur_lankar')
        .update({ document_pdf_url: publicUrl })
        .eq('id', args.link_id)
      if (updErr) throw new Error(updErr.message)

      return { url: publicUrl }
    } finally {
      win.close()
      unlink(tmp1).catch(() => {})
    }
  })

  // ── Render the FINAL document PDF (Slutlig-Offert version) ────────────────
  // Used when the admin sent for signature with Titel 1 (e.g. Preliminär) but
  // the mall has a Titel 2 (e.g. Slutlig). The customer portal stamps the
  // signature on this URL when present so the post-sign copy carries Titel 2.
  ipcMain.handle('db:signatur-lank:render-final-document-pdf', async (_, args: { link_id: string; html: string; landscape?: boolean }) => {
    if (!args.link_id || !args.html) throw new Error('link_id + html krävs')

    const { data: link, error: linkErr } = await supabase
      .from('signatur_lankar').select('token, dokument_typ').eq('id', args.link_id).single()
    if (linkErr || !link) throw new Error(linkErr?.message ?? 'Länken finns inte')

    const win = new BrowserWindow({
      show: false,
      width: args.landscape ? 1200 : 800,
      height: args.landscape ? 850 : 1131,
      webPreferences: { sandbox: false },
    })
    const tmp2 = join(tmpdir(), `crm-pdf-${Date.now()}.html`)
    await writeFile(tmp2, args.html, 'utf-8')
    try {
      await win.loadFile(tmp2)
      const buffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        landscape: args.landscape ?? false,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      })

      const path = `${link.token}/document-final.pdf`
      const { error: upErr } = await supabase.storage
        .from('signing-pdfs')
        .upload(path, buffer, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw new Error(`Storage-uppladdning misslyckades: ${upErr.message}`)

      const { data: { publicUrl } } = supabase.storage.from('signing-pdfs').getPublicUrl(path)
      const { error: updErr } = await supabase
        .from('signatur_lankar')
        .update({ final_document_pdf_url: publicUrl })
        .eq('id', args.link_id)
      if (updErr) throw new Error(updErr.message)

      return { url: publicUrl }
    } finally {
      win.close()
      unlink(tmp2).catch(() => {})
    }
  })

  ipcMain.handle('db:signatur-lank:render-specifikation-pdf', async (_, args: { link_id: string; html: string }) => {
    if (!args.link_id || !args.html) throw new Error('link_id + html krävs')
    const { data: link, error: linkErr } = await supabase
      .from('signatur_lankar').select('token').eq('id', args.link_id).single()
    if (linkErr || !link) throw new Error(linkErr?.message ?? 'Länken finns inte')

    const win = new BrowserWindow({ show: false, width: 800, height: 1131, webPreferences: { sandbox: false } })
    const tmp = join(tmpdir(), `crm-pdf-${Date.now()}.html`)
    await writeFile(tmp, args.html, 'utf-8')
    try {
      await win.loadFile(tmp)
      const buffer = await win.webContents.printToPDF({
        printBackground: true, pageSize: 'A4', landscape: false,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      })
      const path = `${link.token}/specifikation.pdf`
      const { error: upErr } = await supabase.storage
        .from('signing-pdfs').upload(path, buffer, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw new Error(`Storage-uppladdning misslyckades: ${upErr.message}`)
      const { data: { publicUrl } } = supabase.storage.from('signing-pdfs').getPublicUrl(path)
      const { error: updErr } = await supabase
        .from('signatur_lankar').update({ specifikation_pdf_url: publicUrl }).eq('id', args.link_id)
      if (updErr) throw new Error(updErr.message)
      return { url: publicUrl }
    } finally {
      win.close()
      unlink(tmp).catch(() => {})
    }
  })

  ipcMain.handle('db:signatur-lank:render-tidplan-pdf', async (_, args: { link_id: string; html: string }) => {
    if (!args.link_id || !args.html) throw new Error('link_id + html krävs')
    const { data: link, error: linkErr } = await supabase
      .from('signatur_lankar').select('token').eq('id', args.link_id).single()
    if (linkErr || !link) throw new Error(linkErr?.message ?? 'Länken finns inte')

    const win = new BrowserWindow({ show: false, width: 1200, height: 850, webPreferences: { sandbox: false } })
    const tmp = join(tmpdir(), `crm-pdf-${Date.now()}.html`)
    await writeFile(tmp, args.html, 'utf-8')
    try {
      await win.loadFile(tmp)
      const buffer = await win.webContents.printToPDF({
        printBackground: true, pageSize: 'A4', landscape: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      })
      const path = `${link.token}/tidplan.pdf`
      const { error: upErr } = await supabase.storage
        .from('signing-pdfs').upload(path, buffer, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw new Error(`Storage-uppladdning misslyckades: ${upErr.message}`)
      const { data: { publicUrl } } = supabase.storage.from('signing-pdfs').getPublicUrl(path)
      const { error: updErr } = await supabase
        .from('signatur_lankar').update({ tidplan_pdf_url: publicUrl }).eq('id', args.link_id)
      if (updErr) throw new Error(updErr.message)
      return { url: publicUrl }
    } finally {
      win.close()
      unlink(tmp).catch(() => {})
    }
  })

  // ── Default mall-id for the modal pre-selection ───────────────────────────
  ipcMain.handle('db:signatur-lank:get-default-mall', async (_, dokument_typ: DokumentTyp) => {
    const { data } = await supabase
      .from('epost_mallar')
      .select('id')
      .eq('system_kod', begaranSystemKod(dokument_typ))
      .eq('aktiv', true)
      .maybeSingle()
    return (data as { id: string } | null)?.id ?? null
  })

  // Clears andring_begard_at on a link and bumps the förslag back to 'Skickat'.
  // Called by the CRM after the admin edits a förslag and is about to resend
  // an updated PDF on the same link.
  ipcMain.handle('db:signatur-lank:clear-change-request', async (_, link_id: string) => {
    if (!link_id) throw new Error('link_id krävs')
    const { data, error } = await supabase.rpc('clear_change_request', { p_link_id: link_id })
    if (error) throw new Error(error.message)
    return data
  })

  // Returns the most relevant signing link per forslag_id for the table column.
  // Prefers signed links over pending ones; within each forslag takes the latest.
  ipcMain.handle('db:signatur-lank:forslag-events', async () => {
    const { data, error } = await supabase
      .from('signatur_lankar')
      .select('dokument_id, skapad_at, oppnad_at, last_oppnad_at, signerad_at, signerad_namn, revoked_at, view_count, paminnelse_historik')
      .eq('dokument_typ', 'forslag')
      .order('skapad_at', { ascending: false })
    if (error) throw new Error(error.message)

    type Row = {
      dokument_id: string
      skapad_at: string
      oppnad_at: string | null
      last_oppnad_at: string | null
      signerad_at: string | null
      signerad_namn: string | null
      revoked_at: string | null
      view_count: number
      paminnelse_historik: { at: string }[]
    }
    const result: Record<string, Omit<Row, 'dokument_id'>> = {}
    for (const row of (data ?? []) as Row[]) {
      const { dokument_id, ...fields } = row
      const existing = result[dokument_id]
      if (!existing || (fields.signerad_at && !existing.signerad_at)) {
        result[dokument_id] = {
          ...fields,
          view_count: fields.view_count ?? 0,
          paminnelse_historik: fields.paminnelse_historik ?? [],
        }
      }
    }
    return result
  })
}

interface QueueArgs {
  mall_id:      string | null
  // Optional explicit system_kod (e.g. 'signatur_uppdaterad_version_kund_forslag').
  // When set, takes precedence over the dokument_typ-derived 'signatur_begaran_*'.
  system_kod?:  string | null
  fallback_kod?: string | null
  dokument_typ: DokumentTyp
  to:           string
  kund_id:      string | null
  projekt_id:   string | null
  forslag_id:   string | null
  bilagor?:     EpostBilagaRef[]
  metadata?:    PdfOpts
  vars:         Record<string, string>
}

async function queueSignatureEmail(args: QueueArgs): Promise<void> {
  const mall = await pickEmailMall(args.mall_id, args.dokument_typ, args.system_kod ?? null, args.fallback_kod ?? null)
  if (!mall) {
    const expected = args.system_kod || begaranSystemKod(args.dokument_typ)
    throw new Error(`Ingen e-postmall hittades med system_kod='${expected}'. Kontrollera Inställningar → E-post mallar.`)
  }

  const aliasSignatur = await aliasSignaturOrEmpty(mall.alias_id)
  const vars = { ...args.vars, alias_signatur: aliasSignatur }

  await supabase.from('epost_ko').insert({
    alias_id:        mall.alias_id,
    till:            args.to,
    amne:            injectVars(mall.amne, vars),
    kropp_html:      injectVars(mall.kropp_html, vars),
    kund_id:         args.kund_id,
    projekt_id:      args.projekt_id,
    forslag_id:      args.forslag_id,
    bilagor:         args.bilagor ?? [],
    metadata:        args.metadata ?? null,
    schemalagd_till: new Date().toISOString(),
    status:          'väntar',
  })
}

async function aliasSignaturOrEmpty(alias_id: string | null): Promise<string> {
  if (!alias_id) return ''
  const { data } = await supabase.from('epost_alias').select('signatur_html').eq('id', alias_id).maybeSingle()
  return (data as { signatur_html: string | null } | null)?.signatur_html ?? ''
}
