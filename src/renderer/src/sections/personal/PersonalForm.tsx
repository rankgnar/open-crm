import { useState, useEffect } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import type { Personal, CreatePersonalInput, UpdatePersonalInput, PersonalTyp, Loneform, PersonalStatusar } from './types'
import { SelectField } from '@/components/SelectField'

interface Props {
  initial?: Personal
  statusar: PersonalStatusar[]
  onSubmit: (data: CreatePersonalInput | UpdatePersonalInput) => Promise<void>
  onCancel: () => void
}

function fmtPersonnummer(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.length <= 8 ? d : d.slice(0, 8) + '-' + d.slice(8, 12)
}

function fmtPostnummer(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.length <= 3 ? d : d.slice(0, 3) + ' ' + d.slice(3, 5)
}

function validatePostnummer(val: string): string {
  if (!val) return ''
  return /^\d{3} \d{2}$/.test(val) ? '' : 'Format: 123 45'
}

function capitalizeFirst(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export function PersonalForm({ initial, statusar, onSubmit, onCancel }: Props) {
  const isEdit = !!initial

  const [previewNummer, setPreviewNummer] = useState('')
  const [namn, setNamn] = useState(initial?.namn ?? '')
  const [personnummer, setPersonnummer] = useState(initial?.personnummer ?? '')
  const [roll, setRoll] = useState(initial?.roll ?? '')
  const [personaltyp, setPersonaltyp] = useState<PersonalTyp | ''>(initial?.personaltyp ?? '')
  const [loneform, setLoneform] = useState<Loneform | ''>(initial?.loneform ?? '')
  const [anstallningsform, setAnstallningsform] = useState(initial?.anstallningsform ?? '')
  const [status, setStatus] = useState<string>(initial?.status ?? (statusar[0]?.namn ?? 'Aktiv'))
  const [email, setEmail] = useState(initial?.email ?? '')
  const [telefon, setTelefon] = useState(initial?.telefon ?? '')
  const [postadress, setPostadress] = useState(initial?.postadress ?? '')
  const [postnummer, setPostnummer] = useState(initial?.postnummer ?? '')
  const [ort, setOrt] = useState(initial?.ort ?? '')
  const [anstallningsdatum, setAnstallningsdatum] = useState(initial?.anstallningsdatum ?? '')
  const [slutdatum, setSlutdatum] = useState(initial?.slutdatum ?? '')
  const [manadslön, setManadslön] = useState(initial?.['manadslön']?.toString() ?? '')
  const [timlön, setTimlön] = useState(initial?.['timlön']?.toString() ?? '')
  const [sysselsattningsgrad, setSysselsattningsgrad] = useState(initial?.sysselsattningsgrad?.toString() ?? '100')
  const [clearingnummer, setClearingnummer] = useState(initial?.clearingnummer ?? '')
  const [kontonummer, setKontonummer] = useState(initial?.kontonummer ?? '')
  const [bank, setBank] = useState(initial?.bank ?? '')
  const [postnummerErr, setPostnummerErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEdit) {
      window.api.invoke('db:personal:preview-nummer').then((n) => setPreviewNummer(n as string)).catch(() => {})
    }
  }, [isEdit])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim()) return
    const pErr = validatePostnummer(postnummer)
    setPostnummerErr(pErr)
    if (pErr) return
    setSaving(true)
    setSubmitError(null)
    try {
      const manadslönNum = manadslön ? parseFloat(manadslön) : NaN
      const timlönNum = timlön ? parseFloat(timlön) : NaN
      const syssNum = sysselsattningsgrad ? parseFloat(sysselsattningsgrad) : NaN

      if (isEdit) {
        const data: UpdatePersonalInput = {
          namn: namn.trim(),
          status,
          personnummer: personnummer.trim() || null,
          roll: roll.trim() || null,
          personaltyp: personaltyp || null,
          loneform: loneform || null,
          anstallningsform: anstallningsform.trim() || null,
          email: email.trim() || null,
          telefon: telefon.trim() || null,
          postadress: postadress.trim() || null,
          postnummer: postnummer.trim() || null,
          ort: ort.trim() || null,
          anstallningsdatum: anstallningsdatum || null,
          slutdatum: slutdatum || null,
          'manadslön': !isNaN(manadslönNum) ? manadslönNum : null,
          'timlön': !isNaN(timlönNum) ? timlönNum : null,
          sysselsattningsgrad: !isNaN(syssNum) ? syssNum : null,
          clearingnummer: clearingnummer.trim() || null,
          kontonummer: kontonummer.trim() || null,
          bank: bank.trim() || null,
        }
        await onSubmit(data)
      } else {
        const data: CreatePersonalInput = { namn: namn.trim(), status }
        if (personnummer.trim()) data.personnummer = personnummer.trim()
        if (roll.trim()) data.roll = roll.trim()
        if (personaltyp) data.personaltyp = personaltyp
        if (loneform) data.loneform = loneform
        if (anstallningsform.trim()) data.anstallningsform = anstallningsform.trim()
        if (email.trim()) data.email = email.trim()
        if (telefon.trim()) data.telefon = telefon.trim()
        if (postadress.trim()) data.postadress = postadress.trim()
        if (postnummer.trim()) data.postnummer = postnummer.trim()
        if (ort.trim()) data.ort = ort.trim()
        if (anstallningsdatum) data.anstallningsdatum = anstallningsdatum
        if (slutdatum) data.slutdatum = slutdatum
        if (!isNaN(manadslönNum)) data['manadslön'] = manadslönNum
        if (!isNaN(timlönNum)) data['timlön'] = timlönNum
        if (!isNaN(syssNum)) data.sysselsattningsgrad = syssNum
        if (clearingnummer.trim()) data.clearingnummer = clearingnummer.trim()
        if (kontonummer.trim()) data.kontonummer = kontonummer.trim()
        if (bank.trim()) data.bank = bank.trim()
        await onSubmit(data)
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Okänt fel')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-1 rounded text-muted hover:text-fg hover:bg-hover transition-colors">
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm font-medium text-fg">{isEdit ? 'Redigera anställd' : 'Ny anställd'}</span>
          {!isEdit && previewNummer && (
            <span className="text-xs font-mono text-subtle">{previewNummer}</span>
          )}
        </div>
        <button onClick={onCancel} className="p-1 rounded text-muted hover:text-fg hover:bg-hover transition-colors">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
        <div className="grid grid-cols-2 gap-x-8 px-8 py-6">
          {/* Left column */}
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Grunduppgifter</p>
              <div className="flex flex-col gap-3">
                <Field label="Namn *">
                  <input
                    required
                    className="input"
                    value={namn}
                    onChange={(e) => setNamn(e.target.value)}
                    placeholder="Förnamn Efternamn"
                  />
                </Field>
                <Field label="Personnummer">
                  <input
                    className="input font-mono"
                    value={personnummer}
                    onChange={(e) => setPersonnummer(fmtPersonnummer(e.target.value))}
                    placeholder="YYYYMMDD-XXXX"
                    maxLength={13}
                  />
                </Field>
                <Field label="Befattning">
                  <input
                    className="input"
                    value={roll}
                    onChange={(e) => setRoll(e.target.value)}
                    placeholder="t.ex. Snickare"
                  />
                </Field>
                <Field label="Personaltyp">
                  <SelectField
                    value={personaltyp}
                    onChange={(v) => setPersonaltyp(v as PersonalTyp | '')}
                    placeholder="—"
                    className="w-48"
                    options={[
                      { value: 'TJM', label: 'Tjänsteman (TJM)' },
                      { value: 'ARB', label: 'Arbetare (ARB)' },
                    ]}
                  />
                </Field>
                <Field label="Anställningsform">
                  <SelectField
                    value={anstallningsform}
                    onChange={setAnstallningsform}
                    placeholder="—"
                    className="w-48"
                    options={[
                      { value: 'TV', label: 'Tillsvidare (TV)' },
                      { value: 'PRO', label: 'Provanställning (PRO)' },
                      { value: 'VIK', label: 'Vikariat (VIK)' },
                      { value: 'TID', label: 'Tidsbegränsad' },
                    ]}
                  />
                </Field>
                <Field label="Status">
                  <SelectField
                    value={status}
                    onChange={setStatus}
                    className="w-48"
                    options={statusar.map((s) => ({ value: s.namn, label: s.namn }))}
                  />
                </Field>
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Adress</p>
              <div className="flex flex-col gap-3">
                <Field label="Adress">
                  <input className="input" value={postadress} onChange={(e) => setPostadress(e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-subtle">Postnummer</label>
                    <input
                      className={`input font-mono ${postnummerErr ? 'border-red-400/60' : ''}`}
                      value={postnummer}
                      onChange={(e) => { setPostnummer(fmtPostnummer(e.target.value)); setPostnummerErr('') }}
                      onBlur={() => setPostnummerErr(validatePostnummer(postnummer))}
                      placeholder="123 45"
                      maxLength={6}
                    />
                    {postnummerErr && <span className="text-[11px] text-red-400">{postnummerErr}</span>}
                  </div>
                  <Field label="Ort">
                    <input
                      className="input"
                      value={ort}
                      onChange={(e) => setOrt(e.target.value)}
                      onBlur={(e) => setOrt(capitalizeFirst(e.target.value))}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Kontakt & tid</p>
              <div className="flex flex-col gap-3">
                <Field label="E-post">
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Telefon">
                  <input className="input" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
                </Field>
                <Field label="Anställningsdatum">
                  <input className="input" type="date" value={anstallningsdatum} onChange={(e) => setAnstallningsdatum(e.target.value)} />
                </Field>
                <Field label="Anställd t.o.m.">
                  <input className="input" type="date" value={slutdatum} onChange={(e) => setSlutdatum(e.target.value)} />
                </Field>
                <Field label="Sysselsättningsgrad (%)">
                  <input className="input w-32" type="number" min="1" max="100" step="1" value={sysselsattningsgrad} onChange={(e) => setSysselsattningsgrad(e.target.value)} />
                </Field>
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Lön</p>
              <div className="flex flex-col gap-3">
                <Field label="Löneform">
                  <SelectField
                    value={loneform}
                    onChange={(v) => setLoneform(v as Loneform | '')}
                    placeholder="—"
                    className="w-48"
                    options={[
                      { value: 'MAN', label: 'Månadslon (MAN)' },
                      { value: 'TIM', label: 'Timlön (TIM)' },
                    ]}
                  />
                </Field>
                {(loneform === 'MAN' || !loneform) && (
                  <Field label="Månadslon (kr)">
                    <input className="input w-40" type="number" min="0" step="100" value={manadslön} onChange={(e) => setManadslön(e.target.value)} placeholder="0" />
                  </Field>
                )}
                {(loneform === 'TIM' || !loneform) && (
                  <Field label="Timlön (kr/h)">
                    <input className="input w-40" type="number" min="0" step="10" value={timlön} onChange={(e) => setTimlön(e.target.value)} placeholder="0" />
                  </Field>
                )}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Bankuppgifter</p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Clearingnummer">
                    <input className="input" value={clearingnummer} onChange={(e) => setClearingnummer(e.target.value)} placeholder="1234" />
                  </Field>
                  <Field label="Kontonummer">
                    <input className="input" value={kontonummer} onChange={(e) => setKontonummer(e.target.value)} placeholder="123 456 789" />
                  </Field>
                </div>
                <Field label="Bank">
                  <input className="input" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="t.ex. Swedbank" />
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-8 py-4 border-t border-border">
          {submitError && (
            <p className="text-xs text-red-400 mr-auto">{submitError}</p>
          )}
          <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-md text-sm text-muted hover:text-fg hover:bg-hover transition-colors">
            Avbryt
          </button>
          <button
            type="submit"
            disabled={!namn.trim() || saving}
            className="px-4 py-1.5 rounded-md text-sm bg-elevated border border-border text-fg hover:bg-hover transition-colors disabled:opacity-40"
          >
            {saving ? 'Sparar...' : isEdit ? 'Spara ändringar' : 'Skapa anställd'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-subtle">{label}</label>
      {children}
    </div>
  )
}
