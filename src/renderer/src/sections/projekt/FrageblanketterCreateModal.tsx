import { useState } from 'react'
import { X, Copy, Loader2 } from 'lucide-react'
import type { Frageblankett, FragaFalt } from './types'

interface Props {
  projektId: string
  onGenerateFromText: (txt: string) => Promise<FragaFalt[]>
  onCreateBlankett: (projektId: string, titel: string, questions: FragaFalt[]) => Promise<Frageblankett>
  onGetLink: (id: string) => Promise<string>
  onClose: () => void
}

export function FrageblanketterCreateModal({ projektId, onGenerateFromText, onCreateBlankett, onGetLink, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [inputTxt, setInputTxt] = useState('')
  const [generatedQuestions, setGeneratedQuestions] = useState<FragaFalt[]>([])
  const [titel, setTitel] = useState('Frågeformulär')
  const [generating, setGenerating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

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
      const b = await onCreateBlankett(projektId, titel.trim(), generatedQuestions)
      try {
        const link = await onGetLink(b.id)
        await navigator.clipboard.writeText(link)
      } catch {
        // clipboard failed — not critical
      }
      setDone(true)
      setTimeout(() => onClose(), 1200)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Kunde inte skapa formuläret')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-elevated border border-border rounded-xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <p className="text-[11px] uppercase tracking-widest text-muted font-semibold">
            {done ? 'Formulär skapat' : step === 1 ? 'Klistra in frågor' : 'Förhandsgranska & skapa'}
          </p>
          <button onClick={onClose} className="text-subtle hover:text-fg transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Done state */}
        {done && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="flex flex-col items-center gap-2">
              <Copy size={20} className="text-emerald-400" />
              <p className="text-sm text-fg font-medium">Formulär skapat</p>
              <p className="text-xs text-muted">Länken kopierades till urklipp</p>
            </div>
          </div>
        )}

        {/* Step 1 */}
        {!done && step === 1 && (
          <div className="flex-1 flex flex-col gap-3 p-5 min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0">
              <label className="text-[11px] uppercase tracking-widest text-muted block mb-1.5">Frågor (.txt)</label>
              <textarea
                autoFocus
                value={inputTxt}
                onChange={(e) => setInputTxt(e.target.value)}
                placeholder="Klistra in dina frågor här, en per rad..."
                className="flex-1 min-h-[260px] bg-bg border border-border rounded px-3 py-2.5 text-xs text-fg placeholder:text-subtle resize-none overflow-auto"
              />
            </div>
            {genError && <p className="text-xs text-red-400 shrink-0">{genError}</p>}
            <button
              onClick={handleGenerate}
              disabled={generating || !inputTxt.trim()}
              className="shrink-0 flex items-center justify-center gap-2 py-2.5 rounded text-xs font-semibold bg-hover border border-border text-fg hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : null}
              {generating ? 'Genererar...' : 'Generera formulär'}
            </button>
          </div>
        )}

        {/* Step 2 */}
        {!done && step === 2 && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col gap-3 p-5 min-h-0 overflow-hidden">
              <div className="shrink-0">
                <label className="text-[11px] uppercase tracking-widest text-muted block mb-1.5">Titel</label>
                <input
                  type="text"
                  value={titel}
                  onChange={(e) => setTitel(e.target.value)}
                  className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-fg"
                />
              </div>
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <p className="text-[11px] uppercase tracking-widest text-muted mb-2 shrink-0">{generatedQuestions.length} frågor genererade</p>
                <div className="flex-1 overflow-auto flex flex-col gap-1.5 pr-1">
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
              {createError && <p className="text-xs text-red-400 shrink-0">{createError}</p>}
            </div>
            <div className="flex gap-2 px-5 pb-5 shrink-0">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2 rounded text-xs text-muted border border-border hover:text-fg hover:bg-hover transition-colors"
              >
                Tillbaka
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !titel.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold bg-hover border border-border text-fg hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
                {creating ? 'Skapar...' : 'Skapa & kopiera länk'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
