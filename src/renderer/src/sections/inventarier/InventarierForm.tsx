import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { Inventarie, CreateInventarieInput, UpdateInventarieInput } from './types'
import { SKICK_OPTIONS, KATEGORI_OPTIONS, PLACERING_OPTIONS } from './types'
import { SelectField } from '@/components/SelectField'

interface Props {
  item: Inventarie | null
  onSubmit: (data: CreateInventarieInput | UpdateInventarieInput) => Promise<void>
  onCancel: () => void
}

export function InventarierForm({ item, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState({
    kategori: item?.kategori ?? '',
    benamning: item?.benamning ?? '',
    tillverkare_modell: item?.tillverkare_modell ?? '',
    serienr: item?.serienr ?? '',
    antal: item?.antal ?? 1,
    skick: item?.skick ?? 'Bra',
    placering: item?.placering ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.benamning.trim()) { setError('Benämning krävs'); return }
    setSaving(true)
    setError('')
    try {
      await onSubmit({ ...form, antal: Number(form.antal) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fel vid sparning')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted hover:bg-hover hover:text-fg transition-colors"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </button>
        <h1 className="text-sm font-semibold text-fg">
          {item ? 'Redigera post' : 'Ny inventariepost'}
        </h1>
        {item && (
          <span className="text-xs text-subtle">#{item.lopnr}</span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <form onSubmit={handleSubmit} className="px-8 py-6 max-w-2xl">
          {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-muted mb-1.5">Kategori</label>
              <SelectField
                value={form.kategori}
                onChange={(v) => setField('kategori', v)}
                placeholder="— Välj kategori —"
                options={KATEGORI_OPTIONS.map((k) => ({ value: k, label: k }))}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-muted mb-1.5">Namn *</label>
              <input
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-fg outline-none focus:border-emerald-400 transition-colors"
                value={form.benamning}
                onChange={(e) => setField('benamning', e.target.value)}
                placeholder="t.ex. Borrskruvdragare"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-muted mb-1.5">Tillverkare / Modell</label>
              <input
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-fg outline-none focus:border-emerald-400 transition-colors"
                value={form.tillverkare_modell}
                onChange={(e) => setField('tillverkare_modell', e.target.value)}
                placeholder="t.ex. Makita DDF482"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-muted mb-1.5">Serienummer</label>
              <input
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-fg font-mono outline-none focus:border-emerald-400 transition-colors"
                value={form.serienr}
                onChange={(e) => setField('serienr', e.target.value)}
                placeholder="—"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-muted mb-1.5">Antal</label>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-fg outline-none focus:border-emerald-400 transition-colors"
                value={form.antal}
                onChange={(e) => setField('antal', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-muted mb-1.5">Skick</label>
              <SelectField
                value={form.skick}
                onChange={(v) => setField('skick', v)}
                options={SKICK_OPTIONS.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] uppercase tracking-widest text-muted mb-1.5">Placering</label>
              <SelectField
                value={form.placering}
                onChange={(v) => setField('placering', v)}
                placeholder="— Välj placering —"
                options={PLACERING_OPTIONS.map((p) => ({ value: p, label: p }))}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-fg text-bg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {saving ? 'Sparar...' : item ? 'Spara ändringar' : 'Skapa post'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-4 py-2 text-sm text-muted border border-border hover:bg-hover hover:text-fg transition-colors"
            >
              Avbryt
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
