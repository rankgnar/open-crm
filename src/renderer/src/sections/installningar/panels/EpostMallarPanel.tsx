import { useState, useEffect } from 'react'
import { Plus, Trash2, Check, X, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react'
import type { EpostMall, EpostAlias } from '@/sections/epost/types'
import type { AvslutFragaFalt, FragaTyp } from '@/types/fraga'
import { EmailBody } from '@/components/EmailBody'
import { SelectField } from '@/components/SelectField'

const KATEGORIER = ['Förslag', 'Order', 'ÄTA', 'Dokument', 'Offert', 'Faktura', 'Uppföljning', 'Allmänt']

const EMPTY_FORM: Omit<EpostMall, 'id' | 'skapad_at' | 'uppdaterad_at'> = {
  namn: '',
  amne: '',
  kropp_html: '',
  kategori: 'Allmänt',
  system_kod: null,
  alias_id: null,
  meddelande_standard: null,
  questions_json: null,
  aktiv: true,
  sortering: 0,
}

interface FormState extends Omit<EpostMall, 'id' | 'skapad_at' | 'uppdaterad_at'> {}

export function EpostMallarPanel() {
  const [mallar, setMallar] = useState<EpostMall[]>([])
  const [aliasar, setAliasar] = useState<EpostAlias[]>([])
  const [vald, setVald] = useState<EpostMall | null>(null)
  const [redigerar, setRedigerar] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [laddar, setLaddar] = useState(false)
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)
  const [forhandsvy, setForhandsvy] = useState(false)
  const [expandedMallQ, setExpandedMallQ] = useState<string | null>(null)

  useEffect(() => {
    void hamtaMallar()
    void hamtaAliasar()
  }, [])

  async function hamtaAliasar() {
    try {
      const data = await window.api.invoke('db:epost-alias:list') as EpostAlias[]
      setAliasar(data.filter(a => a.aktiv))
    } catch {
      // ignore
    }
  }

  async function hamtaMallar() {
    setLaddar(true)
    try {
      const data = await window.api.invoke('db:epost-mallar:list') as EpostMall[]
      setMallar(data)
    } catch {
      // tabell inte skapad än
    } finally {
      setLaddar(false)
    }
  }

  function handleNy() {
    setVald(null)
    setForm(EMPTY_FORM)
    setRedigerar(true)
    setFel(null)
  }

  function handleRedigera(mall: EpostMall) {
    setVald(mall)
    setExpandedMallQ(null)
    setForm({
      namn: mall.namn,
      amne: mall.amne,
      kropp_html: mall.kropp_html,
      kategori: mall.kategori,
      system_kod: mall.system_kod,
      alias_id: mall.alias_id,
      meddelande_standard: mall.meddelande_standard,
      questions_json: mall.questions_json ?? null,
      aktiv: mall.aktiv,
      sortering: mall.sortering,
    })
    setRedigerar(true)
    setFel(null)
  }

  async function handleSpara() {
    if (!form.namn.trim() || !form.amne.trim()) {
      setFel('Namn och ämne är obligatoriska')
      return
    }
    setSparar(true)
    setFel(null)
    try {
      if (vald) {
        await window.api.invoke('db:epost-mallar:update', { id: vald.id, ...form })
      } else {
        await window.api.invoke('db:epost-mallar:create', form)
      }
      await hamtaMallar()
      setRedigerar(false)
      setVald(null)
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Fel vid sparande')
    } finally {
      setSparar(false)
    }
  }

  async function handleToggleAktiv(mall: EpostMall) {
    try {
      await window.api.invoke('db:epost-mallar:update', { id: mall.id, aktiv: !mall.aktiv })
      setMallar(prev => prev.map(m => m.id === mall.id ? { ...m, aktiv: !mall.aktiv } : m))
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Fel')
    }
  }

  async function handleTabort(id: string) {
    if (!confirm('Ta bort mallen?')) return
    try {
      await window.api.invoke('db:epost-mallar:delete', id)
      await hamtaMallar()
      if (vald?.id === id) { setVald(null); setRedigerar(false) }
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Fel vid borttagning')
    }
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Lista */}
      <div className="w-[28rem] shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-xs text-muted">{mallar.length} mallar</span>
          <button
            onClick={handleNy}
            className="flex items-center gap-1.5 text-xs text-fg px-2.5 py-1.5 rounded-lg hover:bg-hover transition-colors"
          >
            <Plus size={12} /> Ny mall
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {laddar ? (
            <p className="px-4 py-6 text-sm text-muted text-center">Laddar…</p>
          ) : mallar.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted text-center">Inga mallar ännu</p>
          ) : (
            mallar.map(mall => (
              <div
                key={mall.id}
                className={`group w-full flex items-center border-b border-border/50 transition-colors hover:bg-hover ${vald?.id === mall.id && redigerar ? 'bg-hover' : ''}`}
              >
                <button
                  onClick={() => handleRedigera(mall)}
                  className="flex-1 text-left px-4 py-3 min-w-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className={`text-sm truncate ${mall.aktiv ? 'text-fg' : 'text-muted line-through'}`}>{mall.namn}</p>
                    {mall.system_kod && (
                      <span className="shrink-0 text-[9px] uppercase tracking-wider text-subtle border border-border rounded px-1">sys</span>
                    )}
                  </div>
                  <p className="text-[11px] text-subtle truncate">{mall.kategori}</p>
                </button>
                <div className="flex items-center gap-0.5 px-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => void handleToggleAktiv(mall)}
                    title={mall.aktiv ? 'Avaktivera' : 'Aktivera'}
                    className={`p-1 rounded transition-colors ${mall.aktiv ? 'text-emerald-400 hover:text-emerald-300' : 'text-subtle hover:text-fg'}`}
                  >
                    {mall.aktiv ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                  </button>
                  <button
                    onClick={() => void handleTabort(mall.id)}
                    className="p-1 rounded text-subtle hover:text-red-400 hover:bg-hover"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Formulär */}
      {redigerar ? (
        <div className="flex-1 overflow-auto px-8 py-6 flex flex-col gap-5">
          <p className="text-[11px] uppercase tracking-widest text-muted">
            {vald ? 'Redigera mall' : 'Ny mall'}
          </p>

          {fel && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{fel}</div>
          )}

          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted">Namn</label>
              <input
                type="text"
                value={form.namn}
                onChange={e => setForm(f => ({ ...f, namn: e.target.value }))}
                placeholder="Offert-bekräftelse"
                className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30 placeholder:text-subtle"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted">Kategori</label>
              <SelectField
                value={form.kategori}
                onChange={(v) => setForm((f) => ({ ...f, kategori: v }))}
                options={KATEGORIER.map((k) => ({ value: k, label: k }))}
              />
            </div>

            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-[11px] uppercase tracking-widest text-muted">Ämnesrad</label>
              <input
                type="text"
                value={form.amne}
                onChange={e => setForm(f => ({ ...f, amne: e.target.value }))}
                placeholder="Offert nr {{offert_nummer}} — {{foretag_namn}}"
                className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30 placeholder:text-subtle"
              />
              <p className="text-[11px] text-subtle">
                Variabler: {'{{kund_namn}}'}, {'{{kund_email}}'}, {'{{foretag_namn}}'}, {'{{foretag_email}}'},{' '}
                {'{{projekt_namn}}'}, {'{{projekt_nummer}}'}, {'{{offert_nummer}}'}, {'{{faktura_nummer}}'},{' '}
                {'{{datum}}'}, {'{{alias_signatur}}'}
              </p>
            </div>

            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-[11px] uppercase tracking-widest text-muted">Standardalias</label>
              <SelectField
                value={form.alias_id ?? ''}
                onChange={(v) => setForm((f) => ({ ...f, alias_id: v || null }))}
                placeholder="— Använd standardalias —"
                className="w-48"
                options={aliasar.map((a) => ({ value: a.id, label: a.etikett || a.fran_adress }))}
              />
            </div>

            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-[11px] uppercase tracking-widest text-muted">Standardmeddelande (valfritt)</label>
              <textarea
                value={form.meddelande_standard ?? ''}
                onChange={e => setForm(f => ({ ...f, meddelande_standard: e.target.value || null }))}
                placeholder={'T.ex. "Hej {{kund_namn}}! Vi ville bara höra om du fått chansen att titta på offerten…"'}
                rows={4}
                className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30 placeholder:text-subtle resize-none"
              />
              <p className="text-[11px] text-subtle">
                Förfylls i fältet "Personligt meddelande" när mallen används. Kan redigeras innan utskick. Stödjer <code className="text-fg/70">{'{{kund_namn}}'}</code>.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-widest text-muted">Innehåll (HTML)</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setForhandsvy(false)}
                    className={`text-[11px] px-2.5 py-1 rounded transition-colors ${!forhandsvy ? 'bg-hover text-fg' : 'text-muted hover:text-fg hover:bg-hover'}`}
                  >
                    Redigera
                  </button>
                  <button
                    type="button"
                    onClick={() => setForhandsvy(true)}
                    className={`text-[11px] px-2.5 py-1 rounded transition-colors ${forhandsvy ? 'bg-hover text-fg' : 'text-muted hover:text-fg hover:bg-hover'}`}
                  >
                    Förhandsgranska
                  </button>
                </div>
              </div>
              {forhandsvy ? (
                <div className="bg-bg border border-border rounded-lg overflow-auto" style={{ maxHeight: '600px' }}>
                  <EmailBody
                    html={(() => {
                      const base = form.kropp_html || '<p style="color:#888"><em>(Inget innehåll)</em></p>'
                      const sig = aliasar.find(a => a.id === form.alias_id)?.signatur_html
                      if (sig && !base.includes(sig)) return `${base}<br><br>${sig}`
                      return base
                    })()}
                  />
                </div>
              ) : (
                <textarea
                  value={form.kropp_html}
                  onChange={e => setForm(f => ({ ...f, kropp_html: e.target.value }))}
                  placeholder={'<p>Hej {{kund_namn}},</p>\n<p>...</p>'}
                  rows={12}
                  className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30 placeholder:text-subtle font-mono resize-none"
                />
              )}
              {forhandsvy && (
                <p className="text-[11px] text-subtle">Variabler som <code className="text-fg/70">{'{{...}}'}</code> visas oförändrade — de fylls i när mallen används.</p>
              )}
            </div>

            {form.system_kod === 'projekt_avslut_feedback' && (
              <div className="flex flex-col gap-3 col-span-2">
                <p className="text-[11px] uppercase tracking-widest text-muted">Frågemall</p>
                <div className="flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {(form.questions_json ?? []).map((q, idx) => (
                    <AvslutQuestionEditor
                      key={q.id}
                      question={q}
                      expanded={expandedMallQ === q.id}
                      onToggle={() => setExpandedMallQ((v) => v === q.id ? null : q.id)}
                      onChange={(updated) => setForm((f) => ({
                        ...f,
                        questions_json: (f.questions_json ?? []).map((x, i) => i === idx ? updated : x),
                      }))}
                      onDelete={() => setForm((f) => ({
                        ...f,
                        questions_json: (f.questions_json ?? []).filter((_, i) => i !== idx),
                      }))}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const id = `q${Date.now()}`
                    setForm((f) => ({
                      ...f,
                      questions_json: [...(f.questions_json ?? []), { id, label: '', type: 'text' as const, required: false, options: null }],
                    }))
                    setExpandedMallQ(id)
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
                >
                  <Plus size={12} /> Lägg till fråga
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="aktiv"
                checked={form.aktiv}
                onChange={e => setForm(f => ({ ...f, aktiv: e.target.checked }))}
                className="accent-emerald-400"
              />
              <label htmlFor="aktiv" className="text-sm text-fg">Aktiv</label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => void handleSpara()}
              disabled={sparar}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
            >
              <Check size={14} /> {sparar ? 'Sparar…' : 'Spara'}
            </button>
            <button
              onClick={() => { setRedigerar(false); setVald(null) }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-muted hover:text-fg hover:bg-hover transition-colors"
            >
              <X size={14} /> Avbryt
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted text-sm">
          Välj en mall eller skapa en ny
        </div>
      )}
    </div>
  )
}

function AvslutQuestionEditor({
  question, expanded, onToggle, onChange, onDelete,
}: {
  question: AvslutFragaFalt
  expanded: boolean
  onToggle: () => void
  onChange: (q: AvslutFragaFalt) => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 hover:bg-hover transition-colors">
        <button onClick={onToggle} className="flex-1 text-left min-w-0 pr-2">
          <span className="text-xs text-fg truncate block">{question.label || 'Ny fråga'}</span>
          <span className="text-[10px] text-subtle">{question.type}{question.required ? ' · krävs' : ''}</span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onDelete} className="text-subtle hover:text-red-400 transition-colors p-1">
            <Trash2 size={11} />
          </button>
          <button onClick={onToggle} className="text-subtle hover:text-fg transition-colors p-1">
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted">Label</span>
            <input
              value={question.label}
              onChange={(e) => onChange({ ...question, label: e.target.value })}
              className="w-full bg-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-fg outline-none focus:border-fg/30"
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-[10px] uppercase tracking-wider text-muted">Typ</span>
              <select
                value={question.type}
                onChange={(e) => {
                  const type = e.target.value as FragaTyp
                  onChange({ ...question, type, options: type === 'select' ? (question.options ?? []) : null })
                }}
                className="w-full bg-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-fg outline-none"
              >
                {(['text', 'textarea', 'number', 'select', 'date', 'boolean'] as FragaTyp[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <label className="flex flex-col gap-1 items-center pb-1 cursor-pointer">
              <span className="text-[10px] uppercase tracking-wider text-muted">Krävs</span>
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => onChange({ ...question, required: e.target.checked })}
                className="accent-emerald-400"
              />
            </label>
          </div>
          {question.type === 'select' && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted">Alternativ (en per rad)</span>
              <textarea
                value={(question.options ?? []).join('\n')}
                onChange={(e) => onChange({ ...question, options: e.target.value.split('\n') })}
                rows={4}
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg font-mono resize-none outline-none focus:border-fg/30"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
