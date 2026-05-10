import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Toggle } from '@/components/Toggle'
import type { AktivitetsloggSetting } from '../types'

const KATEGORI_LABEL: Record<string, string> = {
  kund: 'Kund',
  projekt: 'Projekt',
  forslag: 'Förslag',
  order: 'Order',
  ata: 'ÄTA',
  tidplan: 'Tidplan',
  kalender: 'Kalender',
  kostnader: 'Kostnader',
  fakturering: 'Fakturering',
  signatur: 'Signatur',
  epost: 'E-post',
  personal: 'Personal',
  revisor: 'Revisor',
  workflow: 'Workflows',
  ovrigt: 'Övrigt',
}

const KATEGORI_ORDER = [
  'kund', 'projekt', 'forslag', 'order', 'ata', 'tidplan', 'kalender',
  'kostnader', 'fakturering', 'signatur', 'epost', 'personal', 'revisor',
  'workflow', 'ovrigt',
]

export function AktivitetsloggPanel() {
  const [settings, setSettings] = useState<AktivitetsloggSetting[]>([])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    window.api.invoke('db:aktivitetslogg:list').then((data) => {
      setSettings(data as AktivitetsloggSetting[])
    })
  }, [])

  async function handleToggle(handelse: string, aktiv: boolean) {
    await window.api.invoke('db:aktivitetslogg:toggle', handelse, aktiv)
    setSettings((prev) => prev.map((s) => s.handelse === handelse ? { ...s, aktiv } : s))
  }

  async function handleToggleKategori(kategori: string, aktiv: boolean) {
    const items = settings.filter((s) => (s.kategori ?? 'ovrigt') === kategori)
    await Promise.all(items.map((s) => window.api.invoke('db:aktivitetslogg:toggle', s.handelse, aktiv)))
    setSettings((prev) => prev.map((s) => (s.kategori ?? 'ovrigt') === kategori ? { ...s, aktiv } : s))
  }

  function toggleCollapsed(kategori: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(kategori)) next.delete(kategori)
      else next.add(kategori)
      return next
    })
  }

  const grouped = useMemo(() => {
    const map = new Map<string, AktivitetsloggSetting[]>()
    for (const s of settings) {
      const k = s.kategori ?? 'ovrigt'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(s)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.etikett.localeCompare(b.etikett, 'sv'))
    return KATEGORI_ORDER
      .filter((k) => map.has(k))
      .map((k) => ({ kategori: k, items: map.get(k)! }))
  }, [settings])

  return (
    <div className="flex flex-col">
      {grouped.map(({ kategori, items }) => {
        const allActive = items.every((i) => i.aktiv)
        const someActive = items.some((i) => i.aktiv)
        const isCollapsed = collapsed.has(kategori)
        return (
          <div key={kategori} className="border-b border-border">
            <div className="flex items-center justify-between px-4 py-2 bg-sidebar">
              <button
                onClick={() => toggleCollapsed(kategori)}
                className="flex items-center gap-2 text-fg hover:text-fg"
              >
                {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                <span className="text-[11px] uppercase tracking-widest text-muted">
                  {KATEGORI_LABEL[kategori] ?? kategori}
                </span>
                <span className="text-[10px] text-subtle">({items.length})</span>
              </button>
              <Toggle
                checked={allActive}
                indeterminate={!allActive && someActive}
                onChange={(next) => handleToggleKategori(kategori, next)}
                title={allActive ? 'Inaktivera alla' : 'Aktivera alla'}
              />
            </div>
            {!isCollapsed && items.map((s) => (
              <div key={s.handelse} className="flex items-center justify-between px-6 py-2.5 border-t border-border">
                <span className="text-xs text-fg">{s.etikett}</span>
                <Toggle checked={s.aktiv} onChange={(next) => handleToggle(s.handelse, next)} size="sm" />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
