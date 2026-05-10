import { useState } from 'react'
import { ArrowLeft, Copy, Check, FileText, Plus, Loader2, Trash2, Mail, Send, X } from 'lucide-react'
import type { Frageblankett, FragaFalt, ProjektDokument, FrageblanktEpostDraft } from './types'

interface Props {
  frageblanktter: Frageblankett[]
  onGenerateFromText: (txt: string) => Promise<FragaFalt[]>
  onCreateBlankett: (titel: string, questionsJson: FragaFalt[]) => Promise<Frageblankett>
  onDeleteBlankett: (id: string) => Promise<void>
  onGetLink: (id: string) => Promise<string>
  onSaveAsDoc: (id: string) => Promise<ProjektDokument>
  onRefresh: (id: string) => Promise<Frageblankett>
  onGetEpostDraft: (blankettId: string) => Promise<FrageblanktEpostDraft>
  onSendEpost: (draft: FrageblanktEpostDraft) => Promise<void>
}

type View = 'list' | 'create' | 'detail'

const STATUS_LABEL: Record<Frageblankett['status'], string> = {
  utkast: 'Utkast',
  skickat: 'Skickat',
  besvarat: 'Besvarat',
}
const STATUS_COLOR: Record<Frageblankett['status'], string> = {
  utkast: 'text-muted',
  skickat: 'text-amber-400',
  besvarat: 'text-emerald-400',
}

export function FrageblanketterPanel({ frageblanktter, onGenerateFromText, onCreateBlankett, onDeleteBlankett, onGetLink, onSaveAsDoc, onRefresh, onGetEpostDraft, onSendEpost }: Props) {
  const [view, setView] = useState<View>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailBlankett, setDetailBlankett] = useState<Frageblankett | null>(null)

  // Create wizard state
  const [step, setStep] = useState<1 | 2>(1)
  const [inputTxt, setInputTxt] = useState('')
  const [generatedQuestions, setGeneratedQuestions] = useState<FragaFalt[]>([])
  const [titel, setTitel] = useState('Frågeformulär')
  const [generating, setGenerating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  // Detail state
  const [copiedLink, setCopiedLink] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [savingDoc, setSavingDoc] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saveDocDone, setSaveDocDone] = useState(false)

  // Email compose state
  const [epostDraft, setEpostDraft] = useState<FrageblanktEpostDraft | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [epostTill, setEpostTill] = useState('')
  const [epostAmne, setEpostAmne] = useState('')
  const [sendingEpost, setSendingEpost] = useState(false)
  const [epostSent, setEpostSent] = useState(false)
  const [epostError, setEpostError] = useState<string | null>(null)

  function openDetail(b: Frageblankett) {
    setDetailBlankett(b)
    setSelectedId(b.id)
    setSaveDocDone(false)
    setEpostDraft(null)
    setEpostSent(false)
    setEpostError(null)
    setLinkError(null)
    setView('detail')
  }

  function resetCreate() {
    setStep(1)
    setInputTxt('')
    setGeneratedQuestions([])
    setTitel('Frågeformulär')
    setGenError(null)
  }

  async function handleGenerate() {
    if (!inputTxt.trim()) return
    setGenerating(true)
    setGenError(null)
    try {
      const questions = await onGenerateFromText(inputTxt)
      setGeneratedQuestions(questions)
      setStep(2)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Fel vid generering')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCreate() {
    if (!titel.trim() || generatedQuestions.length === 0) return
    setCreating(true)
    setCreateError(null)
    try {
      const b = await onCreateBlankett(titel.trim(), generatedQuestions)
      resetCreate()
      openDetail(b)
      try {
        const link = await onGetLink(b.id)
        await navigator.clipboard.writeText(link)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
      } catch {
        // link copy failed — user can retry with the button in detail view
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Kunde inte skapa formuläret')
    } finally {
      setCreating(false)
    }
  }

  async function handleCopyLink() {
    if (!selectedId) return
    setLinkError(null)
    try {
      const link = await onGetLink(selectedId)
      await navigator.clipboard.writeText(link)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Kunde inte hämta länk')
    }
  }

  async function handleSaveAsDoc() {
    if (!selectedId) return
    setSavingDoc(true)
    try {
      await onSaveAsDoc(selectedId)
      setSaveDocDone(true)
    } finally {
      setSavingDoc(false)
    }
  }

  async function handleRefresh() {
    if (!selectedId) return
    setRefreshing(true)
    try {
      const updated = await onRefresh(selectedId)
      setDetailBlankett(updated)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleLoadEpostDraft() {
    if (!selectedId) return
    setLoadingDraft(true)
    setEpostError(null)
    try {
      const draft = await onGetEpostDraft(selectedId)
      setEpostDraft(draft)
      setEpostTill(draft.till)
      setEpostAmne(draft.amne)
    } catch (e) {
      setEpostError(e instanceof Error ? e.message : 'Kunde inte hämta e-postmall')
    } finally {
      setLoadingDraft(false)
    }
  }

  async function handleSendEpost() {
    if (!epostDraft) return
    setSendingEpost(true)
    setEpostError(null)
    try {
      await onSendEpost({ ...epostDraft, till: epostTill, amne: epostAmne })
      setEpostSent(true)
      setTimeout(() => { setEpostDraft(null); setEpostSent(false) }, 2500)
    } catch (e) {
      setEpostError(e instanceof Error ? e.message : 'Kunde inte skicka e-post')
    } finally {
      setSendingEpost(false)
    }
  }

  async function handleDelete(id: string) {
    await onDeleteBlankett(id)
    if (view === 'detail' && selectedId === id) {
      setView('list')
      setSelectedId(null)
      setDetailBlankett(null)
    }
  }

  // --- LIST VIEW ---
  if (view === 'list') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <p className="text-[11px] uppercase tracking-widest text-muted font-semibold">Formulär</p>
          <button
            onClick={() => { resetCreate(); setView('create') }}
            className="flex items-center gap-1 text-xs text-muted hover:text-fg transition-colors"
          >
            <Plus size={12} />
            Nytt
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {frageblanktter.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <FileText size={24} className="text-subtle" />
              <p className="text-xs text-subtle">Inga formulär ännu.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {frageblanktter.map((b) => (
                <button
                  key={b.id}
                  onClick={() => openDetail(b)}
                  className="w-full text-left px-4 py-3 hover:bg-hover transition-colors flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-fg font-medium truncate">{b.titel}</p>
                    <p className="text-[11px] text-subtle">{new Date(b.skapad_at).toLocaleDateString('sv-SE')} · {b.questions_json.length} frågor</p>
                  </div>
                  <span className={`text-[10px] font-semibold shrink-0 mt-0.5 ${STATUS_COLOR[b.status]}`}>
                    {STATUS_LABEL[b.status]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- CREATE VIEW ---
  if (view === 'create') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <button onClick={() => setView('list')} className="text-muted hover:text-fg transition-colors">
            <ArrowLeft size={14} />
          </button>
          <p className="text-[11px] uppercase tracking-widest text-muted font-semibold">
            {step === 1 ? 'Klistra in frågor' : 'Förhandsgranska & skapa'}
          </p>
        </div>

        {step === 1 && (
          <div className="flex-1 flex flex-col gap-3 p-4 overflow-auto">
            <div className="flex-1 flex flex-col">
              <label className="text-[11px] uppercase tracking-widest text-muted block mb-1.5">Frågor (.txt)</label>
              <textarea
                value={inputTxt}
                onChange={(e) => setInputTxt(e.target.value)}
                placeholder="Klistra in dina frågor här, en per rad..."
                className="flex-1 min-h-[160px] bg-elevated border border-border rounded px-3 py-2 text-xs text-fg placeholder:text-subtle resize-none"
              />
            </div>
            {genError && <p className="text-xs text-red-400">{genError}</p>}
            <button
              onClick={handleGenerate}
              disabled={generating || !inputTxt.trim()}
              className="flex items-center justify-center gap-2 py-2 rounded text-xs font-semibold bg-elevated border border-border text-fg hover:bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : null}
              {generating ? 'Genererar...' : 'Generera formulär'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col gap-3 p-4 overflow-auto">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted block mb-1.5">Titel</label>
              <input
                type="text"
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                className="w-full bg-elevated border border-border rounded px-2 py-1.5 text-xs text-fg"
              />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted mb-2">{generatedQuestions.length} frågor genererade</p>
              <div className="flex flex-col gap-1.5">
                {generatedQuestions.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-2">
                    <span className="text-[10px] text-subtle shrink-0 mt-0.5 w-4 text-right">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-xs text-fg">{q.label}</p>
                      <p className="text-[10px] text-subtle">{q.type}{q.options ? ` (${q.options.join(', ')})` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <div className="flex gap-2 mt-auto">
              <button onClick={() => setStep(1)} className="flex-1 py-2 rounded text-xs text-muted border border-border hover:text-fg hover:bg-hover transition-colors">
                Tillbaka
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !titel.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold bg-elevated border border-border text-fg hover:bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
                {creating ? 'Skapar...' : 'Skapa & kopiera länk'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // --- DETAIL VIEW ---
  const b = detailBlankett
  if (!b) return null

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <button onClick={() => setView('list')} className="text-muted hover:text-fg transition-colors">
          <ArrowLeft size={14} />
        </button>
        <p className="text-[11px] uppercase tracking-widest text-muted font-semibold truncate flex-1">{b.titel}</p>
        <span className={`text-[10px] font-semibold shrink-0 ${STATUS_COLOR[b.status]}`}>{STATUS_LABEL[b.status]}</span>
        <button
          onClick={() => handleDelete(b.id)}
          className="text-subtle hover:text-red-400 transition-colors shrink-0"
          title="Ta bort"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4 flex flex-col gap-4">
          {/* Questions + Answers */}
          <div className="flex flex-col gap-3">
            {b.questions_json.map((q, i) => (
              <div key={q.id} className="flex flex-col gap-0.5">
                <p className="text-[11px] text-muted">{i + 1}. {q.label}</p>
                <p className="text-xs text-fg pl-3">
                  {b.answers_json?.[q.id] ?? <span className="text-subtle italic">Ej besvarat</span>}
                </p>
              </div>
            ))}
          </div>

          {b.status !== 'besvarat' && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center justify-center gap-1.5 py-2 rounded text-xs text-muted border border-border hover:text-fg hover:bg-hover transition-colors disabled:opacity-50"
            >
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : null}
              {refreshing ? 'Kontrollerar...' : 'Kontrollera svar'}
            </button>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="shrink-0 border-t border-border p-4 flex flex-col gap-2">
        <button
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-1.5 py-2 rounded text-xs border border-border text-muted hover:text-fg hover:bg-hover transition-colors"
        >
          {copiedLink ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          {copiedLink ? 'Kopierat!' : 'Kopiera länk'}
        </button>
        {linkError && <p className="text-[10px] text-red-400 text-center">{linkError}</p>}

        {/* Send via email */}
        {!epostDraft ? (
          <button
            onClick={handleLoadEpostDraft}
            disabled={loadingDraft}
            className="flex items-center justify-center gap-1.5 py-2 rounded text-xs border border-border text-muted hover:text-fg hover:bg-hover transition-colors disabled:opacity-50"
          >
            {loadingDraft ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
            {loadingDraft ? 'Laddar...' : 'Skicka via e-post'}
          </button>
        ) : epostSent ? (
          <div className="flex items-center justify-center gap-1.5 py-2 rounded text-xs border border-border text-emerald-400">
            <Check size={12} /> Skickat!
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded border border-border p-3 bg-elevated">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-muted font-semibold">E-post</p>
              <button onClick={() => setEpostDraft(null)} className="text-subtle hover:text-fg transition-colors">
                <X size={11} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-subtle">Till</label>
                <input
                  type="email"
                  value={epostTill}
                  onChange={(e) => setEpostTill(e.target.value)}
                  className="bg-bg border border-border rounded px-2 py-1 text-xs text-fg"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-subtle">Ämne</label>
                <input
                  type="text"
                  value={epostAmne}
                  onChange={(e) => setEpostAmne(e.target.value)}
                  className="bg-bg border border-border rounded px-2 py-1 text-xs text-fg"
                />
              </div>
            </div>
            {epostError && <p className="text-[10px] text-red-400">{epostError}</p>}
            <button
              onClick={handleSendEpost}
              disabled={sendingEpost || !epostTill.trim() || !epostAmne.trim()}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold bg-elevated border border-border text-fg hover:bg-hover transition-colors disabled:opacity-50"
            >
              {sendingEpost ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              {sendingEpost ? 'Skickar...' : 'Skicka'}
            </button>
          </div>
        )}

        {b.status === 'besvarat' && (
          <button
            onClick={handleSaveAsDoc}
            disabled={savingDoc || saveDocDone}
            className="flex items-center justify-center gap-1.5 py-2 rounded text-xs border border-border text-muted hover:text-fg hover:bg-hover transition-colors disabled:opacity-50"
          >
            {savingDoc ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            {saveDocDone ? 'Sparat som dokument' : savingDoc ? 'Sparar...' : 'Spara som dokument'}
          </button>
        )}
      </div>
    </div>
  )
}
