import { useState } from 'react'
import { ArrowLeft, Upload, FileText, Image as ImageIcon, X } from 'lucide-react'
import type { CreateKvittoInput, KvittoKategori } from './types'
import { KVITTO_KATEGORIER } from './types'
import type { ProjektWithKund, FileDialogResult } from '@/sections/projekt/types'
import { SelectField } from '@/components/SelectField'

interface Props {
  projekt: ProjektWithKund[]
  onSubmit: (input: CreateKvittoInput) => Promise<void>
  onCancel: () => void
}

interface UploadedFile {
  fil_storage_path: string
  fil_namn: string
  mime_type: string
  storlek: number
}

export function KvittoForm({ projekt, onSubmit, onCancel }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null)
  const [uploading, setUploading] = useState(false)
  const [datum, setDatum] = useState(today)
  const [leverantor, setLeverantor] = useState('')
  const [belopp, setBelopp] = useState('')
  const [moms, setMoms] = useState('')
  const [kategori, setKategori] = useState<KvittoKategori | ''>('')
  const [projektId, setProjektId] = useState<string>('')
  const [beskrivning, setBeskrivning] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handlePickFile() {
    setError('')
    const file = await window.api.invoke('dialog:open-file') as FileDialogResult | null
    if (!file) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
    if (!allowed.includes(file.mimeType)) {
      setError('Endast PDF, JPG, PNG, HEIC eller WEBP tillåts.')
      return
    }
    setUploading(true)
    try {
      const result = await window.api.invoke('db:kvitto:upload', file) as UploadedFile
      setUploaded(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda upp filen')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!uploaded) {
      setError('Du måste ladda upp en bild eller PDF.')
      return
    }
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
      if (isNaN(n)) { setError('Ange ett giltigt momsbelopp eller lämna fältet tomt.'); return }
      momsValue = n
    }
    setSubmitting(true)
    try {
      await onSubmit({
        datum,
        leverantor: leverantor.trim() === '' ? null : leverantor.trim(),
        belopp: beloppValue,
        moms: momsValue,
        kategori: kategori === '' ? null : kategori,
        projekt_id: projektId === '' ? null : projektId,
        beskrivning: beskrivning.trim() === '' ? null : beskrivning.trim(),
        ...uploaded,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara kvitto')
      setSubmitting(false)
    }
  }

  const isImage = uploaded?.mime_type.startsWith('image/')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="text-muted hover:text-fg transition-colors" title="Tillbaka">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-medium text-fg">Nytt kvitto</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-muted hover:text-fg transition-colors"
            disabled={submitting}
          >
            Avbryt
          </button>
          <button
            type="submit"
            form="kvitto-form"
            disabled={submitting || uploading || !uploaded}
            className="rounded-md bg-fg text-bg px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {submitting ? 'Sparar...' : 'Spara kvitto'}
          </button>
        </div>
      </div>

      <form id="kvitto-form" onSubmit={handleSubmit} className="flex-1 overflow-auto flex flex-col">
        {/* Upload */}
        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Bilaga</p>
          {!uploaded ? (
            <button
              type="button"
              onClick={handlePickFile}
              disabled={uploading}
              className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-12 text-muted hover:border-fg hover:text-fg transition-colors disabled:opacity-50"
            >
              <Upload size={20} />
              <span className="text-sm">{uploading ? 'Laddar upp...' : 'Välj fil (PDF, JPG, PNG, HEIC)'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-lg bg-elevated">
              {isImage ? <ImageIcon size={18} className="text-muted" /> : <FileText size={18} className="text-muted" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-fg truncate">{uploaded.fil_namn}</p>
                <p className="text-[11px] text-subtle">{(uploaded.storlek / 1024).toFixed(1)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => setUploaded(null)}
                className="text-muted hover:text-red-400 transition-colors"
                title="Ta bort"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Detaljer */}
        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Detaljer</p>
          <div className="grid grid-cols-3 gap-x-8 gap-y-5">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">Datum *</label>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                required
                className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-fg"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">Leverantör</label>
              <input
                type="text"
                value={leverantor}
                onChange={(e) => setLeverantor(e.target.value)}
                placeholder="t.ex. Bauhaus, Circle K..."
                className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-fg"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">Kategori</label>
              <SelectField
                value={kategori}
                onChange={(v) => setKategori(v as KvittoKategori | '')}
                placeholder="—"
                options={KVITTO_KATEGORIER.map((k) => ({ value: k.value, label: k.label }))}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">Belopp (inkl. moms)</label>
              <input
                type="text"
                inputMode="decimal"
                value={belopp}
                onChange={(e) => setBelopp(e.target.value)}
                placeholder="0,00"
                className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-fg font-mono focus:outline-none focus:border-fg"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">Moms</label>
              <input
                type="text"
                inputMode="decimal"
                value={moms}
                onChange={(e) => setMoms(e.target.value)}
                placeholder="0,00"
                className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-fg font-mono focus:outline-none focus:border-fg"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">Projekt</label>
              <SelectField
                value={projektId}
                onChange={setProjektId}
                placeholder="— Allmän kostnad —"
                searchable
                options={projekt.map((p) => ({ value: p.id, label: `${p.projekt_nummer} — ${p.namn}` }))}
              />
            </div>
            <div className="col-span-3">
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">Beskrivning</label>
              <textarea
                value={beskrivning}
                onChange={(e) => setBeskrivning(e.target.value)}
                rows={2}
                placeholder="Valfri kommentar..."
                className="w-full bg-bg border border-border rounded px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-fg resize-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="px-8 py-3 text-xs text-red-400 border-b border-border">{error}</div>
        )}
      </form>
    </div>
  )
}
