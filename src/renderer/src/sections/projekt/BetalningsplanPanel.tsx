import { useState } from 'react'
import { Upload, FileText, ExternalLink, Trash2, Loader2, Eye, EyeOff, File } from 'lucide-react'
import type { ProjektDokument, DokumentKategori } from './types'

type SubTab = Extract<DokumentKategori, 'faktura' | 'order' | 'ata'>

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'faktura', label: 'Fakturor' },
  { key: 'order',   label: 'Ordrar' },
  { key: 'ata',     label: 'ÄTA' },
]

interface Props {
  dokument: ProjektDokument[]
  onUpload: (kategori: SubTab) => Promise<void>
  onDelete: (id: string, storagePath: string) => Promise<void>
  onOpen: (storagePath: string) => Promise<void>
  onToggleVisibility: (id: string, synlig: boolean) => Promise<void>
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') return <FileText size={14} className="text-red-400 shrink-0" />
  return <File size={14} className="text-muted shrink-0" />
}

export function BetalningsplanPanel({ dokument, onUpload, onDelete, onOpen, onToggleVisibility }: Props) {
  const [active, setActive] = useState<SubTab>('faktura')
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const counts: Record<SubTab, number> = {
    faktura: dokument.filter((d) => d.kategori === 'faktura').length,
    order:   dokument.filter((d) => d.kategori === 'order').length,
    ata:     dokument.filter((d) => d.kategori === 'ata').length,
  }
  const visible = dokument.filter((d) => d.kategori === active)

  async function handleUpload() {
    setUploading(true)
    try { await onUpload(active) } finally { setUploading(false) }
  }

  async function handleDelete(d: ProjektDokument) {
    setDeletingId(d.id)
    try { await onDelete(d.id, d.storage_path) } finally { setDeletingId(null) }
  }

  async function handleOpen(d: ProjektDokument) {
    setOpeningId(d.id)
    try { await onOpen(d.storage_path) } finally { setOpeningId(null) }
  }

  async function handleToggleVisibility(d: ProjektDokument) {
    setTogglingId(d.id)
    try { await onToggleVisibility(d.id, !d.synlig_for_kund) } finally { setTogglingId(null) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {SUB_TABS.map((t) => {
            const isActive = t.key === active
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-elevated border border-border text-fg'
                    : 'text-muted hover:text-fg border border-transparent'
                }`}
              >
                {t.label}
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${isActive ? 'bg-bg border border-border' : 'bg-elevated border border-border'}`}>{counts[t.key]}</span>
              </button>
            )
          })}
        </div>
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 py-1 text-[11px] text-fg hover:bg-hover disabled:opacity-40 transition-colors"
        >
          {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          {uploading ? 'Laddar upp...' : 'Ladda upp'}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <FileText size={24} className="text-subtle" />
            <p className="text-subtle text-xs">Inga {SUB_TABS.find((t) => t.key === active)?.label.toLowerCase()} uppladdade.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {visible.map((d) => (
              <div
                key={d.id}
                className="group flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-hover transition-colors cursor-pointer"
                onClick={() => handleOpen(d)}
              >
                <span className="h-10 w-10 rounded bg-elevated flex items-center justify-center shrink-0">
                  <FileIcon mimeType={d.mime_type} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg truncate group-hover:text-blue-400 transition-colors">{d.filnamn}</p>
                  <p className="text-[11px] text-subtle">{formatSize(d.storlek)} · {new Date(d.skapad_at).toLocaleDateString('sv-SE')}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleVisibility(d) }}
                    disabled={togglingId === d.id}
                    className={`p-1 disabled:opacity-40 transition-all ${
                      d.synlig_for_kund
                        ? 'text-emerald-400 hover:text-emerald-300'
                        : 'text-subtle hover:text-fg opacity-60 group-hover:opacity-100'
                    }`}
                    title={d.synlig_for_kund ? 'Synlig för kund — klicka för att dölja' : 'Dold för kund — klicka för att visa'}
                  >
                    {togglingId === d.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : d.synlig_for_kund ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpen(d) }}
                    disabled={openingId === d.id}
                    className="p-1 text-subtle hover:text-fg opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-all"
                    title="Öppna"
                  >
                    {openingId === d.id ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(d) }}
                    disabled={deletingId === d.id}
                    className="p-1 text-subtle hover:text-red-400 opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-all"
                    title="Ta bort"
                  >
                    {deletingId === d.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
