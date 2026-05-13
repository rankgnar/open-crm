import { useState, useEffect } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { useAppConfig } from '@/context/AppConfig'
import type { VentanaPreset, TakType, DeductionIconType } from '@/sections/kalkylator/types'
import { DEFAULT_VENTANA_PRESETS, DEFAULT_TAK_TYPER } from '@/sections/kalkylator/types'
import { WindowIcon } from '@/sections/kalkylator/WindowIcons'
import { parseNum } from '@/sections/kalkylator/kalkylator-utils'

const ICON_OPTIONS: { value: DeductionIconType; label: string }[] = [
  { value: 'window-single', label: 'Fönster' },
  { value: 'window-double', label: 'Dubbelfönster' },
  { value: 'door', label: 'Dörr' },
  { value: 'door-double', label: 'Dubbeldörr' },
  { value: 'garage', label: 'Garageport' },
  { value: 'triangle', label: 'Triangel' },
  { value: 'triangle-right', label: 'Triangel 90°' },
  { value: 'rectangle', label: 'Rektangel' },
]

function SavedBadge() {
  return <span className="ml-2 text-[10px] text-emerald-400">Sparat ✓</span>
}

export function KalkylPanel() {
  const { config, updateConfig } = useAppConfig()
  const [ventanaSaved, setVentanaSaved] = useState(false)
  const [takSaved, setTakSaved] = useState(false)

  const [localVentana, setLocalVentana] = useState<VentanaPreset[]>(() =>
    Array.isArray(config?.kalkyl_ventanatyper)
      ? (config.kalkyl_ventanatyper as VentanaPreset[])
      : DEFAULT_VENTANA_PRESETS
  )
  const [localTak, setLocalTak] = useState<TakType[]>(() =>
    Array.isArray(config?.kalkyl_taktyper)
      ? (config.kalkyl_taktyper as TakType[])
      : DEFAULT_TAK_TYPER
  )

  useEffect(() => {
    if (Array.isArray(config?.kalkyl_ventanatyper))
      setLocalVentana(config.kalkyl_ventanatyper as VentanaPreset[])
  }, [config?.kalkyl_ventanatyper])

  useEffect(() => {
    if (Array.isArray(config?.kalkyl_taktyper))
      setLocalTak(config.kalkyl_taktyper as TakType[])
  }, [config?.kalkyl_taktyper])

  const saveVentana = async (next: VentanaPreset[]) => {
    setLocalVentana(next)
    await updateConfig({ kalkyl_ventanatyper: next as unknown })
    setVentanaSaved(true)
    setTimeout(() => setVentanaSaved(false), 2000)
  }

  const saveTak = async (next: TakType[]) => {
    setLocalTak(next)
    await updateConfig({ kalkyl_taktyper: next as unknown })
    setTakSaved(true)
    setTimeout(() => setTakSaved(false), 2000)
  }

  const setVentanaField = (id: string, field: keyof VentanaPreset, value: string | number) => {
    setLocalVentana(prev => prev.map(p =>
      p.id === id
        ? { ...p, [field]: field === 'defaultWidth' || field === 'defaultHeight' ? parseNum(String(value)) : value }
        : p
    ))
  }

  const saveVentanaField = (id: string, field: keyof VentanaPreset, value: string | number) => {
    const next = localVentana.map(p =>
      p.id === id
        ? { ...p, [field]: field === 'defaultWidth' || field === 'defaultHeight' ? parseNum(String(value)) : value }
        : p
    )
    void saveVentana(next)
  }

  const setTakField = (id: string, field: keyof TakType, value: string | number) => {
    setLocalTak(prev => prev.map(t => {
      if (t.id !== id) return t
      const updated = { ...t, [field]: field === 'name' ? value : parseNum(String(value)) }
      if (field === 'angleDeg') {
        const rad = parseNum(String(value)) * Math.PI / 180
        updated.slopeFactor = rad === 0 ? 1.0 : Math.round((1 / Math.cos(rad)) * 100) / 100
      }
      return updated
    }))
  }

  const saveTakField = (id: string, field: keyof TakType, value: string | number) => {
    const next = localTak.map(t => {
      if (t.id !== id) return t
      const updated = { ...t, [field]: field === 'name' ? value : parseNum(String(value)) }
      if (field === 'angleDeg') {
        const rad = parseNum(String(value)) * Math.PI / 180
        updated.slopeFactor = rad === 0 ? 1.0 : Math.round((1 / Math.cos(rad)) * 100) / 100
      }
      return updated
    })
    void saveTak(next)
  }

  const addVentana = () => {
    void saveVentana([
      ...localVentana,
      { id: crypto.randomUUID(), name: '', icon: 'window-single', defaultWidth: 800, defaultHeight: 1200 },
    ])
  }

  const removeVentana = (id: string) => {
    void saveVentana(localVentana.filter(p => p.id !== id))
  }

  const addTak = () => {
    void saveTak([
      ...localTak,
      { id: crypto.randomUUID(), name: '', angleDeg: 27, slopeFactor: 1.12 },
    ])
  }

  const removeTak = (id: string) => {
    void saveTak(localTak.filter(t => t.id !== id))
  }

  const resetVentana = () => void saveVentana(DEFAULT_VENTANA_PRESETS)
  const resetTak = () => void saveTak(DEFAULT_TAK_TYPER)

  return (
    <div className="flex flex-col">
      {/* Fönster & Dörrar */}
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-5">
          <p className="text-[11px] uppercase tracking-widest text-muted">Fönster & Dörrar</p>
          {ventanaSaved && <SavedBadge />}
          <button
            onClick={resetVentana}
            className="ml-auto text-xs text-subtle hover:text-muted transition-colors"
          >
            Återställ standard
          </button>
        </div>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="pb-2 text-[11px] font-medium text-muted pr-3 w-12">Ikon</th>
              <th className="pb-2 text-[11px] font-medium text-muted pr-3">Namn</th>
              <th className="pb-2 text-[11px] font-medium text-muted pr-3 w-28">Ikontyp</th>
              <th className="pb-2 text-[11px] font-medium text-muted pr-3 w-28 text-right">Std. bredd (mm)</th>
              <th className="pb-2 text-[11px] font-medium text-muted w-28 text-right">Std. höjd (mm)</th>
              <th className="pb-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {localVentana.map(p => (
              <tr key={p.id} className="group border-b border-border/40 last:border-0">
                <td className="py-2 pr-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded border border-border text-muted">
                    <WindowIcon type={p.icon} size={20} />
                  </div>
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => setVentanaField(p.id, 'name', e.target.value)}
                    onBlur={e => saveVentanaField(p.id, 'name', e.target.value)}
                    className="input w-full text-sm"
                  />
                </td>
                <td className="py-2 pr-3">
                  <select
                    value={p.icon}
                    onChange={e => saveVentanaField(p.id, 'icon', e.target.value)}
                    className="input text-sm w-full"
                  >
                    {ICON_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={p.defaultWidth || ''}
                    onChange={e => setVentanaField(p.id, 'defaultWidth', e.target.value)}
                    onBlur={e => saveVentanaField(p.id, 'defaultWidth', e.target.value)}
                    className="input w-full text-sm text-right"
                  />
                </td>
                <td className="py-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={p.defaultHeight || ''}
                    onChange={e => setVentanaField(p.id, 'defaultHeight', e.target.value)}
                    onBlur={e => saveVentanaField(p.id, 'defaultHeight', e.target.value)}
                    className="input w-full text-sm text-right"
                  />
                </td>
                <td className="py-2 pl-2">
                  <button
                    onClick={() => removeVentana(p.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={addVentana}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
        >
          <Plus size={13} /> Ny fönster-/dörrtyp
        </button>
      </div>

      {/* Taktyper */}
      <div className="px-8 py-6">
        <div className="flex items-center gap-3 mb-5">
          <p className="text-[11px] uppercase tracking-widest text-muted">Taktyper & Lutning</p>
          {takSaved && <SavedBadge />}
          <button
            onClick={resetTak}
            className="ml-auto text-xs text-subtle hover:text-muted transition-colors"
          >
            Återställ standard
          </button>
        </div>

        <p className="text-xs text-subtle mb-4">
          Lutningsfaktorn beräknas automatiskt från vinkeln (1 / cos(vinkel°)). Du kan justera den manuellt om det behövs.
        </p>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="pb-2 text-[11px] font-medium text-muted pr-3">Namn</th>
              <th className="pb-2 text-[11px] font-medium text-muted pr-3 w-28 text-right">Vinkel (°)</th>
              <th className="pb-2 text-[11px] font-medium text-muted w-28 text-right">Lutningsfaktor</th>
              <th className="pb-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {localTak.map(t => (
              <tr key={t.id} className="group border-b border-border/40 last:border-0">
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={t.name}
                    onChange={e => setTakField(t.id, 'name', e.target.value)}
                    onBlur={e => saveTakField(t.id, 'name', e.target.value)}
                    className="input w-full text-sm"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min="0"
                    max="89"
                    step="1"
                    value={t.angleDeg || ''}
                    onChange={e => setTakField(t.id, 'angleDeg', e.target.value)}
                    onBlur={e => saveTakField(t.id, 'angleDeg', e.target.value)}
                    className="input w-full text-sm text-right"
                  />
                </td>
                <td className="py-2">
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={t.slopeFactor || ''}
                    onChange={e => setTakField(t.id, 'slopeFactor', e.target.value)}
                    onBlur={e => saveTakField(t.id, 'slopeFactor', e.target.value)}
                    className="input w-full text-sm text-right text-amber-400"
                  />
                </td>
                <td className="py-2 pl-2">
                  <button
                    onClick={() => removeTak(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={addTak}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
        >
          <Plus size={13} /> Ny taktyp
        </button>
      </div>
    </div>
  )
}
