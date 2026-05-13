import { useEffect, useState, useCallback } from 'react'
import { Copy, Check, RefreshCw, XCircle, Send, Trash2 } from 'lucide-react'
import type { DokumentTyp, SignaturLank } from './types'
import { lankStatus } from './types'

interface Props {
  dokument_typ: DokumentTyp
  dokument_id:  string
  refreshKey?:  number
}

const STATUS_COLOR: Record<string, string> = {
  'väntar':         'text-amber-400',
  'öppnad':         'text-blue-400',
  'ändring begärd': 'text-amber-400',
  'signerad':       'text-emerald-400',
  'utgången':       'text-muted',
  'återkallad':     'text-red-400',
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

export function SignaturLankarPanel({ dokument_typ, dokument_id, refreshKey }: Props) {
  const [lankar, setLankar] = useState<SignaturLank[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [webBase, setWebBase] = useState<string>('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.api.invoke('db:signatur-lank:list-for-doc', dokument_typ, dokument_id) as SignaturLank[]
      setLankar(data)
    } finally {
      setLoading(false)
    }
  }, [dokument_typ, dokument_id])

  useEffect(() => {
    void (async () => {
      const cfg = await window.api.invoke('config:db:get') as { web_app_url?: string }
      setWebBase((cfg.web_app_url || '').replace(/\/+$/, ''))
    })()
  }, [])

  useEffect(() => { void reload() }, [reload, refreshKey])

  function urlFor(token: string): string {
    return webBase ? `${webBase}/?t=${encodeURIComponent(token)}` : `?t=${token}`
  }

  async function handleCopy(l: SignaturLank) {
    await navigator.clipboard.writeText(urlFor(l.token))
    setCopiedId(l.id)
    setTimeout(() => setCopiedId(c => c === l.id ? null : c), 1500)
  }

  async function handleResend(l: SignaturLank) {
    setBusyId(l.id)
    try {
      await window.api.invoke('db:signatur-lank:resend', l.id, {})
      await reload()
    } finally {
      setBusyId(null)
    }
  }

  async function handleRevoke(l: SignaturLank) {
    if (!confirm(`Återkalla länken till ${l.kund_email}?`)) return
    setBusyId(l.id)
    try {
      await window.api.invoke('db:signatur-lank:revoke', l.id)
      await reload()
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(l: SignaturLank) {
    const msg = l.signerad_at
      ? `Ta bort länken permanent? Detta tar även bort signaturen från dokumentet och återställer det till utkast.`
      : `Ta bort länken till ${l.kund_email} permanent?`
    if (!confirm(msg)) return
    setBusyId(l.id)
    try {
      await window.api.invoke('db:signatur-lank:delete', l.id)
      await reload()
    } finally {
      setBusyId(null)
    }
  }

  if (loading && lankar.length === 0) return <p className="text-xs text-muted px-4 py-3">Laddar länkar…</p>
  if (lankar.length === 0) return <p className="text-xs text-muted px-4 py-3">Inga länkar skapade än.</p>

  return (
    <div className="flex flex-col">
      {lankar.map((l) => {
        const st = lankStatus(l)
        return (
          <div key={l.id} className="px-4 py-3 border-b border-border last:border-b-0 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[11px] uppercase tracking-wider font-semibold ${STATUS_COLOR[st]}`}>
                  {st}
                </span>
                <span className="text-sm text-fg truncate">{l.kund_email}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleCopy(l)}
                  title="Kopiera länk"
                  className="text-muted hover:text-fg transition-colors px-1.5 py-1"
                >
                  {copiedId === l.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
                {!l.signerad_at && !l.revoked_at && (
                  <button
                    onClick={() => handleResend(l)}
                    disabled={busyId === l.id}
                    title="Skicka om e-post"
                    className="text-muted hover:text-fg transition-colors px-1.5 py-1 disabled:opacity-30"
                  >
                    <Send size={13} />
                  </button>
                )}
                {!l.signerad_at && !l.revoked_at && (
                  <button
                    onClick={() => handleRevoke(l)}
                    disabled={busyId === l.id}
                    title="Återkalla länken"
                    className="text-muted hover:text-amber-400 transition-colors px-1.5 py-1 disabled:opacity-30"
                  >
                    <XCircle size={13} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(l)}
                  disabled={busyId === l.id}
                  title="Ta bort länken permanent"
                  className="text-muted hover:text-red-400 transition-colors px-1.5 py-1 disabled:opacity-30"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="text-[11px] text-subtle flex flex-wrap gap-x-4 gap-y-0.5">
              <span>Skapad {fmtDate(l.skapad_at)}</span>
              <span>Giltig till {fmtDate(l.gar_ut_at)}</span>
              {l.oppnad_at && (
                <span>
                  Öppnad {fmtDate(l.oppnad_at)}
                  {l.view_count > 1 && ` · visad ${l.view_count} ggr · senast ${fmtDate(l.last_oppnad_at)}`}
                </span>
              )}
              {l.signerad_at && (
                <span className="text-emerald-400">
                  Signerad av {l.signerad_namn} · {fmtDate(l.signerad_at)}
                  {l.signerad_ip && ` · IP ${l.signerad_ip}`}
                </span>
              )}
              {l.revoked_at && <span className="text-red-400">Återkallad {fmtDate(l.revoked_at)}</span>}
            </div>
          </div>
        )
      })}
      <button
        onClick={() => void reload()}
        className="self-end text-[11px] text-muted hover:text-fg flex items-center gap-1 px-4 py-2"
      >
        <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  )
}
