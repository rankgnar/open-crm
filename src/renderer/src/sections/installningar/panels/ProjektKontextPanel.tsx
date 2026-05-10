import { useState, useEffect } from 'react'
import { Trash2, RefreshCw, Database, ChevronDown, ChevronRight } from 'lucide-react'
import { SelectField } from '@/components/SelectField'

interface ProjektOption {
  id: string
  namn: string
  projekt_nummer: string
}

interface KontextEntry {
  id: string
  nyckel: string
  varde: string
  skapad_at: string
  uppdaterad_at: string
}

interface KeyGroup {
  nyckel: string
  entries: KontextEntry[]
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

function ValuePreview({ varde }: { varde: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = varde.length > 140
  if (!isLong) return <pre className="text-xs text-muted font-sans whitespace-pre-wrap leading-relaxed">{varde}</pre>
  return (
    <div>
      <pre className={`text-xs text-muted font-sans whitespace-pre-wrap leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>
        {varde}
      </pre>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] text-blue-400/70 hover:text-blue-400 mt-0.5 transition-colors"
      >
        {expanded ? 'Dölj' : 'Visa allt'}
      </button>
    </div>
  )
}

function KeyGroupRow({
  group,
  onDelete,
  deleting
}: {
  group: KeyGroup
  onDelete: (id: string) => void
  deleting: string | null
}) {
  const [open, setOpen] = useState(true)
  const latest = group.entries[0]

  return (
    <div className="border-b border-border last:border-0">
      {/* Group header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-hover transition-colors text-left"
      >
        {open
          ? <ChevronDown size={12} className="text-subtle shrink-0" />
          : <ChevronRight size={12} className="text-subtle shrink-0" />
        }
        <span className="text-xs font-semibold text-fg font-mono flex-1">{group.nyckel}</span>
        <span className="text-[10px] text-subtle shrink-0">
          {group.entries.length} {group.entries.length === 1 ? 'version' : 'versioner'} — senaste {fmtDate(latest.skapad_at)}
        </span>
      </button>

      {/* Versions */}
      {open && (
        <div className="border-t border-border">
          {group.entries.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''} bg-bg/40`}
            >
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <span className="text-[10px] text-subtle">{fmtDate(entry.skapad_at)}</span>
                <ValuePreview varde={entry.varde} />
              </div>
              <button
                onClick={() => onDelete(entry.id)}
                disabled={deleting === entry.id}
                className="shrink-0 p-1.5 rounded hover:bg-hover text-subtle hover:text-red-400 disabled:opacity-40 transition-colors mt-0.5"
                title="Ta bort"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ProjektKontextPanel() {
  const [projekt, setProjekt] = useState<ProjektOption[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [entries, setEntries] = useState<KontextEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    window.api.invoke('db:projekt:list').then((data) => {
      const list = data as ProjektOption[]
      setProjekt(list)
      if (list.length > 0) setSelectedId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    loadEntries()
  }, [selectedId])

  async function loadEntries() {
    setLoading(true)
    try {
      const data = await window.api.invoke('db:projekt-context:list', selectedId) as KontextEntry[]
      setEntries(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await window.api.invoke('db:projekt-context:delete', id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  async function handleClearAll() {
    if (!selectedId) return
    for (const e of entries) {
      await window.api.invoke('db:projekt-context:delete', e.id)
    }
    setEntries([])
  }

  // Group entries by nyckel, preserving newest-first order within each group
  const groups: KeyGroup[] = []
  const seen = new Map<string, KeyGroup>()
  for (const entry of entries) {
    let g = seen.get(entry.nyckel)
    if (!g) {
      g = { nyckel: entry.nyckel, entries: [] }
      groups.push(g)
      seen.set(entry.nyckel, g)
    }
    g.entries.push(entry)
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Project selector */}
      <div className="px-8 py-5 border-b border-border shrink-0">
        <label className="block text-[10px] uppercase tracking-widest text-subtle mb-2">Projekt</label>
        <SelectField
          value={selectedId}
          onChange={setSelectedId}
          placeholder={projekt.length === 0 ? 'Inga projekt hittade' : undefined}
          searchable
          className="w-72"
          options={projekt.map((p) => ({ value: p.id, label: `${p.projekt_nummer} — ${p.namn}` }))}
        />
      </div>

      {/* Entries */}
      <div className="px-8 py-5 flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <p className="text-[11px] uppercase tracking-widest text-muted">Sparade kontextvärden</p>
            {entries.length > 0 && (
              <span className="text-[10px] text-subtle bg-elevated border border-border rounded px-1.5 py-0.5">
                {entries.length} {entries.length === 1 ? 'post' : 'poster'} · {groups.length} {groups.length === 1 ? 'nyckel' : 'nycklar'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadEntries}
              disabled={loading}
              className="p-1.5 rounded hover:bg-hover text-muted hover:text-fg disabled:opacity-40 transition-colors"
              title="Uppdatera"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            {entries.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:bg-hover rounded border border-border transition-colors"
              >
                <Trash2 size={12} />
                Rensa alla
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6">
            <RefreshCw size={13} className="animate-spin text-muted" />
            <span className="text-xs text-muted">Laddar...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Database size={28} className="text-subtle" />
            <p className="text-sm text-muted">Inga sparade kontextvärden</p>
            <p className="text-xs text-subtle text-center">
              Kör ett workflow med noden "Spara kontext" för att fylla detta.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            {groups.map((group) => (
              <KeyGroupRow
                key={group.nyckel}
                group={group}
                onDelete={handleDelete}
                deleting={deleting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
