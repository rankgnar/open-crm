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

export function KlientportalSection() {
  const { config, updateConfig } = useAppConfig()
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [members, setMembers] = useState<KundUserRow[] | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const enabled = config?.kund_portal_auto_invite ?? false

  useEffect(() => { void loadMembers() }, [])

  async function loadMembers() {
    try {
      const rows = await window.api.invoke('db:kund_users:list-all') as KundUserRow[]
      setMembers(rows)
    } catch {
      setMembers([])
    }
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
      await loadMembers()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Kunde inte återkalla åtkomst')
    } finally {
      setBusy(null)
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
              Om <span className="text-fg">av</span> (standard): inget händer automatiskt. Skicka inbjudan manuellt från <span className="text-fg">Kunder → Kund → Klientportal</span>.
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] uppercase tracking-widest text-muted">Portalanvändare</p>
          <button onClick={loadMembers} className="text-[11px] text-muted hover:text-fg transition-colors">
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
                    <td className="px-3 py-2 text-muted">{new Date(m.invited_at).toLocaleDateString('sv-SE')}</td>
                    <td className="px-3 py-2">
                      {m.accepted_at ? (
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-400" />
                          Aktiv sedan {new Date(m.accepted_at).toLocaleDateString('sv-SE')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-400">
                          <span className="size-1.5 rounded-full bg-amber-400" />
                          Inbjudan skickad
                        </span>
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
                          title="Återkalla åtkomst"
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
    </>
  )
}
