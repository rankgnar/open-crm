import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { AppInstallningar } from '@/sections/installningar/types'

interface AppConfigContextValue {
  config: AppInstallningar | null
  updateConfig: (partial: Partial<AppInstallningar>) => Promise<void>
  refreshConfig: () => void
  formatCurrency: (n: number, decimals?: number) => string
}

const AppConfigContext = createContext<AppConfigContextValue>({
  config: null,
  updateConfig: async () => {},
  refreshConfig: () => {},
  formatCurrency: (n) => `${new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} kr`
})

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppInstallningar | null>(null)

  const fetchConfig = useCallback(() => {
    window.api.invoke('db:installningar:get')
      .then((data) => setConfig(data as AppInstallningar))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  useEffect(() => {
    window.api.on('fortnox:auth:success', fetchConfig)
    return () => window.api.off('fortnox:auth:success', fetchConfig)
  }, [fetchConfig])

  const updateConfig = useCallback(async (partial: Partial<AppInstallningar>) => {
    const updated = await window.api.invoke('db:installningar:update', partial) as AppInstallningar
    setConfig(updated)
  }, [])

  const formatCurrency = useCallback((n: number, decimals = 2): string => {
    const valuta = config?.valuta ?? 'kr'
    const formatted = new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n)
    return `${formatted} ${valuta}`
  }, [config?.valuta])

  return (
    <AppConfigContext.Provider value={{ config, updateConfig, refreshConfig: fetchConfig, formatCurrency }}>
      {children}
    </AppConfigContext.Provider>
  )
}

export function useAppConfig() {
  return useContext(AppConfigContext)
}
