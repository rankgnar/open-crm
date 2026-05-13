import { useState, useEffect } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { useAppConfig } from '@/context/AppConfig'
import type { VentanaPreset, TakType, DeductionIconType } from '@/sections/kalkylator/types'
import {
  DEFAULT_VENTANA_PRESETS,
  DEFAULT_TAK_TYPER,
  DEFAULT_TAK_AVDRAG,
  DEFAULT_GOLV_AVDRAG,
  DEFAULT_VAGG_AVDRAG,
} from '@/sections/kalkylator/types'
import { WindowIcon } from '@/sections/kalkylator/WindowIcons'
import { parseNum } from '@/sections/kalkylator/kalkylator-utils'

type ConfigTab = 'fasad' | 'tak' | 'golv' | 'vagg'

const CONFIG_TABS: { type: ConfigTab; label: string }[] = [
  { type: 'fasad', label: 'Fasad' },
  { type: 'tak', label: 'Tak' },
  { type: 'golv', label: 'Golv' },
  { type: 'vagg', label: 'Vägg' },
]

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
  return <span className="text-[10px] text-emerald-400">Sparat ✓</span>
}

function makePresetsHandlers(
  local: VentanaPreset[],
  setLocal: (v: VentanaPreset[]) => void,
  save: (v: VentanaPreset[]) => void,
) {
  const applyField = (p: VentanaPreset, field: keyof VentanaPreset, value: string | number): VentanaPreset => ({
    ...p,
    [field]: (field === 'defaultWidth' || field === 'defaultHeight') ? parseNum(String(value)) : value,
  })
  return {
    setField: (id: string, field: keyof VentanaPreset, value: string | number) =>
      setLocal(local.map(p => p.id === id ? applyField(p, field, value) : p)),
    saveField: (id: string, field: keyof VentanaPreset, value: string | number) =>
      save(local.map(p => p.id === id ? applyField(p, field, value) : p)),
    remove: (id: string) => save(local.filter(p => p.id !== id)),
    add: () => save([...local, { id: crypto.randomUUID(), name: '', icon: 'window-single' as DeductionIconType, defaultWidth: 800, defaultHeight: 1200 }]),
  }
}

function PresetsTable({
  title, description, items, saved, onSet, onSave, onRemove, onAdd, onReset, addLabel,
}: {
  title: string
  description?: string
  items: VentanaPreset[]
  saved: boolean
  onSet: (id: string, field: keyof VentanaPreset, value: string | number) => void
  onSave: (id: string, field: keyof VentanaPreset, value: string | number) => void
  onRemove: (id: string) => void
  onAdd: () => void
  onReset: () => void
  addLabel: string
}) {
  return (
    <>
      <div className="flex items-center gap-3 mb-1">
        <p className="text-[11px] uppercase tracking-widest text-muted">{title}</p>
        {saved && <SavedBadge />}
        <button onClick={onReset} className="ml-auto text-xs text-subtle hover:text-muted transition-colors">
          Återställ standard
        </button>
      </div>
      <p className="text-xs text-subtle mt-1 mb-5">{description ?? ''}</p>
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
          {items.map(p => (
            <tr key={p.id} className="group border-b border-border/40 last:border-0">
              <td className="py-2 pr-3">
                <div className="w-8 h-8 flex items-center justify-center rounded border border-border text-muted">
                  <WindowIcon type={p.icon} size={20} />
                </div>
              </td>
              <td className="py-2 pr-3">
                <input type="text" value={p.name}
                  onChange={e => onSet(p.id, 'name', e.target.value)}
                  onBlur={e => onSave(p.id, 'name', e.target.value)}
                  className="input w-full text-sm" />
              </td>
              <td className="py-2 pr-3">
                <select value={p.icon}
                  onChange={e => onSave(p.id, 'icon', e.target.value)}
                  className="input text-sm w-full">
                  {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </td>
              <td className="py-2 pr-3">
                <input type="number" min="0" step="1" value={p.defaultWidth || ''}
                  onChange={e => onSet(p.id, 'defaultWidth', e.target.value)}
                  onBlur={e => onSave(p.id, 'defaultWidth', e.target.value)}
                  className="input w-full text-sm text-right" />
              </td>
              <td className="py-2">
                <input type="number" min="0" step="1" value={p.defaultHeight || ''}
                  onChange={e => onSet(p.id, 'defaultHeight', e.target.value)}
                  onBlur={e => onSave(p.id, 'defaultHeight', e.target.value)}
                  className="input w-full text-sm text-right" />
              </td>
              <td className="py-2 pl-2">
                <button onClick={() => onRemove(p.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all">
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={onAdd} className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors">
        <Plus size={13} /> {addLabel}
      </button>
    </>
  )
}

export function KalkylPanel() {
  const { config, updateConfig } = useAppConfig()
  const [activeTab, setActiveTab] = useState<ConfigTab>('fasad')

  // Fasad — Fönster & Dörrar
  const [ventanaSaved, setVentanaSaved] = useState(false)
  const [localVentana, setLocalVentana] = useState<VentanaPreset[]>(() =>
    Array.isArray(config?.kalkyl_ventanatyper) ? (config.kalkyl_ventanatyper as VentanaPreset[]) : DEFAULT_VENTANA_PRESETS
  )
  useEffect(() => {
    if (Array.isArray(config?.kalkyl_ventanatyper)) setLocalVentana(config.kalkyl_ventanatyper as VentanaPreset[])
  }, [config?.kalkyl_ventanatyper])

  // Fasad — Lutningstyper
  const [takSaved, setTakSaved] = useState(false)
  const [localTak, setLocalTak] = useState<TakType[]>(() =>
    Array.isArray(config?.kalkyl_taktyper) ? (config.kalkyl_taktyper as TakType[]) : DEFAULT_TAK_TYPER
  )
  useEffect(() => {
    if (Array.isArray(config?.kalkyl_taktyper)) setLocalTak(config.kalkyl_taktyper as TakType[])
  }, [config?.kalkyl_taktyper])

  // Tak — Öppningar
  const [takAvdragSaved, setTakAvdragSaved] = useState(false)
  const [localTakAvdrag, setLocalTakAvdrag] = useState<VentanaPreset[]>(() =>
    Array.isArray(config?.kalkyl_tak_avdrag) ? (config.kalkyl_tak_avdrag as VentanaPreset[]) : DEFAULT_TAK_AVDRAG
  )
  useEffect(() => {
    if (Array.isArray(config?.kalkyl_tak_avdrag)) setLocalTakAvdrag(config.kalkyl_tak_avdrag as VentanaPreset[])
  }, [config?.kalkyl_tak_avdrag])

  // Golv — Avdrag
  const [golvAvdragSaved, setGolvAvdragSaved] = useState(false)
  const [localGolvAvdrag, setLocalGolvAvdrag] = useState<VentanaPreset[]>(() =>
    Array.isArray(config?.kalkyl_golv_avdrag) ? (config.kalkyl_golv_avdrag as VentanaPreset[]) : DEFAULT_GOLV_AVDRAG
  )
  useEffect(() => {
    if (Array.isArray(config?.kalkyl_golv_avdrag)) setLocalGolvAvdrag(config.kalkyl_golv_avdrag as VentanaPreset[])
  }, [config?.kalkyl_golv_avdrag])

  // Vägg — Fönster & Dörrar
  const [vaggAvdragSaved, setVaggAvdragSaved] = useState(false)
  const [localVaggAvdrag, setLocalVaggAvdrag] = useState<VentanaPreset[]>(() =>
    Array.isArray(config?.kalkyl_vagg_avdrag) ? (config.kalkyl_vagg_avdrag as VentanaPreset[]) : DEFAULT_VAGG_AVDRAG
  )
  useEffect(() => {
    if (Array.isArray(config?.kalkyl_vagg_avdrag)) setLocalVaggAvdrag(config.kalkyl_vagg_avdrag as VentanaPreset[])
  }, [config?.kalkyl_vagg_avdrag])

  // Save helpers
  const saveVentana = async (next: VentanaPreset[]) => {
    setLocalVentana(next); await updateConfig({ kalkyl_ventanatyper: next as unknown })
    setVentanaSaved(true); setTimeout(() => setVentanaSaved(false), 2000)
  }
  const saveTak = async (next: TakType[]) => {
    setLocalTak(next); await updateConfig({ kalkyl_taktyper: next as unknown })
    setTakSaved(true); setTimeout(() => setTakSaved(false), 2000)
  }
  const saveTakAvdrag = async (next: VentanaPreset[]) => {
    setLocalTakAvdrag(next); await updateConfig({ kalkyl_tak_avdrag: next as unknown })
    setTakAvdragSaved(true); setTimeout(() => setTakAvdragSaved(false), 2000)
  }
  const saveGolvAvdrag = async (next: VentanaPreset[]) => {
    setLocalGolvAvdrag(next); await updateConfig({ kalkyl_golv_avdrag: next as unknown })
    setGolvAvdragSaved(true); setTimeout(() => setGolvAvdragSaved(false), 2000)
  }
  const saveVaggAvdrag = async (next: VentanaPreset[]) => {
    setLocalVaggAvdrag(next); await updateConfig({ kalkyl_vagg_avdrag: next as unknown })
    setVaggAvdragSaved(true); setTimeout(() => setVaggAvdragSaved(false), 2000)
  }

  // Slope-type field handlers
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

  // VentanaPreset handlers per tab
  const vh = makePresetsHandlers(localVentana, setLocalVentana, v => void saveVentana(v))
  const tah = makePresetsHandlers(localTakAvdrag, setLocalTakAvdrag, v => void saveTakAvdrag(v))
  const goh = makePresetsHandlers(localGolvAvdrag, setLocalGolvAvdrag, v => void saveGolvAvdrag(v))
  const vah = makePresetsHandlers(localVaggAvdrag, setLocalVaggAvdrag, v => void saveVaggAvdrag(v))

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="px-8 pt-6 pb-0 flex items-center gap-1 border-b border-border">
        {CONFIG_TABS.map(tab => (
          <button
            key={tab.type}
            onClick={() => setActiveTab(tab.type)}
            className={[
              'px-3 py-1.5 -mb-px rounded-t text-sm font-medium transition-colors border border-transparent',
              activeTab === tab.type
                ? 'bg-bg text-fg border-border border-b-bg'
                : 'text-muted hover:text-fg',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Fasad tab */}
      {activeTab === 'fasad' && (
        <>
          <div className="px-8 py-6 border-b border-border">
            <PresetsTable
              title="Fönster & Dörrar"
              description="Förvalt avdragstyper för fasadkalkyl"
              items={localVentana} saved={ventanaSaved}
              onSet={vh.setField} onSave={vh.saveField} onRemove={vh.remove} onAdd={vh.add}
              onReset={() => void saveVentana(DEFAULT_VENTANA_PRESETS)}
              addLabel="Ny fönster-/dörrtyp"
            />
          </div>

          <div className="px-8 py-6">
            <div className="flex items-center gap-3 mb-1">
              <p className="text-[11px] uppercase tracking-widest text-muted">Taktyper & Lutning</p>
              {takSaved && <SavedBadge />}
              <button onClick={() => void saveTak(DEFAULT_TAK_TYPER)} className="ml-auto text-xs text-subtle hover:text-muted transition-colors">
                Återställ standard
              </button>
            </div>
            <p className="text-xs text-subtle mb-5">
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
                      <input type="text" value={t.name}
                        onChange={e => setTakField(t.id, 'name', e.target.value)}
                        onBlur={e => saveTakField(t.id, 'name', e.target.value)}
                        className="input w-full text-sm" />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min="0" max="89" step="1" value={t.angleDeg || ''}
                        onChange={e => setTakField(t.id, 'angleDeg', e.target.value)}
                        onBlur={e => saveTakField(t.id, 'angleDeg', e.target.value)}
                        className="input w-full text-sm text-right" />
                    </td>
                    <td className="py-2">
                      <input type="number" min="1" step="0.01" value={t.slopeFactor || ''}
                        onChange={e => setTakField(t.id, 'slopeFactor', e.target.value)}
                        onBlur={e => saveTakField(t.id, 'slopeFactor', e.target.value)}
                        className="input w-full text-sm text-right text-amber-400" />
                    </td>
                    <td className="py-2 pl-2">
                      <button onClick={() => void saveTak(localTak.filter(x => x.id !== t.id))}
                        className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => void saveTak([...localTak, { id: crypto.randomUUID(), name: '', angleDeg: 27, slopeFactor: 1.12 }])}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
            >
              <Plus size={13} /> Ny taktyp
            </button>
          </div>
        </>
      )}

      {/* Tak tab */}
      {activeTab === 'tak' && (
        <div className="px-8 py-6">
          <PresetsTable
            title="Öppningar"
            description="Förvalt avdragstyper för takkalkyl — takfönster, rökluckor, genomföringar"
            items={localTakAvdrag} saved={takAvdragSaved}
            onSet={tah.setField} onSave={tah.saveField} onRemove={tah.remove} onAdd={tah.add}
            onReset={() => void saveTakAvdrag(DEFAULT_TAK_AVDRAG)}
            addLabel="Ny öppningstyp"
          />
        </div>
      )}

      {/* Golv tab */}
      {activeTab === 'golv' && (
        <div className="px-8 py-6">
          <PresetsTable
            title="Avdrag"
            description="Förvalt avdragstyper för golvkalkyl — trappor, pelare, dörrpartier"
            items={localGolvAvdrag} saved={golvAvdragSaved}
            onSet={goh.setField} onSave={goh.saveField} onRemove={goh.remove} onAdd={goh.add}
            onReset={() => void saveGolvAvdrag(DEFAULT_GOLV_AVDRAG)}
            addLabel="Ny avdragstyp"
          />
        </div>
      )}

      {/* Vägg tab */}
      {activeTab === 'vagg' && (
        <div className="px-8 py-6">
          <PresetsTable
            title="Fönster & Dörrar"
            description="Förvalt avdragstyper för väggkalkyl — fönster, dörrar"
            items={localVaggAvdrag} saved={vaggAvdragSaved}
            onSet={vah.setField} onSave={vah.saveField} onRemove={vah.remove} onAdd={vah.add}
            onReset={() => void saveVaggAvdrag(DEFAULT_VAGG_AVDRAG)}
            addLabel="Ny fönster-/dörrtyp"
          />
        </div>
      )}
    </div>
  )
}
