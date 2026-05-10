import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Kund, CreateKundInput, KundStatusar } from './types'
import { useAppConfig } from '@/context/AppConfig'
import { SelectField } from '@/components/SelectField'

interface Props {
  initial?: Kund
  statusar: KundStatusar[]
  onSubmit: (data: CreateKundInput) => Promise<void>
  onCancel: () => void
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtOrgNummer(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.length <= 6 ? d : d.slice(0, 6) + '-' + d.slice(6, 10)
}

function fmtPostnummer(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.length <= 3 ? d : d.slice(0, 3) + ' ' + d.slice(3, 5)
}

function fmtPersonnummer(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.length <= 8 ? d : d.slice(0, 8) + '-' + d.slice(8, 12)
}

function capitalizeFirst(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function validateOrgNummer(val: string): string {
  if (!val) return ''
  return /^\d{6}-\d{4}$/.test(val) ? '' : 'Format: 556000-0000'
}

function validatePostnummer(val: string): string {
  if (!val) return ''
  return /^\d{3} \d{2}$/.test(val) ? '' : 'Format: 123 45'
}

// ─────────────────────────────────────────────────────────────────────────────

export function KundForm({ initial, statusar, onSubmit, onCancel }: Props) {
  const { config } = useAppConfig()
  const isEdit = !!initial

  const [kundnummer, setKundnummer] = useState(initial?.kundnummer ?? '')
  const [previewNummer, setPreviewNummer] = useState<string | null>(null)
  const [namn, setNamn] = useState(initial?.namn ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [telefon, setTelefon] = useState(initial?.telefon ?? '')
  const [telefon2, setTelefon2] = useState(initial?.telefon_2 ?? '')
  const [fax, setFax] = useState(initial?.fax ?? '')
  const [webbadress, setWebbadress] = useState(initial?.webbadress ?? '')
  const [adress, setAdress] = useState(initial?.adress ?? '')
  const [adress2, setAdress2] = useState(initial?.adress_2 ?? '')
  const [postnummer, setPostnummer] = useState(initial?.postnummer ?? '')
  const [postnummerErr, setPostnummerErr] = useState('')
  const [stad, setStad] = useState(initial?.stad ?? '')
  const [land, setLand] = useState(initial?.land ?? (isEdit ? 'Sverige' : (config?.kund_std_land ?? 'Sverige')))
  const [landskod, setLandskod] = useState(initial?.landskod ?? (isEdit ? 'SE' : (config?.kund_std_landskod ?? 'SE')))
  const [orgNummer, setOrgNummer] = useState(initial?.org_nummer ?? '')
  const [orgNummerErr, setOrgNummerErr] = useState('')
  const [personnummer, setPersonnummer] = useState(initial?.personnummer ?? '')
  const [fastighetsbeteckning, setFastighetsbeteckning] = useState(initial?.fastighetsbeteckning ?? '')
  const [brfOrgNummer, setBrfOrgNummer] = useState(initial?.brf_org_nummer ?? '')
  const [brfOrgErr, setBrfOrgErr] = useState('')
  const [medsokandNamn, setMedsokandNamn] = useState(initial?.medsokande_namn ?? '')
  const [medsokandPersonnummer, setMedsokandPersonnummer] = useState(initial?.medsokande_personnummer ?? '')
  const [orderStdVillkor, setOrderStdVillkor] = useState(initial?.order_std_villkor ?? '')
  const [ataStdVillkor, setAtaStdVillkor] = useState(initial?.ata_std_villkor ?? '')
  const [loginAnteckning, setLoginAnteckning] = useState(initial?.login_anteckning ?? '')
  const [status, setStatus] = useState<string>(initial?.status ?? (isEdit ? '' : (config?.kund_std_status ?? '')))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEdit) {
      window.api.invoke('db:kunder:preview-nummer').then((n) => setPreviewNummer(n as string)).catch(() => {})
    }
  }, [isEdit])

  function hasValidationErrors(): boolean {
    const e1 = validateOrgNummer(orgNummer)
    const e2 = validatePostnummer(postnummer)
    const e3 = validateOrgNummer(brfOrgNummer)
    setOrgNummerErr(e1)
    setPostnummerErr(e2)
    setBrfOrgErr(e3)
    return !!(e1 || e2 || e3)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim()) return
    if (hasValidationErrors()) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        kundnummer: kundnummer.trim() || undefined,
        namn: namn.trim(),
        email: email.trim() || undefined,
        telefon: telefon.trim() || undefined,
        telefon_2: telefon2.trim() || undefined,
        fax: fax.trim() || undefined,
        webbadress: webbadress.trim() || undefined,
        adress: adress.trim() || undefined,
        adress_2: adress2.trim() || undefined,
        postnummer: postnummer.trim() || undefined,
        stad: stad.trim() || undefined,
        land: land.trim() || undefined,
        landskod: landskod.trim() || undefined,
        org_nummer: orgNummer.trim() || undefined,
        personnummer: personnummer.trim() || undefined,
        fastighetsbeteckning: fastighetsbeteckning.trim() || undefined,
        brf_org_nummer: brfOrgNummer.trim() || undefined,
        medsokande_namn: medsokandNamn.trim() || undefined,
        medsokande_personnummer: medsokandPersonnummer.trim() || undefined,
        order_std_villkor: orderStdVillkor,
        ata_std_villkor: ataStdVillkor,
        login_anteckning: loginAnteckning.trim() || undefined,
        status
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <p className="text-[11px] uppercase tracking-widest text-muted">Kunder</p>
          <span className="text-subtle">/</span>
          <h2 className="text-sm font-semibold text-fg">{isEdit ? 'Redigera kund' : 'Ny kund'}</h2>
        </div>
        <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-muted hover:text-fg hover:bg-hover transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 divide-x divide-border overflow-auto">

        {/* Columna izquierda */}
        <div className="flex flex-col flex-1 divide-y divide-border">

          <div className="px-8 py-6 flex flex-col gap-4">
            <Label>Grunduppgifter</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">
                  Kundnummer
                  {!isEdit && previewNummer && <span className="ml-2 font-normal text-subtle">→ {previewNummer}</span>}
                </label>
                <input value={kundnummer} onChange={(e) => setKundnummer(e.target.value)} placeholder={previewNummer ?? 'Auto-genererat'} className="input font-mono" />
              </div>
              <F label="Status">
                <SelectField
                  value={status}
                  onChange={setStatus}
                  options={statusar.map((s) => ({ value: s.namn, label: s.namn }))}
                />
              </F>
            </div>
            <F label="Namn *">
              <input
                value={namn}
                onChange={(e) => setNamn(e.target.value.toUpperCase())}
                required
                autoFocus
                placeholder="FÖRETAGSNAMN ELLER FULLSTÄNDIGT NAMN"
                className="input uppercase"
              />
            </F>
            <F label="Org-nummer">
              <input
                value={orgNummer}
                onChange={(e) => { setOrgNummer(fmtOrgNummer(e.target.value)); setOrgNummerErr('') }}
                onBlur={() => setOrgNummerErr(validateOrgNummer(orgNummer))}
                placeholder="556000-0000"
                maxLength={11}
                className={`input font-mono ${orgNummerErr ? 'border-red-400/60' : ''}`}
              />
              {orgNummerErr && <span className="text-[11px] text-red-400">{orgNummerErr}</span>}
            </F>
            <F label="Personnummer">
              <input
                value={personnummer}
                onChange={(e) => setPersonnummer(fmtPersonnummer(e.target.value))}
                placeholder="YYMMDD-XXXX"
                maxLength={13}
                className="input font-mono"
              />
              <span className="text-[11px] text-subtle">Fylls i automatiskt vid signering om fältet är tomt.</span>
            </F>
            <F label="Login (intern anteckning för test)">
              <input
                value={loginAnteckning}
                onChange={(e) => setLoginAnteckning(e.target.value)}
                placeholder="t.ex. test123"
                className="input"
                autoComplete="off"
              />
            </F>
          </div>

          <div className="px-8 py-6 flex flex-col gap-4">
            <Label>Kontaktuppgifter</Label>
            <div className="grid grid-cols-2 gap-3">
              <F label="E-post">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kontakt@exempel.se" className="input" />
              </F>
              <F label="Webbadress">
                <input value={webbadress} onChange={(e) => setWebbadress(e.target.value)} placeholder="www.exempel.se" className="input" />
              </F>
              <F label="Telefon">
                <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="070-000 00 00" className="input" />
              </F>
              <F label="Telefon 2">
                <input value={telefon2} onChange={(e) => setTelefon2(e.target.value)} placeholder="070-000 00 00" className="input" />
              </F>
            </div>
            <F label="Fax">
              <input value={fax} onChange={(e) => setFax(e.target.value)} placeholder="08-000 00 00" className="input" />
            </F>
          </div>

        </div>

        {/* Columna derecha */}
        <div className="flex flex-col flex-1 divide-y divide-border">

          <div className="px-8 py-6 flex flex-col gap-4">
            <Label>Fakturaadress</Label>
            <F label="Fakturaadress">
              <input value={adress} onChange={(e) => setAdress(e.target.value)} placeholder="Gatugatan 1" className="input" />
            </F>
            <F label="Fakturaadress 2">
              <input value={adress2} onChange={(e) => setAdress2(e.target.value)} placeholder="c/o, våning, etc." className="input" />
            </F>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Postnr</label>
                <input
                  value={postnummer}
                  onChange={(e) => { setPostnummer(fmtPostnummer(e.target.value)); setPostnummerErr('') }}
                  onBlur={() => setPostnummerErr(validatePostnummer(postnummer))}
                  placeholder="123 45"
                  maxLength={6}
                  className={`input font-mono ${postnummerErr ? 'border-red-400/60' : ''}`}
                />
                {postnummerErr && <span className="text-[11px] text-red-400">{postnummerErr}</span>}
              </div>
              <F label="Ort">
                <input
                  value={stad}
                  onChange={(e) => setStad(e.target.value)}
                  onBlur={(e) => setStad(capitalizeFirst(e.target.value))}
                  placeholder="Stockholm"
                  className="input"
                />
              </F>
              <F label="Land">
                <input value={land} onChange={(e) => setLand(e.target.value)} placeholder="Sverige" className="input" />
              </F>
              <F label="Landskod">
                <input value={landskod} onChange={(e) => setLandskod(e.target.value.toUpperCase())} placeholder="SE" maxLength={2} className="input uppercase" />
              </F>
            </div>
          </div>

          <div className="px-8 py-6 flex flex-col gap-4">
            <Label>Fastighet &amp; husarbete</Label>
            <F label="Fastighetsbeteckning / Lägenhetsnr">
              <input value={fastighetsbeteckning} onChange={(e) => setFastighetsbeteckning(e.target.value)} placeholder="Exempel 1:23" className="input" />
            </F>
            <F label="BRF:s org.nr">
              <input
                value={brfOrgNummer}
                onChange={(e) => { setBrfOrgNummer(fmtOrgNummer(e.target.value)); setBrfOrgErr('') }}
                onBlur={() => setBrfOrgErr(validateOrgNummer(brfOrgNummer))}
                placeholder="769000-0000"
                maxLength={11}
                className={`input font-mono ${brfOrgErr ? 'border-red-400/60' : ''}`}
              />
              {brfOrgErr && <span className="text-[11px] text-red-400">{brfOrgErr}</span>}
            </F>
            <F label="Namn för medsökande (husarbete)">
              <input
                value={medsokandNamn}
                onChange={(e) => setMedsokandNamn(e.target.value)}
                onBlur={(e) => setMedsokandNamn(capitalizeFirst(e.target.value))}
                placeholder="Fullständigt namn"
                className="input"
              />
            </F>
            <F label="Personnummer för medsökande (husarbete)">
              <input
                value={medsokandPersonnummer}
                onChange={(e) => setMedsokandPersonnummer(fmtPersonnummer(e.target.value))}
                placeholder="YYYYMMDD-XXXX"
                maxLength={13}
                className="input font-mono"
              />
            </F>
          </div>

          <div className="px-8 py-6 flex flex-col gap-4">
            <Label>Standardvillkor för extraarbeten (Order)</Label>
            <F label="Villkor som kopieras till nya orders för denna kund">
              <textarea
                value={orderStdVillkor}
                onChange={(e) => setOrderStdVillkor(e.target.value)}
                rows={6}
                placeholder="t.ex. Order är gällande efter signering av kund. Arbetet faktureras separat från huvudprojekt. Betalning 30 dagar netto."
                className="input resize-y leading-relaxed"
              />
            </F>
            <p className="text-[11px] text-subtle">
              Snapshot — det här texten kopieras till varje ny order. Ändringar här påverkar inte redan skapade orders.
            </p>
          </div>

          <div className="px-8 py-6 flex flex-col gap-4">
            <Label>Standardvillkor för ÄTA (ändrings- och tilläggsarbeten)</Label>
            <F label="Villkor som kopieras till nya ÄTA-arbeten för denna kund">
              <textarea
                value={ataStdVillkor}
                onChange={(e) => setAtaStdVillkor(e.target.value)}
                rows={6}
                placeholder="t.ex. Detta arbete utgör ett tilläggsarbete och faktureras separat från huvudprojekt. Påbörjas efter kundens signering."
                className="input resize-y leading-relaxed"
              />
            </F>
            <p className="text-[11px] text-subtle">
              Snapshot — kopieras till varje ny ÄTA. Ändringar här påverkar inte redan skapade ÄTA-arbeten.
            </p>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-8 py-4 border-t border-border shrink-0">
        {error
          ? <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-1.5">{error}</p>
          : <span />
        }
        <div className="flex items-center gap-4">
          <button type="button" onClick={onCancel} className="text-sm text-muted hover:text-fg transition-colors">
            Avbryt
          </button>
          <button
            type="submit"
            disabled={submitting || !namn.trim()}
            className="rounded-lg bg-fg text-bg px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sparar...' : isEdit ? 'Spara ändringar' : 'Skapa kund'}
          </button>
        </div>
      </div>
    </form>
  )
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[11px] uppercase tracking-widest text-muted ${className ?? ''}`}>{children}</p>
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      {children}
    </div>
  )
}
