import { ipcMain, dialog, shell, app } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { tmpdir } from 'os'
import { supabase } from '../supabase'

// ── Zoho API helpers ──────────────────────────────────────────────────────────

interface ZohoConfig {
  id: string
  zoho_access_token: string
  zoho_refresh_token: string
  zoho_client_id: string
  zoho_client_secret: string
  foretag_email: string
}

async function getConfig(): Promise<ZohoConfig> {
  const { data } = await supabase
    .from('app_installningar')
    .select('id, zoho_access_token, zoho_refresh_token, zoho_client_id, zoho_client_secret, foretag_email')
    .single()
  if (!data?.zoho_access_token?.trim()) {
    throw new Error('Zoho är inte ansluten — gå till Inställningar → Integrationer → Zoho')
  }
  return data as ZohoConfig
}

async function refreshToken(cfg: ZohoConfig): Promise<string> {
  const res = await fetch('https://accounts.zoho.eu/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: cfg.zoho_client_id,
      client_secret: cfg.zoho_client_secret,
      refresh_token: cfg.zoho_refresh_token,
    }).toString(),
  })
  const json = await res.json() as Record<string, string>
  if (!res.ok || json.error) {
    throw new Error(`Zoho-sessionen har gått ut — anslut igen i Inställningar`)
  }
  await supabase
    .from('app_installningar')
    .update({ zoho_access_token: json.access_token })
    .eq('id', cfg.id)
  return json.access_token
}

async function zohoFetch(path: string, token: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`https://mail.zoho.eu${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      Accept: 'application/json',
      ...(init.body && !(init.headers as Record<string, string>)?.['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let json: unknown
  try { json = JSON.parse(text) } catch { json = text }

  if (!res.ok) {
    throw new Error(`Zoho ${res.status}: ${typeof json === 'object' ? JSON.stringify(json) : json}`)
  }
  return json
}

async function zohoGet(path: string): Promise<unknown> {
  const cfg = await getConfig()
  try {
    return await zohoFetch(path, cfg.zoho_access_token)
  } catch (err) {
    if ((err as Error).message.includes('401')) {
      const newToken = await refreshToken(cfg)
      return await zohoFetch(path, newToken)
    }
    throw err
  }
}

async function zohoPost(path: string, body: object): Promise<unknown> {
  const cfg = await getConfig()
  const init: RequestInit = { method: 'POST', body: JSON.stringify(body) }
  try {
    return await zohoFetch(path, cfg.zoho_access_token, init)
  } catch (err) {
    if ((err as Error).message.includes('401')) {
      const newToken = await refreshToken(cfg)
      return await zohoFetch(path, newToken, init)
    }
    throw err
  }
}

export async function zohoUploadAttachment(filename: string, buffer: Buffer): Promise<{ storeName: string; attachmentName: string; attachmentPath: string }> {
  const cfg = await getConfig()
  const aRes = await zohoGet('/api/accounts') as { data: ZohoAccount[] }
  const accountId = aRes.data?.[0]?.accountId
  if (!accountId) throw new Error('Inga Zoho-konton hittades')

  const path = `/api/accounts/${accountId}/messages/attachments?fileName=${encodeURIComponent(filename)}`
  const url = `https://mail.zoho.eu${path}`

  const ab = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(ab).set(buffer)

  // Zoho rejects file-type Content-Type for raw uploads — must be octet-stream.
  async function doUpload(token: string): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/octet-stream' },
      body: ab,
    })
  }

  let token = cfg.zoho_access_token
  let res = await doUpload(token)
  if (res.status === 401) {
    token = await refreshToken(cfg)
    res = await doUpload(token)
  }
  const text = await res.text()
  if (!res.ok) throw new Error(`Zoho upload ${res.status}: ${text}`)
  const json = JSON.parse(text) as { data: { storeName: string; attachmentName: string; attachmentPath: string } | { storeName: string; attachmentName: string; attachmentPath: string }[] }
  return Array.isArray(json.data) ? json.data[0] : json.data
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ZohoAccount { accountId: string; incomingUserName: string; primaryEmailAddress?: string }

interface ZohoSendMailDetail {
  sendMailId: string
  fromAddress: string
  displayName: string
  signatureId?: string
  mode: string
  validated: boolean
  status: boolean
}

interface ZohoFolder { folderId: string; folderName: string; folderType?: string; path?: string }

interface ZohoMessage {
  messageId: string
  subject: string
  fromAddress: string
  sender: string
  toAddress: string
  ccAddress?: string
  receivedTime?: string
  sentDateInGMT?: string
  isRead: string | boolean
  hasAttachment: string | boolean
  summary?: string
  folderId: string
}

type EpostMapp = 'inkorg' | 'skickat' | 'utkast' | 'papperskorg'

interface EpostMeddelande {
  id: string
  provider: 'zoho'
  provider_message_id: string
  folder_id: string
  kund_id: string | null
  fran_adress: string
  fran_namn: string
  till: string[]
  cc: string[]
  amne: string
  snippet: string
  kropp_html: string
  kropp_text: string
  olast: boolean
  har_bilaga: boolean
  mapp: EpostMapp
  datum: string
}

export interface EpostAlias {
  id: string
  etikett: string
  fran_namn: string
  fran_adress: string
  signatur_html: string
  provider: string
  zoho_send_mail_id: string | null
  standard: boolean
  aktiv: boolean
  sortering: number
}

export interface EpostBilagaRef {
  storeName: string
  attachmentName: string
  attachmentPath: string
  storlek?: number
  kalla?: 'fil' | 'offert_pdf' | 'faktura_pdf'
}

function decodeEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
}

function parseAddresses(raw: string | undefined): string[] {
  if (!raw || raw.trim().toLowerCase() === 'not provided') return []
  return raw.split(',').map(s => decodeEntities(s.trim())).filter(Boolean)
}

function mapMessage(msg: ZohoMessage, mapp: EpostMapp): EpostMeddelande {
  const ts = msg.receivedTime || msg.sentDateInGMT
  return {
    id: msg.messageId,
    provider: 'zoho',
    provider_message_id: msg.messageId,
    folder_id: msg.folderId,
    kund_id: null,
    fran_adress: decodeEntities(msg.fromAddress ?? ''),
    fran_namn: decodeEntities(msg.sender ?? ''),
    till: parseAddresses(msg.toAddress),
    cc: parseAddresses(msg.ccAddress),
    amne: decodeEntities(msg.subject ?? ''),
    snippet: msg.summary ?? '',
    kropp_html: '',
    kropp_text: '',
    olast: msg.isRead === '0' || msg.isRead === false,
    har_bilaga: msg.hasAttachment === '1' || msg.hasAttachment === true,
    mapp,
    datum: ts ? new Date(parseInt(String(ts))).toISOString() : new Date().toISOString(),
  }
}

function folderNameToMapp(name: string): EpostMapp | null {
  const n = name.toLowerCase()
  if (n === 'inbox') return 'inkorg'
  if (n === 'sent') return 'skickat'
  if (n === 'drafts' || n === 'draft') return 'utkast'
  if (n === 'trash' || n === 'deleted') return 'papperskorg'
  return null
}

// ── Variable interpolation ───────────────────────────────────────────────────

export interface ContextRefs {
  kund_id?: string | null
  projekt_id?: string | null
  forslag_id?: string | null
  faktura_id?: string | null
  alias?: EpostAlias | null
}

export async function resolveContext(refs: ContextRefs): Promise<Record<string, string>> {
  const ctx: Record<string, string> = {
    datum: new Date().toLocaleDateString('sv-SE'),
    alias_signatur: refs.alias?.signatur_html ?? '',
  }

  const { data: foretag } = await supabase
    .from('app_installningar')
    .select('foretag_namn, foretag_email, foretag_telefon, foretag_webbadress')
    .single()
  if (foretag) {
    ctx.foretag_namn = (foretag.foretag_namn as string) ?? ''
    ctx.foretag_email = (foretag.foretag_email as string) ?? ''
    ctx.foretag_telefon = (foretag.foretag_telefon as string) ?? ''
    ctx.foretag_webbadress = (foretag.foretag_webbadress as string) ?? ''
  }

  if (refs.kund_id) {
    const { data } = await supabase.from('kunder').select('namn, email, telefon').eq('id', refs.kund_id).single()
    if (data) {
      ctx.kund_namn = (data.namn as string) ?? ''
      ctx.kund_email = (data.email as string) ?? ''
      ctx.kund_telefon = (data.telefon as string) ?? ''
    }
  }
  if (refs.projekt_id) {
    const { data } = await supabase.from('projekt').select('namn, projekt_nummer').eq('id', refs.projekt_id).single()
    if (data) {
      ctx.projekt_namn = (data.namn as string) ?? ''
      ctx.projekt_nummer = (data.projekt_nummer as string) ?? ''
    }
  }
  if (refs.forslag_id) {
    const { data } = await supabase.from('forslag').select('forslag_nummer, giltig_till').eq('id', refs.forslag_id).single()
    if (data) {
      ctx.offert_nummer = (data.forslag_nummer as string) ?? ''
      ctx.offert_giltig_till = (data.giltig_till as string) ?? ''
    }
  }
  if (refs.faktura_id) {
    const { data } = await supabase.from('fakturor').select('faktura_nummer').eq('id', refs.faktura_id).single()
    if (data) {
      ctx.faktura_nummer = (data.faktura_nummer as string) ?? ''
    }
  }
  return ctx
}

function interpolate(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => ctx[key.trim()] ?? '')
}

export async function applyMall(mall_id: string, ctx: Record<string, string>): Promise<{ amne: string; kropp_html: string; alias_id: string | null }> {
  const { data, error } = await supabase
    .from('epost_mallar')
    .select('amne, kropp_html, alias_id')
    .eq('id', mall_id)
    .single()
  if (error || !data) throw new Error(`Mall hittades inte: ${error?.message ?? ''}`)
  return {
    amne: interpolate((data.amne as string) ?? '', ctx),
    kropp_html: interpolate((data.kropp_html as string) ?? '', ctx),
    alias_id: (data.alias_id as string | null) ?? null,
  }
}

export async function loadAlias(alias_id: string | null): Promise<EpostAlias | null> {
  if (alias_id) {
    const { data } = await supabase.from('epost_alias').select('*').eq('id', alias_id).single()
    return (data as EpostAlias) ?? null
  }
  const { data } = await supabase
    .from('epost_alias')
    .select('*')
    .eq('aktiv', true)
    .order('standard', { ascending: false })
    .order('sortering')
    .limit(1)
  return ((data as EpostAlias[])?.[0]) ?? null
}

function formatFromAddress(alias: EpostAlias, foretag_namn: string): string {
  const namn = (alias.fran_namn?.trim() || foretag_namn?.trim() || '')
  if (!namn) return alias.fran_adress
  const escaped = namn.replace(/"/g, '\\"')
  return `"${escaped}" <${alias.fran_adress}>`
}

export async function loggEpostAnteckning(projekt_id: string | null, alias: EpostAlias, till: string, amne: string): Promise<void> {
  if (!projekt_id) return
  const fran = alias.fran_namn ? `${alias.fran_namn} <${alias.fran_adress}>` : alias.fran_adress
  await supabase.from('projekt_anteckningar').insert({
    projekt_id,
    titel: `E-post: ${amne || '(Inget ämne)'}`,
    innehall: `Skickat till ${till}\nFrån: ${fran}`,
    farg: 'blue',
  })
}

export async function sendEpost(input: {
  alias: EpostAlias
  till: string
  cc?: string
  amne: string
  kropp: string
  bilagor?: EpostBilagaRef[]
}): Promise<void> {
  const aRes = await zohoGet('/api/accounts') as { data: ZohoAccount[] }
  const accountId = aRes.data?.[0]?.accountId
  if (!accountId) throw new Error('Inga Zoho-konton hittades')

  const { data: foretag } = await supabase
    .from('app_installningar')
    .select('foretag_namn')
    .single()
  const foretag_namn = (foretag?.foretag_namn as string) ?? ''

  const sig = input.alias.signatur_html
  const baseKropp = input.kropp || '&nbsp;'
  const kropp = sig && !baseKropp.includes(sig)
    ? `${baseKropp}<br><br>${sig}`
    : baseKropp

  const body: Record<string, unknown> = {
    fromAddress: formatFromAddress(input.alias, foretag_namn),
    toAddress: input.till,
    subject: input.amne,
    content: kropp,
    mailFormat: 'html',
  }
  if (input.cc) body.ccAddress = input.cc
  if (input.bilagor && input.bilagor.length > 0) {
    body.attachments = input.bilagor.map(b => ({
      storeName: b.storeName,
      attachmentName: b.attachmentName,
      attachmentPath: b.attachmentPath,
    }))
  }

  await zohoPost(`/api/accounts/${accountId}/messages`, body)
}

// ── Workspace helper: olästa i inkorgen ─────────────────────────────────────

export interface EpostInkorgStats {
  olasta: number
  status: 'ok' | 'ej_ansluten' | 'fel'
}

export async function getEpostInkorgStats(): Promise<EpostInkorgStats> {
  try {
    const aRes = await zohoGet('/api/accounts') as { data: ZohoAccount[] }
    const accountId = aRes.data?.[0]?.accountId
    if (!accountId) return { olasta: 0, status: 'fel' }
    const fRes = await zohoGet(`/api/accounts/${accountId}/folders`) as { data: ZohoFolder[] }
    const inbox = (fRes.data ?? []).find((f) => f.folderName === 'Inbox' && f.path === '/Inbox')
      ?? (fRes.data ?? []).find((f) => f.folderName.toLowerCase() === 'inbox')
    if (!inbox) return { olasta: 0, status: 'fel' }
    const mRes = await zohoGet(
      `/api/accounts/${accountId}/messages/view?folderId=${inbox.folderId}&start=1&limit=200`,
    ) as { data: Array<{ status?: string }> }
    const olasta = (mRes.data ?? []).filter((m) => m.status === '0').length
    return { olasta, status: 'ok' }
  } catch (err) {
    const msg = String((err as Error)?.message ?? '')
    if (msg.includes('inte ansluten') || msg.includes('Zoho-sessionen')) {
      return { olasta: 0, status: 'ej_ansluten' }
    }
    return { olasta: 0, status: 'fel' }
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export function registerEpostHandlers(): void {
  // Sync: fetch messages from all standard folders
  ipcMain.handle('db:epost:sync', async () => {
    const res = await zohoGet('/api/accounts') as { data: ZohoAccount[] }
    const accountId = res.data?.[0]?.accountId
    if (!accountId) throw new Error('Inga Zoho-konton hittades')

    const fRes = await zohoGet(`/api/accounts/${accountId}/folders`) as { data: ZohoFolder[] }
    const folders = fRes.data ?? []

    const targets = folders
      .map(f => ({ ...f, mapp: folderNameToMapp(f.folderName) }))
      .filter(f => f.mapp !== null) as (ZohoFolder & { mapp: EpostMapp })[]

    const results = await Promise.all(
      targets.map(async (folder) => {
        try {
          const mRes = await zohoGet(
            `/api/accounts/${accountId}/messages/view?folderId=${folder.folderId}&start=1&limit=25`
          ) as { data: ZohoMessage[] }
          return (mRes.data ?? []).map(m => mapMessage(m, folder.mapp))
        } catch {
          return []
        }
      })
    )

    return results.flat()
  })

  ipcMain.handle('db:epost:get-content', async (_, messageId: string, folderId: string) => {
    const res = await zohoGet('/api/accounts') as { data: ZohoAccount[] }
    const accountId = res.data?.[0]?.accountId
    if (!accountId) return ''
    try {
      const cRes = await zohoGet(
        `/api/accounts/${accountId}/folders/${folderId}/messages/${messageId}/content`
      ) as { data: { content: string } }
      return cRes.data?.content ?? ''
    } catch {
      return ''
    }
  })

  ipcMain.handle('db:epost:list-message-attachments', async (_, messageId: string, folderId: string) => {
    const res = await zohoGet('/api/accounts') as { data: ZohoAccount[] }
    const accountId = res.data?.[0]?.accountId
    if (!accountId) return []
    try {
      const r = await zohoGet(
        `/api/accounts/${accountId}/folders/${folderId}/messages/${messageId}/attachmentinfo`
      ) as { data: { attachments?: { attachmentId: string; attachmentName: string; attachmentSize: number }[] } }
      return r.data?.attachments ?? []
    } catch {
      return []
    }
  })

  ipcMain.handle('db:epost:download-message-attachment', async (_, input: {
    messageId: string
    folderId: string
    attachmentId: string
    attachmentName: string
    save: boolean
  }) => {
    const cfg = await getConfig()
    const aRes = await zohoGet('/api/accounts') as { data: ZohoAccount[] }
    const accountId = aRes.data?.[0]?.accountId
    if (!accountId) throw new Error('Inga Zoho-konton hittades')

    const url = `https://mail.zoho.eu/api/accounts/${accountId}/folders/${input.folderId}/messages/${input.messageId}/attachments/${input.attachmentId}`

    async function fetchBuffer(token: string): Promise<{ ok: boolean; buf: Buffer; status: number; text?: string }> {
      const r = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } })
      if (!r.ok) return { ok: false, buf: Buffer.alloc(0), status: r.status, text: await r.text() }
      const buf = Buffer.from(await r.arrayBuffer())
      return { ok: true, buf, status: 200 }
    }

    let result = await fetchBuffer(cfg.zoho_access_token)
    if (result.status === 401) {
      const newToken = await refreshToken(cfg)
      result = await fetchBuffer(newToken)
    }
    if (!result.ok) throw new Error(`Zoho ${result.status}: ${result.text ?? ''}`)

    if (input.save) {
      const { filePath, canceled } = await dialog.showSaveDialog({
        defaultPath: join(app.getPath('downloads'), input.attachmentName),
      })
      if (canceled || !filePath) return null
      await writeFile(filePath, result.buf)
      return filePath
    }

    const tmpPath = join(tmpdir(), `open-crm-${Date.now()}-${input.attachmentName}`)
    await writeFile(tmpPath, result.buf)
    await shell.openPath(tmpPath)
    return tmpPath
  })

  // Send (unified)
  ipcMain.handle('db:epost:send', async (_, form: {
    alias_id: string | null
    till: string
    cc?: string
    amne: string
    kropp: string
    mall_id?: string | null
    kund_id?: string | null
    projekt_id?: string | null
    forslag_id?: string | null
    faktura_id?: string | null
    bilagor?: EpostBilagaRef[]
  }) => {
    const alias = await loadAlias(form.alias_id ?? null)
    if (!alias) throw new Error('Inget alias konfigurerat — gå till Inställningar → E-post alias')

    let amne = form.amne
    let kropp = form.kropp
    let aliasToUse = alias

    if (form.mall_id) {
      const ctx = await resolveContext({
        kund_id: form.kund_id,
        projekt_id: form.projekt_id,
        forslag_id: form.forslag_id,
        faktura_id: form.faktura_id,
        alias,
      })
      const m = await applyMall(form.mall_id, ctx)
      amne = m.amne || amne
      kropp = m.kropp_html || kropp
      if (m.alias_id) {
        const overrideAlias = await loadAlias(m.alias_id)
        if (overrideAlias) aliasToUse = overrideAlias
      }
    }

    await sendEpost({
      alias: aliasToUse,
      till: form.till,
      cc: form.cc,
      amne,
      kropp,
      bilagor: form.bilagor,
    })

    await loggEpostAnteckning(form.projekt_id ?? null, aliasToUse, form.till, amne).catch(() => {})

    return { ok: true }
  })

  // ── Alias CRUD ─────────────────────────────────────────────────────────────

  ipcMain.handle('db:epost-alias:list', async () => {
    const { data, error } = await supabase
      .from('epost_alias')
      .select('*')
      .order('sortering')
      .order('fran_adress')
    if (error) throw new Error(error.message)
    return data ?? []
  })

  ipcMain.handle('db:epost-alias:create', async (_, input: Partial<EpostAlias>) => {
    const { data, error } = await supabase
      .from('epost_alias')
      .insert({
        etikett: input.etikett ?? '',
        fran_namn: input.fran_namn ?? '',
        fran_adress: input.fran_adress,
        signatur_html: input.signatur_html ?? '',
        provider: input.provider ?? 'zoho',
        zoho_send_mail_id: input.zoho_send_mail_id ?? null,
        standard: input.standard ?? false,
        aktiv: input.aktiv ?? true,
        sortering: input.sortering ?? 0,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:epost-alias:update', async (_, id: string, input: Partial<EpostAlias>) => {
    const { data, error } = await supabase
      .from('epost_alias')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:epost-alias:delete', async (_, id: string) => {
    const { error } = await supabase.from('epost_alias').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

  ipcMain.handle('db:epost-alias:set-standard', async (_, id: string) => {
    await supabase.from('epost_alias').update({ standard: false }).eq('standard', true)
    const { error } = await supabase.from('epost_alias').update({ standard: true }).eq('id', id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

  ipcMain.handle('db:epost-alias:sync-from-zoho', async () => {
    const aRes = await zohoGet('/api/accounts') as { data: ZohoAccount[] }
    const accountId = aRes.data?.[0]?.accountId
    if (!accountId) throw new Error('Inga Zoho-konton hittades')

    const detail = await zohoGet(`/api/accounts/${accountId}`) as { data: { sendMailDetails?: ZohoSendMailDetail[] } }
    const sendDetails = detail.data?.sendMailDetails ?? []
    if (sendDetails.length === 0) return { added: 0, updated: 0 }

    const { data: existing } = await supabase.from('epost_alias').select('id, zoho_send_mail_id, fran_adress')
    const existingByZohoId = new Map<string, { id: string }>()
    const existingByAddress = new Map<string, { id: string }>()
    for (const row of (existing as { id: string; zoho_send_mail_id: string | null; fran_adress: string }[]) ?? []) {
      if (row.zoho_send_mail_id) existingByZohoId.set(row.zoho_send_mail_id, { id: row.id })
      existingByAddress.set(row.fran_adress, { id: row.id })
    }

    let added = 0
    let updated = 0
    for (let i = 0; i < sendDetails.length; i++) {
      const d = sendDetails[i]
      const match = existingByZohoId.get(d.sendMailId) ?? existingByAddress.get(d.fromAddress)
      if (match) {
        await supabase.from('epost_alias').update({
          fran_namn: d.displayName ?? '',
          zoho_send_mail_id: d.sendMailId,
          provider: 'zoho',
        }).eq('id', match.id)
        updated++
      } else {
        await supabase.from('epost_alias').insert({
          etikett: d.fromAddress.split('@')[0],
          fran_namn: d.displayName ?? '',
          fran_adress: d.fromAddress,
          provider: 'zoho',
          zoho_send_mail_id: d.sendMailId,
          aktiv: true,
          sortering: i,
        })
        added++
      }
    }
    return { added, updated }
  })

  // ── Mallar CRUD ────────────────────────────────────────────────────────────

  ipcMain.handle('db:epost-mallar:list', async () => {
    const { data, error } = await supabase
      .from('epost_mallar')
      .select('*')
      .order('kategori')
      .order('sortering')
      .order('namn')
    if (error) throw new Error(error.message)
    return data ?? []
  })

  ipcMain.handle('db:epost-mallar:create', async (_, input: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('epost_mallar')
      .insert({
        namn: input.namn ?? '',
        amne: input.amne ?? '',
        kropp_html: input.kropp_html ?? '',
        kategori: input.kategori ?? 'Allmänt',
        alias_id: input.alias_id ?? null,
        aktiv: input.aktiv ?? true,
        sortering: input.sortering ?? 0,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:epost-mallar:update', async (_, input: { id: string } & Record<string, unknown>) => {
    const { id, ...rest } = input
    const { data, error } = await supabase
      .from('epost_mallar')
      .update(rest)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:epost-mallar:delete', async (_, id: string) => {
    const { data: existing } = await supabase
      .from('epost_mallar')
      .select('system_kod')
      .eq('id', id)
      .single()
    if (existing?.system_kod) throw new Error('Systemmallar kan inte tas bort')
    const { error } = await supabase.from('epost_mallar').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

  // Preview applied template (resolves variables)
  ipcMain.handle('db:epost-mallar:preview', async (_, mall_id: string, refs: ContextRefs) => {
    const alias = refs.kund_id || refs.projekt_id || refs.forslag_id || refs.faktura_id
      ? await loadAlias(null)
      : null
    const ctx = await resolveContext({ ...refs, alias })
    return await applyMall(mall_id, ctx)
  })

  // ── Attachments ────────────────────────────────────────────────────────────

  // Pick files from disk and upload them all to Zoho
  ipcMain.handle('db:epost:pick-and-upload-files', async (): Promise<EpostBilagaRef[]> => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Välj bilagor',
      properties: ['openFile', 'multiSelections'],
    })
    if (canceled || filePaths.length === 0) return []

    const refs: EpostBilagaRef[] = []
    for (const path of filePaths) {
      const buffer = await readFile(path)
      const ref = await zohoUploadAttachment(basename(path), buffer)
      refs.push({ ...ref, storlek: buffer.byteLength, kalla: 'fil' })
    }
    return refs
  })

  // Upload a buffer (e.g., generated PDF passed from renderer)
  ipcMain.handle('db:epost:upload-buffer', async (_, input: { filename: string; buffer: number[]; kalla?: 'fil' | 'offert_pdf' | 'faktura_pdf' }): Promise<EpostBilagaRef> => {
    const buf = Buffer.from(input.buffer)
    const ref = await zohoUploadAttachment(input.filename, buf)
    return { ...ref, storlek: buf.byteLength, kalla: input.kalla ?? 'fil' }
  })

  // ── Queue (epost_ko) ──────────────────────────────────────────────────────

  ipcMain.handle('db:epost:queue', async (_, form: {
    alias_id: string | null
    till: string
    cc?: string
    amne: string
    kropp: string
    mall_id?: string | null
    kund_id?: string | null
    projekt_id?: string | null
    forslag_id?: string | null
    faktura_id?: string | null
    bilagor?: EpostBilagaRef[]
    schemalagd_till: string
  }) => {
    const alias = await loadAlias(form.alias_id ?? null)
    if (!alias) throw new Error('Inget alias konfigurerat')

    let amne = form.amne
    let kropp = form.kropp
    let aliasIdToStore = alias.id
    if (form.mall_id) {
      const ctx = await resolveContext({
        kund_id: form.kund_id,
        projekt_id: form.projekt_id,
        forslag_id: form.forslag_id,
        faktura_id: form.faktura_id,
        alias,
      })
      const m = await applyMall(form.mall_id, ctx)
      amne = m.amne || amne
      kropp = m.kropp_html || kropp
      if (m.alias_id) aliasIdToStore = m.alias_id
    }

    const { data, error } = await supabase.from('epost_ko').insert({
      alias_id: aliasIdToStore,
      mall_id: form.mall_id ?? null,
      till: form.till,
      cc: form.cc ?? '',
      amne,
      kropp_html: kropp,
      bilagor: form.bilagor ?? [],
      kund_id: form.kund_id ?? null,
      projekt_id: form.projekt_id ?? null,
      forslag_id: form.forslag_id ?? null,
      faktura_id: form.faktura_id ?? null,
      schemalagd_till: form.schemalagd_till,
    }).select('*').single()
    if (error) throw new Error(error.message)
    return data
  })

  ipcMain.handle('db:epost-ko:list', async () => {
    const { data, error } = await supabase
      .from('epost_ko')
      .select('*')
      .in('status', ['väntar', 'skickar', 'misslyckades'])
      .order('schemalagd_till', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  })

  ipcMain.handle('db:epost-ko:list-by-forslag', async (_, forslag_id: string) => {
    const { data, error } = await supabase
      .from('epost_ko')
      .select('id, amne, till, status, schemalagd_till, skickad_at, fel_meddelande, kropp_html, metadata')
      .eq('forslag_id', forslag_id)
      .order('schemalagd_till', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  })

  ipcMain.handle('db:epost-ko:cancel', async (_, id: string) => {
    const { error } = await supabase.from('epost_ko').delete().eq('id', id).eq('status', 'väntar')
    if (error) throw new Error(error.message)
    return { ok: true }
  })

  ipcMain.handle('db:epost-ko:retry', async (_, id: string) => {
    const { error } = await supabase
      .from('epost_ko')
      .update({ status: 'väntar', forsok: 0, fel_meddelande: '', schemalagd_till: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'misslyckades')
    if (error) throw new Error(error.message)
    return { ok: true }
  })

  ipcMain.handle('db:epost-ko:delete', async (_, id: string) => {
    const { error } = await supabase.from('epost_ko').delete().eq('id', id).neq('status', 'skickar')
    if (error) throw new Error(error.message)
    return { ok: true }
  })
}

// ── Queue processor (called by ticker in main/index.ts) ──────────────────────

interface KoRow {
  id: string
  alias_id: string | null
  till: string
  cc: string
  amne: string
  kropp_html: string
  bilagor: EpostBilagaRef[]
  forsok: number
  projekt_id: string | null
}

function isPermanentError(msg: string): boolean {
  return /\b(400|401|403|404|422)\b/.test(msg) || /invalid|unauthor|forbidden/i.test(msg)
}

export async function processEpostKo(): Promise<void> {
  const { data, error } = await supabase
    .from('epost_ko')
    .select('id, alias_id, till, cc, amne, kropp_html, bilagor, forsok, projekt_id')
    .eq('status', 'väntar')
    .lte('schemalagd_till', new Date().toISOString())
    .limit(10)

  if (error || !data || data.length === 0) return

  for (const row of data as KoRow[]) {
    await supabase.from('epost_ko').update({ status: 'skickar' }).eq('id', row.id).eq('status', 'väntar')

    try {
      const alias = await loadAlias(row.alias_id)
      if (!alias) throw new Error('Alias saknas')
      await sendEpost({
        alias,
        till: row.till,
        cc: row.cc || undefined,
        amne: row.amne,
        kropp: row.kropp_html,
        bilagor: row.bilagor ?? [],
      })
      await supabase.from('epost_ko').update({
        status: 'skickat',
        skickad_at: new Date().toISOString(),
        fel_meddelande: '',
      }).eq('id', row.id)
      await loggEpostAnteckning(row.projekt_id, alias, row.till, row.amne).catch(() => {})
    } catch (err) {
      const msg = (err as Error).message
      const forsok = row.forsok + 1
      const permanent = isPermanentError(msg) || forsok >= 3
      await supabase.from('epost_ko').update({
        status: permanent ? 'misslyckades' : 'väntar',
        forsok,
        fel_meddelande: msg.slice(0, 500),
        schemalagd_till: permanent ? undefined : new Date(Date.now() + 60 * 1000).toISOString(),
      }).eq('id', row.id)
    }
  }
}
