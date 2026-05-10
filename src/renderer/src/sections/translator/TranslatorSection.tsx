import { useState } from 'react'
import { Copy, Check, Languages, Loader2 } from 'lucide-react'

interface ColumnProps {
  from: string
  to: string
  input: string
  output: string
  loading: boolean
  error: string
  copied: boolean
  onInput: (v: string) => void
  onTranslate: () => void
  onCopy: () => void
}

function TranslatorColumn({ from, to, input, output, loading, error, copied, onInput, onTranslate, onCopy }: ColumnProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden p-5 gap-3">
      <p className="text-[11px] uppercase tracking-widest text-muted shrink-0">
        {from} <span className="text-subtle">→</span> {to}
      </p>

      <textarea
        value={input}
        onChange={(e) => onInput(e.target.value)}
        placeholder={`Klistra in eller skriv text på ${from.charAt(0) + from.slice(1).toLowerCase()}…`}
        className="flex-1 min-h-[160px] w-full resize-none rounded-lg border border-border bg-elevated p-3 text-sm text-fg placeholder:text-subtle focus:outline-none focus:border-muted transition-colors"
      />

      <button
        onClick={onTranslate}
        disabled={loading || !input.trim()}
        className="shrink-0 flex items-center justify-center gap-2 rounded-lg border border-border bg-elevated px-4 py-2 text-sm text-fg hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {loading ? 'Översätter…' : 'Översätt'}
      </button>

      <div className="border-t border-border shrink-0" />

      <div className="flex-1 min-h-[140px] relative">
        <textarea
          readOnly
          value={error ? '' : output}
          placeholder={error || 'Översättningen visas här…'}
          className={`h-full w-full resize-none rounded-lg border border-border p-3 text-sm focus:outline-none ${
            error
              ? 'bg-elevated text-red-400 placeholder:text-red-400'
              : 'bg-elevated text-fg placeholder:text-subtle'
          }`}
        />
        {output && !error && (
          <button
            onClick={onCopy}
            title="Kopiera översättning"
            className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted hover:bg-hover hover:text-fg transition-colors bg-elevated border border-border"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Kopierat' : 'Kopiera'}
          </button>
        )}
      </div>
    </div>
  )
}

export function TranslatorSection() {
  const [inputSv, setInputSv] = useState('')
  const [outputSv, setOutputSv] = useState('')
  const [loadingSv, setLoadingSv] = useState(false)
  const [errorSv, setErrorSv] = useState('')
  const [copiedSv, setCopiedSv] = useState(false)

  const [inputEs, setInputEs] = useState('')
  const [outputEs, setOutputEs] = useState('')
  const [loadingEs, setLoadingEs] = useState(false)
  const [errorEs, setErrorEs] = useState('')
  const [copiedEs, setCopiedEs] = useState(false)

  async function translate(direction: 'sv-es' | 'es-sv'): Promise<void> {
    const text = direction === 'sv-es' ? inputSv : inputEs
    if (!text.trim()) return

    if (direction === 'sv-es') {
      setLoadingSv(true); setErrorSv(''); setOutputSv('')
    } else {
      setLoadingEs(true); setErrorEs(''); setOutputEs('')
    }

    try {
      const result = await window.api.invoke('ai:translate', { text, direction }) as string
      if (direction === 'sv-es') setOutputSv(result)
      else setOutputEs(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Translation error'
      if (direction === 'sv-es') setErrorSv(msg)
      else setErrorEs(msg)
    } finally {
      if (direction === 'sv-es') setLoadingSv(false)
      else setLoadingEs(false)
    }
  }

  async function copy(text: string, setCopied: (v: boolean) => void): Promise<void> {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <Languages size={16} className="text-muted" />
        <h2 className="text-sm font-semibold text-fg">Översättare</h2>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <TranslatorColumn
          from="SVENSKA"
          to="ESPAÑOL"
          input={inputSv}
          output={outputSv}
          loading={loadingSv}
          error={errorSv}
          copied={copiedSv}
          onInput={setInputSv}
          onTranslate={() => { void translate('sv-es') }}
          onCopy={() => { void copy(outputSv, setCopiedSv) }}
        />
        <div className="w-px bg-border shrink-0" />
        <TranslatorColumn
          from="ESPAÑOL"
          to="SVENSKA"
          input={inputEs}
          output={outputEs}
          loading={loadingEs}
          error={errorEs}
          copied={copiedEs}
          onInput={setInputEs}
          onTranslate={() => { void translate('es-sv') }}
          onCopy={() => { void copy(outputEs, setCopiedEs) }}
        />
      </div>
    </div>
  )
}
