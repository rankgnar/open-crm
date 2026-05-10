import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { WorkflowTriggerBar } from '@/components/WorkflowTriggerBar'
import type { ProjektWithKund } from '@/sections/projekt/types'
import type { ForslagWithProjekt, ForslagArbete, ForslagMaterial, ForslagUnderentreprenor } from '@/sections/forslag/types'
import type { EkonomiUtfall, CreateUtfallInput, UtfallKategori } from './types'
import { useAppConfig } from '@/context/AppConfig'

interface Props {
  projekt: ProjektWithKund
  utfall: EkonomiUtfall[]
  onBack: () => void
  onAddUtfall: (input: CreateUtfallInput) => Promise<void>
  onDeleteUtfall: (id: string) => Promise<void>
}

const KATEGORI_LABEL: Record<UtfallKategori, string> = {
  arbete: 'Arbete', material: 'Material', ue: 'Underentrepr.', övrigt: 'Övrigt'
}
const KATEGORI_COLOR: Record<UtfallKategori, string> = {
  arbete: 'text-blue-400', material: 'text-amber-400', ue: 'text-purple-400', övrigt: 'text-muted'
}



function StatCard({ label, value, sub, highlight, red }: { label: string; value: string; sub?: string; highlight?: boolean; red?: boolean }) {
  return (
    <div className="flex flex-col gap-1 px-6 py-5 border-r border-border last:border-r-0">
      <p className="text-[10px] uppercase tracking-widest text-muted font-medium">{label}</p>
      <p className={`text-xl font-semibold font-mono ${highlight ? 'text-fg' : red ? 'text-red-400' : 'text-fg'}`}>{value}</p>
      {sub && <p className="text-[10px] text-subtle">{sub}</p>}
    </div>
  )
}

export function EkonomiDetail({ projekt, utfall, onBack, onAddUtfall, onDeleteUtfall }: Props) {
  const { config, formatCurrency } = useAppConfig()
  const fmt = (n: number) => formatCurrency(n, 0)
  const ROT_CAP_SINGLE = config?.rot_avdrag_tak_enkel ?? 50000
  const ROT_CAP_DOUBLE = config?.rot_avdrag_tak_dubbel ?? 100000

  const [forslag, setForslag] = useState<ForslagWithProjekt | null>(null)
  const [forslagTotalt, setForslagTotalt] = useState(0)
  const [loadingForslag, setLoadingForslag] = useState(true)

  // Form state
  const [kategori, setKategori] = useState<UtfallKategori>('arbete')
  const [beskrivning, setBeskrivning] = useState('')
  const [belopp, setBelopp] = useState('')
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  // Multi-select state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const allSelected = utfall.length > 0 && selected.size === utfall.length

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(utfall.map(u => u.id)))
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return
    const ok = window.confirm(`Ta bort ${selected.size} ${selected.size === 1 ? 'post' : 'poster'}?`)
    if (!ok) return
    setBulkDeleting(true)
    try {
      await Promise.all(Array.from(selected).map(id => onDeleteUtfall(id)))
      setSelected(new Set())
    } finally {
      setBulkDeleting(false)
    }
  }

  const loadForslag = useCallback(async () => {
    setLoadingForslag(true)
    try {
      const list = await window.api.invoke('db:forslag:list-by-projekt', projekt.id) as ForslagWithProjekt[]
      if (list.length === 0) { setLoadingForslag(false); return }

      const active = list.find((f) => f.status === 'accepterat') ?? list[0]
      setForslag(active)

      const [arbeteData, materialData, ueData] = await Promise.all([
        window.api.invoke('db:forslag-arbete:list-by-forslag', active.id) as Promise<ForslagArbete[]>,
        window.api.invoke('db:forslag-material:list-by-forslag', active.id) as Promise<ForslagMaterial[]>,
        window.api.invoke('db:forslag-ue:list-by-forslag', active.id) as Promise<ForslagUnderentreprenor[]>,
      ])

      const totalArbete = arbeteData.reduce((s, r) => s + r.antal_timmar * r.timpris, 0)
      const totalMaterial = materialData.reduce((s, r) => s + r.antal * r.a_pris, 0)
      const totalUE = ueData.reduce((s, r) => s + r.kostnad, 0)
      const subtotal = totalArbete + totalMaterial + totalUE

      let rot = 0
      if (active.projekt.rot_avdrag) {
        const cap = active.projekt.rot_inkludera_medsokande ? ROT_CAP_DOUBLE : ROT_CAP_SINGLE
        rot = Math.min(totalArbete * (active.projekt.rot_procent / 100), cap)
      }
      const netto = subtotal - rot
      setForslagTotalt(netto * (1 + active.moms_procent / 100))
    } finally {
      setLoadingForslag(false)
    }
  }, [projekt.id])

  useEffect(() => { loadForslag() }, [loadForslag])

  const utfallTotal = utfall.reduce((s, u) => s + u.belopp, 0)
  const resultat = forslagTotalt > 0 ? forslagTotalt - utfallTotal : projekt.budget_total - utfallTotal
  const progressPct = forslagTotalt > 0 ? Math.min((utfallTotal / forslagTotalt) * 100, 100) : 0

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!beskrivning.trim() || !belopp) return
    setSaving(true)
    try {
      await onAddUtfall({ projekt_id: projekt.id, kategori, beskrivning: beskrivning.trim(), belopp: parseFloat(belopp), datum })
      setBeskrivning('')
      setBelopp('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <button onClick={onBack} className="text-muted hover:text-fg transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Kostnader</span>
          <span className="text-subtle">/</span>
          <span className="font-mono text-xs text-muted">{projekt.projekt_nummer}</span>
          <span className="text-subtle">/</span>
          <span className="text-fg font-medium">{projekt.namn}</span>
        </div>
        <span className="text-xs text-muted ml-1">— {projekt.kunder.namn}</span>
      </div>

      <WorkflowTriggerBar seccion="ekonomi" context={{ projekt_id: projekt.id }} />

      <div className="flex-1 overflow-auto flex flex-col">
        {/* Stats row */}
        <div className="flex border-b border-border shrink-0">
          <StatCard
            label="Budget (estimat)"
            value={projekt.budget_total > 0 ? fmt(projekt.budget_total) : '—'}
            sub="vid projektstart"
          />
          <StatCard
            label={forslag ? `Förslag pris${forslag.status !== 'accepterat' ? ` (${forslag.status})` : ''}` : 'Förslag pris'}
            value={loadingForslag ? '...' : forslagTotalt > 0 ? fmt(forslagTotalt) : '—'}
            sub={forslag ? `${forslag.forslag_nummer} inkl. moms` : 'Inget förslag'}
          />
          <StatCard
            label="Utfall (verklig kostnad)"
            value={utfallTotal > 0 ? fmt(utfallTotal) : '—'}
            sub={`${utfall.length} poster`}
          />
          <StatCard
            label="Resultat"
            value={resultat >= 0 ? `+${fmt(resultat)}` : fmt(resultat)}
            sub="förslag − utfall"
            red={resultat < 0}
          />
        </div>

        {/* Progress bar */}
        {forslagTotalt > 0 && (
          <div className="px-8 py-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-widest text-muted font-medium">Utfall vs Förslag pris</p>
              <span className="text-xs font-mono text-muted">{progressPct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progressPct > 100 ? 'bg-red-400' : progressPct > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${Math.min(progressPct, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Utfall list */}
        <div className="px-8 py-6 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] uppercase tracking-widest text-muted font-medium">
              Utfall — kostnadsregistrering
            </p>
            {selected.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted">{selected.size} markerade</span>
                <button
                  onClick={handleDeleteSelected}
                  disabled={bulkDeleting}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs border border-border text-muted hover:text-red-400 hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 size={11} />
                  {bulkDeleting ? 'Tar bort…' : 'Ta bort markerade'}
                </button>
              </div>
            )}
          </div>

          {utfall.length > 0 && (
            <div className="flex-1 overflow-auto mb-6">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="cursor-pointer accent-fg"
                      />
                    </th>
                    <th className="pb-2 text-[10px] uppercase tracking-wider text-subtle font-medium w-24">Datum</th>
                    <th className="pb-2 text-[10px] uppercase tracking-wider text-subtle font-medium w-28">Kategori</th>
                    <th className="pb-2 text-[10px] uppercase tracking-wider text-subtle font-medium">Beskrivning</th>
                    <th className="pb-2 text-[10px] uppercase tracking-wider text-subtle font-medium text-right w-32">Belopp</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {utfall.map((u) => (
                    <tr key={u.id} className={`group border-b border-border/50 ${selected.has(u.id) ? 'bg-hover' : ''}`}>
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(u.id)}
                          onChange={() => toggleOne(u.id)}
                          className="cursor-pointer accent-fg"
                        />
                      </td>
                      <td className="py-2 pr-4 text-muted font-mono">{u.datum}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-[10px] font-medium uppercase tracking-wider ${KATEGORI_COLOR[u.kategori]}`}>
                          {KATEGORI_LABEL[u.kategori]}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-fg">{u.beskrivning}</td>
                      <td className="py-2 text-right font-mono text-fg">{fmt(u.belopp)}</td>
                      <td className="py-2 pl-2">
                        <button
                          onClick={() => onDeleteUtfall(u.id)}
                          className="opacity-0 group-hover:opacity-100 text-subtle hover:text-red-400 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {utfall.length === 0 && (
            <p className="text-xs text-subtle italic mb-6">Inga kostnader registrerade ännu.</p>
          )}

          {/* Add form */}
          <form onSubmit={handleAdd} className="flex items-end gap-3 pt-4 border-t border-border shrink-0">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted">Datum</label>
              <input type="date" className="input text-xs py-1.5 px-2 w-32" value={datum} onChange={(e) => setDatum(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted">Kategori</label>
              <select className="input text-xs py-1.5 px-2 text-muted w-36" value={kategori} onChange={(e) => setKategori(e.target.value as UtfallKategori)}>
                <option value="arbete">Arbete</option>
                <option value="material">Material</option>
                <option value="ue">Underentrepr.</option>
                <option value="övrigt">Övrigt</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] uppercase tracking-wider text-muted">Beskrivning</label>
              <input
                type="text"
                className="input text-xs py-1.5 px-2"
                placeholder="Elektriker 8h, Kabel 10m..."
                value={beskrivning}
                onChange={(e) => setBeskrivning(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted">Belopp ({config?.valuta ?? 'kr'})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input text-xs py-1.5 px-2 w-32 text-right"
                placeholder="0"
                value={belopp}
                onChange={(e) => setBelopp(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-fg text-bg px-4 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
            >
              {saving ? '...' : '+ Registrera'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
