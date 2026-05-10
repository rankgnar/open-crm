import { ConfigField } from './ConfigField'

export function EkonomiPanel() {
  return (
    <div className="px-8 py-6">
      <p className="text-[11px] uppercase tracking-widest text-muted mb-5">ROT-avdrag tak — Ekonomi</p>
      <div className="grid grid-cols-3 gap-x-8 gap-y-5">
        <ConfigField label="Tak enkel (SEK)" field="rot_avdrag_tak_enkel" type="number" placeholder="50000" suffix="kr" />
        <ConfigField label="Tak med medsökande (SEK)" field="rot_avdrag_tak_dubbel" type="number" placeholder="100000" suffix="kr" />
      </div>
      <p className="mt-4 text-xs text-muted">Dessa värden används i Ekonomi-vyn och Förslag-panelen för att beräkna maxavdrag.</p>
    </div>
  )
}
