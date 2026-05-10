import { useState } from 'react'
import { Upload, File, FileText, Image, ExternalLink, Trash2, Loader2 } from 'lucide-react'
import type { RevisorDokument } from './types'

interface Props {
  dokument: RevisorDokument[]
  onUpload: () => Promise<void>
  onDelete: (id: string, storagePath: string) => Promise<void>
  onOpen: (storagePath: string) => Promise<void>
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <Image size={14} className="text-blue-400 shrink-0" />
  if (mimeType === 'application/pdf') return <FileText size={14} className="text-red-400 shrink-0" />
  return <File size={14} className="text-muted shrink-0" />
}

export function RevisorDokumentPanel({ dokument, onUpload, onDelete, onOpen }: Props) {
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  async function handleUpload() {
    setUploading(true)
    try { await onUpload() } finally { setUploading(false) }
  }

  async function handleDelete(d: RevisorDokument) {
    setDeletingId(d.id)
    try { await onDelete(d.id, d.storage_path) } finally { setDeletingId(null) }
  }

  async function handleOpen(d: RevisorDokument) {
    setOpeningId(d.id)
    try { await onOpen(d.storage_path) } finally { setOpeningId(null) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Dokument</h3>
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
        {dokument.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <File size={24} className="text-subtle" />
            <p className="text-subtle text-xs">Inga dokument uppladdade.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {dokument.map((d) => (
              <div
                key={d.id}
                className="group flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-hover transition-colors cursor-pointer"
                onClick={() => handleOpen(d)}
              >
                <FileIcon mimeType={d.mime_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg truncate group-hover:text-blue-400 transition-colors">{d.filnamn}</p>
                  <p className="text-[11px] text-subtle">{formatSize(d.storlek)} · {new Date(d.skapad_at).toLocaleDateString('sv-SE')}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
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
