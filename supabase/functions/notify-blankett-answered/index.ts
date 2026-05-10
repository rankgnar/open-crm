import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface Inst {
  id: string
  foretag_namn: string | null
  foretag_email: string | null
  zoho_access_token: string | null
  zoho_refresh_token: string | null
  zoho_client_id: string | null
  zoho_client_secret: string | null
}

interface Alias {
  id: string
  fran_namn: string
  fran_adress: string
  signatur_html: string
}

type SupabaseClient = ReturnType<typeof createClient>

async function refreshToken(inst: Inst, supabase: SupabaseClient): Promise<string> {
  const res = await fetch('https://accounts.zoho.eu/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: inst.zoho_client_id!,
      client_secret: inst.zoho_client_secret!,
      refresh_token: inst.zoho_refresh_token!,
    }).toString(),
  })
  const json = await res.json() as Record<string, string>
  if (!res.ok || json.error) throw new Error('Zoho token refresh failed')
  await supabase.from('app_installningar').update({ zoho_access_token: json.access_token }).eq('id', inst.id)
  return json.access_token
}

async function sendZoho(inst: Inst, alias: Alias, till: string, amne: string, kropp: string, supabase: SupabaseClient): Promise<void> {
  let token = inst.zoho_access_token!

  async function getAccountId(t: string): Promise<string | null> {
    const r = await fetch('https://mail.zoho.eu/api/accounts', {
      headers: { Authorization: `Zoho-oauthtoken ${t}` },
    })
    if (r.status === 401) return null
    const j = await r.json() as { data: { accountId: string }[] }
    return j.data?.[0]?.accountId ?? null
  }

  let accountId = await getAccountId(token)
  if (!accountId) {
    token = await refreshToken(inst, supabase)
    accountId = await getAccountId(token)
  }
  if (!accountId) throw new Error('No Zoho account found')

  const foretag_namn = inst.foretag_namn ?? ''
  const fromNamn = alias.fran_namn?.trim() || foretag_namn.trim() || ''
  const fromAddress = fromNamn
    ? `"${fromNamn.replace(/"/g, '\\"')}" <${alias.fran_adress}>`
    : alias.fran_adress

  const sig = alias.signatur_html
  const body = sig && !kropp.includes(sig) ? `${kropp}<br><br>${sig}` : kropp

  const res = await fetch(`https://mail.zoho.eu/api/accounts/${accountId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fromAddress, toAddress: till, subject: amne, content: body, mailFormat: 'html' }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zoho send ${res.status}: ${text}`)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { token, formulär_url } = await req.json() as { token: string; formulär_url?: string }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Check notification template is enabled
    const { data: mall } = await supabase
      .from('epost_mallar')
      .select('amne, kropp_html, alias_id')
      .eq('system_kod', 'frageblankett_besvarat')
      .eq('aktiv', true)
      .maybeSingle()

    if (!mall) return new Response('Notification template disabled', { status: 200 })

    // Resolve blankett → projekt → kund
    const { data: blankett } = await supabase
      .from('projekt_frageblankett')
      .select('titel, projekt_id')
      .eq('token', token)
      .single()

    if (!blankett) return new Response('Blankett not found', { status: 200 })

    const { data: projekt } = await supabase
      .from('projekt')
      .select('namn, kund_id')
      .eq('id', blankett.projekt_id)
      .single()

    const { data: kund } = await supabase
      .from('kunder')
      .select('namn')
      .eq('id', (projekt as { namn: string; kund_id: string } | null)?.kund_id)
      .maybeSingle()

    // Company settings + Zoho credentials
    const { data: inst } = await supabase
      .from('app_installningar')
      .select('id, foretag_namn, foretag_email, zoho_access_token, zoho_refresh_token, zoho_client_id, zoho_client_secret')
      .maybeSingle()

    const instTyped = inst as Inst | null
    if (!instTyped?.foretag_email || !instTyped?.zoho_access_token) {
      return new Response('Company email or Zoho not configured', { status: 200 })
    }

    // Resolve alias: prefer template alias, fallback to default
    let alias: Alias | null = null
    if ((mall as { alias_id?: string | null }).alias_id) {
      const { data } = await supabase
        .from('epost_alias')
        .select('id, fran_namn, fran_adress, signatur_html')
        .eq('id', (mall as { alias_id: string }).alias_id)
        .single()
      alias = data as Alias | null
    }
    if (!alias) {
      const { data } = await supabase
        .from('epost_alias')
        .select('id, fran_namn, fran_adress, signatur_html')
        .eq('aktiv', true)
        .order('standard', { ascending: false })
        .order('sortering')
        .limit(1)
        .maybeSingle()
      alias = data as Alias | null
    }

    if (!alias) return new Response('No alias configured', { status: 200 })

    // Interpolate template variables
    const vars: Record<string, string> = {
      kund_namn: (kund as { namn: string } | null)?.namn ?? '',
      projekt_namn: (projekt as { namn: string } | null)?.namn ?? '',
      blankett_titel: (blankett as { titel: string }).titel ?? '',
      'formulär_länk': formulär_url ?? '',
      foretag_namn: instTyped.foretag_namn ?? '',
      datum: new Date().toLocaleDateString('sv-SE'),
    }

    const interpolate = (s: string) =>
      s.replace(/\{\{([\wÄÖÅäöå_]+)\}\}/g, (_: string, k: string) => vars[k] ?? '')

    await sendZoho(
      instTyped,
      alias,
      instTyped.foretag_email,
      interpolate((mall as { amne: string }).amne),
      interpolate((mall as { kropp_html: string }).kropp_html),
      supabase,
    )

    // Log to projekt_anteckningar so it appears in the project timeline
    const kundNamn = (kund as { namn: string } | null)?.namn ?? 'Kunden'
    const blanketTitel = (blankett as { titel: string }).titel ?? ''
    await supabase.from('projekt_anteckningar').insert({
      projekt_id: (blankett as { projekt_id: string }).projekt_id,
      titel: `Formulär besvarat: ${blanketTitel}`,
      innehall: `${kundNamn} har besvarat formuläret.`,
      farg: 'emerald',
    })

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-blankett-answered:', err)
    return new Response(String(err), { status: 500 })
  }
})
