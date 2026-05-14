import { useState, useRef, useEffect } from 'react'
import { useAppConfig } from '@/context/AppConfig'
import { ArrowLeft, Pencil, Trash2, Send, Check, X as XIcon, Eye, EyeOff, FileText, ChevronDown } from 'lucide-react'
import { RefreshButton } from '@/components/RefreshButton'
import { WorkflowTriggerBar } from '@/components/WorkflowTriggerBar'
import { ProjektForm } from './ProjektForm'
import { DokumentPanel } from './DokumentPanel'
import { BetalningsplanPanel } from './BetalningsplanPanel'
import { FrageblanketterPanel } from './FrageblanketterPanel'
import type { ProjektWithKund, CreateProjektInput, ProjektAnteckning, ProjektStatusar, ProjektDokument, AnteckningFarg, ProjektAktivitet, DokumentKategori, Frageblankett, FragaFalt, FrageblanktEpostDraft } from './types'

type RightTab = 'anteckningar' | 'dokument' | 'betalningsplan' | 'fragor'
import { FARG_DOT, FARG_TEXT, ANTECKNING_FARG_DOT } from './types'
import type { Kund } from '@/sections/kunder/types'
import type { FaktureringSnapshot, FaktureringEtapp } from '@/sections/fakturering/types'

interface Props {
  projekt: ProjektWithKund
  kunder: Kund[]
  statusar: ProjektStatusar[]
  anteckningar: ProjektAnteckning[]
  snapshots: FaktureringSnapshot[]
  dokument: ProjektDokument[]
  onBack: () => void
  onEdit: (data: CreateProjektInput) => Promise<void>
  onChangeStatus: (status: string) => Promise<void>
  onDelete: () => Promise<void>
  onAddAnteckning: (titel: string, innehall: string, farg: string) => Promise<void>
  onUpdateAnteckning: (id: string, titel: string, innehall: string, farg: string) => Promise<void>
  onDeleteAnteckning: (id: string) => Promise<void>
  onChangeAnteckningFarg: (id: string, farg: string) => Promise<void>
  aktiviteter: ProjektAktivitet[]
  onUploadDokument: (kategori?: DokumentKategori, carpeta?: string | null) => Promise<void>
  onDeleteDokument: (id: string, storagePath: string) => Promise<void>
  onOpenDokument: (storagePath: string) => Promise<void>
  onToggleDokumentVisibility: (id: string, synlig: boolean) => Promise<void>
  onMoveCarpeta: (id: string, carpeta: string | null) => Promise<void>
  onDeleteCarpeta: (carpeta: string) => Promise<void>
  onRenameDokument: (id: string, filnamn: string) => Promise<void>
  uploadProgress: { current: number; total: number } | null

  frageblanktter: Frageblankett[]
  onGenerateFromText: (txt: string) => Promise<FragaFalt[]>
  onCreateBlankett: (titel: string, questionsJson: FragaFalt[]) => Promise<Frageblankett>
  onDeleteBlankett: (id: string) => Promise<void>
  onGetBlanktLink: (id: string) => Promise<string>
  onSaveBlanktAsDoc: (id: string) => Promise<ProjektDokument>
  onRefreshBlankett: (id: string) => Promise<Frageblankett>
  onGetBlanktEpostDraft: (id: string) => Promise<FrageblanktEpostDraft>
  onSendBlanktEpost: (draft: FrageblanktEpostDraft) => Promise<void>
}


function formatDate(d: string | null) { return d ? new Date(d).toLocaleDateString('sv-SE') : '—' }
function formatDateTime(d: string) { return new Date(d).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) }

type TimelineItem =
  | { kind: 'anteckning'; data: ProjektAnteckning }
  | { kind: 'aktivitet'; data: ProjektAktivitet }

export function ProjektDetail({ projekt, kunder, statusar, anteckningar, snapshots, dokument, aktiviteter, onBack, onEdit, onChangeStatus, onDelete, onAddAnteckning, onUpdateAnteckning, onDeleteAnteckning, onChangeAnteckningFarg, onUploadDokument, onDeleteDokument, onOpenDokument, onToggleDokumentVisibility, onMoveCarpeta, onDeleteCarpeta, onRenameDokument, uploadProgress, frageblanktter, onGenerateFromText, onCreateBlankett, onDeleteBlankett, onGetBlanktLink, onSaveBlanktAsDoc, onRefreshBlankett, onGetBlanktEpostDraft, onSendBlanktEpost }: Props) {
  const { formatCurrency } = useAppConfig()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [villkorExpanded, setVillkorExpanded] = useState(false)
  const [beskrivningExpanded, setBeskrivningExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Ny anteckning
  const [nyTitel, setNyTitel] = useState('')
  const [nyInnehall, setNyInnehall] = useState('')
  const [nyFarg, setNyFarg] = useState<AnteckningFarg>('muted')
  const [savingNote, setSavingNote] = useState(false)

  // Estado por nota
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editTitel, setEditTitel] = useState('')
  const [editInnehall, setEditInnehall] = useState('')
  const [editFarg, setEditFarg] = useState<AnteckningFarg>('muted')
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('anteckningar')

  if (editing) {
    return (
      <ProjektForm
        kunder={kunder}
        statusar={statusar}
        initial={projekt}
        onSubmit={async (data) => { await onEdit(data); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  async function handleDelete() { setDeleting(true); await onDelete() }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!nyTitel.trim()) return
    setSavingNote(true)
    await onAddAnteckning(nyTitel.trim(), nyInnehall.trim(), nyFarg)
    setNyTitel('')
    setNyInnehall('')
    setNyFarg('muted')
    setSavingNote(false)
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function startEdit(a: ProjektAnteckning) {
    setEditingNoteId(a.id)
    setEditTitel(a.titel)
    setEditInnehall(a.innehall)
    setEditFarg(a.farg)
    setExpandedIds((prev) => new Set(prev).add(a.id))
  }

  async function saveEdit(id: string) {
    if (!editTitel.trim()) return
    setSavingEditId(id)
    await onUpdateAnteckning(id, editTitel.trim(), editInnehall.trim(), editFarg)
    setEditingNoteId(null)
    setSavingEditId(null)
  }

  function cancelEdit() { setEditingNoteId(null) }

  async function handleDeleteNote(id: string) {
    setDeletingNoteId(id)
    await onDeleteAnteckning(id)
    setDeletingNoteId(null)
  }

  return (
    <div className="flex flex-col h-full">

      <div className="flex items-center px-6 py-3 border-b border-border bg-sidebar shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={onBack} className="flex items-center gap-1.5 text-muted hover:text-fg transition-colors text-sm shrink-0">
            <ArrowLeft size={14} />
            Projekt
          </button>
          <span className="text-subtle shrink-0">/</span>
          <span className="text-sm text-fg font-medium truncate shrink-0">{projekt.projekt_nummer} — {projekt.namn}</span>
        </div>
        <div className="flex items-center justify-center shrink-0">
          <StatusDropdown
            statusar={statusar}
            current={projekt.status}
            onChange={onChangeStatus}
          />
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">
            <Pencil size={11} />Redigera
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-red-400 transition-colors">
              <Trash2 size={11} />Ta bort
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">Är du säker?</span>
              <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors disabled:opacity-40">
                {deleting ? 'Tar bort...' : 'Ja, ta bort'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors">Avbryt</button>
            </div>
          )}
          <RefreshButton iconOnly />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* Info del proyecto */}
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-0.5">{projekt.projekt_nummer}</p>
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold text-fg">{projekt.namn}</h2>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-sm font-semibold text-fg uppercase tracking-wide">{projekt.kunder.namn}</span>
                {projekt.kunder.telefon && (
                  <span className="text-xs text-muted mt-0.5">{projekt.kunder.telefon}</span>
                )}
              </div>
            </div>
          </div>

          <WorkflowTriggerBar
            seccion="projekt"
            context={{ projekt_id: projekt.id }}
            rightSlot={
              <button
                onClick={() => void window.api.invoke('window:open-forslag', projekt.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-elevated border border-border rounded text-[11px] text-muted hover:text-fg hover:border-subtle transition-colors"
              >
                <FileText size={10} className="shrink-0" />
                Förslag
              </button>
            }
          />

          <DetailSection title="Kund">
            <DetailField label="Kundnummer" value={projekt.kunder.kundnummer} />
            <DetailField label="Kundnamn" value={projekt.kunder.namn} />
            <DetailField label="ROT-avdrag" value={projekt.rot_avdrag ? `Ja — ${projekt.rot_procent}%${projekt.rot_inkludera_medsokande ? ' (inkl. medsökande)' : ''}` : 'Nej'} />
          </DetailSection>

          {(projekt.arbetsplats_adress || projekt.arbetsplats_stad) && (
            <DetailSection title="Arbetsplats">
              <DetailField label="Adress" value={projekt.arbetsplats_adress} />
              <DetailField label="Stad" value={projekt.arbetsplats_stad} />
              <DetailField label="Postnummer" value={projekt.arbetsplats_postnummer} />
            </DetailSection>
          )}

          <DetailSection title="Projektinfo">
            <DetailField label="Status" value={projekt.status} />
            <DetailField label="Preliminär budget" value={formatCurrency(projekt.budget_total, 0)} />
            <DetailField label="Startdatum" value={formatDate(projekt.startdatum)} />
            <DetailField label="Slutdatum" value={formatDate(projekt.slutdatum)} />
            <DetailField label="Betalningsvillkor" value={projekt.betalningsvillkor} />
          </DetailSection>

          <div className="px-8 py-6 border-b border-border flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-muted">Beskrivning</p>
              {projekt.beskrivning && (
                <button onClick={() => setBeskrivningExpanded(v => !v)} className="p-1 text-subtle hover:text-fg transition-colors" title={beskrivningExpanded ? 'Dölj' : 'Visa'}>
                  {beskrivningExpanded ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
            </div>
            <div className="bg-elevated border border-border rounded-sm px-4 py-3 text-sm leading-relaxed min-h-[60px]">
              {projekt.beskrivning
                ? beskrivningExpanded
                  ? <p className="text-muted whitespace-pre-wrap">{projekt.beskrivning}</p>
                  : <p className="text-muted">{projekt.beskrivning.length > 120 ? projekt.beskrivning.slice(0, 120) + '…' : projekt.beskrivning}</p>
                : <p className="text-subtle italic">Ingen beskrivning angiven.</p>
              }
            </div>
          </div>

          <div className="px-8 py-6 border-b border-border flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-muted">Villkor</p>
              {projekt.villkor && (
                <button onClick={() => setVillkorExpanded(v => !v)} className="p-1 text-subtle hover:text-fg transition-colors" title={villkorExpanded ? 'Dölj' : 'Visa'}>
                  {villkorExpanded ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
            </div>
            <div className="bg-elevated border border-border rounded-sm px-4 py-3 text-sm leading-relaxed min-h-[60px]">
              {projekt.villkor
                ? villkorExpanded
                  ? <p className="text-muted whitespace-pre-wrap">{projekt.villkor}</p>
                  : <p className="text-muted">{projekt.villkor.length > 120 ? projekt.villkor.slice(0, 120) + '…' : projekt.villkor}</p>
                : <p className="text-subtle italic">Inga villkor angivna.</p>
              }
            </div>
          </div>

          <div className="px-8 py-6 border-b border-border">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Fakturering</p>
            {snapshots.length === 0 ? (
              <p className="text-xs text-subtle italic">Ingen fakturering skapad ännu.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {snapshots.map((s) => <SnapshotCard key={s.id} snap={s} />)}
              </div>
            )}
          </div>

          <div className="px-8 py-4 mt-auto border-t border-border flex items-center gap-6">
            <MetaField label="Skapad" value={new Date(projekt.skapad_at).toLocaleDateString('sv-SE')} />
            <MetaField label="Uppdaterad" value={new Date(projekt.uppdaterad_at).toLocaleDateString('sv-SE')} />
          </div>
        </div>

        {/* Panel derecho con tabs */}
        <div className="w-[480px] border-l border-border flex flex-col shrink-0">

          {(() => {
            const dokumentList = dokument.filter((d) => (d.kategori ?? 'dokument') === 'dokument')
            const betalningsplanList = dokument.filter((d) => d.kategori && d.kategori !== 'dokument')
            return (
              <>
                <div className="flex shrink-0 border-b border-border">
                  <button
                    onClick={() => setRightTab('anteckningar')}
                    className={`flex items-center gap-1.5 px-3 py-3 text-[11px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${rightTab === 'anteckningar' ? 'text-fg border-fg' : 'text-muted border-transparent hover:text-fg'}`}
                  >
                    Anteckningar
                    <span className="text-[10px] bg-elevated border border-border rounded-full px-1.5 py-0.5">{anteckningar.length}</span>
                  </button>
                  <button
                    onClick={() => setRightTab('dokument')}
                    className={`flex items-center gap-1.5 px-3 py-3 text-[11px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${rightTab === 'dokument' ? 'text-fg border-fg' : 'text-muted border-transparent hover:text-fg'}`}
                  >
                    Dokument
                    <span className="text-[10px] bg-elevated border border-border rounded-full px-1.5 py-0.5">{dokumentList.length}</span>
                  </button>
                  <button
                    onClick={() => setRightTab('betalningsplan')}
                    className={`flex items-center gap-1.5 px-3 py-3 text-[11px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${rightTab === 'betalningsplan' ? 'text-fg border-fg' : 'text-muted border-transparent hover:text-fg'}`}
                  >
                    Betalningsplan
                    <span className="text-[10px] bg-elevated border border-border rounded-full px-1.5 py-0.5">{betalningsplanList.length}</span>
                  </button>
                  <button
                    onClick={() => setRightTab('fragor')}
                    className={`flex items-center gap-1.5 px-3 py-3 text-[11px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${rightTab === 'fragor' ? 'text-fg border-fg' : 'text-muted border-transparent hover:text-fg'}`}
                  >
                    Frågor
                    <span className="text-[10px] bg-elevated border border-border rounded-full px-1.5 py-0.5">{frageblanktter.length}</span>
                  </button>
                </div>

                {rightTab === 'dokument' && (
                  <DokumentPanel
                    dokument={dokumentList}
                    projektId={projekt.id}
                    onUpload={(carpeta) => onUploadDokument('dokument', carpeta)}
                    onDelete={onDeleteDokument}
                    onOpen={onOpenDokument}
                    onToggleVisibility={onToggleDokumentVisibility}
                    onMoveCarpeta={onMoveCarpeta}
                    onDeleteCarpeta={onDeleteCarpeta}
                    onRename={onRenameDokument}
                    uploadProgress={uploadProgress}
                  />
                )}

                {rightTab === 'betalningsplan' && (
                  <BetalningsplanPanel
                    dokument={betalningsplanList}
                    onUpload={(kategori) => onUploadDokument(kategori)}
                    onDelete={onDeleteDokument}
                    onOpen={onOpenDokument}
                    onToggleVisibility={onToggleDokumentVisibility}
                  />
                )}
                {rightTab === 'fragor' && (
                  <FrageblanketterPanel
                    frageblanktter={frageblanktter}
                    onGenerateFromText={onGenerateFromText}
                    onCreateBlankett={onCreateBlankett}
                    onDeleteBlankett={onDeleteBlankett}
                    onGetLink={onGetBlanktLink}
                    onSaveAsDoc={onSaveBlanktAsDoc}
                    onRefresh={onRefreshBlankett}
                    onGetEpostDraft={onGetBlanktEpostDraft}
                    onSendEpost={onSendBlanktEpost}
                  />
                )}
              </>
            )
          })()}

          {/* Tab: Anteckningar */}
          {rightTab === 'anteckningar' && (
          <div className="flex-1 flex flex-col min-h-0">
          {/* Timeline */}
          <div className="flex-1 overflow-auto">
            {anteckningar.length === 0 && aktiviteter.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-subtle text-xs">Inga anteckningar ännu.</p>
              </div>
            ) : (() => {
              const items: TimelineItem[] = [
                ...anteckningar.map(a => ({ kind: 'anteckning' as const, data: a })),
                ...aktiviteter.map(a => ({ kind: 'aktivitet' as const, data: a })),
              ].sort((a, b) => new Date(a.data.skapad_at).getTime() - new Date(b.data.skapad_at).getTime())
              return (
              <div className="relative py-4">
                <div className="absolute left-[27px] top-0 bottom-0 w-px bg-border" />

                {items.map((item) => {
                  if (item.kind === 'aktivitet') {
                    const a = item.data
                    return (
                      <div key={`akt-${a.id}`} className="relative flex gap-3 px-4 pb-4">
                        <div className="relative z-10 mt-1 size-2 rounded-full bg-subtle border border-subtle shrink-0 ml-[1px]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-subtle italic">{a.text}</p>
                          <p className="text-[10px] text-subtle/60 mt-0.5">{formatDateTime(a.skapad_at)}</p>
                        </div>
                      </div>
                    )
                  }
                  const a = item.data as ProjektAnteckning
                  const expanded = expandedIds.has(a.id)
                  const isEditing = editingNoteId === a.id

                  return (
                    <div key={a.id} className="group relative flex gap-3 px-4 pb-5 last:pb-2">
                      {/* Dot clickable */}
                      <div className="relative shrink-0 flex flex-col items-center mt-1">
                        <button
                          type="button"
                          onClick={() => setColorPickerId(colorPickerId === a.id ? null : a.id)}
                          className={`relative z-10 size-2.5 rounded-full border-2 transition-transform hover:scale-125 ${ANTECKNING_FARG_DOT[a.farg ?? 'muted']}`}
                        />
                        {colorPickerId === a.id && (
                          <div className="absolute top-4 left-0 z-20 flex items-center gap-1 bg-sidebar border border-border rounded-lg px-2 py-1.5 shadow-lg">
                            {FARG_OPTIONS.map((o) => (
                              <button
                                key={o.value}
                                type="button"
                                onClick={() => { onChangeAnteckningFarg(a.id, o.value); setColorPickerId(null) }}
                                className={`size-3 rounded-full border-2 transition-transform hover:scale-125 ${o.dot} ${a.farg === o.value ? 'scale-125' : 'opacity-60'}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          {isEditing ? (
                            <input
                              autoFocus
                              className="input flex-1"
                              value={editTitel}
                              onChange={(e) => setEditTitel(e.target.value)}
                            />
                          ) : (
                            <span
                              className="text-xs font-semibold text-fg cursor-pointer hover:text-muted transition-colors leading-relaxed"
                              onClick={() => toggleExpand(a.id)}
                            >
                              {a.titel || '(ingen titel)'}
                            </span>
                          )}
                          <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                            {isEditing ? (
                              <>
                                <button onClick={() => saveEdit(a.id)} disabled={savingEditId === a.id} className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors">
                                  <Check size={12} />
                                </button>
                                <button onClick={cancelEdit} className="p-1 text-muted hover:text-fg transition-colors">
                                  <XIcon size={12} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(a)} className="p-1 text-subtle hover:text-fg opacity-0 group-hover:opacity-100 transition-all">
                                  <Pencil size={11} />
                                </button>
                                <button onClick={() => handleDeleteNote(a.id)} disabled={deletingNoteId === a.id} className="p-1 text-subtle hover:text-red-400 opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-all">
                                  <Trash2 size={11} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-subtle mt-0.5">{formatDateTime(a.skapad_at)}</p>

                        {isEditing && (
                          <FargPicker value={editFarg} onChange={setEditFarg} />
                        )}

                        {isEditing ? (
                          <textarea
                            className="input resize-none w-full mt-2"
                            rows={5}
                            value={editInnehall}
                            onChange={(e) => setEditInnehall(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit() }}
                            placeholder="Innehåll..."
                          />
                        ) : a.innehall ? (
                          <p
                            className="text-xs text-muted mt-1.5 cursor-pointer leading-relaxed"
                            onClick={() => toggleExpand(a.id)}
                          >
                            {expanded ? a.innehall : a.innehall.length > 80 ? a.innehall.slice(0, 80) + '…' : a.innehall}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
              )
            })()}
          </div>

          {/* Formulario nueva nota */}
          <form onSubmit={handleAddNote} className="border-t border-border p-4 flex flex-col gap-2 shrink-0">
            <input
              className="input text-xs"
              placeholder="Titel *"
              value={nyTitel}
              onChange={(e) => setNyTitel(e.target.value)}
            />
            <FargPicker value={nyFarg} onChange={setNyFarg} />
            <textarea
              className="input resize-none text-xs"
              rows={5}
              placeholder="Innehåll (valfritt)..."
              value={nyInnehall}
              onChange={(e) => setNyInnehall(e.target.value)}
            />
            <button
              type="submit"
              disabled={savingNote || !nyTitel.trim()}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-fg text-bg px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              <Send size={11} />
              {savingNote ? 'Sparar...' : 'Lägg till anteckning'}
            </button>
          </form>
          </div>
          )}

        </div>

      </div>
    </div>
  )
}

const FARG_OPTIONS: { value: AnteckningFarg; dot: string }[] = [
  { value: 'muted',   dot: 'bg-subtle border-subtle' },
  { value: 'emerald', dot: 'bg-emerald-400 border-emerald-400' },
  { value: 'amber',   dot: 'bg-amber-400 border-amber-400' },
  { value: 'red',     dot: 'bg-red-400 border-red-400' },
  { value: 'blue',    dot: 'bg-blue-400 border-blue-400' },
]

function FargPicker({ value, onChange }: { value: AnteckningFarg; onChange: (f: AnteckningFarg) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {FARG_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`size-3 rounded-full border-2 transition-transform ${o.dot} ${value === o.value ? 'scale-125' : 'opacity-50 hover:opacity-100'}`}
        />
      ))}
    </div>
  )
}

function SnapshotCard({ snap }: { snap: FaktureringSnapshot }) {
  const [expanded, setExpanded] = useState(false)
  const { formatCurrency } = useAppConfig()
  const fmt = (n: number) => formatCurrency(n, 0)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-elevated border-b border-border">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-fg">{snap.forslag_nummer} — {snap.forslag_titel}</span>
          <span className="text-[11px] text-subtle">{new Date(snap.skapad_at).toLocaleDateString('sv-SE')}</span>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-muted hover:text-fg transition-colors"
        >
          {expanded ? 'Dölj etapper' : 'Visa etapper'}
        </button>
      </div>

      <div className="grid grid-cols-4 divide-x divide-border">
        <SnapStat label="Arbete" value={fmt(snap.total_arbete)} />
        <SnapStat label="Material" value={fmt(snap.total_material)} />
        <SnapStat label="ROT-avdrag" value={snap.rot_avdrag > 0 ? `−${fmt(snap.rot_avdrag)}` : '—'} color="text-emerald-400" />
        <SnapStat label="Att betala" value={fmt(snap.att_betala_totalt)} highlight />
      </div>

      {expanded && snap.etapper.length > 0 && (
        <div className="border-t border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-elevated text-left">
                <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-subtle font-medium w-12">%</th>
                <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-subtle font-medium">Beskrivning</th>
                <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-subtle font-medium text-right w-28">Netto</th>
                <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-subtle font-medium text-right w-28">ROT</th>
                <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-subtle font-medium text-right w-28">Att betala</th>
              </tr>
            </thead>
            <tbody>
              {snap.etapper.map((e: FaktureringEtapp, i: number) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2 text-muted font-mono">{e.pct}%</td>
                  <td className="px-4 py-2 text-fg">{e.beskrivning}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted">{fmt(e.netto)}</td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-400">{e.rot > 0 ? `−${fmt(e.rot)}` : '—'}</td>
                  <td className="px-4 py-2 text-right font-mono text-fg font-semibold">{fmt(e.att_betala)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SnapStat({ label, value, color, highlight }: { label: string; value: string; color?: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-subtle font-medium">{label}</span>
      <span className={`text-sm font-mono font-semibold ${highlight ? 'text-fg' : color ?? 'text-muted'}`}>{value}</span>
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-8 py-6 border-b border-border">
      <p className="text-[11px] uppercase tracking-widest text-muted mb-4">{title}</p>
      <div className="grid grid-cols-3 gap-[1px] bg-border overflow-hidden rounded-sm">{children}</div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1.5 bg-elevated px-4 py-3">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className="text-sm text-fg">{value ?? '—'}</span>
    </div>
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-subtle">{label}: <span className="text-muted">{value}</span></span>
  )
}

function StatusDropdown({
  statusar,
  current,
  onChange,
}: {
  statusar: ProjektStatusar[]
  current: string
  onChange: (status: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const sorted = [...statusar].sort((a, b) => a.sortering - b.sortering || a.namn.localeCompare(b.namn))
  const currentStatus = sorted.find((s) => s.namn === current)
  const farg = currentStatus?.farg ?? 'muted'

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  async function handle(namn: string) {
    setOpen(false)
    if (busy || namn === current) return
    setBusy(true)
    try { await onChange(namn) } finally { setBusy(false) }
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border bg-elevated hover:bg-hover transition-colors text-[11px] disabled:opacity-50"
      >
        <span className={`size-2 rounded-full shrink-0 ${FARG_DOT[farg]}`} />
        <span className={FARG_TEXT[farg]}>{current}</span>
        <ChevronDown size={10} className="text-subtle ml-0.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-sidebar border border-border rounded shadow-lg py-1">
          {sorted.map((s) => (
            <button
              key={s.namn}
              type="button"
              onClick={() => handle(s.namn)}
              disabled={busy}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors text-left ${
                s.namn === current
                  ? 'text-fg bg-elevated cursor-default'
                  : 'text-muted hover:text-fg hover:bg-hover'
              }`}
            >
              <span className={`size-2 rounded-full shrink-0 ${FARG_DOT[s.farg ?? 'muted']}`} />
              {s.namn}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
