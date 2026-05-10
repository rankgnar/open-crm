import { useState, useEffect } from 'react'
import { Plus, Trash2, Check, X, RefreshCw, Star } from 'lucide-react'
import type { EpostAlias } from '@/sections/epost/types'
import { useAppConfig } from '@/context/AppConfig'

interface FormState {
  etikett: string
  fran_namn: string
  fran_adress: string
  signatur_html: string
  aktiv: boolean
  standard: boolean
}

const EMPTY_FORM: FormState = {
  etikett: '',
  fran_namn: '',
  fran_adress: '',
  signatur_html: '',
  aktiv: true,
  standard: false,
}

export function EpostAliasPanel() {
  const { config } = useAppConfig()
  const [aliasar, setAliasar] = useState<EpostAlias[]>([])
  const [vald, setVald] = useState<EpostAlias | null>(null)
  const [redigerar, setRedigerar] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [laddar, setLaddar] = useState(false)
  const [synkar, setSynkar] = useState(false)
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)
  const [synkResultat, setSynkResultat] = useState<string | null>(null)

  useEffect(() => { void hamta() }, [])

  async function hamta() {
    setLaddar(true)
    try {
      const data = await window.api.invoke('db:epost-alias:list') as EpostAlias[]
      setAliasar(data)
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Fel vid hämtning')
    } finally {
      setLaddar(false)
    }
  }

  async function handleSynka() {
    setSynkar(true)
    setFel(null)
    setSynkResultat(null)
    try {
      const r = await window.api.invoke('db:epost-alias:sync-from-zoho') as { added: number; updated: number }
      setSynkResultat(`${r.added} nya, ${r.updated} uppdaterade`)
      await hamta()
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Synk misslyckades')
    } finally {
      setSynkar(false)
    }
  }

  function handleNy() {
    setVald(null)
    setForm(EMPTY_FORM)
    setRedigerar(true)
    setFel(null)
  }

  function handleRedigera(alias: EpostAlias) {
    setVald(alias)
    setForm({
      etikett: alias.etikett,
      fran_namn: alias.fran_namn,
      fran_adress: alias.fran_adress,
      signatur_html: alias.signatur_html,
      aktiv: alias.aktiv,
      standard: alias.standard,
    })
    setRedigerar(true)
    setFel(null)
  }

  async function handleSpara() {
    if (!form.fran_adress.trim()) {
      setFel('E-postadress är obligatoriskt')
      return
    }
    setSparar(true)
    setFel(null)
    try {
      if (vald) {
        await window.api.invoke('db:epost-alias:update', vald.id, form)
      } else {
        await window.api.invoke('db:epost-alias:create', form)
      }
      await hamta()
      setRedigerar(false)
      setVald(null)
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Fel vid sparande')
    } finally {
      setSparar(false)
    }
  }

  async function handleSetStandard(id: string) {
    try {
      await window.api.invoke('db:epost-alias:set-standard', id)
      await hamta()
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Fel')
    }
  }

  async function handleTabort(id: string) {
    if (!confirm('Ta bort aliaset?')) return
    try {
      await window.api.invoke('db:epost-alias:delete', id)
      await hamta()
      if (vald?.id === id) { setVald(null); setRedigerar(false) }
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Fel vid borttagning')
    }
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 gap-2">
          <span className="text-xs text-muted">{aliasar.length} alias</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => void handleSynka()}
              disabled={synkar}
              title="Synka från Zoho"
              className="flex items-center gap-1.5 text-xs text-fg px-2.5 py-1.5 rounded-lg hover:bg-hover transition-colors disabled:opacity-40"
            >
              <RefreshCw size={12} className={synkar ? 'animate-spin' : ''} /> Synka
            </button>
            <button
              onClick={handleNy}
              className="flex items-center gap-1.5 text-xs text-fg px-2.5 py-1.5 rounded-lg hover:bg-hover transition-colors"
            >
              <Plus size={12} /> Nytt
            </button>
          </div>
        </div>
        {synkResultat && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 text-xs text-emerald-400">{synkResultat}</div>
        )}
        <div className="flex-1 overflow-auto">
          {laddar ? (
            <p className="px-4 py-6 text-sm text-muted text-center">Laddar…</p>
          ) : aliasar.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted text-center">Inga alias ännu — synka från Zoho</p>
          ) : (
            aliasar.map(alias => (
              <button
                key={alias.id}
                onClick={() => handleRedigera(alias)}
                className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors hover:bg-hover ${vald?.id === alias.id && redigerar ? 'bg-hover' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${alias.aktiv ? 'text-fg' : 'text-muted line-through'}`}>
                        {alias.etikett || alias.fran_adress}
                      </p>
                      {alias.standard && <Star size={11} className="text-amber-400 shrink-0 fill-amber-400" />}
                    </div>
                    <p className="text-[11px] text-subtle truncate">{alias.fran_adress}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); void handleTabort(alias.id) }}
                    title="Ta bort"
                    className="p-1 rounded text-subtle hover:text-red-400 hover:bg-hover shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {redigerar ? (
        <div className="flex-1 overflow-auto px-8 py-6 flex flex-col gap-5">
          <p className="text-[11px] uppercase tracking-widest text-muted">
            {vald ? 'Redigera alias' : 'Nytt alias'}
          </p>

          {fel && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{fel}</div>
          )}

          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted">Etikett</label>
              <input
                type="text"
                value={form.etikett}
                onChange={e => setForm(f => ({ ...f, etikett: e.target.value }))}
                placeholder="Offerter, Fakturor, VD…"
                className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30 placeholder:text-subtle"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted">Visningsnamn</label>
              <input
                type="text"
                value={form.fran_namn}
                onChange={e => setForm(f => ({ ...f, fran_namn: e.target.value }))}
                placeholder="(använder företagsnamn)"
                className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30 placeholder:text-subtle"
              />
              <p className="text-[11px] text-subtle">Vad mottagaren ser. Lämna tomt för att använda företagsnamnet.</p>
            </div>

            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-[11px] uppercase tracking-widest text-muted">E-postadress</label>
              <input
                type="email"
                value={form.fran_adress}
                onChange={e => setForm(f => ({ ...f, fran_adress: e.target.value }))}
                placeholder="alias@foretag.se"
                className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30 placeholder:text-subtle"
              />
              {form.fran_adress && (
                <p className="text-[11px] text-subtle">
                  Mottagaren ser:{' '}
                  <span className="text-fg">
                    {(form.fran_namn.trim() || config?.foretag_namn?.trim()) && (
                      <>&quot;{form.fran_namn.trim() || config?.foretag_namn}&quot; </>
                    )}
                    &lt;{form.fran_adress}&gt;
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-[11px] uppercase tracking-widest text-muted">Signatur (HTML)</label>
              <textarea
                value={form.signatur_html}
                onChange={e => setForm(f => ({ ...f, signatur_html: e.target.value }))}
                placeholder={'<p>Med vänlig hälsning,<br>Mitt företag AB</p>'}
                rows={8}
                className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-muted outline-none focus:border-fg/30 placeholder:text-subtle font-mono resize-none"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.aktiv}
                  onChange={e => setForm(f => ({ ...f, aktiv: e.target.checked }))}
                  className="accent-emerald-400"
                />
                <span className="text-sm text-fg">Aktiv</span>
              </label>
              {vald && (
                <button
                  type="button"
                  onClick={() => { void handleSetStandard(vald.id) }}
                  disabled={vald.standard}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-colors ${vald.standard ? 'bg-amber-500/10 text-amber-400 cursor-default' : 'text-muted hover:text-fg hover:bg-hover'}`}
                >
                  <Star size={12} className={vald.standard ? 'fill-amber-400' : ''} />
                  {vald.standard ? 'Standard' : 'Sätt som standard'}
                </button>
              )}
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
          Välj ett alias eller synka från Zoho
        </div>
      )}
    </div>
  )
}
