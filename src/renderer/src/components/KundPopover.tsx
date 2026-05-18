import { useRef, useState } from 'react'
import { Phone, MapPin } from 'lucide-react'

export interface KundContactInfo {
  namn: string
  telefon: string | null
  telefon_2?: string | null
  adress: string | null
  adress_2?: string | null
  postnummer: string | null
  stad: string | null
}

export function KundPopover({ kund }: { kund: KundContactInfo }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const hasPhone = kund.telefon || kund.telefon_2
  const adressParts = [kund.adress, kund.adress_2, [kund.postnummer, kund.stad].filter(Boolean).join(' ')].filter(Boolean)
  const hasAddress = adressParts.length > 0
  const hasAny = hasPhone || hasAddress

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false) }}
        className="text-[13px] font-medium text-fg uppercase hover:text-emerald-400 transition-colors"
      >
        {kund.namn}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[200px] bg-elevated border border-border rounded-lg shadow-lg py-2 px-3 flex flex-col gap-2">
          {!hasAny && <span className="text-[11px] text-muted">Ingen kontaktinfo</span>}
          {hasPhone && (
            <div className="flex flex-col gap-0.5">
              {kund.telefon && (
                <div className="flex items-center gap-1.5">
                  <Phone size={10} className="text-muted shrink-0" />
                  <span className="text-[11px] text-fg">{kund.telefon}</span>
                </div>
              )}
              {kund.telefon_2 && (
                <div className="flex items-center gap-1.5">
                  <Phone size={10} className="text-muted shrink-0" />
                  <span className="text-[11px] text-fg">{kund.telefon_2}</span>
                </div>
              )}
            </div>
          )}
          {hasAddress && (
            <div className="flex items-start gap-1.5">
              <MapPin size={10} className="text-muted shrink-0 mt-0.5" />
              <div className="flex flex-col">
                {adressParts.map((line, i) => (
                  <span key={i} className="text-[11px] text-fg">{line}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
