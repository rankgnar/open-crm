import { useState, useEffect } from 'react'
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

// Cell input base classes
const CI = 'bg-transparent text-sm text-fg outline-none placeholder:text-subtle w-full'

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
  const [postnummer, setPostnummer] = useState(fmtPostnummer(initial?.postnummer ?? ''))
  const [postnummerErr, setPostnummerErr] = useState('')
  const [stad, setStad] = useState(initial?.stad ?? '')
  const [land, setLand] = useState(initial?.land ?? (isEdit ? 'Sverige' : (config?.kund_std_land ?? 'Sverige')))
  const [landskod, setLandskod] = useState(initial?.landskod ?? (isEdit ? 'SE' : (config?.kund_std_landskod ?? 'SE')))
  const [orgNummer, setOrgNummer] = useState(fmtOrgNummer(initial?.org_nummer ?? ''))
  const [orgNummerErr, setOrgNummerErr] = useState('')
  const [personnummer, setPersonnummer] = useState(fmtPersonnummer(initial?.personnummer ?? ''))
  const [fastighetsbeteckning, setFastighetsbeteckning] = useState(initial?.fastighetsbeteckning ?? '')
  const [brfOrgNummer, setBrfOrgNummer] = useState(fmtOrgNummer(initial?.brf_org_nummer ?? ''))
  const [brfOrgErr, setBrfOrgErr] = useState('')
  const [medsokandNamn, setMedsokandNamn] = useState(initial?.medsokande_namn ?? '')
  const [medsokandPersonnummer, setMedsokandPersonnummer] = useState(fmtPersonnummer(initial?.medsokande_personnummer ?? ''))
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
        email: email.trim() || null,
        telefon: telefon.trim() || null,
        telefon_2: telefon2.trim() || null,
        fax: fax.trim() || null,
        webbadress: webbadress.trim() || null,
        adress: adress.trim() || null,
        adress_2: adress2.trim() || null,
        postnummer: postnummer.trim() || null,
        stad: stad.trim() || null,
        land: land.trim() || null,
        landskod: landskod.trim() || null,
        org_nummer: orgNummer.trim() || null,
        personnummer: personnummer.trim() || null,
        fastighetsbeteckning: fastighetsbeteckning.trim() || null,
        brf_org_nummer: brfOrgNummer.trim() || null,
        medsokande_namn: medsokandNamn.trim() || null,
        medsokande_personnummer: medsokandPersonnummer.trim() || null,
        order_std_villkor: orderStdVillkor,
        ata_std_villkor: ataStdVillkor,
        login_anteckning: loginAnteckning.trim() || null,
        status
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">

      {/* Header — mirrors KundDetail header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <p className="text-[11px] uppercase tracking-widest text-muted">Kunder</p>
          <span className="text-subtle">/</span>
          <span className="text-sm font-medium text-fg">{isEdit ? 'Redigera kund' : 'Ny kund'}</span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <p className="text-red-400 text-[10px] font-semibold bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-1.5 max-w-xs truncate">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={submitting || !namn.trim()}
            className="inline-flex items-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-fg hover:opacity-70 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sparar...' : isEdit ? 'Spara ändringar' : 'Skapa kund'}
          </button>
        </div>
      </div>

      {/* Body — same scrollable structure as KundDetail */}
      <div className="flex-1 overflow-auto flex flex-col">

        {/* Title block — Namn + Status */}
        <div className="px-8 py-6 border-b border-border flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-0.5">
              {isEdit ? initial?.kundnummer : (previewNummer ?? '—')}
            </p>
            <input
              value={namn}
              onChange={(e) => setNamn(e.target.value.toUpperCase())}
              required
              autoFocus
              placeholder="FÖRETAGSNAMN ELLER FULLSTÄNDIGT NAMN"
              className="text-xl font-semibold text-fg bg-transparent outline-none w-full placeholder:text-muted/30 uppercase"
            />
          </div>
          <div className="shrink-0 w-44">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-1.5">Status</p>
            <SelectField
              value={status}
              onChange={setStatus}
              options={statusar.map((s) => ({ value: s.namn, label: s.namn }))}
            />
          </div>
        </div>

        {/* Grunduppgifter */}
        <FS title="Grunduppgifter">
          <FC label="Kundnummer">
            <input
              value={kundnummer}
              onChange={(e) => setKundnummer(e.target.value)}
              placeholder={previewNummer ?? 'Auto-genererat'}
              className={`${CI} font-mono`}
            />
          </FC>
          <FC label="Org-nummer" error={orgNummerErr}>
            <input
              value={orgNummer}
              onChange={(e) => { setOrgNummer(fmtOrgNummer(e.target.value)); setOrgNummerErr('') }}
              onBlur={() => setOrgNummerErr(validateOrgNummer(orgNummer))}
              placeholder="556000-0000"
              maxLength={11}
              className={`${CI} font-mono ${orgNummerErr ? 'text-red-400' : ''}`}
            />
          </FC>
          <FC label="Login (intern anteckning)">
            <input
              value={loginAnteckning}
              onChange={(e) => setLoginAnteckning(e.target.value)}
              placeholder="t.ex. test123"
              className={CI}
              autoComplete="off"
            />
          </FC>
        </FS>

        {/* Kontaktuppgifter */}
        <FS title="Kontaktuppgifter">
          <FC label="E-post">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kontakt@exempel.se" className={CI} />
          </FC>
          <FC label="Url">
            <input value={webbadress} onChange={(e) => setWebbadress(e.target.value)} placeholder="www.exempel.se" className={CI} />
          </FC>
          <FC label="Telefon">
            <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="070-000 00 00" className={CI} />
          </FC>
          <FC label="Telefon 2">
            <input value={telefon2} onChange={(e) => setTelefon2(e.target.value)} placeholder="070-000 00 00" className={CI} />
          </FC>
          <FC label="Fax">
            <input value={fax} onChange={(e) => setFax(e.target.value)} placeholder="08-000 00 00" className={CI} />
          </FC>
          <FC label="Personnummer">
            <input
              value={personnummer}
              onChange={(e) => setPersonnummer(fmtPersonnummer(e.target.value))}
              placeholder="YYMMDD-XXXX"
              maxLength={13}
              className={`${CI} font-mono`}
            />
          </FC>
        </FS>

        {/* Fakturaadress */}
        <FS title="Fakturaadress">
          <FC label="Fakturaadress">
            <input value={adress} onChange={(e) => setAdress(e.target.value)} placeholder="Gatugatan 1" className={CI} />
          </FC>
          <FC label="Fakturaadress 2">
            <input value={adress2} onChange={(e) => setAdress2(e.target.value)} placeholder="c/o, våning, etc." className={CI} />
          </FC>
          <FC label="Postnummer" error={postnummerErr}>
            <input
              value={postnummer}
              onChange={(e) => { setPostnummer(fmtPostnummer(e.target.value)); setPostnummerErr('') }}
              onBlur={() => setPostnummerErr(validatePostnummer(postnummer))}
              placeholder="123 45"
              maxLength={6}
              className={`${CI} font-mono ${postnummerErr ? 'text-red-400' : ''}`}
            />
          </FC>
          <FC label="Ort">
            <input
              value={stad}
              onChange={(e) => setStad(e.target.value)}
              onBlur={(e) => setStad(capitalizeFirst(e.target.value))}
              placeholder="Stockholm"
              className={CI}
            />
          </FC>
          <FC label="Land">
            <input value={land} onChange={(e) => setLand(e.target.value)} placeholder="Sverige" className={CI} />
          </FC>
          <FC label="Landskod">
            <input
              value={landskod}
              onChange={(e) => setLandskod(e.target.value.toUpperCase())}
              placeholder="SE"
              maxLength={2}
              className={`${CI} uppercase`}
            />
          </FC>
        </FS>

        {/* Fastighet & husarbete */}
        <FS title="Fastighet & husarbete" cols={4}>
          <FC label="Fastighetsbeteckning / Lägenhetsnr">
            <input value={fastighetsbeteckning} onChange={(e) => setFastighetsbeteckning(e.target.value)} placeholder="Exempel 1:23" className={CI} />
          </FC>
          <FC label="BRF:s org.nr" error={brfOrgErr}>
            <input
              value={brfOrgNummer}
              onChange={(e) => { setBrfOrgNummer(fmtOrgNummer(e.target.value)); setBrfOrgErr('') }}
              onBlur={() => setBrfOrgErr(validateOrgNummer(brfOrgNummer))}
              placeholder="769000-0000"
              maxLength={11}
              className={`${CI} font-mono ${brfOrgErr ? 'text-red-400' : ''}`}
            />
          </FC>
          <FC label="Medsökande namn">
            <input
              value={medsokandNamn}
              onChange={(e) => setMedsokandNamn(e.target.value)}
              onBlur={(e) => setMedsokandNamn(capitalizeFirst(e.target.value))}
              placeholder="Fullständigt namn"
              className={CI}
            />
          </FC>
          <FC label="Medsökande personnummer">
            <input
              value={medsokandPersonnummer}
              onChange={(e) => setMedsokandPersonnummer(fmtPersonnummer(e.target.value))}
              placeholder="YYYYMMDD-XXXX"
              maxLength={13}
              className={`${CI} font-mono`}
            />
          </FC>
        </FS>

        {/* Standardvillkor Order */}
        <div className="px-8 py-6 border-b border-border flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-widest text-muted">Standardvillkor för extraarbeten (Order)</p>
          <textarea
            value={orderStdVillkor}
            onChange={(e) => setOrderStdVillkor(e.target.value)}
            rows={5}
            placeholder="t.ex. Order är gällande efter signering av kund. Arbetet faktureras separat från huvudprojekt. Betalning 30 dagar netto."
            className="bg-elevated border border-border rounded-sm px-4 py-3 text-sm text-muted outline-none resize-y leading-relaxed placeholder:text-subtle"
          />
          <p className="text-[11px] text-subtle">Snapshot — kopieras till varje ny order. Ändringar påverkar inte redan skapade orders.</p>
        </div>

        {/* Standardvillkor ÄTA */}
        <div className="px-8 py-6 border-b border-border flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-widest text-muted">Standardvillkor för ÄTA</p>
          <textarea
            value={ataStdVillkor}
            onChange={(e) => setAtaStdVillkor(e.target.value)}
            rows={5}
            placeholder="t.ex. Detta arbete utgör ett tilläggsarbete och faktureras separat från huvudprojekt. Påbörjas efter kundens signering."
            className="bg-elevated border border-border rounded-sm px-4 py-3 text-sm text-muted outline-none resize-y leading-relaxed placeholder:text-subtle"
          />
          <p className="text-[11px] text-subtle">Snapshot — kopieras till varje ny ÄTA. Ändringar påverkar inte redan skapade ÄTA-arbeten.</p>
        </div>

      </div>
    </form>
  )
}

// ── Local layout helpers ──────────────────────────────────────────────────────

function FS({ title, children, cols = 3 }: { title: string; children: React.ReactNode; cols?: 3 | 4 }) {
  return (
    <div className="px-8 py-6 border-b border-border">
      <p className="text-[11px] uppercase tracking-widest text-muted mb-4">{title}</p>
      <div className={`grid gap-[1px] bg-border overflow-hidden rounded-sm ${cols === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {children}
      </div>
    </div>
  )
}

function FC({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 bg-elevated px-4 py-3 ${error ? 'ring-1 ring-inset ring-red-400/40' : ''}`}>
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      {children}
      {error && <span className="text-[10px] text-red-400 mt-0.5">{error}</span>}
    </div>
  )
}
