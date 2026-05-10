import { ipcMain, shell } from 'electron'
import http from 'http'
import https from 'https'
import { supabase } from '../supabase'

const REDIRECT_URI = 'http://localhost:9999/callback'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'openid',
  'email',
  'profile',
]

async function getRow() {
  const { data } = await supabase.from('app_installningar').select('id, google_client_id, google_client_secret').single()
  return data
}

async function saveTokens(access_token: string, refresh_token: string) {
  const row = await getRow()
  if (!row) throw new Error('Inställningar saknas i databasen')
  // Google only returns refresh_token on first consent (with prompt=consent
  // it returns it again, but be defensive — never overwrite a saved one with empty).
  const update: Record<string, string> = { google_access_token: access_token }
  if (refresh_token && refresh_token.length > 0) {
    update.google_refresh_token = refresh_token
  }
  await supabase.from('app_installningar').update(update).eq('id', row.id)
}

function exchangeCode(
  code: string,
  client_id: string,
  client_secret: string,
): Promise<{ access_token: string; refresh_token: string }> {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id,
      client_secret,
      redirect_uri: REDIRECT_URI,
      code,
    }).toString()

    const req = https.request(
      {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk: string) => { raw += chunk })
        res.on('end', () => {
          try {
            const json = JSON.parse(raw)
            if (json.access_token) {
              resolve({ access_token: json.access_token, refresh_token: json.refresh_token ?? '' })
            } else {
              reject(new Error(json.error_description || json.error || 'Token exchange failed'))
            }
          } catch {
            reject(new Error('Ogiltigt svar från Google'))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function startCallbackServer(timeoutMs = 120000): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost:9999')
      if (url.pathname !== '/callback') {
        res.writeHead(404); res.end(); return
      }

      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      const ok = `<html><body style="font-family:sans-serif;background:#121212;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px"><h2 style="margin:0">✓ Google ansluten!</h2><p style="color:#6b7280;margin:0">Du kan stänga detta fönster och återgå till OpenCRM.</p></body></html>`
      const fail = (msg: string) => `<html><body style="font-family:sans-serif;background:#121212;color:#f87171;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h2>${msg}</h2></body></html>`

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })

      if (code) {
        res.end(ok)
        server.close()
        resolve(code)
      } else {
        res.end(fail(error ?? 'Okänt fel från Google'))
        server.close()
        reject(new Error(error ?? 'OAuth error'))
      }
    })

    server.listen(9999, '127.0.0.1')
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error('Port 9999 är upptagen. Stäng andra program och försök igen.'))
      } else {
        reject(err)
      }
    })

    const timer = setTimeout(() => {
      server.close()
      reject(new Error('Timeout — inget svar från Google inom 2 minuter'))
    }, timeoutMs)

    server.on('close', () => clearTimeout(timer))
  })
}

export function registerGoogleHandlers(): void {
  ipcMain.handle('google:connect', async () => {
    const row = await getRow()
    if (!row) throw new Error('Inställningar saknas')

    const client_id = row.google_client_id?.trim() || ''
    const client_secret = row.google_client_secret?.trim() || ''

    if (!client_id || !client_secret) {
      throw new Error('Fyll i Client ID och Client Secret innan du ansluter')
    }

    const params = new URLSearchParams({
      client_id,
      redirect_uri: REDIRECT_URI,
      scope: SCOPES.join(' '),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`

    const callbackPromise = startCallbackServer()
    await shell.openExternal(authUrl)

    const code = await callbackPromise
    const { access_token, refresh_token } = await exchangeCode(code, client_id, client_secret)
    await saveTokens(access_token, refresh_token)

    return { ok: true, access_token, refresh_token }
  })

  ipcMain.handle('google:disconnect', async () => {
    const row = await getRow()
    if (!row) return
    await supabase
      .from('app_installningar')
      .update({ google_access_token: '', google_refresh_token: '' })
      .eq('id', row.id)
  })
}
