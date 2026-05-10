import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { Upload, File, FileText, Image, ExternalLink, Trash2, Loader2, Eye, EyeOff, Folder, FolderOpen, Plus, X } from 'lucide-react'
import type { ProjektDokument } from './types'
import { WorkflowTriggerInline } from '@/components/WorkflowTriggerInline'

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

interface Props {
  dokument: ProjektDokument[]
  projektId: string
  onUpload: (carpeta: string | null) => Promise<void>
  onDelete: (id: string, storagePath: string) => Promise<void>
  onOpen: (storagePath: string) => Promise<void>
  onToggleVisibility: (id: string, synlig: boolean) => Promise<void>
  onMoveCarpeta: (id: string, carpeta: string | null) => Promise<void>
  onDeleteCarpeta: (carpeta: string) => Promise<void>
  uploadProgress: { current: number; total: number } | null
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

export function DokumentPanel({ dokument, projektId, onUpload, onDelete, onOpen, onToggleVisibility, onMoveCarpeta, onDeleteCarpeta, uploadProgress }: Props) {
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  // Folder bar state
  const [activeCarpeta, setActiveCarpeta] = useState<string>('__alla__')
  const [localCarpetas, setLocalCarpetas] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`dok-carpetas-${projektId}`)
      return stored ? (JSON.parse(stored) as string[]) : []
    } catch { return [] }
  })
  const [newCarpetaInput, setNewCarpetaInput] = useState<string | null>(null)

  // Move-to-folder dropdown (rendered via portal to escape scroll clipping)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [movingAnchor, setMovingAnchor] = useState<{ top: number; right: number } | null>(null)
  const [movingNewActive, setMovingNewActive] = useState(false)
  const [movingNewName, setMovingNewName] = useState('')

  // Derived folder data from documents
  const carpetas = [...new Set(dokument.filter((d) => d.carpeta).map((d) => d.carpeta!))]
  const hasNoFolder = dokument.some((d) => d.carpeta === null)
  // Merge DB folders + locally created folders (localCarpetas persists even when activeCarpeta changes)
  const allCarpetas = [...new Set([...carpetas, ...localCarpetas])]

  const visibleDocs = dokument.filter((d) => {
    if (activeCarpeta === '__alla__') return true
    if (activeCarpeta === '__ingen__') return d.carpeta === null
    return d.carpeta === activeCarpeta
  })

  const movingDoc = movingId ? dokument.find((d) => d.id === movingId) : null

  useEffect(() => {
    try {
      if (localCarpetas.length > 0) {
        localStorage.setItem(`dok-carpetas-${projektId}`, JSON.stringify(localCarpetas))
      } else {
        localStorage.removeItem(`dok-carpetas-${projektId}`)
      }
    } catch { /* ignore */ }
  }, [localCarpetas, projektId])

  useEffect(() => {
    const missing = dokument.filter((d) => isImage(d.mime_type) && !thumbs[d.id])
    if (missing.length === 0) return
    let cancelled = false
    void (async () => {
      const urls = await Promise.all(
        missing.map((d) =>
          window.api.invoke('db:projekt-dokument:get-url', d.storage_path)
            .then((u) => u as string)
            .catch(() => null)
        )
      )
      if (cancelled) return
      const next: Record<string, string> = {}
      urls.forEach((url, i) => { if (url) next[missing[i].id] = url })
      if (Object.keys(next).length > 0) setThumbs((prev) => ({ ...prev, ...next }))
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dokument])

  async function handleUpload() {
    const carpeta = activeCarpeta === '__alla__' || activeCarpeta === '__ingen__' ? null : activeCarpeta
    setUploading(true)
    try { await onUpload(carpeta) } finally { setUploading(false) }
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

  async function handleDeleteCarpeta(carpeta: string) {
    await onDeleteCarpeta(carpeta)
    setLocalCarpetas((prev) => prev.filter((c) => c !== carpeta))
    if (activeCarpeta === carpeta) setActiveCarpeta('__alla__')
  }

  function openMoveDropdown(e: React.MouseEvent<HTMLElement>, id: string) {
    e.stopPropagation()
    if (movingId === id) { closeMoveDropdown(); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setMovingId(id)
    setMovingAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setMovingNewActive(false)
    setMovingNewName('')
  }

  function closeMoveDropdown() {
    setMovingId(null)
    setMovingAnchor(null)
    setMovingNewActive(false)
    setMovingNewName('')
  }

  async function handleMove(id: string, carpeta: string | null) {
    closeMoveDropdown()
    await onMoveCarpeta(id, carpeta)
  }

  function handleNewCarpetaConfirm() {
    const name = newCarpetaInput?.trim()
    if (name) {
      if (!allCarpetas.includes(name)) {
        setLocalCarpetas((prev) => [...prev, name])
      }
      setActiveCarpeta(name)
    }
    setNewCarpetaInput(null)
  }

  const isUploading = uploading || uploadProgress !== null
  const uploadLabel = uploadProgress
    ? `Laddar upp ${uploadProgress.current}/${uploadProgress.total}...`
    : uploading
    ? 'Laddar upp...'
    : 'Ladda upp'

  const tabClass = (active: boolean) =>
    `flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors shrink-0 ${
      active ? 'bg-hover text-fg' : 'text-muted hover:text-fg'
    }`

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Dokument</h3>
        <div className="flex items-center gap-2">
          {activeCarpeta !== '__alla__' && activeCarpeta !== '__ingen__' && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted">
              <Folder size={9} /> {activeCarpeta}
            </span>
          )}
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 py-1 text-[11px] text-fg hover:bg-hover disabled:opacity-40 transition-colors"
          >
            {isUploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
            {uploadLabel}
          </button>
          <WorkflowTriggerInline seccion="projekt:dokument" context={{ projekt_id: projektId }} />
        </div>
      </div>

      {/* Folder bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border shrink-0 overflow-x-auto">
        <button onClick={() => setActiveCarpeta('__alla__')} className={tabClass(activeCarpeta === '__alla__')}>
          Alla
        </button>

        {allCarpetas.map((c) => (
          <button key={c} onClick={() => setActiveCarpeta(c)} className={tabClass(activeCarpeta === c)}>
            <Folder size={10} />
            {c}
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); void handleDeleteCarpeta(c) }}
              className="ml-0.5 text-subtle hover:text-red-400 transition-colors"
              title="Ta bort mapp (filer behålls)"
            >
              <X size={9} />
            </span>
          </button>
        ))}

        {hasNoFolder && allCarpetas.length > 0 && (
          <button onClick={() => setActiveCarpeta('__ingen__')} className={tabClass(activeCarpeta === '__ingen__')}>
            Ingen mapp
          </button>
        )}

        {newCarpetaInput !== null ? (
          <input
            autoFocus
            value={newCarpetaInput}
            onChange={(e) => setNewCarpetaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleNewCarpetaConfirm() }
              if (e.key === 'Escape') setNewCarpetaInput(null)
            }}
            className="text-[11px] bg-elevated border border-border rounded px-1.5 py-0.5 text-fg w-28 outline-none focus:border-blue-400 shrink-0"
            placeholder="Mappnamn... (Enter)"
          />
        ) : (
          <button
            onClick={() => setNewCarpetaInput('')}
            className="p-1 text-subtle hover:text-fg transition-colors shrink-0"
            title="Ny mapp"
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {visibleDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <File size={24} className="text-subtle" />
            <p className="text-subtle text-xs">
              {activeCarpeta === '__alla__' ? 'Inga dokument uppladdade.' : 'Inga dokument i den här mappen.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {visibleDocs.map((d) => (
              <div
                key={d.id}
                className="group flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-hover transition-colors cursor-pointer"
                onClick={() => handleOpen(d)}
              >
                {isImage(d.mime_type) && thumbs[d.id] ? (
                  <img
                    src={thumbs[d.id]}
                    alt={d.filnamn}
                    loading="lazy"
                    decoding="async"
                    className="h-10 w-10 rounded object-cover bg-elevated shrink-0"
                  />
                ) : (
                  <span className="h-10 w-10 rounded bg-elevated flex items-center justify-center shrink-0">
                    <FileIcon mimeType={d.mime_type} />
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg truncate group-hover:text-blue-400 transition-colors">{d.filnamn}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[11px] text-subtle">
                      {formatSize(d.storlek)} · {new Date(d.skapad_at).toLocaleDateString('sv-SE')}
                    </p>
                    {d.carpeta && activeCarpeta === '__alla__' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openMoveDropdown(e, d.id) }}
                        className="flex items-center gap-0.5 text-[10px] text-muted bg-elevated border border-border rounded-full px-1.5 py-0 shrink-0 hover:border-blue-400 hover:text-blue-400 transition-colors"
                        title="Flytta till annan mapp"
                      >
                        <Folder size={8} /> {d.carpeta}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {/* Move to folder */}
                  <button
                    onClick={(e) => openMoveDropdown(e, d.id)}
                    className="p-1 text-subtle hover:text-fg opacity-20 group-hover:opacity-100 transition-all"
                    title="Flytta till mapp"
                  >
                    <FolderOpen size={13} />
                  </button>

                  {/* Visibility toggle */}
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

                  {/* Open externally */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpen(d) }}
                    disabled={openingId === d.id}
                    className="p-1 text-subtle hover:text-fg opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-all"
                    title="Öppna"
                  >
                    {openingId === d.id ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                  </button>

                  {/* Delete */}
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

      {/* Move-to-folder dropdown via portal — escapes scroll container clipping */}
      {movingId && movingAnchor && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={closeMoveDropdown} />
          <div
            className="fixed z-50 bg-elevated border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
            style={{ top: movingAnchor.top, right: movingAnchor.right }}
          >
            {allCarpetas.filter((c) => c !== movingDoc?.carpeta).map((c) => (
              <button
                key={c}
                onClick={() => handleMove(movingId, c)}
                className="w-full text-left px-3 py-1.5 text-[11px] text-fg hover:bg-hover flex items-center gap-2 transition-colors"
              >
                <Folder size={11} className="text-muted shrink-0" /> {c}
              </button>
            ))}
            {movingDoc?.carpeta != null && (
              <button
                onClick={() => handleMove(movingId, null)}
                className="w-full text-left px-3 py-1.5 text-[11px] text-muted hover:bg-hover flex items-center gap-2 transition-colors"
              >
                <X size={11} className="shrink-0" /> Ingen mapp
              </button>
            )}
            {movingNewActive ? (
              <div className="px-3 py-1.5 border-t border-border mt-1">
                <input
                  autoFocus
                  value={movingNewName}
                  onChange={(e) => setMovingNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && movingNewName.trim()) handleMove(movingId, movingNewName.trim())
                    if (e.key === 'Escape') { setMovingNewActive(false); setMovingNewName('') }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-[11px] bg-bg border border-border rounded px-1.5 py-0.5 text-fg outline-none focus:border-blue-400"
                  placeholder="Mappnamn..."
                />
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setMovingNewActive(true) }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-subtle hover:bg-hover flex items-center gap-2 transition-colors border-t border-border mt-1"
              >
                <Plus size={11} className="shrink-0" /> Ny mapp...
              </button>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
