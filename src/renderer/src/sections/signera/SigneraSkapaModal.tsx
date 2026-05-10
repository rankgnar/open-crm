import { useEffect, useMemo, useState } from 'react'
import { X, Upload, FileText, Image as ImageIcon } from 'lucide-react'
import type { ProjektWithKund } from '@/sections/projekt/types'
import type { EpostMall } from '@/sections/signatur/types'
import type { CreateSigneraInput, SigneraRow } from './types'

interface Props {
  projekt:           ProjektWithKund[]
  onClose:           () => void
  onCreated:         () => void
  initialProjektId?: string | null
}

interface PickedFile {
  filePath: string
  fileName: string
  mimeType: string
  size:     number
}

interface KundInfo {
  email: string | null
}

const EXPIRY_OPTIONS = [
  { label: '7 dagar', days: 7 },
  { label: '14 dagar', days: 14 },
  { label: '30 dagar', days: 30 },
  { label: '60 dagar', days: 60 },
  { label: 'Ingen utgång', days: 0 },
]

const ACCEPTED_MIME = (m: string): boolean =>
  m === 'application/pdf' || m.startsWith('image/')

function fileIcon(mime: string) {
  if (mime === 'application/pdf') return <FileText size={14} className="text-red-400" />
  if (mime.startsWith('image/'))  return <ImageIcon size={14} className="text-blue-400" />
  return <Upload size={14} className="text-muted" />
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export function SigneraSkapaModal({ projekt, onClose, onCreated, initialProjektId }: Props) {
  const [projektId, setProjektId] = useState<string>(initialProjektId ?? '')
  const [titel, setTitel]         = useState('')
  const [file, setFile]           = useState<PickedFile | null>(null)
  const [email, setEmail]         = useState('')
  const [days, setDays]           = useState(30)
  const [mallar, setMallar]       = useState<EpostMall[]>([])
  const [mallId, setMallId]       = useState<string | null>(null)
  const [meddelande, setMeddelande] = useState('')
  const [autoInviteKundPortal, setAutoInviteKundPortal] = useState(false)
  const [sending, setSending]     = useState(false)
  const [error, setError]         = useState('')

  // Derive default email from projekt's kund
  const selectedProjekt = useMemo(
    () => projekt.find(p => p.id === projektId) ?? null,
    [projekt, projektId]
  )

  useEffect(() => {
    if (!projektId || email.trim()) return
    void (async () => {
      try {
        const k = await window.api.invoke('db:kunder:get', selectedProjekt?.kund_id) as KundInfo | null
        if (k?.email) setEmail(k.email)
      } catch { /* swallow — email is editable */ }
    })()
  }, [projektId, selectedProjekt?.kund_id, email])

  useEffect(() => {
    void (async () => {
      const all = await window.api.invoke('db:epost-mallar:list') as EpostMall[]
      const filtered = (all ?? []).filter(m =>
        m.system_kod === 'signatur_begaran_dokument' ||
        (m.system_kod ?? '').startsWith('signatur_begaran_dokument_')
      )
      setMallar(filtered)
      const def = await window.api.invoke('db:signatur-lank:get-default-mall', 'fritt') as string | null
      setMallId(def ?? filtered[0]?.id ?? null)
    })()
  }, [])

  async function pickFile() {
    setError('')
    const picked = await window.api.invoke('dialog:open-file') as PickedFile | null
    if (!picked) return
    if (!ACCEPTED_MIME(picked.mimeType)) {
      setError(`Filtypen "${picked.mimeType}" stöds ej. Konvertera till PDF eller använd en bild.`)
      return
    }
    setFile(picked)
    if (!titel.trim()) {
      setTitel(picked.fileName.replace(/\.[^.]+$/, ''))
    }
  }

  async function handleSend() {
    setError('')
    if (!projektId)            { setError('Välj projekt'); return }
    if (!titel.trim())         { setError('Ange titel'); return }
    if (!file)                 { setError('Välj fil'); return }
    if (!email.includes('@'))  { setError('Ange giltig e-postadress'); return }
    if (mallar.length === 0)   { setError("Ingen mall med system_kod 'signatur_begaran_dokument' finns. Kontrollera Inställningar → E-post mallar."); return }

    setSending(true)
    try {
      const input: CreateSigneraInput = {
        projekt_id:              projektId,
        titel:                   titel.trim(),
        filnamn:                 file.fileName,
        mime_type:                file.mimeType,
        filePath:                file.filePath,
        storlek:                 file.size,
        kund_email:              email.trim(),
        giltig_dagar:            days,
        meddelande:              meddelande.trim() || undefined,
        mall_id:                 mallId,
        auto_invite_kund_portal: autoInviteKundPortal,
      }
      await window.api.invoke('db:signera:create', input) as SigneraRow
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar">
          <h2 className="text-sm font-medium text-fg">Nytt dokument för signering</h2>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Projekt</label>
            <select
              className="input text-fg w-full"
              value={projektId}
              onChange={(e) => setProjektId(e.target.value)}
            >
              <option value="">— välj projekt —</option>
              {projekt.map(p => (
                <option key={p.id} value={p.id}>
                  {p.projekt_nummer} · {p.namn} ({p.kunder?.namn ?? '—'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Titel</label>
            <input
              type="text"
              className="input"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="T.ex. Avtal om ändringsarbete"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Fil (PDF eller bild)</label>
            {file ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-elevated px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {fileIcon(file.mimeType)}
                  <div className="min-w-0">
                    <p className="text-sm text-fg truncate">{file.fileName}</p>
                    <p className="text-[11px] text-subtle">{fmtSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs text-muted hover:text-red-400 transition-colors"
                >Ta bort</button>
              </div>
            ) : (
              <button
                onClick={pickFile}
                className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-elevated px-3 py-3 text-sm text-muted hover:bg-hover hover:text-fg transition-colors"
              >
                <Upload size={14} />Välj fil
              </button>
            )}
            <p className="text-[11px] text-subtle">PDF eller bild (jpg/png). För Word/Excel — exportera till PDF först.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Kundens e-post</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kund@exempel.se"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">Giltighet</label>
              <select
                className="input text-muted w-full"
                value={String(days)}
                onChange={(e) => setDays(parseInt(e.target.value, 10))}
              >
                {EXPIRY_OPTIONS.map(o => (
                  <option key={o.days} value={o.days}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted">E-post-mall</label>
              <select
                className="input text-muted w-full"
                value={mallId ?? ''}
                onChange={(e) => setMallId(e.target.value || null)}
              >
                {mallar.length === 0 && <option value="">— ingen tillgänglig —</option>}
                {mallar.map(m => (
                  <option key={m.id} value={m.id}>{m.namn}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted">Personligt meddelande (valfritt)</label>
            <textarea
              className="input min-h-[80px] resize-none"
              rows={3}
              value={meddelande}
              onChange={(e) => setMeddelande(e.target.value)}
              placeholder="Skrivs in i e-posten via {{meddelande}}."
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoInviteKundPortal}
              onChange={(e) => setAutoInviteKundPortal(e.target.checked)}
              className="mt-1 accent-emerald-400"
            />
            <span className="text-sm text-fg">
              Bjud in till klientportalen efter signering
              <span className="block text-xs text-muted mt-0.5">
                Kunden får ett välkomstmail med åtkomst till klientportalen så fort dokumentet är signerat.
              </span>
            </span>
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border bg-sidebar">
          <button onClick={onClose} className="text-sm text-muted hover:text-fg transition-colors px-3 py-1.5">
            Avbryt
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="rounded-md bg-emerald-400 text-bg px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {sending ? 'Skickar…' : 'Skicka'}
          </button>
        </div>
      </div>
    </div>
  )
}
