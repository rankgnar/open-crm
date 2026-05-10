import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import type { CreateATAInput, CreateATARadInput, FasTreeNode } from './types'
import type { ProjektWithKund } from '@/sections/projekt/types'
import type { Kund } from '@/sections/kunder/types'
import { useAppConfig } from '@/context/AppConfig'
import { MaterialAutocompleteInput } from '@/sections/order/MaterialAutocompleteInput'
import { SelectField } from '@/components/SelectField'

interface Props {
  projekt: ProjektWithKund[]
  onSubmit: (data: CreateATAInput) => Promise<void>
  onCancel: () => void
}

interface RadDraft extends CreateATARadInput {
  key: string
}

const MOMS = 0.25

function round2(n: number) { return Math.round(n * 100) / 100 }

export function ATAForm({ projekt, onSubmit, onCancel }: Props) {
  const { formatCurrency, config } = useAppConfig()
  const [projekt_id, setProjektId] = useState('')
  const [titel, setTitel] = useState('')
  const [beskrivning, setBeskrivning] = useState('')
  const [villkor, setVillkor] = useState('')
  const [villkorTouched, setVillkorTouched] = useState(false)
  const [fasTree, setFasTree] = useState<FasTreeNode[]>([])
  const [fas_id, setFasId] = useState('')
  const [subfas_id, setSubfasId] = useState('')
  const [loadingFaser, setLoadingFaser] = useState(false)
  const [rader, setRader] = useState<RadDraft[]>([
    { key: crypto.randomUUID(), beskrivning: '', antal: 1, enhet: 'st', a_pris: 0 },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const valda = projekt.find((p) => p.id === projekt_id)

  useEffect(() => {
    if (!projekt_id) {
      setFasTree([])
      setFasId('')
      setSubfasId('')
      return
    }
    setLoadingFaser(true)
    window.api.invoke('db:projekt:list-fas-tree', projekt_id)
      .then((tree) => setFasTree(tree as FasTreeNode[]))
      .finally(() => setLoadingFaser(false))
    setFasId('')
    setSubfasId('')

    // Pre-fill villkor with cascade: kund's ata template → global ata default.
    if (!villkorTouched && valda?.kund_id) {
      window.api.invoke('db:kunder:get', valda.kund_id)
        .then((k) => {
          const fromKund = ((k as Kund & { ata_std_villkor?: string }).ata_std_villkor ?? '').trim()
          setVillkor(fromKund || (config?.ata_std_villkor ?? ''))
        })
        .catch(() => setVillkor(config?.ata_std_villkor ?? ''))
    }
  }, [projekt_id])

  const valdFas = fasTree.find((f) => f.id === fas_id)
  const flerForslag = new Set(fasTree.map((f) => f.forslag_id)).size > 1

  function updateRad(key: string, patch: Partial<RadDraft>) {
    setRader((prev) => prev.map((r) => r.key === key ? { ...r, ...patch } : r))
  }

  function removeRad(key: string) {
    setRader((prev) => prev.filter((r) => r.key !== key))
  }

  function addRad() {
    setRader((prev) => [...prev, { key: crypto.randomUUID(), beskrivning: '', antal: 1, enhet: 'st', a_pris: 0 }])
  }

  const netto = rader.reduce((s, r) => s + (r.antal ?? 0) * (r.a_pris ?? 0), 0)
  const moms = round2(netto * MOMS)
  const total = round2(netto + moms)

  async function handleSubmit() {
    if (!projekt_id || !titel.trim()) {
      setError('Projekt och titel krävs')
      return
    }
    const cleanRader = rader.filter((r) => r.beskrivning.trim()).map((r, i) => ({
      beskrivning: r.beskrivning,
      antal: r.antal ?? 1,
      enhet: r.enhet ?? 'st',
      a_pris: r.a_pris ?? 0,
      sortering: i,
    }))
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        projekt_id,
        titel: titel.trim(),
        beskrivning: beskrivning.trim(),
        villkor: villkor.trim(),
        fas_id: fas_id || null,
        subfas_id: subfas_id || null,
        rader: cleanRader,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-muted text-sm">ÄTA</span>
          <span className="text-subtle">/</span>
          <span className="text-fg text-sm font-medium">Ny ÄTA</span>
        </div>
        <button onClick={onCancel} className="text-muted hover:text-fg transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-8 py-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Grunduppgifter</p>
          <div className="grid grid-cols-3 gap-x-8 gap-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted">Projekt</label>
              <SelectField
                value={projekt_id}
                onChange={setProjektId}
                placeholder="Välj projekt..."
                searchable
                options={projekt.map((p) => ({ value: p.id, label: `${p.projekt_nummer} — ${p.namn} (${p.kunder.namn})` }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted">Kund</label>
              <input
                type="text"
                className="input"
                value={valda?.kunder.namn ?? ''}
                disabled
                placeholder="Auto-ifylls från projekt"
              />
            </div>
            <div className="flex flex-col gap-1.5 col-span-3">
              <label className="text-xs text-muted">Titel</label>
              <input
                type="text"
                className="input"
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                placeholder="t.ex. Tilläggsarbete: kakling badrum"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted">Fas {projekt_id && fasTree.length === 0 && !loadingFaser && <span className="text-subtle">(inga fas i projektet)</span>}</label>
              <SelectField
                value={fas_id}
                onChange={(v) => { setFasId(v); setSubfasId('') }}
                placeholder={loadingFaser ? 'Laddar...' : 'Ingen fas'}
                disabled={!projekt_id || loadingFaser || fasTree.length === 0}
                options={fasTree.map((f) => ({ value: f.id, label: flerForslag ? `[${f.forslag_nummer}] ${f.namn}` : f.namn }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted">Subfas (valfri)</label>
              <SelectField
                value={subfas_id}
                onChange={setSubfasId}
                placeholder={!fas_id ? 'Välj fas först' : (valdFas?.subfaser.length === 0 ? 'Inga subfaser' : 'Ingen subfas')}
                disabled={!fas_id || !valdFas || valdFas.subfaser.length === 0}
                options={(valdFas?.subfaser ?? []).map((s) => ({ value: s.id, label: s.namn }))}
              />
            </div>
            <div />
            <div className="flex flex-col gap-1.5 col-span-3">
              <label className="text-xs text-muted">Beskrivning / motivering</label>
              <textarea
                className="input min-h-24"
                value={beskrivning}
                onChange={(e) => setBeskrivning(e.target.value)}
                placeholder="Förklara varför detta arbete ligger utanför ursprungliga budgeten"
              />
            </div>
            <div className="flex flex-col gap-1.5 col-span-3">
              <label className="text-xs text-muted">
                Villkor
                {!villkorTouched && projekt_id && <span className="ml-2 text-subtle font-normal">(auto-ifylld från ÄTA-mall)</span>}
              </label>
              <textarea
                className="input min-h-24"
                value={villkor}
                onChange={(e) => { setVillkor(e.target.value); setVillkorTouched(true) }}
                placeholder="Specifika villkor för denna ÄTA..."
              />
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] uppercase tracking-widest text-muted">Rader</p>
            <button
              onClick={addRad}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
            >
              <Plus size={12} />Lägg till rad
            </button>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
                <th className="text-left pb-2 font-medium">Beskrivning</th>
                <th className="text-right pb-2 font-medium w-20">Antal</th>
                <th className="text-left pb-2 font-medium w-20">Enhet</th>
                <th className="text-right pb-2 font-medium w-28">À-pris</th>
                <th className="text-right pb-2 font-medium w-32">Belopp</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rader.map((r) => {
                const belopp = (r.antal ?? 0) * (r.a_pris ?? 0)
                return (
                  <tr key={r.key} className="border-b border-border/40 group">
                    <td className="py-2 pr-3">
                      <MaterialAutocompleteInput
                        value={r.beskrivning}
                        onChange={(text) => updateRad(r.key, { beskrivning: text })}
                        onSelectMaterial={(m) => updateRad(r.key, {
                          beskrivning: m.namn,
                          enhet: m.enhet ?? r.enhet ?? 'st',
                          a_pris: m.a_pris,
                        })}
                        placeholder="Sök i materialkatalog eller skriv själv"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number" min="0" step="0.01"
                        className="input text-xs py-1 px-2 w-full text-right font-mono"
                        value={r.antal ?? ''}
                        onChange={(e) => updateRad(r.key, { antal: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        className="input text-xs py-1 px-2 w-full"
                        value={r.enhet ?? ''}
                        onChange={(e) => updateRad(r.key, { enhet: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number" min="0" step="0.01"
                        className="input text-xs py-1 px-2 w-full text-right font-mono"
                        value={r.a_pris ?? ''}
                        onChange={(e) => updateRad(r.key, { a_pris: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-fg">{formatCurrency(belopp)}</td>
                    <td className="py-2">
                      <button
                        onClick={() => removeRad(r.key)}
                        className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-8 py-6 border-b border-border">
          <div className="grid grid-cols-2 gap-x-8 max-w-md ml-auto text-xs">
            <span className="text-muted py-1">Netto</span>
            <span className="text-right font-mono text-fg py-1">{formatCurrency(netto)}</span>
            <span className="text-muted py-1">Moms 25%</span>
            <span className="text-right font-mono text-fg py-1">{formatCurrency(moms)}</span>
            <span className="text-fg font-semibold border-t border-border pt-2">Total</span>
            <span className="text-right font-mono text-fg font-semibold border-t border-border pt-2">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-8 py-4 border-t border-border bg-sidebar shrink-0">
        <button onClick={onCancel} className="text-sm text-muted hover:text-fg transition-colors">Avbryt</button>
        {error && <span className="text-xs text-red-400">{error}</span>}
        <button
          onClick={handleSubmit}
          disabled={submitting || !projekt_id || !titel.trim()}
          className="rounded-lg bg-fg text-bg px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30"
        >
          {submitting ? 'Skapar...' : 'Skapa ÄTA'}
        </button>
      </div>
    </div>
  )
}
