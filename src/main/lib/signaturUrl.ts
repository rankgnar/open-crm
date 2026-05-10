import { readDbConfig } from '../config-store'

export function buildSignatureUrl(token: string): string {
  const fromConfig = readDbConfig().web_app_url?.trim()
  const fromEnv = process.env.OPEN_CRM_APP_URL?.trim()
  const base = (fromConfig || fromEnv || '').replace(/\/+$/, '')
  if (!base) {
    throw new Error('Web-appens URL är inte konfigurerad. Sätt den i Avancerat → DataBase, eller via env-variabeln OPEN_CRM_APP_URL.')
  }
  return `${base}/?t=${encodeURIComponent(token)}`
}
