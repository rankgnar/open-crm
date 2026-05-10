import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAppConfig } from '@/context/AppConfig'

interface KundUserRow {
  id: string
  auth_user_id: string
  kund_id: string
  email: string | null
  invited_at: string
  accepted_at: string | null
  kund_namn: string | null
  kund_nummer: string | null
}

interface QueueRow {
  id: string
  kund_id: string
  source_lank_id: string | null
  created_at: string
  processed_at: string | null
  error: string | null
  kund_namn?: string
}

export function KlientportalSection() {
  const { config, updateConfig } = useAppConfig()
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [members, setMembers] = useState<KundUserRow[] | null>(null)
  const [queue, setQueue] = useState<QueueRow[] | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [purging, setPurging] = useState(false)

  const enabled = config?.kund_portal_auto_invite ?? false

  useEffect(() => { void loadAll() }, [])

  async function loadAll() {
    const [m, q] = await Promise.allSettled([
      window.api.invoke('db:kund_users:list-all') as Promise<KundUserRow[]>,
      window.api.invoke('db:kund_portal_invite_queue:list-recent') as Promise<QueueRow[]>,
    ])
    setMembers(m.status === 'fulfilled' ? m.value : [])
    setQueue(q.status === 'fulfilled' ? q.value : [])
  }

  async function toggle() {
    setSaving(true)
    try {
      await updateConfig({ kund_portal_auto_invite: !enabled } as never)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1800)
    } finally {
      setSaving(false)
    }
  }

  async function revoke(kund_id: string) {
    setBusy(kund_id)
    try {
      await window.api.invoke('db:kund_users:revoke', kund_id)
      setConfirmRevoke(null)
      await loadAll()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Kunde inte återkalla åtkomst')
    } finally {
      setBusy(null)
    }
  }

  async function purgeFinished() {
    setPurging(true)
    try {
      await window.api.invoke('db:kund_portal_invite_queue:purge-finished')
      await loadAll()
    } finally {
      setPurging(false)
    }
  }

  return (
    <>
      <div className="px-8 py-6 border-b border-border">
        <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Klientportal — automatisk inbjudan</p>

        <div className="flex items-start gap-4 max-w-2xl">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={toggle}
            disabled={saving}
            className={`relative shrink-0 h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-emerald-400' : 'bg-border'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-bg shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
          <div className="flex-1">
            <p className="text-sm text-fg">
              Skicka <span className="font-medium">Välkomstinbjudan klientportal</span> automatiskt när en kund signerar en offert
              {savedFlash && <span className="ml-2 size-1.5 inline-block rounded-full bg-emerald-400 align-middle" />}
            </p>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              Om <span className="text-fg">på</span>: när kunden signerar en <span className="text-fg">offert</span>, läggs en rad i kön nedan och Electron-appen skapar auth-användaren och skickar välkomstmailet inom en minut.
              {' '}
              Bekräftelsemailet (<span className="text-fg">Förslag — Bekräftelse</span>) skickas alltid, oberoende av denna inställning.
            </p>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              Om <span className="text-fg">av</span> (standard): inget händer automatiskt. Skicka inbjudan manuellt från <span className="text-fg">Kunder → Kund → Klientportal</span>.
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] uppercase tracking-widest text-muted">Aktiva åtkomster</p>
          <button onClick={loadAll} className="text-[11px] text-muted hover:text-fg transition-colors">
            Uppdatera
          </button>
        </div>

        {members === null ? (
          <p className="text-xs text-subtle">Laddar…</p>
        ) : members.length === 0 ? (
          <p className="text-xs text-subtle">Ingen kund har klientportal-åtkomst ännu.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-elevated text-muted">
                  <th className="px-3 py-2 text-left font-medium">Kund</th>
                  <th className="px-3 py-2 text-left font-medium">E-post</th>
                  <th className="px-3 py-2 text-left font-medium">Inbjudan</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 w-px"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2 text-fg">
                      {m.kund_namn ?? m.kund_id.slice(0, 8)}
                      {m.kund_nummer && <span className="ml-1.5 text-subtle font-mono">{m.kund_nummer}</span>}
                    </td>
                    <td className="px-3 py-2 text-muted">{m.email ?? '—'}</td>
                    <td className="px-3 py-2 text-muted">{new Date(m.invited_at).toLocaleString('sv-SE')}</td>
                    <td className="px-3 py-2">
                      {m.accepted_at ? (
                        <span className="text-emerald-400">Aktiverad {new Date(m.accepted_at).toLocaleString('sv-SE')}</span>
                      ) : (
                        <span className="text-amber-400">Väntar</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {confirmRevoke === m.kund_id ? (
                        <span className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => revoke(m.kund_id)}
                            disabled={busy === m.kund_id}
                            className="text-red-400 hover:text-red-300 disabled:opacity-40 font-medium"
                          >
                            {busy === m.kund_id ? '...' : 'Återkalla'}
                          </button>
                          <button
                            onClick={() => setConfirmRevoke(null)}
                            className="text-muted hover:text-fg"
                          >
                            Avbryt
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmRevoke(m.kund_id)}
                          className="text-muted hover:text-red-400 transition-colors"
                          title="Återkalla åtkomst (raderar kund_user, auth-konto om det inte används av annan kund och köposter)"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] uppercase tracking-widest text-muted">Senaste i kön</p>
          <div className="flex items-center gap-3">
            {queue && queue.some((r) => r.processed_at) && (
              <button
                onClick={purgeFinished}
                disabled={purging}
                className="text-[11px] text-muted hover:text-red-400 transition-colors disabled:opacity-40"
              >
                {purging ? 'Rensar…' : 'Rensa avslutade'}
              </button>
            )}
            <button onClick={loadAll} className="text-[11px] text-muted hover:text-fg transition-colors">
              Uppdatera
            </button>
          </div>
        </div>

        {queue === null ? (
          <p className="text-xs text-subtle">Laddar…</p>
        ) : queue.length === 0 ? (
          <p className="text-xs text-subtle">Kön är tom.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-elevated text-muted">
                  <th className="px-3 py-2 text-left font-medium">Kund</th>
                  <th className="px-3 py-2 text-left font-medium">Skapad</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 text-fg">{row.kund_namn ?? row.kund_id.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-muted">{new Date(row.created_at).toLocaleString('sv-SE')}</td>
                    <td className="px-3 py-2">
                      {row.processed_at && !row.error ? (
                        <span className="text-emerald-400">Skickad {new Date(row.processed_at).toLocaleString('sv-SE')}</span>
                      ) : row.error ? (
                        <span className="text-red-400" title={row.error}>Fel — {row.error.slice(0, 60)}</span>
                      ) : (
                        <span className="text-amber-400">Väntar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
