import { useState } from 'react'
import { useAppConfig } from '@/context/AppConfig'
import type { AppInstallningar } from '../types'

function SavedDot() {
  return <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] inline-block ml-1.5" />
}

interface ConfigFieldProps {
  label: string
  field: keyof AppInstallningar
  type?: 'text' | 'number' | 'email'
  placeholder?: string
  suffix?: string
}

export function ConfigField({ label, field, type = 'text', placeholder = '', suffix }: ConfigFieldProps) {
  const { config, updateConfig } = useAppConfig()
  const [saved, setSaved] = useState(false)

  if (!config) return null

  async function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.target.value
    const val = type === 'number' ? parseFloat(raw) || 0 : raw
    if (val === (config as unknown as Record<string, unknown>)[field as string]) return
    await updateConfig({ [field]: val } as never)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center text-[11px] uppercase tracking-wider text-muted">
        {label}
        {saved && <SavedDot />}
      </label>
      <div className="flex items-center gap-2">
        <input
          type={type}
          className="input flex-1"
          defaultValue={String((config as unknown as Record<string, unknown>)[field as string] ?? '')}
          placeholder={placeholder}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
        {suffix && <span className="text-xs text-muted shrink-0">{suffix}</span>}
      </div>
    </div>
  )
}

interface ConfigTextareaProps {
  label: string
  field: keyof AppInstallningar
  placeholder?: string
  rows?: number
}

export function ConfigTextarea({ label, field, placeholder = '', rows = 10 }: ConfigTextareaProps) {
  const { config, updateConfig } = useAppConfig()
  const [value, setValue] = useState(String((config as unknown as Record<string, unknown>)[field as string] ?? ''))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!config) return null

  async function handleSave() {
    setSaving(true)
    await updateConfig({ [field]: value } as never)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center text-[11px] uppercase tracking-wider text-muted">
        {label}
        {saved && <SavedDot />}
      </label>
      <textarea
        className="input resize-y"
        style={{ color: 'var(--color-muted)' }}
        rows={rows}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      />
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-fg text-bg px-4 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? 'Sparar...' : 'Spara'}
        </button>
      </div>
    </div>
  )
}

interface ConfigCheckboxProps {
  label: string
  description?: string
  field: keyof AppInstallningar
}

export function ConfigCheckbox({ label, description, field }: ConfigCheckboxProps) {
  const { config, updateConfig } = useAppConfig()
  const [saved, setSaved] = useState(false)

  if (!config) return null

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    await updateConfig({ [field]: e.target.checked } as never)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={Boolean((config as unknown as Record<string, unknown>)[field as string])}
        onChange={handleChange}
        className="w-4 h-4 mt-0.5 accent-emerald-400"
      />
      <div>
        <span className="flex items-center gap-2 text-sm text-fg">
          {label}
          {saved && <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] inline-block" />}
        </span>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
    </label>
  )
}

interface ConfigSelectProps {
  label: string
  field: keyof AppInstallningar
  options: { value: string; label: string }[]
}

export function ConfigSelect({ label, field, options }: ConfigSelectProps) {
  const { config, updateConfig } = useAppConfig()
  const [saved, setSaved] = useState(false)

  if (!config) return null

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    await updateConfig({ [field]: e.target.value } as never)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center text-[11px] uppercase tracking-wider text-muted">
        {label}
        {saved && <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] inline-block ml-1.5" />}
      </label>
      <select
        className="input text-muted"
        value={String((config as unknown as Record<string, unknown>)[field as string] ?? '')}
        onChange={handleChange}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
