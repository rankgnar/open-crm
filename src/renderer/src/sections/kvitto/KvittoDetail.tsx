import { useEffect, useState } from 'react'
import { ArrowLeft, Trash2, Check, RotateCcw, ExternalLink, FileText, Pencil } from 'lucide-react'
import type { Kvitto, KvittoListItem, KvittoKategori, UpdateKvittoInput } from './types'
import { KVITTO_KATEGORIER } from './types'
import { KvittoStatusBadge } from './KvittoStatusBadge'
import { useAppConfig } from '@/context/AppConfig'
import type { ProjektWithKund } from '@/sections/projekt/types'

interface Props {
  kvitto: KvittoListItem
  projekt: ProjektWithKund[]
  onBack: () => void
  onUpdate: (id: string, patch: UpdateKvittoInput) => Promise<Kvitto>
  onSetStatus: (id: string, status: 'att_hantera' | 'hanterade') => Promise<void>
  onDelete: (id: string, storagePath: string) => Promise<void>
}

export function KvittoDetail({ kvitto, projekt, onBack, onUpdate, onSetStatus, onDelete }: Props) {
  const { formatCurrency } = useAppConfig()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [datum, setDatum] = useState(kvitto.datum)
  const [leverantor, setLeverantor] = useState(kvitto.leverantor ?? '')
  const [belopp, setBelopp] = useState(kvitto.belopp != null ? String(kvitto.belopp) : '')
  const [moms, setMoms] = useState(kvitto.moms !== null ? String(kvitto.moms) : '')
  const [kategori, setKategori] = useState<KvittoKategori | ''>(kvitto.kategori ?? '')
  const [projektId, setProjektId] = useState<string>(kvitto.projekt_id ?? '')
  const [beskrivning, setBeskrivning] = useState(kvitto.beskrivning ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    setDatum(kvitto.datum)
    setLeverantor(kvitto.leverantor ?? '')
    setBelopp(kvitto.belopp != null ? String(kvitto.belopp) : '')
    setMoms(kvitto.moms !== null ? String(kvitto.moms) : '')
    setKategori(kvitto.kategori ?? '')
    setProjektId(kvitto.projekt_id ?? '')
    setBeskrivning(kvitto.beskrivning ?? '')
  }, [kvitto.id, kvitto.datum, kvitto.leverantor, kvitto.belopp, kvitto.moms, kvitto.kategori, kvitto.projekt_id, kvitto.beskrivning])

  useEffect(() => {
    if (!kvitto.mime_type.startsWith('image/')) {
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const url = await window.api.invoke('db:kvitto:signed-url', { storagePath: kvitto.fil_storage_path, ttl: 3600 }) as string | null
        if (!cancelled) setPreviewUrl(url)
      } catch {
        if (!cancelled) setPreviewUrl(null)
      }
    })()
    return () => { cancelled = true }
  }, [kvitto.id, kvitto.fil_storage_path, kvitto.mime_type])

  function kategoriLabel(value: string | null): string {
    if (!value) return '—'
    return KVITTO_KATEGORIER.find((k) => k.value === value)?.label ?? value
  }

  function projektLabel(): string {
    if (!kvitto.projekt_id) return 'Allmän kostnad'
    if (kvitto.projekt_nummer && kvitto.projekt_titel) return `${kvitto.projekt_nummer} — ${kvitto.projekt_titel}`
    return '—'
  }

  async function handleOpenFile() {
    await window.api.invoke('db:kvitto:open', kvitto.fil_storage_path)
  }

  async function handleToggleStatus() {
    const next = kvitto.status === 'att_hantera' ? 'hanterade' : 'att_hantera'
    setBusy(true)
    try {
      await onSetStatus(kvitto.id, next)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await onDelete(kvitto.id, kvitto.fil_storage_path)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEdit() {
    setError('')
    const beloppTrim = belopp.trim()
    let beloppValue: number | null = null
    if (beloppTrim !== '') {
      const n = parseFloat(beloppTrim.replace(',', '.'))
      if (isNaN(n) || n < 0) { setError('Ange ett giltigt belopp eller lämna fältet tomt.'); return }
      beloppValue = n
    }
    const momsTrim = moms.trim()
    let momsValue: number | null = null
    if (momsTrim !== '') {
      const n = parseFloat(momsTrim.replace(',', '.'))
      if (isNaN(n)) { setError('Ange ett giltigt momsbelopp.'); return }
      momsValue = n
    }
    setBusy(true)
    try {
      await onUpdate(kvitto.id, {
        datum,
        leverantor: leverantor.trim() === '' ? null : leverantor.trim(),
        belopp: beloppValue,
        moms: momsValue,
        kategori: kategori === '' ? null : kategori,
        projekt_id: projektId === '' ? null : projektId,
        beskrivning: beskrivning.trim() === '' ? null : beskrivning.trim(),
      })
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-muted hover:text-fg transition-colors" title="Tillbaka">
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs text-subtle">Kvitto</span>
          <span className="text-xs text-muted">/</span>
          <span className={`text-sm font-medium ${kvitto.leverantor ? 'text-fg' : 'text-amber-400 italic'}`}>{kvitto.leverantor ?? 'Saknar info'}</span>
          <KvittoStatusBadge status={kvitto.status} />
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <>
              <button
                onClick={handleToggleStatus}
                disabled={busy}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 ${kvitto.status === 'att_hantera' ? 'text-muted hover:text-emerald-400' : 'text-muted hover:text-fg'}`}
              >
                {kvitto.status === 'att_hantera' ? <><Check size={11} />Markera som hanterad</> : <><RotateCcw size={11} />Ångra hantering</>}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
              >
                <Pencil size={11} />Redigera
              </button>
              {confirmDelete ? (
                <>
                  <button
                    onClick={handleDelete}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                  >
                    Ja, ta bort
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
                  >
                    Avbryt
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={11} />Ta bort
                </button>
              )}
            </>
          )}
          {editing && (
            <>
              <button
                onClick={() => { setEditing(false); setError('') }}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-emerald-400 transition-colors disabled:opacity-40"
              >
                Spara
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: details */}
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted">{kvitto.datum}</p>
            <h2 className={`text-xl font-semibold mt-1 ${kvitto.leverantor ? 'text-fg' : 'text-amber-400 italic'}`}>
              {kvitto.leverantor ?? 'Saknar info'}
            </h2>
            <p className={`text-2xl font-mono font-semibold mt-3 ${kvitto.belopp != null ? 'text-fg' : 'text-subtle'}`}>
              {kvitto.belopp != null ? formatCurrency(kvitto.belopp) : '— SEK'}
            </p>
          </div>

          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Detaljer</p>
            {!editing ? (
              <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                <Field label="Datum" value={kvitto.datum} mono />
                <Field label="Leverantör" value={kvitto.leverantor ?? '—'} />
                <Field label="Kategori" value={kategoriLabel(kvitto.kategori)} />
                <Field label="Belopp" value={kvitto.belopp != null ? formatCurrency(kvitto.belopp) : '—'} mono />
                <Field label="Moms" value={kvitto.moms !== null ? formatCurrency(kvitto.moms) : '—'} mono />
                <Field label="Projekt" value={projektLabel()} />
                <div className="col-span-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted mb-1.5">Beskrivning</p>
                  <p className="text-sm text-fg whitespace-pre-wrap">{kvitto.beskrivning ?? '—'}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                <EditField label="Datum" type="date" value={datum} onChange={setDatum} />
                <EditField label="Leverantör" value={leverantor} onChange={setLeverantor} />
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">Kategori</label>
                  <select
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value as KvittoKategori | '')}
                    className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-fg"
                  >
                    <option value="">—</option>
                    {KVITTO_KATEGORIER.map((k) => (
                      <option key={k.value} value={k.value}>{k.label}</option>
                    ))}
                  </select>
                </div>
                <EditField label="Belopp" value={belopp} onChange={setBelopp} mono />
                <EditField label="Moms" value={moms} onChange={setMoms} mono />
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">Projekt</label>
                  <select
                    value={projektId}
                    onChange={(e) => setProjektId(e.target.value)}
                    className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-fg"
                  >
                    <option value="">— Allmän kostnad —</option>
                    {projekt.map((p) => (
                      <option key={p.id} value={p.id}>{p.projekt_nummer} — {p.namn}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">Beskrivning</label>
                  <textarea
                    value={beskrivning}
                    onChange={(e) => setBeskrivning(e.target.value)}
                    rows={3}
                    className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-fg resize-none"
                  />
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
          </div>

          <div className="px-8 py-4 mt-auto border-t border-border flex items-center gap-6">
            <span className="text-xs text-subtle">
              Skapad: <span className="text-muted">{kvitto.skapad_at.slice(0, 16).replace('T', ' ')}</span>
            </span>
            {kvitto.uppdaterad_at !== kvitto.skapad_at && (
              <span className="text-xs text-subtle">
                Uppdaterad: <span className="text-muted">{kvitto.uppdaterad_at.slice(0, 16).replace('T', ' ')}</span>
              </span>
            )}
            {kvitto.fortnox_voucher_id && (
              <span className="text-xs text-subtle">
                Fortnox voucher: <span className="text-muted font-mono">{kvitto.fortnox_voucher_id}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: file preview */}
        <div className="w-[420px] border-l border-border flex flex-col shrink-0 bg-elevated/30">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted">Bilaga</p>
            <button
              onClick={handleOpenFile}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors"
              title="Öppna i extern app"
            >
              <ExternalLink size={11} />Öppna
            </button>
          </div>
          <div className="flex-1 overflow-auto p-5">
            {previewUrl ? (
              <img src={previewUrl} alt={kvitto.fil_namn} className="w-full rounded border border-border" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted gap-2">
                <FileText size={48} className="text-subtle" />
                <p className="text-sm text-fg">{kvitto.fil_namn}</p>
                <p className="text-[11px] text-subtle">{(kvitto.storlek / 1024).toFixed(1)} KB</p>
                <button
                  onClick={handleOpenFile}
                  className="mt-3 flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-fg hover:bg-hover transition-colors"
                >
                  <ExternalLink size={12} />Öppna fil
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted mb-1.5">{label}</p>
      <p className={`text-sm text-fg ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function EditField({ label, value, onChange, type = 'text', mono = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; mono?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-fg ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}
