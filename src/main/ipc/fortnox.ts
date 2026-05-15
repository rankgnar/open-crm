import { ipcMain, app, shell } from 'electron'
import http from 'http'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { URLSearchParams } from 'url'
import { randomBytes } from 'crypto'
import { supabase } from '../supabase'

const FORTNOX_TOKEN_URL = 'https://apps.fortnox.se/oauth-v1/token'
const FORTNOX_API_BASE = 'https://api.fortnox.se/3'
const REDIRECT_URI = 'http://localhost:9999/callback'
const SCOPES = 'invoice supplierinvoice payment customer supplier article companyinformation inbox archive bookkeeping'

// ── Token management ──────────────────────────────────────────────────────────

interface StoredTokens {
  access_token: string
  refresh_token: string
  expires_at: number | null
  client_id: string
  client_secret: string
}

async function getTokens(): Promise<StoredTokens | null> {
  const { data } = await supabase
    .from('app_installningar')
    .select('fortnox_access_token, fortnox_refresh_token, fortnox_token_expires_at, fortnox_client_id, fortnox_client_secret')
    .limit(1)
    .single()

  if (!data?.fortnox_access_token || !data?.fortnox_client_id) return null

  return {
    access_token: data.fortnox_access_token as string,
    refresh_token: data.fortnox_refresh_token as string,
    expires_at: data.fortnox_token_expires_at as number | null,
    client_id: data.fortnox_client_id as string,
    client_secret: data.fortnox_client_secret as string,
  }
}

async function saveTokens(access_token: string, refresh_token: string, expires_in: number): Promise<void> {
  const expires_at = Date.now() + expires_in * 1000
  const { data: existing } = await supabase.from('app_installningar').select('id').limit(1).single()
  if (!existing) throw new Error('No settings row')
  const { error } = await supabase.from('app_installningar').update({
    fortnox_access_token: access_token,
    fortnox_refresh_token: refresh_token,
    fortnox_token_expires_at: expires_at,
  }).eq('id', existing.id)
  if (error) throw new Error(error.message)
  statusCache = null
}

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch(FORTNOX_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token refresh failed: ${response.status} — ${text}`)
  }

  const json = (await response.json()) as { access_token: string; refresh_token: string; expires_in: number }
  await saveTokens(json.access_token, json.refresh_token, json.expires_in)
  return json.access_token
}

async function getValidAccessToken(): Promise<string> {
  const tokens = await getTokens()
  if (!tokens) throw new Error('Not connected to Fortnox')

  const needsRefresh = !tokens.expires_at || tokens.expires_at < Date.now() + 60_000
  if (needsRefresh) {
    return refreshAccessToken(tokens.client_id, tokens.client_secret, tokens.refresh_token)
  }

  return tokens.access_token
}

// ── Live connection check (verifies the token actually works against Fortnox) ─

interface FortnoxStatus {
  connected: boolean
  expiresAt: number | null
  scopes: string[]
}

let statusCache: { value: FortnoxStatus; at: number } | null = null
const STATUS_CACHE_TTL = 5 * 60 * 1000

export async function checkFortnoxConnection(force = false): Promise<FortnoxStatus> {
  if (!force && statusCache && Date.now() - statusCache.at < STATUS_CACHE_TTL) {
    return statusCache.value
  }

  const tokens = await getTokens()
  const empty: FortnoxStatus = { connected: false, expiresAt: null, scopes: [] }

  if (!tokens?.access_token) {
    statusCache = { value: empty, at: Date.now() }
    return empty
  }

  let scopes: string[] = []
  try {
    const payload = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64url').toString())
    scopes = typeof payload.scope === 'string' ? payload.scope.split(' ') : []
  } catch { /* not a JWT or no scope claim */ }

  let connected = false
  try {
    const accessToken = await getValidAccessToken()
    const resp = await fetch(`${FORTNOX_API_BASE}/companyinformation`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    connected = resp.ok
  } catch {
    connected = false
  }

  const value: FortnoxStatus = { connected, expiresAt: tokens.expires_at ?? null, scopes }
  statusCache = { value, at: Date.now() }
  return value
}

function invalidateFortnoxStatusCache(): void {
  statusCache = null
}

// ── Fortnox API client ────────────────────────────────────────────────────────

async function fortnoxRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = await getValidAccessToken()

  const response = await fetch(`${FORTNOX_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Fortnox ${response.status}: ${text}`)
  }

  return response.json()
}

function fortnoxGet(path: string): Promise<unknown> {
  return fortnoxRequest(path)
}

async function fortnoxGetBuffer(path: string): Promise<Buffer> {
  const token = await getValidAccessToken()
  const response = await fetch(`${FORTNOX_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: '*/*',
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Fortnox ${response.status}: ${text}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

function fortnoxPost(path: string, body: unknown): Promise<unknown> {
  return fortnoxRequest(path, { method: 'POST', body: JSON.stringify(body) })
}

// ── OAuth callback server ─────────────────────────────────────────────────────

let callbackServer: http.Server | null = null
let oauthState = ''

function startCallbackServer(clientId: string, clientSecret: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (callbackServer) {
      callbackServer.close()
      callbackServer = null
    }

    callbackServer = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404)
        res.end()
        return
      }

      const url = new URL(req.url, 'http://localhost:9999')
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      if (!code || !state || state !== oauthState) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<html><body><p>Ogiltig callback.</p></body></html>')
        callbackServer?.close()
        callbackServer = null
        return
      }

      try {
        const body = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
        })

        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        const tokenResponse = await fetch(FORTNOX_TOKEN_URL, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        })

        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text()
          throw new Error(`Token exchange failed: ${tokenResponse.status} — ${errText}`)
        }

        const tokens = (await tokenResponse.json()) as { access_token: string; refresh_token: string; expires_in: number }
        await saveTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in)

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>OpenCRM</title></head><body style="font-family:system-ui;background:#121212;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#34d399;margin-bottom:8px">✓ Fortnox ansluten</h2><p style="color:#888;margin:0">Du kan stänga det här fönstret och återgå till OpenCRM.</p></div></body></html>`)

        // Notify renderer so it can refresh its state
        const { BrowserWindow } = await import('electron')
        BrowserWindow.getAllWindows()[0]?.webContents.send('fortnox:auth:success')
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<html><body><p style="color:red">Fel: ${err instanceof Error ? err.message : 'okänt fel'}</p></body></html>`)
      } finally {
        callbackServer?.close()
        callbackServer = null
      }
    })

    callbackServer.listen(9999, '127.0.0.1', () => resolve())
    callbackServer.on('error', (err) => {
      callbackServer = null
      reject(err)
    })
  })
}

// ── Pagination helpers ────────────────────────────────────────────────────────

interface FnMeta {
  '@TotalResources': number
  '@TotalPages': number
  '@CurrentPage': number
}

function parseMeta(m?: FnMeta) {
  return {
    totalResources: m?.['@TotalResources'] ?? 0,
    totalPages: m?.['@TotalPages'] ?? 1,
    currentPage: m?.['@CurrentPage'] ?? 1,
  }
}

// ── Register handlers ─────────────────────────────────────────────────────────

export function registerFortnoxHandlers(): void {
  // Auth
  ipcMain.handle('fortnox:auth:start', async (_, clientId: string, clientSecret: string) => {
    await startCallbackServer(clientId, clientSecret)
    const { shell } = await import('electron')
    oauthState = randomBytes(16).toString('hex')
    const authUrl = `https://apps.fortnox.se/oauth-v1/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&response_type=code&access_type=offline&state=${oauthState}`
    await shell.openExternal(authUrl)
  })

  ipcMain.handle('fortnox:auth:status', async (_, force?: boolean) => {
    return checkFortnoxConnection(force === true)
  })

  ipcMain.handle('fortnox:auth:disconnect', async () => {
    const { data: existing } = await supabase.from('app_installningar').select('id').limit(1).single()
    if (!existing) return
    await supabase.from('app_installningar').update({
      fortnox_access_token: '',
      fortnox_refresh_token: '',
      fortnox_token_expires_at: null,
    }).eq('id', existing.id)
    invalidateFortnoxStatusCache()
  })

  // Invoices
  ipcMain.handle('fortnox:invoices:list', async (_, params?: { filter?: string; page?: number; sortby?: string; sortorder?: string }) => {
    const qs = new URLSearchParams()
    if (params?.filter) qs.set('filter', params.filter)
    qs.set('page', String(params?.page ?? 1))
    qs.set('limit', '100')
    if (params?.sortby) qs.set('sortby', params.sortby)
    if (params?.sortorder) qs.set('sortorder', params.sortorder)
    const data = (await fortnoxGet(`/invoices?${qs}`)) as { Invoices: unknown[]; MetaInformation: FnMeta }
    return { items: data.Invoices ?? [], meta: parseMeta(data.MetaInformation) }
  })

  ipcMain.handle('fortnox:invoices:get', async (_, documentNumber: number) => {
    const data = (await fortnoxGet(`/invoices/${documentNumber}`)) as { Invoice: unknown }
    return data.Invoice
  })

  ipcMain.handle('fortnox:invoices:push', async (_, invoice: Record<string, unknown>) => {
    const payload = { ...invoice, NotCompleted: true }
    const data = (await fortnoxPost('/invoices', { Invoice: payload })) as { Invoice: unknown }
    return data.Invoice
  })

  // Supplier invoices
  ipcMain.handle('fortnox:supplierinvoices:list', async (_, params?: { filter?: string; page?: number; sortby?: string; sortorder?: string }) => {
    const qs = new URLSearchParams()
    if (params?.filter) qs.set('filter', params.filter)
    qs.set('page', String(params?.page ?? 1))
    qs.set('limit', '100')
    if (params?.sortby) qs.set('sortby', params.sortby)
    if (params?.sortorder) qs.set('sortorder', params.sortorder)
    const data = (await fortnoxGet(`/supplierinvoices?${qs}`)) as { SupplierInvoices: unknown[]; MetaInformation: FnMeta }
    return { items: data.SupplierInvoices ?? [], meta: parseMeta(data.MetaInformation) }
  })

  ipcMain.handle('fortnox:supplierinvoices:get', async (_, givenNumber: number) => {
    const data = (await fortnoxGet(`/supplierinvoices/${givenNumber}`)) as { SupplierInvoice: unknown }
    return data.SupplierInvoice
  })

  // Customers
  ipcMain.handle('fortnox:customers:list', async (_, params?: { search?: string; page?: number; sortby?: string; sortorder?: string }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('name', params.search)
    qs.set('page', String(params?.page ?? 1))
    qs.set('limit', '100')
    if (params?.sortby) qs.set('sortby', params.sortby)
    if (params?.sortorder) qs.set('sortorder', params.sortorder)
    const data = (await fortnoxGet(`/customers?${qs}`)) as { Customers: unknown[]; MetaInformation: FnMeta }
    return { items: data.Customers ?? [], meta: parseMeta(data.MetaInformation) }
  })

  ipcMain.handle('fortnox:customers:get', async (_, customerNumber: string) => {
    const data = (await fortnoxGet(`/customers/${customerNumber}`)) as { Customer: unknown }
    return data.Customer
  })

  // Suppliers
  ipcMain.handle('fortnox:suppliers:list', async (_, params?: { page?: number; sortby?: string; sortorder?: string }) => {
    const qs = new URLSearchParams()
    qs.set('page', String(params?.page ?? 1))
    qs.set('limit', '100')
    if (params?.sortby) qs.set('sortby', params.sortby)
    if (params?.sortorder) qs.set('sortorder', params.sortorder)
    const data = (await fortnoxGet(`/suppliers?${qs}`)) as { Suppliers: unknown[]; MetaInformation: FnMeta }
    return { items: data.Suppliers ?? [], meta: parseMeta(data.MetaInformation) }
  })

  ipcMain.handle('fortnox:suppliers:get', async (_, supplierNumber: string) => {
    const data = (await fortnoxGet(`/suppliers/${supplierNumber}`)) as { Supplier: unknown }
    return data.Supplier
  })

  // Invoice payments
  ipcMain.handle('fortnox:payments:list', async (_, params?: { page?: number; sortby?: string; sortorder?: string }) => {
    const qs = new URLSearchParams()
    qs.set('page', String(params?.page ?? 1))
    qs.set('limit', '100')
    if (params?.sortby) qs.set('sortby', params.sortby)
    if (params?.sortorder) qs.set('sortorder', params.sortorder)
    const data = (await fortnoxGet(`/invoicepayments?${qs}`)) as { InvoicePayments: unknown[]; MetaInformation: FnMeta }
    return { items: data.InvoicePayments ?? [], meta: parseMeta(data.MetaInformation) }
  })

  // Supplier invoice payments
  ipcMain.handle('fortnox:supplier-payments:list', async (_, params?: { page?: number; sortby?: string; sortorder?: string }) => {
    const qs = new URLSearchParams()
    qs.set('page', String(params?.page ?? 1))
    qs.set('limit', '100')
    if (params?.sortby) qs.set('sortby', params.sortby)
    if (params?.sortorder) qs.set('sortorder', params.sortorder)
    const data = (await fortnoxGet(`/supplierinvoicepayments?${qs}`)) as { SupplierInvoicePayments: unknown[]; MetaInformation: FnMeta }
    return { items: data.SupplierInvoicePayments ?? [], meta: parseMeta(data.MetaInformation) }
  })

  // Articles
  ipcMain.handle('fortnox:articles:list', async (_, params?: { search?: string; page?: number; sortby?: string; sortorder?: string }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('description', params.search)
    qs.set('page', String(params?.page ?? 1))
    qs.set('limit', '100')
    if (params?.sortby) qs.set('sortby', params.sortby)
    if (params?.sortorder) qs.set('sortorder', params.sortorder)
    const data = (await fortnoxGet(`/articles?${qs}`)) as { Articles: unknown[]; MetaInformation: FnMeta }
    return { items: data.Articles ?? [], meta: parseMeta(data.MetaInformation) }
  })

  // Company information
  ipcMain.handle('fortnox:company:get', async () => {
    const data = (await fortnoxGet('/companyinformation')) as { CompanyInformation: unknown }
    return data.CompanyInformation
  })

  // Inbox — list files in a folder (default: inbox_s = leverantörsfakturor)
  ipcMain.handle('fortnox:inbox:list', async (_, folder = 'inbox_s') => {
    const data = (await fortnoxGet(`/inbox/${folder}`)) as { Folder: { Files?: unknown[] } }
    return data.Folder?.Files ?? []
  })

  // Inbox — download a file and open it with the default app
  ipcMain.handle('fortnox:inbox:open', async (_, fileId: string, filename: string) => {
    const buffer = await fortnoxGetBuffer(`/inbox/${fileId}`)
    const dest = join(app.getPath('temp'), filename)
    writeFileSync(dest, buffer)
    await shell.openPath(dest)
    return dest
  })

  // Supplier invoice — find and open linked PDF
  // Strategy 1: supplierinvoicefileconnections → archive
  // Strategy 2: fileattachments (LGR_IO/LGR_IG entity types) → archive?fileid=
  ipcMain.handle('fortnox:supplierinvoices:open-pdf', async (_, givenNumber: number) => {
    // Strategy 1: file connections
    try {
      const fcData = (await fortnoxGet(`/supplierinvoicefileconnections?supplierinvoicenumber=${givenNumber}`)) as {
        SupplierInvoiceFileConnections?: Array<{ FileId: string; Name: string }>
      }
      const connections = fcData.SupplierInvoiceFileConnections ?? []
      console.log(`[pdf] file-connections #${givenNumber}: ${connections.length} items`)
      if (connections.length > 0) {
        const file = connections.find(c => c.Name?.toLowerCase().endsWith('.pdf')) ?? connections[0]
        const buffer = await fortnoxGetBuffer(`/archive/${file.FileId}`)
        const dest = join(app.getPath('temp'), file.Name || `faktura_${givenNumber}.pdf`)
        writeFileSync(dest, buffer)
        await shell.openPath(dest)
        return dest
      }
    } catch (e) {
      console.log(`[pdf] file-connections error: ${e instanceof Error ? e.message : e}`)
    }

    // Strategy 2: fileattachments API — try all known supplier invoice entity types
    // Also try VER (Verifikat) for booked invoices where the voucher may have the PDF
    const invRaw = (await fortnoxGet(`/supplierinvoices/${givenNumber}`)) as {
      SupplierInvoice?: { Booked?: boolean; VoucherNumber?: number; VoucherSeries?: string }
    }
    const inv = invRaw.SupplierInvoice
    const voucherNumber = inv?.VoucherNumber
    const token = await getValidAccessToken()

    // Try supplier invoice entity types first, then voucher if booked
    const attempts: Array<{ entityType: string; entityId: number }> = [
      { entityType: 'LGR_IO', entityId: givenNumber },
      { entityType: 'LGR_IG', entityId: givenNumber },
      ...(inv?.Booked && voucherNumber ? [{ entityType: 'VER', entityId: voucherNumber }] : []),
    ]
    for (const { entityType, entityId } of attempts) {
      try {
        const resp = await fetch(
          `https://api.fortnox.se/api/fileattachments/attachments-v1?entitytype=${entityType}&entityid=${entityId}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
        )
        console.log(`[pdf] fileattachments ${entityType} #${entityId}: status ${resp.status}`)
        if (!resp.ok) continue
        const items = await resp.json() as Array<{ fileId: string }>
        console.log(`[pdf] fileattachments ${entityType}: ${JSON.stringify(items)}`)
        if (Array.isArray(items) && items.length > 0 && items[0]?.fileId) {
          const buffer = await fortnoxGetBuffer(`/archive/file?fileid=${items[0].fileId}`)
          const dest = join(app.getPath('temp'), `faktura_${givenNumber}.pdf`)
          writeFileSync(dest, buffer)
          await shell.openPath(dest)
          return dest
        }
      } catch (e) {
        console.log(`[pdf] fileattachments ${entityType} error: ${e instanceof Error ? e.message : e}`)
      }
    }

    return null
  })

}
