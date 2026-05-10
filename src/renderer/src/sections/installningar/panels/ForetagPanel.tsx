import { useState } from 'react'
import { Upload, Database } from 'lucide-react'
import { useAppConfig } from '@/context/AppConfig'
import { SelectField } from '@/components/SelectField'

function SavedDot() {
  return <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] inline-block" />
}

function Field({
  label,
  field,
  type = 'text',
  placeholder = ''
}: {
  label: string
  field: keyof import('../types').AppInstallningar
  type?: string
  placeholder?: string
}) {
  const { config, updateConfig } = useAppConfig()
  const [saved, setSaved] = useState(false)

  if (!config) return null

  async function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
    if (val === (config as unknown as Record<string, unknown>)[field as string]) return
    await updateConfig({ [field]: val } as never)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
        {label}
        {saved && <SavedDot />}
      </label>
      <input
        type={type}
        className="input"
        defaultValue={String((config as unknown as Record<string, unknown>)[field as string] ?? '')}
        placeholder={placeholder}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
    </div>
  )
}

const VALUTOR = ['kr', '€', '$', '£', 'NOK', 'DKK', 'CHF']

function ValutaField() {
  const { config, updateConfig } = useAppConfig()
  const [saved, setSaved] = useState(false)
  if (!config) return null

  async function handleChange(v: string) {
    await updateConfig({ valuta: v })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
        Valuta
        {saved && <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] inline-block" />}
      </label>
      <SelectField
        value={config.valuta ?? 'kr'}
        onChange={handleChange}
        options={VALUTOR.map((v) => ({ value: v, label: v }))}
      />
    </div>
  )
}

function LogotypSection() {
  const { config, updateConfig } = useAppConfig()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!config) return null

  async function handlePickLogo() {
    setLoading(true)
    try {
      const dataUrl = await window.api.invoke('pdf:pick-logo') as string | null
      if (dataUrl) {
        await updateConfig({ foretag_logo_url: dataUrl })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveLogo() {
    await updateConfig({ foretag_logo_url: '' })
  }

  const logoUrl = config.foretag_logo_url

  if (logoUrl) {
    return (
      <div className="flex items-center gap-6">
        <div className="flex items-center justify-center h-16 w-44 rounded-lg border border-border bg-elevated shrink-0">
          <img src={logoUrl} alt="Logotyp" className="max-h-12 max-w-[160px] object-contain" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[11px] text-muted">
            Logotyp uppladdad
            {saved && <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] inline-block" />}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePickLogo}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs rounded-lg border border-border px-3 py-1.5 text-muted hover:text-fg hover:border-fg/40 transition-colors disabled:opacity-50"
            >
              <Upload size={12} />
              Byt logotyp
            </button>
            <button
              onClick={handleRemoveLogo}
              className="text-xs text-muted hover:text-red-400 transition-colors"
            >
              Ta bort
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={handlePickLogo}
      disabled={loading}
      className="flex items-center gap-3 h-16 px-5 rounded-lg border border-dashed border-border hover:border-fg/30 hover:bg-hover transition-colors text-muted hover:text-fg disabled:opacity-50"
    >
      <Upload size={16} />
      <span className="text-sm">{loading ? 'Laddar...' : 'Välj logotyp'}</span>
    </button>
  )
}

function IkonSection() {
  const { config, refreshConfig } = useAppConfig()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!config) return null

  async function handlePickIkon() {
    setLoading(true)
    setError(null)
    try {
      const updated = await window.api.invoke('branding:upload-ikon')
      if (updated) {
        refreshConfig()
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uppladdningen misslyckades')
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveIkon() {
    setLoading(true)
    setError(null)
    try {
      await window.api.invoke('branding:remove-ikon')
      refreshConfig()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Borttagningen misslyckades')
    } finally {
      setLoading(false)
    }
  }

  const masterUrl = config.branding_ikon_master_url

  if (masterUrl) {
    const previews = [
      { label: '16', url: config.branding_favicon_16_url, size: 16 },
      { label: '32', url: config.branding_favicon_32_url, size: 32 },
      { label: '180', url: config.branding_apple_touch_icon_url, size: 48 },
      { label: '192', url: config.branding_android_192_url, size: 48 },
      { label: '512', url: config.branding_android_512_url, size: 64 },
    ]
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-6">
          <div className="flex items-end gap-4">
            {previews.map((p) => (
              <div key={p.label} className="flex flex-col items-center gap-2">
                <div
                  className="flex items-center justify-center rounded-lg border border-border bg-elevated"
                  style={{ width: p.size + 16, height: p.size + 16 }}
                >
                  {p.url && <img src={p.url} alt={`${p.label}px`} style={{ width: p.size, height: p.size }} className="object-contain" />}
                </div>
                <span className="text-[10px] text-muted">{p.label}px</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 pb-5">
            <p className="flex items-center gap-2 text-[11px] text-muted">
              Ikon uppladdad — 5 storlekar genererade
              {saved && <SavedDot />}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePickIkon}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs rounded-lg border border-border px-3 py-1.5 text-muted hover:text-fg hover:border-fg/40 transition-colors disabled:opacity-50"
              >
                <Upload size={12} />
                Byt ikon
              </button>
              <button
                onClick={handleRemoveIkon}
                disabled={loading}
                className="text-xs text-muted hover:text-red-400 transition-colors disabled:opacity-50"
              >
                Ta bort
              </button>
            </div>
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handlePickIkon}
        disabled={loading}
        className="flex items-center gap-3 h-16 px-5 rounded-lg border border-dashed border-border hover:border-fg/30 hover:bg-hover transition-colors text-muted hover:text-fg disabled:opacity-50"
      >
        <Upload size={16} />
        <span className="text-sm">{loading ? 'Genererar storlekar...' : 'Ladda upp ikon (kvadratisk, 512×512 eller större)'}</span>
      </button>
      <p className="text-xs text-muted">Används som favicon i webbläsaren och som app-ikon i mobil/PWA. Systemet genererar automatiskt 16, 32, 180, 192 och 512 px.</p>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

function NotConnectedState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <div className="flex items-center justify-center size-12 rounded-full border border-border bg-elevated">
        <Database size={20} className="text-muted" />
      </div>
      <div className="flex flex-col gap-1.5 max-w-md">
        <p className="text-base font-medium text-fg">Databasen är inte ansluten</p>
        <p className="text-sm text-muted leading-relaxed">
          Företagsinformation sparas direkt i din databas. Slutför installationsguiden under <span className="text-fg">Avancerat → Databas</span> och starta om appen för att aktivera anslutningen.
        </p>
      </div>
    </div>
  )
}

export function ForetagPanel() {
  const { config } = useAppConfig()

  if (!config) return <NotConnectedState />

  return (
    <div className="flex flex-col gap-0">

      {/* Logotyp + Ikon */}
      <div className="grid grid-cols-2 gap-x-8 px-8 py-6 border-b border-border">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted mb-5">Logotyp</p>
          <LogotypSection />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted mb-5">Ikon (favicon & app)</p>
          <IkonSection />
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-2 divide-x divide-border">

        {/* Left: Företagsinformation + Adress */}
        <div className="flex flex-col divide-y divide-border">
          <div className="px-8 py-5">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Företagsinformation</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Företagsnamn" field="foretag_namn" placeholder="Mitt företag AB" />
              <Field label="Org.nummer" field="foretag_org_nummer" placeholder="000000-0000" />
              <Field label="Momsreg.nummer" field="foretag_momsreg_nummer" placeholder="SE000000000001" />
            </div>
          </div>

          <div className="px-8 py-5">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Adress</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Gatuadress" field="foretag_adress" />
              <Field label="Postnummer" field="foretag_postnummer" placeholder="123 45" />
              <Field label="Stad" field="foretag_stad" />
              <Field label="Land" field="foretag_land" placeholder="Sverige" />
            </div>
          </div>
        </div>

        {/* Right: Kontakt + Betalning + Skatteverket */}
        <div className="flex flex-col divide-y divide-border">
          <div className="px-8 py-5">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Kontakt</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Telefon" field="foretag_telefon" />
              <Field label="E-post" field="foretag_email" type="email" />
              <Field label="Webbadress" field="foretag_webbadress" placeholder="https://..." />
            </div>
          </div>

          <div className="px-8 py-5">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Betalning</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Bankgiro" field="foretag_bankgiro" placeholder="1234-5678" />
              <Field label="Plusgiro" field="foretag_plusgiro" />
              <ValutaField />
            </div>
          </div>

          <div className="px-8 py-5">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-4">Skatteverket</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Ditt OCR-nummer" field="skatteverket_ocr_nummer" placeholder="xxxxxxxxxx" />
              <Field label="Skatteverkets bankgiro" field="skatteverkets_bankgiro" placeholder="1234-5678" />
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
