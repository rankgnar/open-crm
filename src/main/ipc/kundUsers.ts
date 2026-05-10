import { ipcMain } from 'electron'
import { supabase } from '../supabase'
import { readDbConfig } from '../config-store'

const CHANNELS = [
  'db:kund_users:list-by-kund',
  'db:kund_users:list-all',
  'db:kund_users:invite',
  'db:kund_users:send-password-reset',
  'db:kund_users:revoke',
  'db:kund_portal_invite_queue:list-recent',
  'db:kund_portal_invite_queue:purge-finished',
] as const

interface QueueRow {
  id: string
  kund_id: string
  source_lank_id: string | null
  created_at: string
  processed_at: string | null
  error: string | null
}

type KundUserAction = 'invite' | 'recovery'

export interface KundUserRow {
  id: string
  auth_user_id: string
  kund_id: string
  email: string | null
  invited_at: string
  accepted_at: string | null
  skapad_at: string
}

function clientAppUrl(): string {
  const fromConfig = readDbConfig().client_app_url?.trim()
  if (fromConfig) return fromConfig.replace(/\/+$/, '')
  const fromEnv = process.env.OPEN_CRM_CLIENT_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  throw new Error('Kundportalens URL är inte konfigurerad. Sätt den i Avancerat → DataBase, eller via env-variabeln OPEN_CRM_CLIENT_APP_URL.')
}

function injectVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

export function registerKundUsersHandlers(): void {
  for (const ch of CHANNELS) ipcMain.removeHandler(ch)

  ipcMain.handle('db:kund_users:list-by-kund', async (_, kund_id: string) => {
    const { data, error } = await supabase
      .from('kund_users')
      .select('*')
      .eq('kund_id', kund_id)
      .order('invited_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as KundUserRow[]
  })

  ipcMain.handle('db:kund_users:list-all', async () => {
    const { data, error } = await supabase
      .from('kund_users')
      .select('id, auth_user_id, kund_id, email, invited_at, accepted_at, kunder:kund_id (namn, kundnummer)')
      .order('invited_at', { ascending: false })
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as Array<KundUserRow & { kunder: { namn: string; kundnummer: string | null } | { namn: string; kundnummer: string | null }[] | null }>).map((r) => {
      const k = Array.isArray(r.kunder) ? r.kunder[0] : r.kunder
      return {
        id: r.id,
        auth_user_id: r.auth_user_id,
        kund_id: r.kund_id,
        email: r.email,
        invited_at: r.invited_at,
        accepted_at: r.accepted_at,
        kund_namn: k?.namn ?? null,
        kund_nummer: k?.kundnummer ?? null,
      }
    })
  })

  ipcMain.handle('db:kund_users:revoke', async (_, kund_id: string) => {
    return revokeKundPortalAccess(kund_id)
  })

  ipcMain.handle('db:kund_users:invite', async (_, kund_id: string) => {
    return queueKundUserAuthEmail(kund_id, 'invite')
  })

  ipcMain.handle('db:kund_users:send-password-reset', async (_, kund_id: string) => {
    return queueKundUserAuthEmail(kund_id, 'recovery')
  })

  ipcMain.handle('db:kund_portal_invite_queue:purge-finished', async () => {
    const { error, count } = await supabase
      .from('kund_portal_invite_queue')
      .delete({ count: 'exact' })
      .not('processed_at', 'is', null)
    if (error) throw new Error(error.message)
    return { deleted: count ?? 0 }
  })

  ipcMain.handle('db:kund_portal_invite_queue:list-recent', async () => {
    const { data, error } = await supabase
      .from('kund_portal_invite_queue')
      .select('id, kund_id, source_lank_id, created_at, processed_at, error, kunder:kund_id (namn)')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as Array<QueueRow & { kunder: { namn: string } | { namn: string }[] | null }>).map((r) => {
      const k = Array.isArray(r.kunder) ? r.kunder[0] : r.kunder
      return {
        id: r.id,
        kund_id: r.kund_id,
        source_lank_id: r.source_lank_id,
        created_at: r.created_at,
        processed_at: r.processed_at,
        error: r.error,
        kund_namn: k?.namn,
      }
    })
  })
}

/**
 * Pulls pending rows from kund_portal_invite_queue and runs the manual
 * invite flow for each. Runs the toggle check itself so callers (the
 * setInterval in main/index) don't need to remember it. Best-effort:
 * a single failure doesn't block the rest of the batch.
 */
export async function processKundPortalInviteQueue(): Promise<void> {
  const { data: cfg } = await supabase
    .from('app_installningar')
    .select('kund_portal_auto_invite')
    .limit(1)
    .maybeSingle()
  const enabled = (cfg as { kund_portal_auto_invite: boolean | null } | null)?.kund_portal_auto_invite
  if (enabled !== true) return

  const { data: pending, error } = await supabase
    .from('kund_portal_invite_queue')
    .select('id, kund_id')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(20)
  if (error) return

  for (const row of (pending ?? []) as Array<{ id: string; kund_id: string }>) {
    try {
      await queueKundUserAuthEmail(row.kund_id, 'invite')
      await supabase
        .from('kund_portal_invite_queue')
        .update({ processed_at: new Date().toISOString(), error: null })
        .eq('id', row.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'okänt fel'
      await supabase
        .from('kund_portal_invite_queue')
        .update({ processed_at: new Date().toISOString(), error: msg })
        .eq('id', row.id)
    }
  }
}

export async function queueKundUserAuthEmail(
  kund_id: string,
  action: KundUserAction
): Promise<{ status: 'queued'; user_id: string }> {
  const { data: kData, error: kErr } = await supabase
    .from('kunder')
    .select('id, namn, email')
    .eq('id', kund_id)
    .single()
  if (kErr) throw new Error(kErr.message)

  const kund = kData as { id: string; namn: string; email: string | null }
  const email = kund.email?.trim()
  if (!email) throw new Error('Kunden saknar e-postadress')

  // Look up any existing kund_users row for this kund (we'll reuse its
  // auth_user_id if present so re-sending is idempotent).
  const { data: existingRow } = await supabase
    .from('kund_users')
    .select('id, auth_user_id, email')
    .eq('kund_id', kund_id)
    .maybeSingle()
  const existing = existingRow as { id: string; auth_user_id: string; email: string | null } | null
  let existingAuthUserId = existing?.auth_user_id ?? null

  // If the kund's email has changed since the last invite, the stored
  // auth.users row is tied to the OLD address. Reusing it would force
  // generateLink() into recovery mode against the new address — the link
  // works but lands the customer on a recovery flow instead of the welcome
  // "create password" flow. Wipe the stale row + orphaned auth user so the
  // next invite is a clean signup.
  if (existing && (existing.email ?? '').toLowerCase() !== email.toLowerCase()) {
    await supabase.from('kund_users').delete().eq('id', existing.id)
    await deleteAuthUserIfOrphan(existing.auth_user_id)
    existingAuthUserId = null
  }

  // Re-sending an invite to a user that already has an auth account would
  // fail with "already registered" — fall back to recovery so the welcome
  // template still works.
  let linkType: KundUserAction = action
  if (action === 'invite' && existingAuthUserId) linkType = 'recovery'

  // The portal lives under a locale prefix (next-intl, defaultLocale=sv).
  // Both invite and recovery land on the same /set-password page — the
  // form there handles either auth event.
  const redirectTo = `${clientAppUrl()}/sv/set-password`

  let { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: linkType,
    email,
    options: { redirectTo }
  })

  // The email may already exist in auth.users (same address used by another
  // kund or a residual auth row). Recover by switching to 'recovery'.
  if (linkErr && /already.*registered|already exists/i.test(linkErr.message) && linkType === 'invite') {
    linkType = 'recovery'
    const retry = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo }
    })
    linkData = retry.data
    linkErr = retry.error
  }

  if (linkErr) throw new Error(linkErr.message)

  const action_link =
    (linkData as { properties?: { action_link?: string } } | null)?.properties?.action_link
  const auth_user_id =
    (linkData as { user?: { id?: string } } | null)?.user?.id ?? existingAuthUserId
  if (!action_link) throw new Error('Kunde inte generera inloggningslänk')
  if (!auth_user_id) throw new Error('Kunde inte koppla auth-användare till kunden')

  // Upsert kund_users membership: one row per (auth_user_id, kund_id).
  // Update invited_at on every send so the admin sees the latest invite time.
  const { error: upsertErr } = await supabase
    .from('kund_users')
    .upsert(
      {
        auth_user_id,
        kund_id,
        email,
        invited_at: new Date().toISOString(),
      },
      { onConflict: 'auth_user_id,kund_id' }
    )
  if (upsertErr) throw new Error(upsertErr.message)

  const system_kod =
    action === 'invite'
      ? 'kund_klientportal_valkommen'
      : 'kund_klientportal_losenord_aterstall'

  const { data: mallData, error: mallErr } = await supabase
    .from('epost_mallar')
    .select('amne, kropp_html, alias_id')
    .eq('system_kod', system_kod)
    .eq('aktiv', true)
    .maybeSingle()
  if (mallErr) throw new Error(mallErr.message)
  if (!mallData) {
    throw new Error(`Mallen '${system_kod}' saknas. Kontrollera Inställningar → E-post mallar.`)
  }
  const mall = mallData as { amne: string; kropp_html: string; alias_id: string | null }

  let alias_id = mall.alias_id
  if (!alias_id) {
    const { data: aliasData } = await supabase
      .from('epost_alias')
      .select('id')
      .eq('aktiv', true)
      .order('standard', { ascending: false, nullsFirst: false })
      .order('sortering', { ascending: true })
      .limit(1)
      .maybeSingle()
    alias_id = (aliasData as { id: string } | null)?.id ?? null
  }

  let alias_signatur = ''
  if (alias_id) {
    const { data: sigData } = await supabase
      .from('epost_alias')
      .select('signatur_html')
      .eq('id', alias_id)
      .maybeSingle()
    alias_signatur = (sigData as { signatur_html: string | null } | null)?.signatur_html ?? ''
  }

  const { data: foretag } = await supabase
    .from('app_installningar')
    .select('foretag_namn')
    .limit(1)
    .maybeSingle()
  const foretag_namn = (foretag as { foretag_namn: string | null } | null)?.foretag_namn ?? ''

  const vars: Record<string, string> = {
    kund_namn: kund.namn,
    kund_email: email,
    foretag_namn,
    action_link,
    alias_signatur,
  }

  const { error: insErr } = await supabase.from('epost_ko').insert({
    alias_id,
    till: email,
    amne: injectVars(mall.amne, vars),
    kropp_html: injectVars(mall.kropp_html, vars),
    kund_id,
    schemalagd_till: new Date().toISOString(),
    status: 'väntar',
  })
  if (insErr) throw new Error(insErr.message)

  return { status: 'queued', user_id: auth_user_id }
}

/**
 * Wipe all klientportal traces for a single kund:
 *  - delete kund_users rows for the kund (collect their auth_user_ids);
 *  - delete kund_portal_invite_queue rows for the kund;
 *  - delete each auth.users row that no longer has any kund_users
 *    membership (preserves accounts shared across multiple kunder).
 *
 * Idempotent: running twice on the same kund returns counts of 0.
 */
export async function revokeKundPortalAccess(kund_id: string): Promise<{
  removed_memberships: number
  removed_auth_users: number
  removed_queue_rows: number
}> {
  const { data: members, error: selErr } = await supabase
    .from('kund_users')
    .select('id, auth_user_id')
    .eq('kund_id', kund_id)
  if (selErr) throw new Error(selErr.message)
  const memberRows = (members ?? []) as Array<{ id: string; auth_user_id: string }>

  const { error: delMembersErr } = await supabase
    .from('kund_users')
    .delete()
    .eq('kund_id', kund_id)
  if (delMembersErr) throw new Error(delMembersErr.message)

  const { count: queueDeleted, error: delQueueErr } = await supabase
    .from('kund_portal_invite_queue')
    .delete({ count: 'exact' })
    .eq('kund_id', kund_id)
  if (delQueueErr) throw new Error(delQueueErr.message)

  let removedAuthUsers = 0
  const seenAuthIds = new Set<string>()
  for (const m of memberRows) {
    if (seenAuthIds.has(m.auth_user_id)) continue
    seenAuthIds.add(m.auth_user_id)
    if (await deleteAuthUserIfOrphan(m.auth_user_id)) removedAuthUsers += 1
  }

  return {
    removed_memberships: memberRows.length,
    removed_auth_users: removedAuthUsers,
    removed_queue_rows: queueDeleted ?? 0,
  }
}

/**
 * Delete an auth.users row only when no kund_users membership still
 * references it. Returns true on actual deletion. Best-effort: errors
 * from auth admin are swallowed (caller treats it as "not removed").
 */
async function deleteAuthUserIfOrphan(auth_user_id: string): Promise<boolean> {
  const { count } = await supabase
    .from('kund_users')
    .select('id', { count: 'exact', head: true })
    .eq('auth_user_id', auth_user_id)
  if ((count ?? 0) > 0) return false
  const { error } = await supabase.auth.admin.deleteUser(auth_user_id)
  return !error
}
