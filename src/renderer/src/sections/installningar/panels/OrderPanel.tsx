import { useState, useEffect } from 'react'
import { STATUS_FARG, type OrderStatus } from '@/sections/order/types'
import { useAppConfig } from '@/context/AppConfig'

const STATUSAR: OrderStatus[] = ['Utkast', 'Skickad', 'Godkänd', 'Avvisad']

export function OrderPanel() {
  const { config, updateConfig } = useAppConfig()
  const [current, setCurrent] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [villkorDraft, setVillkorDraft] = useState('')
  const [villkorSaved, setVillkorSaved] = useState(false)
  useEffect(() => { setVillkorDraft(config?.order_std_villkor ?? '') }, [config?.order_std_villkor])

  async function saveVillkor() {
    if (villkorDraft === (config?.order_std_villkor ?? '')) return
    await updateConfig({ order_std_villkor: villkorDraft })
    setVillkorSaved(true)
    setTimeout(() => setVillkorSaved(false), 2000)
  }

  useEffect(() => {
    window.api.invoke('db:order-nummer:peek').then((n) => {
      setCurrent(n as number)
      setInput(String(n as number))
    })
  }, [])

  async function handleSet() {
    const val = parseInt(input)
    if (!val || val < 1) { setError('Ange ett positivt heltal.'); return }
    setSaving(true); setError('')
    try {
      const next = await window.api.invoke('db:order-nummer:set', val) as number
      setCurrent(next); setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fel')
    } finally { setSaving(false) }
  }

  async function handleReset() {
    setInput('1'); setSaving(true); setError('')
    try {
      const next = await window.api.invoke('db:order-nummer:set', 1) as number
      setCurrent(next); setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fel')
    } finally { setSaving(false) }
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex flex-col flex-1 border-r border-border overflow-auto">
        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Ordernumrering</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-subtle">
              Nästa: <span className="font-mono text-fg">O-{current != null ? String(current).padStart(4, '0') : '…'}</span>
            </span>
            <input
              type="number" min="1" step="1" className="input font-mono w-24 text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSet() }}
            />
            <button onClick={handleSet} disabled={saving} className="px-3 py-1.5 rounded-lg bg-hover text-fg text-xs font-medium hover:bg-border disabled:opacity-40 transition-colors">
              {saving ? '...' : saved ? '✓ Sparat' : 'Sätt'}
            </button>
            <button
              onClick={handleReset}
              disabled={saving}
              className="text-xs text-muted hover:text-fg disabled:opacity-40 transition-colors"
            >
              Återställ till 1
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          <p className="mt-4 text-xs text-muted">Order numreras automatiskt som O-NNNN. Sätt nästa nummer manuellt vid behov (t.ex. vid årsskifte).</p>
        </div>

        <div className="px-8 py-6 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-widest text-muted">Standardvillkor för Order (global)</p>
            {villkorSaved && <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />}
          </div>
          <textarea
            value={villkorDraft}
            onChange={(e) => setVillkorDraft(e.target.value)}
            onBlur={saveVillkor}
            rows={6}
            placeholder="t.ex. Order är gällande efter signering av kund. Arbetet faktureras separat från huvudprojekt."
            className="input resize-y leading-relaxed w-full"
          />
          <p className="mt-2 text-[11px] text-subtle leading-relaxed">
            Används som mall när en ny order skapas. Kaskad: <span className="text-muted">order-input</span> →{' '}
            <span className="text-muted">kundens egna villkor</span> →{' '}
            <span className="text-muted">denna globala mall</span>. Snapshot — redan skapade orders påverkas inte.
          </p>
        </div>
      </div>

      <div className="w-72 flex flex-col shrink-0">
        <div className="flex items-center px-6 py-4 border-b border-border shrink-0">
          <p className="text-[11px] uppercase tracking-widest text-muted">Statusar</p>
        </div>
        <div className="flex-1 overflow-auto">
          <div className="flex flex-col divide-y divide-border">
            {STATUSAR.map((s) => {
              const farg = STATUS_FARG[s]
              return (
                <div key={s} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`size-3.5 rounded-full ${farg.dot} shrink-0`} />
                  <span className={`flex-1 text-sm font-medium ${farg.text}`}>{s}</span>
                </div>
              )
            })}
          </div>
          <p className="px-6 py-4 text-[11px] text-subtle leading-relaxed">
            Statusarna är fasta för Order: Utkast → Skickad → Godkänd / Avvisad. De kan inte ändras eftersom de är kopplade till signeringsflödet.
          </p>
        </div>
      </div>
    </div>
  )
}
