import { useState, useEffect, useRef } from 'react'
import {
  Inbox, Send, FileText, Trash2, RefreshCw, Pencil, Reply, Forward,
  Paperclip, X, Search, Mail, ChevronDown, Clock, AlertCircle, RotateCw, Eye, Download, CalendarPlus,
} from 'lucide-react'
import type { EpostMapp, EpostMeddelande, EpostProvider, NyttMeddelandeForm, EpostAlias, EpostMall, EpostBilagaRef, EpostKoMeddelande } from './types'
import type { ForslagWithProjekt } from '@/sections/forslag/types'
import { useAppConfig } from '@/context/AppConfig'
import { useRefreshHandler } from '@/context/RefreshContext'
import { EmailBody } from '@/components/EmailBody'

const MAPPAR: { id: EpostMapp; label: string; icon: typeof Inbox }[] = [
  { id: 'inkorg', label: 'Inkorg', icon: Inbox },
  { id: 'skickat', label: 'Skickat', icon: Send },
  { id: 'utkast', label: 'Utkast', icon: FileText },
  { id: 'utkorg', label: 'Utkorg', icon: Clock },
  { id: 'papperskorg', label: 'Papperskorg', icon: Trash2 },
]

const EMPTY_FORM: NyttMeddelandeForm = {
  alias_id: null,
  till: '',
  cc: '',
  amne: '',
  kropp: '',
  mall_id: null,
  kund_id: null,
  projekt_id: null,
  forslag_id: null,
  faktura_id: null,
  bilagor: [],
}

function formatDatum(datum: string): string {
  const d = new Date(datum)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000) return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800000) return d.toLocaleDateString('sv-SE', { weekday: 'short' })
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function formatStorlek(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function bilagaTypBadge(filename: string): { label: string; cls: string } {
  const ext = (filename.split('.').pop() ?? '').toLowerCase()
  if (ext === 'pdf') return { label: 'PDF', cls: 'bg-red-500/15 text-red-400' }
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return { label: ext.toUpperCase(), cls: 'bg-blue-500/15 text-blue-400' }
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return { label: ext.toUpperCase(), cls: 'bg-emerald-500/15 text-emerald-400' }
  if (['ppt', 'pptx', 'odp'].includes(ext)) return { label: ext.toUpperCase(), cls: 'bg-orange-500/15 text-orange-400' }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'avif'].includes(ext)) return { label: 'IMG', cls: 'bg-purple-500/15 text-purple-400' }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { label: 'ZIP', cls: 'bg-amber-500/15 text-amber-400' }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return { label: 'VID', cls: 'bg-rose-500/15 text-rose-400' }
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return { label: 'AUD', cls: 'bg-cyan-500/15 text-cyan-400' }
  return { label: ext.slice(0, 3).toUpperCase() || 'FIL', cls: 'bg-muted/15 text-muted' }
}

function BilagaCard({
  filnamn, storlek, onRemove, onView, onDownload,
}: {
  filnamn: string
  storlek?: number
  onRemove?: () => void
  onView?: () => void
  onDownload?: () => void
}) {
  const { label, cls } = bilagaTypBadge(filnamn)
  const hasActions = onView || onDownload
  const clickable = hasActions ? onView ?? onDownload : undefined
  return (
    <div
      className={`group flex items-center gap-3 bg-elevated border border-border rounded-lg pl-2 pr-2 py-2 min-w-0 ${clickable ? 'hover:border-fg/30 cursor-pointer' : ''} transition-colors`}
      onClick={clickable}
    >
      <div className={`size-10 rounded-md flex items-center justify-center text-[11px] font-bold tracking-wider shrink-0 ${cls}`}>
        {label}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm text-fg truncate">{filnamn}</span>
        {storlek != null && <span className="text-[11px] text-subtle">{formatStorlek(storlek)}</span>}
      </div>
      {hasActions && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {onView && (
            <button
              onClick={e => { e.stopPropagation(); onView() }}
              className="p-1.5 rounded text-muted hover:text-fg hover:bg-hover"
              title="Visa"
            >
              <Eye size={14} />
            </button>
          )}
          {onDownload && (
            <button
              onClick={e => { e.stopPropagation(); onDownload() }}
              className="p-1.5 rounded text-muted hover:text-fg hover:bg-hover"
              title="Spara"
            >
              <Download size={14} />
            </button>
          )}
        </div>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-1 rounded text-subtle hover:text-red-400 hover:bg-hover opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          title="Ta bort"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

interface DropdownOption {
  id: string
  label: string
  hint?: string
}

function Dropdown({
  value, onChange, options, placeholder, searchable = false,
}: {
  value: string
  onChange: (v: string) => void
  options: DropdownOption[]
  placeholder: string
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setQuery(''); return }
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = searchable && query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()) || (o.hint ?? '').toLowerCase().includes(query.toLowerCase()))
    : options

  const selected = options.find(o => o.id === value)

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 text-sm outline-none"
      >
        <span className={`truncate ${selected ? 'text-fg' : 'text-subtle'}`}>
          {selected ? (
            <>
              <span>{selected.label}</span>
              {selected.hint && <span className="text-muted ml-1.5">{selected.hint}</span>}
            </>
          ) : placeholder}
        </span>
        <ChevronDown size={12} className="text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-full bg-elevated border border-border rounded-lg shadow-xl flex flex-col overflow-hidden">
          {searchable && (
            <div className="px-3 py-2 border-b border-border">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Sök…"
                className="w-full bg-transparent text-xs text-fg outline-none placeholder:text-subtle"
              />
            </div>
          )}
          <div className="max-h-64 overflow-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs text-subtle hover:bg-hover transition-colors"
            >
              {placeholder}
            </button>
            {filtered.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onChange(o.id); setOpen(false) }}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-xs hover:bg-hover transition-colors ${o.id === value ? 'text-fg font-medium bg-hover/50' : 'text-muted'}`}
              >
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="text-subtle text-[11px] shrink-0">{o.hint}</span>}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-subtle">Inga träffar</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProviderBadge({ provider }: { provider: EpostProvider }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
      provider === 'gmail' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
    }`}>
      {provider === 'gmail' ? 'Gmail' : 'Zoho'}
    </span>
  )
}

interface ComposeProps {
  form: NyttMeddelandeForm
  onChange: (f: NyttMeddelandeForm) => void
  onSend: () => void
  onSchedule: (schemalagd_till: string) => void
  onClose: () => void
  aliasar: EpostAlias[]
  mallar: EpostMall[]
  sending: boolean
  scheduling: boolean
}

function ComposePanel({ form, onChange, onSend, onSchedule, onClose, aliasar, mallar, sending, scheduling }: ComposeProps) {
  const [showCc, setShowCc] = useState(false)
  const [kunder, setKunder] = useState<{ id: string; namn: string; email: string | null }[]>([])
  const [projekt, setProjekt] = useState<{ id: string; namn: string }[]>([])
  const [tillOpen, setTillOpen] = useState(false)
  const [tillQuery, setTillQuery] = useState('')
  const [bifogar, setBifogar] = useState(false)
  const [bilagaFel, setBilagaFel] = useState<string | null>(null)
  const [forhandsvy, setForhandsvy] = useState(true)
  const [schemaPopover, setSchemaPopover] = useState(false)
  const [schemaTid, setSchemaTid] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000)
    d.setSeconds(0, 0)
    return d.toISOString().slice(0, 16)
  })
  const tillRef = useRef<HTMLDivElement>(null)
  const schemaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!schemaPopover) return
    const handler = (e: MouseEvent) => {
      if (schemaRef.current && !schemaRef.current.contains(e.target as Node)) setSchemaPopover(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [schemaPopover])

  useEffect(() => {
    window.api.invoke('db:kunder:list')
      .then(data => setKunder((data as { id: string; namn: string; email: string | null }[]) ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!form.kund_id) { setProjekt([]); return }
    window.api.invoke('db:projekt:list-by-kund', form.kund_id)
      .then(data => setProjekt((data as { id: string; namn: string }[]) ?? []))
      .catch(() => {})
  }, [form.kund_id])

  useEffect(() => {
    if (!tillOpen) { setTillQuery(''); return }
    const handler = (e: MouseEvent) => {
      if (tillRef.current && !tillRef.current.contains(e.target as Node)) setTillOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [tillOpen])

  const tillSuggestions = tillQuery
    ? kunder.filter(k =>
        k.namn.toLowerCase().includes(tillQuery.toLowerCase()) ||
        (k.email ?? '').toLowerCase().includes(tillQuery.toLowerCase())
      ).slice(0, 8)
    : kunder.slice(0, 8)

  function selectKund(k: { id: string; namn: string; email: string | null }) {
    onChange({ ...form, till: k.email ?? form.till, kund_id: k.id, projekt_id: null })
    setTillOpen(false)
    setTillQuery('')
  }

  async function applyMall(mall_id: string) {
    if (!mall_id) {
      onChange({ ...form, mall_id: null })
      return
    }
    if ((form.amne || form.kropp) && !confirm('Det aktuella innehållet skrivs över. Fortsätt?')) return
    try {
      const result = await window.api.invoke('db:epost-mallar:preview', mall_id, {
        kund_id: form.kund_id,
        projekt_id: form.projekt_id,
        forslag_id: form.forslag_id,
        faktura_id: form.faktura_id,
      }) as { amne: string; kropp_html: string; alias_id: string | null; bilaga_typ: string }
      onChange({
        ...form,
        mall_id,
        amne: result.amne,
        kropp: result.kropp_html,
        alias_id: result.alias_id ?? form.alias_id,
      })
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function bifogaFil() {
    setBifogar(true)
    setBilagaFel(null)
    try {
      const refs = await window.api.invoke('db:epost:pick-and-upload-files') as EpostBilagaRef[]
      if (refs.length > 0) onChange({ ...form, bilagor: [...form.bilagor, ...refs] })
    } catch (e) {
      setBilagaFel((e as Error).message)
    } finally {
      setBifogar(false)
    }
  }

  function tabortBilaga(idx: number) {
    onChange({ ...form, bilagor: form.bilagor.filter((_, i) => i !== idx) })
  }

  const aktivaAliasar = aliasar.filter(a => a.aktiv)
  const aktivaMallar = mallar.filter(m => m.aktiv)
  const valdAlias = aktivaAliasar.find(a => a.id === form.alias_id)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-medium text-fg">Nytt meddelande</span>
        <button onClick={onClose} className="p-1 rounded text-muted hover:text-fg hover:bg-hover">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-auto">
        {/* Fields */}
        <div className="border-b border-border">
          <div className="flex items-center px-4 py-2 border-b border-border/50 gap-2">
            <span className="text-[11px] text-muted w-8 shrink-0">Från</span>
            <Dropdown
              value={form.alias_id ?? ''}
              onChange={v => onChange({ ...form, alias_id: v || null })}
              options={aktivaAliasar.map(a => ({
                id: a.id,
                label: a.etikett || a.fran_adress,
                hint: a.fran_adress,
              }))}
              placeholder="— Standardalias —"
            />
          </div>
          <div className="flex items-center px-4 py-2 border-b border-border/50 gap-2">
            <span className="text-[11px] text-muted w-8 shrink-0">Mall</span>
            <Dropdown
              value={form.mall_id ?? ''}
              onChange={v => void applyMall(v)}
              options={aktivaMallar.map(m => ({
                id: m.id,
                label: m.namn,
                hint: m.kategori,
              }))}
              placeholder="— Ingen mall —"
              searchable
            />
          </div>
        </div>
        <div className="border-b border-border">
          <div ref={tillRef} className="relative">
            <div className="flex items-center px-4 py-2 border-b border-border/50 gap-2">
              <span className="text-[11px] text-muted w-8 shrink-0">Till</span>
              {form.kund_id ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm text-fg truncate">{form.till}</span>
                  <button
                    type="button"
                    onClick={() => { onChange({ ...form, till: '', kund_id: null, projekt_id: null }); setTillOpen(true) }}
                    className="p-0.5 rounded text-muted hover:text-fg hover:bg-hover shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <input
                  value={tillQuery || form.till}
                  onChange={e => { setTillQuery(e.target.value); onChange({ ...form, till: e.target.value, kund_id: null }) }}
                  onFocus={() => setTillOpen(true)}
                  onBlur={() => setTimeout(() => setTillOpen(false), 200)}
                  placeholder="mottagare@email.se eller sök kund…"
                  className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
                />
              )}
              <button onClick={() => setShowCc(v => !v)} className="text-[11px] text-muted hover:text-fg shrink-0">
                Cc
              </button>
            </div>
            {tillOpen && !form.kund_id && (
              <div className="absolute left-0 right-0 top-full z-50 bg-elevated border border-border shadow-xl overflow-hidden">
                {tillSuggestions.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-subtle">Inga kunder hittades</p>
                ) : (
                  tillSuggestions.map(k => (
                    <button
                      key={k.id}
                      type="button"
                      onMouseDown={() => selectKund(k)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-hover transition-colors"
                    >
                      <span className="text-sm text-fg">{k.namn}</span>
                      <span className="text-xs text-muted">{k.email ?? 'ingen e-post'}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {showCc && (
            <div className="flex items-center px-4 py-2 border-b border-border/50">
              <span className="text-[11px] text-muted w-8 shrink-0">Cc</span>
              <input
                value={form.cc}
                onChange={e => onChange({ ...form, cc: e.target.value })}
                placeholder="kopia@email.se"
                className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
              />
            </div>
          )}

          <div className="flex items-center px-4 py-2 border-b border-border/50">
            <span className="text-[11px] text-muted w-8 shrink-0">Ämne</span>
            <input
              type="text"
              value={form.amne}
              onChange={e => onChange({ ...form, amne: e.target.value })}
              placeholder="Ämnesrad"
              className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
            />
          </div>

          {form.kund_id && projekt.length > 0 && (
            <div className="flex items-center px-4 py-2 gap-2">
              <span className="text-[11px] text-muted w-8 shrink-0">Proj.</span>
              <Dropdown
                value={form.projekt_id ?? ''}
                onChange={v => onChange({ ...form, projekt_id: v || null })}
                options={projekt.map(p => ({ id: p.id, label: p.namn }))}
                placeholder="— Inget projekt —"
              />
            </div>
          )}
        </div>

        {/* Body toolbar */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setForhandsvy(false)}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${!forhandsvy ? 'bg-hover text-fg' : 'text-muted hover:text-fg hover:bg-hover'}`}
            >
              Redigera
            </button>
            <button
              type="button"
              onClick={() => setForhandsvy(true)}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${forhandsvy ? 'bg-hover text-fg' : 'text-muted hover:text-fg hover:bg-hover'}`}
            >
              Förhandsgranska
            </button>
          </div>
          {forhandsvy && (
            <span className="text-[11px] text-subtle">Så här ser mottagaren det</span>
          )}
        </div>

        {/* Body */}
        {forhandsvy ? (
          <div className="flex-1 overflow-auto bg-bg">
            <EmailBody
              html={(() => {
                const base = form.kropp || '<p style="color:#888"><em>(Inget innehåll)</em></p>'
                const sig = valdAlias?.signatur_html
                if (sig && !base.includes(sig)) return `${base}<br><br>${sig}`
                return base
              })()}
              text=""
            />
          </div>
        ) : (
          <textarea
            value={form.kropp}
            onChange={e => onChange({ ...form, kropp: e.target.value })}
            placeholder="Skriv ditt meddelande här..."
            className="flex-1 px-4 py-3 bg-transparent text-sm text-fg outline-none resize-none placeholder:text-subtle min-h-[200px]"
          />
        )}

        {/* Attachments */}
        {form.bilagor.length > 0 && (
          <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
            <p className="text-[11px] uppercase tracking-widest text-muted flex items-center gap-1.5">
              <Paperclip size={11} />
              {form.bilagor.length} {form.bilagor.length === 1 ? 'bilaga' : 'bilagor'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {form.bilagor.map((b, i) => (
                <BilagaCard
                  key={i}
                  filnamn={b.attachmentName}
                  storlek={b.storlek}
                  onRemove={() => tabortBilaga(i)}
                />
              ))}
            </div>
          </div>
        )}

        {bilagaFel && (
          <div className="mx-4 my-2 px-3 py-2 rounded-lg bg-red-500/10 text-xs text-red-400">{bilagaFel}</div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0 flex items-center gap-2">
        <button
          onClick={onSend}
          disabled={!form.till || !form.amne || sending || scheduling || aktivaAliasar.length === 0}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? 'Skickar…' : 'Skicka'}
        </button>
        <div ref={schemaRef} className="relative">
          <button
            onClick={() => setSchemaPopover(v => !v)}
            disabled={!form.till || !form.amne || sending || scheduling || aktivaAliasar.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-elevated text-fg hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-border"
          >
            <Clock size={13} /> Skicka senare
          </button>
          {schemaPopover && (
            <div className="absolute bottom-full mb-2 left-0 z-50 bg-elevated border border-border rounded-lg shadow-xl p-3 w-72">
              <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Schemalägg</p>
              <input
                type="datetime-local"
                value={schemaTid}
                onChange={e => setSchemaTid(e.target.value)}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-fg outline-none focus:border-fg/30 mb-3"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const d = new Date(schemaTid)
                    if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) {
                      alert('Datumet måste vara i framtiden')
                      return
                    }
                    onSchedule(d.toISOString())
                    setSchemaPopover(false)
                  }}
                  disabled={scheduling}
                  className="flex-1 px-3 py-1.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
                >
                  {scheduling ? 'Schemalägger…' : 'Schemalägg'}
                </button>
                <button
                  onClick={() => setSchemaPopover(false)}
                  className="px-3 py-1.5 rounded text-xs text-muted hover:text-fg hover:bg-hover transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => void bifogaFil()}
          disabled={bifogar}
          title="Bifoga fil"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted hover:text-fg hover:bg-hover disabled:opacity-40 transition-colors"
        >
          <Paperclip size={14} /> {bifogar ? 'Laddar upp…' : 'Bifoga fil'}
        </button>
        {valdAlias && (
          <span className="ml-auto text-[11px] text-subtle truncate max-w-[200px]">
            {valdAlias.fran_namn} &lt;{valdAlias.fran_adress}&gt;
          </span>
        )}
        {!valdAlias && aktivaAliasar.length === 0 && (
          <span className="ml-auto text-[11px] text-amber-400">Konfigurera ett alias i Inställningar</span>
        )}
        <button onClick={onClose} className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-hover">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

interface DetailProps {
  meddelande: EpostMeddelande
  onSvara: () => void
  onVidarebefodra: () => void
  onSkapaUppgift: () => void
  onKoppla: () => void
}


interface ZohoBilaga {
  attachmentId: string
  attachmentName: string
  attachmentSize: number
}

function DetailPanel({ meddelande, onSvara, onVidarebefodra, onSkapaUppgift, onKoppla }: DetailProps) {
  const [bilagor, setBilagor] = useState<ZohoBilaga[]>([])

  useEffect(() => {
    if (!meddelande.har_bilaga) { setBilagor([]); return }
    window.api.invoke('db:epost:list-message-attachments', meddelande.id, meddelande.folder_id)
      .then(data => setBilagor((data as ZohoBilaga[]) ?? []))
      .catch(() => setBilagor([]))
  }, [meddelande.id])

  function handleAction(att: ZohoBilaga, save: boolean) {
    window.api.invoke('db:epost:download-message-attachment', {
      messageId: meddelande.id,
      folderId: meddelande.folder_id,
      attachmentId: att.attachmentId,
      attachmentName: att.attachmentName,
      save,
    }).catch(e => alert((e as Error).message))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="text-base font-semibold text-fg leading-snug">{meddelande.amne || '(Inget ämne)'}</h2>
          <ProviderBadge provider={meddelande.provider} />
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <span className="text-muted">Från</span>
          <span className="text-fg">{meddelande.fran_namn ? `${meddelande.fran_namn} <${meddelande.fran_adress}>` : meddelande.fran_adress}</span>
          <span className="text-muted">Till</span>
          <span className="text-fg">{meddelande.till.join(', ')}</span>
          {meddelande.cc.length > 0 && <>
            <span className="text-muted">Cc</span>
            <span className="text-fg">{meddelande.cc.join(', ')}</span>
          </>}
          <span className="text-muted">Datum</span>
          <span className="text-fg">{new Date(meddelande.datum).toLocaleString('sv-SE')}</span>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={onSvara} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted hover:text-fg hover:bg-hover transition-colors">
            <Reply size={13} /> Svara
          </button>
          <button onClick={onVidarebefodra} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted hover:text-fg hover:bg-hover transition-colors">
            <Forward size={13} /> Vidarebefordra
          </button>
          <button onClick={onSkapaUppgift} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-blue-400 hover:text-blue-300 hover:bg-hover transition-colors ml-auto">
            <CalendarPlus size={13} /> + Kalender
          </button>
          <button onClick={onKoppla} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-emerald-400 hover:text-emerald-300 hover:bg-hover transition-colors">
            <FileText size={13} /> + Förslag
          </button>
        </div>
      </div>

      {bilagor.length > 0 && (
        <div className="px-6 py-3 border-b border-border shrink-0">
          <p className="text-[11px] uppercase tracking-widest text-muted flex items-center gap-1.5 mb-2">
            <Paperclip size={11} />
            {bilagor.length} {bilagor.length === 1 ? 'bilaga' : 'bilagor'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {bilagor.map(att => (
              <BilagaCard
                key={att.attachmentId}
                filnamn={att.attachmentName}
                storlek={att.attachmentSize}
                onView={() => handleAction(att, false)}
                onDownload={() => handleAction(att, true)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <EmailBody html={meddelande.kropp_html} text={meddelande.kropp_text} />
      </div>
    </div>
  )
}

function formatSchemaTid(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `Idag ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function KoStatusBadge({ status }: { status: 'väntar' | 'skickar' | 'skickat' | 'misslyckades' }) {
  const cfg = {
    väntar: { label: 'Väntar', cls: 'bg-amber-500/10 text-amber-400' },
    skickar: { label: 'Skickar…', cls: 'bg-blue-500/10 text-blue-400' },
    skickat: { label: 'Skickat', cls: 'bg-emerald-500/10 text-emerald-400' },
    misslyckades: { label: 'Misslyckades', cls: 'bg-red-500/10 text-red-400' },
  }[status]
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.cls}`}>{cfg.label}</span>
}

function KoDetailPanel({
  meddelande, onAvbryt, onAterforsok,
}: {
  meddelande: EpostKoMeddelande
  onAvbryt: () => void
  onAterforsok: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="text-base font-semibold text-fg leading-snug">{meddelande.amne || '(Inget ämne)'}</h2>
          <KoStatusBadge status={meddelande.status} />
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <span className="text-muted">Till</span>
          <span className="text-fg">{meddelande.till}</span>
          {meddelande.cc && <>
            <span className="text-muted">Cc</span>
            <span className="text-fg">{meddelande.cc}</span>
          </>}
          <span className="text-muted">Schemalagd</span>
          <span className="text-fg">{new Date(meddelande.schemalagd_till).toLocaleString('sv-SE')}</span>
          {meddelande.forsok > 0 && <>
            <span className="text-muted">Försök</span>
            <span className="text-fg">{meddelande.forsok}</span>
          </>}
        </div>
        {meddelande.fel_meddelande && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{meddelande.fel_meddelande}</span>
          </div>
        )}
        <div className="flex items-center gap-2 mt-4">
          {meddelande.status === 'misslyckades' && (
            <button onClick={onAterforsok} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
              <RotateCw size={13} /> Försök igen
            </button>
          )}
          {(meddelande.status === 'väntar' || meddelande.status === 'misslyckades') && (
            <button onClick={onAvbryt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted hover:text-red-400 hover:bg-hover transition-colors">
              <Trash2 size={13} /> Avbryt
            </button>
          )}
          {meddelande.bilagor.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted ml-2">
              <Paperclip size={12} /> {meddelande.bilagor.length}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <EmailBody html={meddelande.kropp_html} text="" />
      </div>
    </div>
  )
}

interface UppgiftForm {
  titel: string
  datum: string
  beskrivning: string
}

export function EpostSection() {
  const { config } = useAppConfig()
  const [aktivMapp, setAktivMapp] = useState<EpostMapp>('inkorg')
  const [valtMeddelande, setValtMeddelande] = useState<EpostMeddelande | null>(null)
  const [komponera, setKomponera] = useState(false)
  const [form, setForm] = useState<NyttMeddelandeForm>(EMPTY_FORM)
  const [sokning, setSokning] = useState('')
  const [laddar, setLaddar] = useState(false)
  const [skickar, setSkickar] = useState(false)
  const [schemar, setSchemar] = useState(false)
  const [meddelanden, setMeddelanden] = useState<EpostMeddelande[]>([])
  const [aliasar, setAliasar] = useState<EpostAlias[]>([])
  const [mallar, setMallar] = useState<EpostMall[]>([])
  const [koMeddelanden, setKoMeddelanden] = useState<EpostKoMeddelande[]>([])
  const [valtKoMeddelande, setValtKoMeddelande] = useState<EpostKoMeddelande | null>(null)
  const [syncFel, setSyncFel] = useState('')
  const [skickaFel, setSkickaFel] = useState('')
  const [uppgiftModal, setUppgiftModal] = useState(false)
  const [uppgiftForm, setUppgiftForm] = useState<UppgiftForm>({ titel: '', datum: '', beskrivning: '' })
  const [spararUppgift, setSpararUppgift] = useState(false)
  const [uppgiftFel, setUppgiftFel] = useState<string | null>(null)
  const [forslagModal, setForslagModal] = useState(false)
  const [forslagList, setForslagList] = useState<ForslagWithProjekt[]>([])
  const [forslagSearch, setForslagSearch] = useState('')
  const [forslagSaving, setForslagSaving] = useState(false)

  const gmailConnected = Boolean(config?.google_access_token)
  const zohoConnected = Boolean(config?.zoho_access_token)
  // Gmail credentials get stored but the Gmail backend (sync/send) is not built
  // yet — see pending/2026-05-02_gmail_backend_obligatorio.md. Until it lands,
  // Zoho is the only provider that actually works.
  const ingenProvider = !zohoConnected

  useEffect(() => {
    if (zohoConnected) handleUppdatera()
  }, [zohoConnected])
  useRefreshHandler(() => { if (!ingenProvider) handleUppdatera() })

  // Open email linked from Kalender task
  useEffect(() => {
    const raw = localStorage.getItem('open-crm:pending-email')
    if (!raw) return
    localStorage.removeItem('open-crm:pending-email')
    try {
      const ref = JSON.parse(raw) as {
        message_id: string; folder_id: string; provider: string
        amne: string; fran_adress: string; fran_namn: string; snippet: string; datum: string
      }
      const synthetic: EpostMeddelande = {
        id: ref.message_id,
        provider: ref.provider as EpostMeddelande['provider'],
        provider_message_id: ref.message_id,
        folder_id: ref.folder_id,
        kund_id: null,
        fran_adress: ref.fran_adress,
        fran_namn: ref.fran_namn,
        till: [],
        cc: [],
        amne: ref.amne,
        snippet: ref.snippet,
        kropp_html: '',
        kropp_text: '',
        olast: false,
        har_bilaga: false,
        mapp: 'inkorg',
        datum: ref.datum,
      }
      setValtMeddelande(synthetic)
      setKomponera(false)
    } catch {
      // ignore malformed ref
    }
  }, [])

  useEffect(() => {
    void hamtaAliasar()
    void hamtaMallar()
    void hamtaKo()
  }, [])

  useEffect(() => {
    if (aktivMapp !== 'utkorg') return
    void hamtaKo()
    const id = setInterval(() => { void hamtaKo() }, 30_000)
    return () => clearInterval(id)
  }, [aktivMapp])

  useEffect(() => {
    if (!valtMeddelande || valtMeddelande.kropp_html) return
    window.api.invoke('db:epost:get-content', valtMeddelande.id, valtMeddelande.folder_id)
      .then((html) => {
        if (html) {
          setMeddelanden(prev =>
            prev.map(m => m.id === valtMeddelande.id ? { ...m, kropp_html: html as string } : m)
          )
          setValtMeddelande(prev => prev ? { ...prev, kropp_html: html as string } : prev)
        }
      })
      .catch(() => {})
  }, [valtMeddelande?.id])

  async function hamtaAliasar() {
    try {
      const data = await window.api.invoke('db:epost-alias:list') as EpostAlias[]
      setAliasar(data)
    } catch {
      // ignore
    }
  }

  async function hamtaMallar() {
    try {
      const data = await window.api.invoke('db:epost-mallar:list') as EpostMall[]
      setMallar(data)
    } catch {
      // ignore
    }
  }

  async function hamtaKo() {
    try {
      const data = await window.api.invoke('db:epost-ko:list') as EpostKoMeddelande[]
      setKoMeddelanden(data)
      setValtKoMeddelande(prev => prev ? data.find(d => d.id === prev.id) ?? null : null)
    } catch {
      // ignore
    }
  }

  async function handleSchemalägg(schemalagd_till: string) {
    if (!form.till || !form.amne) return
    setSchemar(true)
    setSkickaFel('')
    try {
      await window.api.invoke('db:epost:queue', {
        alias_id: form.alias_id,
        till: form.till,
        cc: form.cc,
        amne: form.amne,
        kropp: form.kropp,
        mall_id: form.mall_id,
        kund_id: form.kund_id,
        projekt_id: form.projekt_id,
        forslag_id: form.forslag_id,
        faktura_id: form.faktura_id,
        bilagor: form.bilagor,
        schemalagd_till,
      })
      setKomponera(false)
      setForm(EMPTY_FORM)
      void hamtaKo()
      setAktivMapp('utkorg')
    } catch (e) {
      setSkickaFel((e as Error).message)
    } finally {
      setSchemar(false)
    }
  }

  async function handleAvbrytKo(id: string) {
    if (!confirm('Avbryt schemalagt utskick?')) return
    try {
      await window.api.invoke('db:epost-ko:cancel', id)
      void hamtaKo()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function handleAterforsok(id: string) {
    try {
      await window.api.invoke('db:epost-ko:retry', id)
      void hamtaKo()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  function defaultAliasId(): string | null {
    const std = aliasar.find(a => a.standard && a.aktiv)
    return std?.id ?? aliasar.find(a => a.aktiv)?.id ?? null
  }

  function handleNytt() {
    setForm({ ...EMPTY_FORM, alias_id: defaultAliasId() })
    setValtMeddelande(null)
    setKomponera(true)
    setSkickaFel('')
  }

  function handleSvara() {
    if (!valtMeddelande) return
    setForm({
      ...EMPTY_FORM,
      alias_id: defaultAliasId(),
      till: valtMeddelande.fran_adress,
      amne: valtMeddelande.amne.startsWith('Re:') ? valtMeddelande.amne : `Re: ${valtMeddelande.amne}`,
    })
    setKomponera(true)
    setSkickaFel('')
  }

  function handleVidarebefodra() {
    if (!valtMeddelande) return
    setForm({
      ...EMPTY_FORM,
      alias_id: defaultAliasId(),
      amne: valtMeddelande.amne.startsWith('Fwd:') ? valtMeddelande.amne : `Fwd: ${valtMeddelande.amne}`,
      kropp: `\n\n---------- Vidarebefordrat meddelande ----------\nFrån: ${valtMeddelande.fran_adress}\nDatum: ${new Date(valtMeddelande.datum).toLocaleString('sv-SE')}\nÄmne: ${valtMeddelande.amne}\n\n${valtMeddelande.kropp_text}`,
    })
    setKomponera(true)
    setSkickaFel('')
  }

  async function handleSkicka() {
    if (!form.till || !form.amne) return
    setSkickar(true)
    setSkickaFel('')
    try {
      await window.api.invoke('db:epost:send', {
        alias_id: form.alias_id,
        till: form.till,
        cc: form.cc,
        amne: form.amne,
        kropp: form.kropp,
        mall_id: form.mall_id,
        kund_id: form.kund_id,
        projekt_id: form.projekt_id,
        forslag_id: form.forslag_id,
        faktura_id: form.faktura_id,
        bilagor: form.bilagor,
      })

      if (form.projekt_id) {
        await window.api.invoke('db:projekt-aktivitet:create', {
          projekt_id: form.projekt_id,
          handelse: 'epost_skickat',
          text: `E-post skickat: ${form.amne} → ${form.till}`,
        }).catch(() => {})
        if (form.forslag_id) {
          await window.api.invoke('db:projekt-aktivitet:create', {
            projekt_id: form.projekt_id,
            handelse: 'forslag_skickat',
            text: `Förslag skickat till ${form.till}`,
          }).catch(() => {})
        }
        if (form.faktura_id) {
          await window.api.invoke('db:projekt-aktivitet:create', {
            projekt_id: form.projekt_id,
            handelse: 'faktura_skickad',
            text: `Faktura skickad till ${form.till}`,
          }).catch(() => {})
        }
      }

      setKomponera(false)
      setForm(EMPTY_FORM)
      handleUppdatera()
    } catch (e) {
      setSkickaFel((e as Error).message)
    } finally {
      setSkickar(false)
    }
  }

  function handleOpenUppgiftModal() {
    if (!valtMeddelande) return
    const d = new Date(Date.now() + 60 * 60 * 1000)
    d.setSeconds(0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    const defaultDatum = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    setUppgiftForm({ titel: valtMeddelande.amne || '', datum: defaultDatum, beskrivning: '' })
    setUppgiftFel(null)
    setUppgiftModal(true)
  }

  async function handleSpararUppgift() {
    if (!valtMeddelande || !uppgiftForm.titel || !uppgiftForm.datum) return
    setSpararUppgift(true)
    setUppgiftFel(null)
    try {
      const start = new Date(uppgiftForm.datum)
      const slut = new Date(start.getTime() + 60 * 60 * 1000)
      const epostRef = {
        message_id: valtMeddelande.id,
        folder_id: valtMeddelande.folder_id,
        provider: valtMeddelande.provider,
        amne: valtMeddelande.amne,
        fran_adress: valtMeddelande.fran_adress,
        fran_namn: valtMeddelande.fran_namn,
        snippet: valtMeddelande.snippet,
        datum: valtMeddelande.datum,
      }
      await window.api.invoke('db:kalender:create', {
        titel: uppgiftForm.titel,
        beskrivning: uppgiftForm.beskrivning,
        start: start.toISOString(),
        slut: slut.toISOString(),
        hel_dag: false,
        epost_ref: epostRef,
      })
      setUppgiftModal(false)
    } catch (e) {
      setUppgiftFel((e as Error).message)
    } finally {
      setSpararUppgift(false)
    }
  }

  async function handleOpenForslagModal() {
    if (!valtMeddelande) return
    const data = await window.api.invoke('db:forslag:list') as ForslagWithProjekt[]
    setForslagList(data ?? [])
    setForslagSearch('')
    setForslagModal(true)
  }

  async function handleSparaForslagRef(forslagId: string) {
    if (!valtMeddelande) return
    setForslagSaving(true)
    try {
      await window.api.invoke('db:forslag-epost:create', {
        forslag_id: forslagId,
        message_id: valtMeddelande.id,
        folder_id: valtMeddelande.folder_id,
        provider: valtMeddelande.provider,
        amne: valtMeddelande.amne,
        fran_adress: valtMeddelande.fran_adress,
        fran_namn: valtMeddelande.fran_namn,
        snippet: valtMeddelande.snippet,
        datum: valtMeddelande.datum,
      })
      setForslagModal(false)
    } finally {
      setForslagSaving(false)
    }
  }

  async function handleUppdatera() {
    setLaddar(true)
    setSyncFel('')
    try {
      const data = await window.api.invoke('db:epost:sync') as EpostMeddelande[]
      setMeddelanden(data ?? [])
    } catch (e) {
      setSyncFel((e as Error).message)
    } finally {
      setLaddar(false)
    }
  }

  const visadeMeddelanden = meddelanden.filter(m =>
    m.mapp === aktivMapp &&
    (!sokning || m.amne.toLowerCase().includes(sokning.toLowerCase()) || m.fran_adress.toLowerCase().includes(sokning.toLowerCase()))
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <p className="text-[11px] uppercase tracking-widest text-muted">E-post</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUppdatera}
            disabled={laddar || ingenProvider}
            title="Uppdatera (F5)"
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={11} className={laddar ? 'animate-spin' : ''} />Uppdatera
          </button>
          <button
            onClick={handleNytt}
            disabled={ingenProvider}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg disabled:opacity-40 transition-colors"
          >
            <Pencil size={11} />Nytt meddelande
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <nav className="w-44 shrink-0 border-r border-border flex flex-col py-3 gap-0.5 px-2">
          {MAPPAR.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setAktivMapp(id); setValtMeddelande(null); setValtKoMeddelande(null); setKomponera(false) }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${aktivMapp === id ? 'bg-hover text-fg' : 'text-muted hover:bg-hover hover:text-fg'}`}
            >
              <Icon size={14} />
              <span className="flex-1 text-left">{label}</span>
            </button>
          ))}

          <div className="mt-4 mb-1 px-2.5">
            <p className="text-[10px] uppercase tracking-widest text-subtle">Konton</p>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <span className={`size-1.5 rounded-full ${gmailConnected ? 'bg-emerald-400' : 'bg-border'}`} />
            <span className="text-xs text-muted">Gmail</span>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <span className={`size-1.5 rounded-full ${zohoConnected ? 'bg-emerald-400' : 'bg-border'}`} />
            <span className="text-xs text-muted">Zoho</span>
          </div>
          {aliasar.length > 0 && (
            <>
              <div className="mt-4 mb-1 px-2.5">
                <p className="text-[10px] uppercase tracking-widest text-subtle">Alias</p>
              </div>
              <div className="px-2.5 py-1 text-[11px] text-muted">{aliasar.filter(a => a.aktiv).length} aktiva</div>
            </>
          )}
        </nav>

        <div className="w-72 shrink-0 border-r border-border flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-border shrink-0">
            <div className="flex items-center gap-2 bg-elevated rounded-lg px-2.5 py-1.5">
              <Search size={12} className="text-muted shrink-0" />
              <input
                type="text"
                value={sokning}
                onChange={e => setSokning(e.target.value)}
                placeholder="Sök…"
                className="flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-subtle"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {syncFel && aktivMapp !== 'utkorg' && (
              <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-red-400/10 text-xs text-red-400">{syncFel}</div>
            )}
            {aktivMapp === 'utkorg' ? (
              koMeddelanden.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
                  <Clock size={28} className="text-muted" />
                  <p className="text-sm text-muted">Inga schemalagda utskick</p>
                </div>
              ) : (
                koMeddelanden.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setValtKoMeddelande(m); setKomponera(false); setValtMeddelande(null) }}
                    className={`w-full text-left px-3 py-3 border-b border-border/50 transition-colors hover:bg-hover ${valtKoMeddelande?.id === m.id ? 'bg-hover' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs truncate text-fg font-medium">{m.till}</span>
                      <span className="text-[10px] text-subtle shrink-0">{formatSchemaTid(m.schemalagd_till)}</span>
                    </div>
                    <p className="text-xs truncate mb-1 text-muted">{m.amne || '(Inget ämne)'}</p>
                    <div className="flex items-center gap-1.5">
                      <KoStatusBadge status={m.status} />
                      {m.bilagor.length > 0 && <Paperclip size={10} className="text-subtle shrink-0" />}
                    </div>
                  </button>
                ))
              )
            ) : ingenProvider ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                <Mail size={28} className="text-muted" />
                <p className="text-sm text-fg">E-posten kräver Zoho för tillfället</p>
                <p className="text-xs text-muted leading-relaxed max-w-xs">
                  Anslut Zoho i Inställningar → Integrationer.{gmailConnected && ' Gmail-anslutningen är sparad, men Gmail-stödet kommer i nästa uppdatering.'}
                </p>
              </div>
            ) : visadeMeddelanden.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
                <Mail size={28} className="text-muted" />
                <p className="text-sm text-muted">{sokning ? 'Inga resultat' : 'Inga meddelanden'}</p>
                {!sokning && (
                  <button
                    onClick={handleUppdatera}
                    className="text-xs text-blue-400 hover:underline mt-1"
                  >
                    Hämta nu
                  </button>
                )}
              </div>
            ) : (
              visadeMeddelanden.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setValtMeddelande(m); setKomponera(false) }}
                  className={`w-full text-left px-3 py-3 border-b border-border/50 transition-colors hover:bg-hover ${valtMeddelande?.id === m.id ? 'bg-hover' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`text-xs truncate ${m.olast ? 'font-semibold text-fg' : 'text-muted'}`}>
                      {m.fran_namn || m.fran_adress}
                    </span>
                    <span className="text-[10px] text-subtle shrink-0">{formatDatum(m.datum)}</span>
                  </div>
                  <p className={`text-xs truncate mb-0.5 ${m.olast ? 'text-fg font-medium' : 'text-muted'}`}>{m.amne || '(Inget ämne)'}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] text-subtle truncate flex-1">{m.snippet}</p>
                    {m.har_bilaga && <Paperclip size={10} className="text-subtle shrink-0" />}
                    <ProviderBadge provider={m.provider} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {skickaFel && (
            <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-400/10 text-xs text-red-400 shrink-0">{skickaFel}</div>
          )}
          {komponera ? (
            <ComposePanel
              form={form}
              onChange={setForm}
              onSend={handleSkicka}
              onSchedule={handleSchemalägg}
              onClose={() => setKomponera(false)}
              aliasar={aliasar}
              mallar={mallar}
              sending={skickar}
              scheduling={schemar}
            />
          ) : valtKoMeddelande ? (
            <KoDetailPanel
              meddelande={valtKoMeddelande}
              onAvbryt={() => void handleAvbrytKo(valtKoMeddelande.id)}
              onAterforsok={() => void handleAterforsok(valtKoMeddelande.id)}
            />
          ) : valtMeddelande ? (
            <DetailPanel
              meddelande={valtMeddelande}
              onSvara={handleSvara}
              onVidarebefodra={handleVidarebefodra}
              onSkapaUppgift={handleOpenUppgiftModal}
              onKoppla={handleOpenForslagModal}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <Mail size={32} className="text-muted" />
              <p className="text-sm text-muted">Välj ett meddelande eller skriv ett nytt</p>
              {!ingenProvider && (
                <button
                  onClick={handleNytt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-elevated text-fg hover:bg-hover transition-colors border border-border mt-1"
                >
                  <Pencil size={12} /> Nytt meddelande
                </button>
              )}
              {!ingenProvider && aliasar.length === 0 && (
                <p className="text-[11px] text-amber-400 mt-2">Konfigurera ett alias i Inställningar → E-post alias</p>
              )}
            </div>
          )}
        </div>
      </div>

      {forslagModal && valtMeddelande && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setForslagModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-[420px] max-w-[92vw] bg-bg border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <span className="text-sm font-medium text-fg flex items-center gap-2">
                <FileText size={14} className="text-emerald-400" /> Koppla till förslag
              </span>
              <button onClick={() => setForslagModal(false)} className="p-1 rounded text-muted hover:text-fg hover:bg-hover">
                <X size={14} />
              </button>
            </div>

            <div className="px-4 py-3 border-b border-border">
              <input
                autoFocus
                type="text"
                placeholder="Sök på kundnamn, förslag eller projekt…"
                value={forslagSearch}
                onChange={e => setForslagSearch(e.target.value)}
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder:text-muted outline-none focus:border-fg/30"
              />
            </div>

            <div className="overflow-auto max-h-64 divide-y divide-border">
              {forslagList
                .filter(f =>
                  !forslagSearch ||
                  f.titel.toLowerCase().includes(forslagSearch.toLowerCase()) ||
                  (f.forslag_nummer ?? '').toLowerCase().includes(forslagSearch.toLowerCase()) ||
                  (f.projekt?.kunder?.namn ?? '').toLowerCase().includes(forslagSearch.toLowerCase())
                )
                .map(f => (
                  <button
                    key={f.id}
                    onClick={() => void handleSparaForslagRef(f.id)}
                    disabled={forslagSaving}
                    className="w-full px-4 py-3 text-left hover:bg-hover transition-colors flex flex-col gap-0.5 disabled:opacity-40"
                  >
                    <p className="text-sm text-fg">{f.forslag_nummer} — {f.titel}</p>
                    <p className="text-xs text-muted">
                      {f.projekt?.kunder?.namn} · {f.projekt?.namn}
                    </p>
                  </button>
                ))
              }
              {forslagList.filter(f =>
                !forslagSearch ||
                f.titel.toLowerCase().includes(forslagSearch.toLowerCase()) ||
                (f.forslag_nummer ?? '').toLowerCase().includes(forslagSearch.toLowerCase()) ||
                (f.projekt?.kunder?.namn ?? '').toLowerCase().includes(forslagSearch.toLowerCase())
              ).length === 0 && (
                <p className="px-4 py-6 text-xs text-muted text-center">Inga förslag hittades</p>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border flex items-center justify-end">
              <button
                onClick={() => setForslagModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-fg hover:bg-hover transition-colors"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {uppgiftModal && valtMeddelande && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setUppgiftModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-[400px] max-w-[92vw] bg-bg border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <span className="text-sm font-medium text-fg flex items-center gap-2">
                <CalendarPlus size={14} className="text-blue-400" /> Skapa uppgift från e-post
              </span>
              <button onClick={() => setUppgiftModal(false)} className="p-1 rounded text-muted hover:text-fg hover:bg-hover">
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted">Titel</label>
                <input
                  autoFocus
                  value={uppgiftForm.titel}
                  onChange={e => setUppgiftForm(f => ({ ...f, titel: e.target.value }))}
                  className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-fg/30"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted">Datum och tid</label>
                <input
                  type="datetime-local"
                  value={uppgiftForm.datum}
                  onChange={e => setUppgiftForm(f => ({ ...f, datum: e.target.value }))}
                  className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-fg/30"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted">Beskrivning (valfri)</label>
                <textarea
                  value={uppgiftForm.beskrivning}
                  onChange={e => setUppgiftForm(f => ({ ...f, beskrivning: e.target.value }))}
                  rows={3}
                  className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-fg/30 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-elevated border border-border">
                <Mail size={13} className="text-blue-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-fg truncate">{valtMeddelande.amne || '(Inget ämne)'}</p>
                  <p className="text-[11px] text-muted truncate">{valtMeddelande.fran_namn || valtMeddelande.fran_adress}</p>
                </div>
              </div>

              {uppgiftFel && (
                <p className="text-xs text-red-400">{uppgiftFel}</p>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border flex items-center gap-2 justify-end">
              <button
                onClick={() => setUppgiftModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-fg hover:bg-hover transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={() => void handleSpararUppgift()}
                disabled={!uppgiftForm.titel || !uppgiftForm.datum || spararUppgift}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {spararUppgift ? 'Skapar…' : 'Skapa uppgift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
