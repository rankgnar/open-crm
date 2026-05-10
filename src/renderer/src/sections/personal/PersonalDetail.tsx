import { useState } from 'react'
import { ArrowLeft, Pencil, Trash2, File, FileText, Image, ExternalLink, Plus, Upload, Mail, KeyRound } from 'lucide-react'
import { SelectField } from '@/components/SelectField'
import { PersonalForm } from './PersonalForm'
import type {
  Personal, CreatePersonalInput, UpdatePersonalInput, PersonalAnteckning, PersonalDokument,
  PersonalLonepost, PersonalStatusar, AnteckningFarg, DokumentKategori, LonepostTyp,
  ProjektPersonal, ProjektItem,
} from './types'
import { ANTECKNING_FARG_DOT, FARG_DOT, FARG_TEXT, LONEPOST_TYPER } from './types'

type RightTab = 'anteckningar' | 'dokument' | 'lonespec' | 'loneposter'

interface Props {
  personal: Personal
  statusar: PersonalStatusar[]
  anteckningar: PersonalAnteckning[]
  dokument: PersonalDokument[]
  loneposter: PersonalLonepost[]
  assignedProjekt: ProjektPersonal[]
  availableProjekt: ProjektItem[]
  onBack: () => void
  onEdit: (data: CreatePersonalInput | UpdatePersonalInput) => Promise<void>
  onDelete: () => Promise<void>
  onAddAnteckning: (titel: string, innehall: string, farg: string) => Promise<void>
  onUpdateAnteckning: (id: string, titel: string, innehall: string, farg: string) => Promise<void>
  onDeleteAnteckning: (id: string) => Promise<void>
  onUploadDokument: (kategori: DokumentKategori) => Promise<void>
  onDeleteDokument: (id: string, storagePath: string) => Promise<void>
  onOpenDokument: (storagePath: string) => Promise<void>
  onAddLonepost: (data: { typ: string; belopp: number; beskrivning: string; datum: string; manad: string }) => Promise<void>
  onDeleteLonepost: (id: string) => Promise<void>
  onAssignProjekt: (projekt_id: string) => Promise<void>
  onRemoveProjekt: (projekt_id: string) => Promise<void>
  onSendInvite: () => Promise<void>
  onSendPasswordReset: () => Promise<void>
}

function formatDate(d: string | null) { return d ? new Date(d).toLocaleDateString('sv-SE') : '—' }
function formatDateTime(d: string) { return new Date(d).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) }
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function currentMånad() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` }

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <Image size={14} className="text-blue-400" />
  if (mime === 'application/pdf') return <FileText size={14} className="text-red-400" />
  return <File size={14} className="text-muted" />
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-subtle">{label}</span>
      <span className="text-sm text-fg">{value || '—'}</span>
    </div>
  )
}

function DokumentList({
  items, emptyText, uploading, onUpload, onOpen, onDelete,
}: {
  items: PersonalDokument[]
  emptyText: string
  uploading: boolean
  onUpload: () => void
  onOpen: (storagePath: string) => Promise<void>
  onDelete: (id: string, storagePath: string) => Promise<void>
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-4 py-3 border-b border-border shrink-0">
        <button onClick={onUpload} disabled={uploading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-elevated border border-border text-muted hover:text-fg hover:bg-hover disabled:opacity-50 transition-colors">
          <Upload size={12} />
          {uploading ? 'Laddar upp...' : 'Ladda upp'}
        </button>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3">
        {items.length === 0 ? (
          <p className="text-xs text-subtle text-center py-6">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {items.map((d) => (
              <div key={d.id} className="group flex items-center gap-3 py-2 border-b border-border last:border-0">
                <FileIcon mime={d.mime_type} />
                <div className="flex-1 min-w-0">
                  <button className="text-sm text-fg hover:text-blue-400 transition-colors truncate max-w-full text-left block" onClick={() => onOpen(d.storage_path)}>
                    {d.filnamn}
                  </button>
                  <p className="text-[10px] text-subtle">{formatSize(d.storlek)} · {formatDate(d.skapad_at)}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onOpen(d.storage_path)} className="p-1 rounded text-subtle hover:text-fg hover:bg-hover transition-colors"><ExternalLink size={12} /></button>
                  <button onClick={() => onDelete(d.id, d.storage_path)} className="p-1 rounded text-subtle hover:text-red-400 hover:bg-hover transition-colors"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const FARG_COLORS: Record<AnteckningFarg, string> = {
  emerald: '#34d399', amber: '#fbbf24', red: '#f87171', blue: '#60a5fa', muted: '#6b7280',
}

const SIGN_CLASS: Record<string, string> = { tillägg: 'text-emerald-400', traktamente: 'text-emerald-400', utlägg: 'text-emerald-400', avdrag: 'text-red-400', förskott: 'text-red-400' }
const SIGN: Record<string, string> = { tillägg: '+', traktamente: '+', utlägg: '+', avdrag: '−', förskott: '−' }

export function PersonalDetail({
  personal, statusar, anteckningar, dokument, loneposter,
  assignedProjekt, availableProjekt,
  onBack, onEdit, onDelete,
  onAddAnteckning, onUpdateAnteckning, onDeleteAnteckning,
  onUploadDokument, onDeleteDokument, onOpenDokument,
  onAddLonepost, onDeleteLonepost,
  onAssignProjekt, onRemoveProjekt,
  onSendInvite, onSendPasswordReset,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [rightTab, setRightTab] = useState<RightTab>('anteckningar')
  const [uploading, setUploading] = useState(false)

  // Anteckningar state
  const [nyTitel, setNyTitel] = useState('')
  const [nyInnehall, setNyInnehall] = useState('')
  const [nyFarg, setNyFarg] = useState<AnteckningFarg>('muted')
  const [savingNote, setSavingNote] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editTitel, setEditTitel] = useState('')
  const [editInnehall, setEditInnehall] = useState('')
  const [editFarg, setEditFarg] = useState<AnteckningFarg>('muted')
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)

  // Löneposter form state
  const [addingProjekt, setAddingProjekt] = useState(false)
  const [removingProjektId, setRemovingProjektId] = useState<string | null>(null)

  const [lpTyp, setLpTyp] = useState<LonepostTyp>('tillägg')
  const [lpBelopp, setLpBelopp] = useState('')
  const [lpBeskrivning, setLpBeskrivning] = useState('')
  const [lpDatum, setLpDatum] = useState(new Date().toISOString().split('T')[0])
  const [lpManad, setLpManad] = useState(currentMånad())
  const [savingLp, setSavingLp] = useState(false)
  const [deletingLpId, setDeletingLpId] = useState<string | null>(null)

  // App-åtkomst state
  const [invitingApp, setInvitingApp] = useState(false)
  const [resettingApp, setResettingApp] = useState(false)
  const [appAccessMsg, setAppAccessMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  if (editing) {
    return (
      <PersonalForm
        initial={personal}
        statusar={statusar}
        onSubmit={async (data) => { await onEdit(data); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  async function handleDelete() { setDeleting(true); await onDelete() }

  async function handleSaveNote() {
    if (!nyTitel.trim()) return
    setSavingNote(true)
    try { await onAddAnteckning(nyTitel, nyInnehall, nyFarg); setNyTitel(''); setNyInnehall(''); setNyFarg('muted') }
    finally { setSavingNote(false) }
  }

  async function handleSaveEditNote(id: string) {
    setSavingEditId(id)
    try { await onUpdateAnteckning(id, editTitel, editInnehall, editFarg); setEditingNoteId(null) }
    finally { setSavingEditId(null) }
  }

  async function handleDeleteNote(id: string) {
    setDeletingNoteId(id)
    try { await onDeleteAnteckning(id) }
    finally { setDeletingNoteId(null) }
  }

  async function handleUpload(kategori: DokumentKategori) {
    setUploading(true)
    try { await onUploadDokument(kategori) }
    finally { setUploading(false) }
  }

  const dokumentList = dokument.filter((d) => d.kategori === 'dokument')
  const lonespecList = dokument.filter((d) => d.kategori === 'lonespec')

  async function handleSendInvite() {
    if (!personal.email) return
    setInvitingApp(true)
    setAppAccessMsg(null)
    try {
      await onSendInvite()
      setAppAccessMsg({ kind: 'ok', text: `Inbjudan skickad till ${personal.email}` })
    } catch (err) {
      setAppAccessMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Kunde inte skicka inbjudan' })
    } finally {
      setInvitingApp(false)
    }
  }

  async function handleSendPasswordReset() {
    if (!personal.email) return
    setResettingApp(true)
    setAppAccessMsg(null)
    try {
      await onSendPasswordReset()
      setAppAccessMsg({ kind: 'ok', text: `Återställningsmail skickat till ${personal.email}` })
    } catch (err) {
      setAppAccessMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Kunde inte skicka återställning' })
    } finally {
      setResettingApp(false)
    }
  }

  async function handleSaveLonepost() {
    const b = parseFloat(lpBelopp)
    if (!lpDatum || isNaN(b) || b <= 0) return
    setSavingLp(true)
    try {
      await onAddLonepost({ typ: lpTyp, belopp: b, beskrivning: lpBeskrivning, datum: lpDatum, manad: lpManad })
      setLpBelopp(''); setLpBeskrivning('')
    } finally { setSavingLp(false) }
  }

  function formatLon() {
    if (personal.loneform === 'MAN' && personal['manadslön']) return `${personal['manadslön'].toLocaleString('sv-SE')} kr/mån`
    if (personal.loneform === 'TIM' && personal['timlön']) return `${personal['timlön'].toLocaleString('sv-SE')} kr/h`
    return '—'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 rounded text-muted hover:text-fg hover:bg-hover transition-colors">
            <ArrowLeft size={16} />
          </button>
          <span className="font-mono text-xs text-subtle">{personal.personal_nummer}</span>
          {(() => {
            const s = statusar.find((x) => x.namn === personal.status)
            return (
              <span className={`inline-flex items-center gap-1 text-xs ${FARG_TEXT[s?.farg ?? 'muted']}`}>
                <span className={`size-1.5 rounded-full ${FARG_DOT[s?.farg ?? 'muted']}`} />
                {personal.status || '—'}
              </span>
            )
          })()}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
            <Pencil size={11} />Redigera
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">Är du säker?</span>
              <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors disabled:opacity-40">
                {deleting ? '...' : 'Ja, ta bort'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
                Avbryt
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-red-400 transition-colors">
              <Trash2 size={11} />Ta bort
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted">{personal.personal_nummer}</p>
            <h2 className="text-xl font-semibold text-fg">{personal.namn}</h2>
            {personal.roll && <p className="text-sm text-muted mt-0.5">{personal.roll}</p>}
          </div>

          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Grunduppgifter</p>
            <div className="grid grid-cols-3 gap-x-8 gap-y-5">
              <DetailField label="Personnummer" value={personal.personnummer} />
              <DetailField label="Personaltyp" value={personal.personaltyp} />
              <DetailField label="Anställningsform" value={personal.anstallningsform} />
              <DetailField label="E-post" value={personal.email} />
              <DetailField label="Telefon" value={personal.telefon} />
              <DetailField label="Sysselsättningsgrad" value={personal.sysselsattningsgrad ? `${personal.sysselsattningsgrad}%` : null} />
              <DetailField label="Anställningsdatum" value={formatDate(personal.anstallningsdatum)} />
              {personal.slutdatum && <DetailField label="Anställd t.o.m." value={formatDate(personal.slutdatum)} />}
              {(personal.postadress || personal.ort) && (
                <DetailField label="Adress" value={[personal.postadress, personal.postnummer, personal.ort].filter(Boolean).join(', ')} />
              )}
            </div>
          </div>

          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Lön</p>
            <div className="grid grid-cols-3 gap-x-8 gap-y-5">
              <DetailField label="Löneform" value={personal.loneform === 'MAN' ? 'Månadslon' : personal.loneform === 'TIM' ? 'Timlön' : personal.loneform} />
              <DetailField label={personal.loneform === 'TIM' ? 'Timlön' : 'Månadslon'} value={formatLon()} />
            </div>
          </div>

          {(personal.clearingnummer || personal.kontonummer || personal.bank) && (
            <div className="px-8 py-6 border-b border-border">
              <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Bankuppgifter</p>
              <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                <DetailField label="Clearingnummer" value={personal.clearingnummer} />
                <DetailField label="Kontonummer" value={personal.kontonummer} />
                <DetailField label="Bank" value={personal.bank} />
              </div>
            </div>
          )}

          {/* App-åtkomst */}
          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-4">App-åtkomst</p>
            <div className="grid grid-cols-3 gap-x-8 gap-y-5 mb-4">
              <DetailField
                label="Status"
                value={
                  personal.supabase_user_id ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      Aktiverad
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-subtle">
                      <span className="size-1.5 rounded-full bg-subtle" />
                      Ej inbjuden
                    </span>
                  )
                }
              />
              <DetailField label="Inloggningsmail" value={personal.email} />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSendInvite}
                disabled={!personal.email || invitingApp || resettingApp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-elevated border border-border text-fg hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title={!personal.email ? 'Lägg till en e-postadress först' : undefined}
              >
                <Mail size={14} />
                {invitingApp ? 'Skickar...' : personal.supabase_user_id ? 'Skicka ny inbjudan' : 'Skicka inbjudan'}
              </button>
              {personal.supabase_user_id && (
                <button
                  onClick={handleSendPasswordReset}
                  disabled={!personal.email || invitingApp || resettingApp}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted hover:text-fg hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={!personal.email ? 'Lägg till en e-postadress först' : undefined}
                >
                  <KeyRound size={14} />
                  {resettingApp ? 'Skickar...' : 'Återställ lösenord'}
                </button>
              )}
              {appAccessMsg && (
                <span className={`text-xs ml-2 ${appAccessMsg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {appAccessMsg.text}
                </span>
              )}
            </div>
          </div>

          {/* Tilldelade projekt */}
          <div className="px-8 py-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] uppercase tracking-widest text-muted">Tilldelade projekt</p>
              {availableProjekt.length > 0 && (
                <button onClick={() => setAddingProjekt((v) => !v)} className="text-[11px] text-muted hover:text-fg transition-colors">
                  + Tilldela
                </button>
              )}
            </div>
            {addingProjekt && availableProjekt.length > 0 && (
              <SelectField
                value=""
                onChange={async (v) => {
                  if (!v) return
                  await onAssignProjekt(v)
                  setAddingProjekt(false)
                }}
                placeholder="Välj projekt..."
                searchable
                className="mb-3"
                options={availableProjekt.map((p) => ({ value: p.id, label: `${p.projekt_nummer} – ${p.namn}` }))}
              />
            )}
            {assignedProjekt.length === 0 ? (
              <p className="text-xs text-subtle">Inga tilldelade projekt</p>
            ) : (
              <div className="flex flex-col gap-2">
                {assignedProjekt.map((ap) => (
                  <div key={ap.id} className="flex items-center justify-between group">
                    <div>
                      <span className="text-xs font-mono text-subtle mr-2">{ap.projekt?.projekt_nummer}</span>
                      <span className="text-sm text-fg">{ap.projekt?.namn}</span>
                    </div>
                    <button
                      disabled={removingProjektId === ap.projekt_id}
                      onClick={async () => { setRemovingProjektId(ap.projekt_id); await onRemoveProjekt(ap.projekt_id); setRemovingProjektId(null) }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-subtle hover:text-red-400 transition-all disabled:opacity-40"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-8 py-4 mt-auto border-t border-border flex items-center gap-6">
            <span className="text-xs text-subtle">Skapad: {formatDateTime(personal.skapad_at)}</span>
            <span className="text-xs text-subtle">Uppdaterad: {formatDateTime(personal.uppdaterad_at)}</span>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-[480px] border-l border-border flex flex-col">
          <div className="flex border-b border-border shrink-0">
            {([
              ['anteckningar', 'Anteckningar', anteckningar.length],
              ['dokument', 'Dokument', dokumentList.length],
              ['lonespec', 'Lönespec', lonespecList.length],
              ['loneposter', 'Löneposter', loneposter.length],
            ] as [RightTab, string, number][]).map(([tab, label, count]) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                  rightTab === tab ? 'border-fg text-fg' : 'border-transparent text-subtle hover:text-muted'
                }`}
              >
                {label}
                <span className={`ml-1.5 text-[10px] ${rightTab === tab ? 'text-muted' : 'text-subtle'}`}>{count}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            {/* ── Anteckningar ── */}
            {rightTab === 'anteckningar' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
                  {anteckningar.length === 0 && (
                    <p className="text-xs text-subtle text-center py-6">Inga anteckningar ännu</p>
                  )}
                  {anteckningar.map((a) => (
                    <div key={a.id} className="group relative flex gap-3">
                      <div className="relative mt-0.5">
                        <button
                          className={`size-2.5 rounded-full border mt-1 ${ANTECKNING_FARG_DOT[a.farg]}`}
                          onClick={() => setColorPickerId(colorPickerId === a.id ? null : a.id)}
                        />
                        {colorPickerId === a.id && (
                          <div className="absolute left-0 top-5 z-20 flex gap-1.5 bg-elevated border border-border rounded-lg p-2 shadow-lg">
                            {(Object.keys(FARG_COLORS) as AnteckningFarg[]).map((f) => (
                              <button
                                key={f}
                                className="size-4 rounded-full transition-transform hover:scale-125"
                                style={{ backgroundColor: FARG_COLORS[f], opacity: a.farg === f ? 1 : 0.5 }}
                                onClick={async () => { setColorPickerId(null); await onUpdateAnteckning(a.id, a.titel, a.innehall, f) }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingNoteId === a.id ? (
                          <div className="flex flex-col gap-2">
                            <input className="input text-sm" value={editTitel} onChange={(e) => setEditTitel(e.target.value)} placeholder="Titel" />
                            <textarea className="input text-sm resize-none" rows={5} value={editInnehall} onChange={(e) => setEditInnehall(e.target.value)} placeholder="Anteckning..." />
                            <div className="flex items-center gap-2 flex-wrap">
                              {(Object.keys(FARG_COLORS) as AnteckningFarg[]).map((f) => (
                                <button key={f} className={`size-4 rounded-full transition-transform ${editFarg === f ? 'scale-125' : 'opacity-50'}`} style={{ backgroundColor: FARG_COLORS[f] }} onClick={() => setEditFarg(f)} />
                              ))}
                              <div className="flex gap-1.5 ml-auto">
                                <button onClick={() => setEditingNoteId(null)} className="px-2 py-1 text-xs text-muted hover:text-fg rounded hover:bg-hover">Avbryt</button>
                                <button onClick={() => handleSaveEditNote(a.id)} disabled={savingEditId === a.id} className="px-2 py-1 text-xs bg-elevated border border-border rounded text-fg hover:bg-hover disabled:opacity-50">
                                  {savingEditId === a.id ? '...' : 'Spara'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button className="text-left w-full" onClick={() => setExpandedIds((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n })}>
                              <p className="text-sm font-medium text-fg leading-snug">{a.titel || '(ingen titel)'}</p>
                            </button>
                            {expandedIds.has(a.id) && a.innehall && <p className="text-xs text-muted mt-1 whitespace-pre-wrap">{a.innehall}</p>}
                            <p className="text-[10px] text-subtle mt-1">{formatDateTime(a.skapad_at)}</p>
                          </>
                        )}
                      </div>
                      {editingNoteId !== a.id && (
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1 rounded text-subtle hover:text-fg hover:bg-hover transition-colors" onClick={() => { setEditingNoteId(a.id); setEditTitel(a.titel); setEditInnehall(a.innehall); setEditFarg(a.farg) }}>
                            <Pencil size={12} />
                          </button>
                          <button className="p-1 rounded text-subtle hover:text-red-400 hover:bg-hover transition-colors" disabled={deletingNoteId === a.id} onClick={() => handleDeleteNote(a.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-border p-4 shrink-0 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input className="input flex-1 text-sm" placeholder="Titel..." value={nyTitel} onChange={(e) => setNyTitel(e.target.value)} />
                    <div className="flex gap-1">
                      {(Object.keys(FARG_COLORS) as AnteckningFarg[]).map((f) => (
                        <button key={f} className={`size-4 rounded-full transition-transform ${nyFarg === f ? 'scale-125' : 'opacity-40'}`} style={{ backgroundColor: FARG_COLORS[f] }} onClick={() => setNyFarg(f)} />
                      ))}
                    </div>
                  </div>
                  <textarea className="input text-sm resize-none" rows={5} placeholder="Anteckning... (valfritt)" value={nyInnehall} onChange={(e) => setNyInnehall(e.target.value)} />
                  <button onClick={handleSaveNote} disabled={!nyTitel.trim() || savingNote} className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-elevated border border-border text-fg hover:bg-hover disabled:opacity-40 transition-colors">
                    <Plus size={12} />
                    {savingNote ? 'Sparar...' : 'Lägg till'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Dokument ── */}
            {rightTab === 'dokument' && (
              <DokumentList
                items={dokumentList}
                emptyText="Inga dokument uppladdade"
                uploading={uploading}
                onUpload={() => handleUpload('dokument')}
                onOpen={onOpenDokument}
                onDelete={onDeleteDokument}
              />
            )}

            {/* ── Lönespec ── */}
            {rightTab === 'lonespec' && (
              <DokumentList
                items={lonespecList}
                emptyText="Inga lönespecar uppladdade"
                uploading={uploading}
                onUpload={() => handleUpload('lonespec')}
                onOpen={onOpenDokument}
                onDelete={onDeleteDokument}
              />
            )}

            {/* ── Löneposter ── */}
            {rightTab === 'loneposter' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-auto px-4 py-3">
                  {loneposter.length === 0 ? (
                    <p className="text-xs text-subtle text-center py-6">Inga löneposter</p>
                  ) : (
                    <div className="space-y-0.5">
                      {loneposter.map((l) => {
                        const typInfo = LONEPOST_TYPER.find((t) => t.value === l.typ)
                        return (
                          <div key={l.id} className="group flex items-center gap-3 py-2 border-b border-border last:border-0">
                            <span className="text-xs font-mono text-muted w-20 shrink-0">{new Date(l.datum).toLocaleDateString('sv-SE')}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${SIGN_CLASS[l.typ] ? SIGN_CLASS[l.typ] + '/10 ' + SIGN_CLASS[l.typ] : 'bg-elevated text-muted'}`}>
                              {typInfo?.label ?? l.typ}
                            </span>
                            {l.beskrivning && <span className="text-xs text-subtle truncate flex-1">{l.beskrivning}</span>}
                            <span className={`text-sm font-medium shrink-0 ${SIGN_CLASS[l.typ] ?? 'text-fg'}`}>
                              {SIGN[l.typ]}{l.belopp.toLocaleString('sv-SE')} kr
                            </span>
                            <button
                              disabled={deletingLpId === l.id}
                              onClick={async () => { setDeletingLpId(l.id); await onDeleteLonepost(l.id); setDeletingLpId(null) }}
                              className="p-1 rounded text-subtle hover:text-red-400 hover:bg-hover opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Add form */}
                <div className="border-t border-border p-4 shrink-0 flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-2">
                    <SelectField
                      value={lpTyp}
                      onChange={(v) => setLpTyp(v as LonepostTyp)}
                      options={LONEPOST_TYPER.map((t) => ({ value: t.value, label: t.label }))}
                    />
                    <input type="number" min="0" step="100" className="input text-sm" placeholder="Belopp (kr)" value={lpBelopp} onChange={(e) => setLpBelopp(e.target.value)} />
                    <input type="month" className="input text-sm" value={lpManad} onChange={(e) => setLpManad(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="date" className="input text-sm" value={lpDatum} onChange={(e) => setLpDatum(e.target.value)} />
                    <input className="input text-sm col-span-2" placeholder="Beskrivning (valfritt)" value={lpBeskrivning} onChange={(e) => setLpBeskrivning(e.target.value)} />
                  </div>
                  <button
                    onClick={handleSaveLonepost}
                    disabled={!lpDatum || !lpBelopp || savingLp}
                    className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-elevated border border-border text-fg hover:bg-hover disabled:opacity-40 transition-colors"
                  >
                    <Plus size={12} />
                    {savingLp ? 'Sparar...' : 'Lägg till'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
