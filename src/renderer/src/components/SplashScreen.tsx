import { useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useAppConfig } from '@/context/AppConfig'
import openCrmTextDark from '@/assets/branding/logo-opencrm-text-dark.png'
import openCrmTextLight from '@/assets/branding/logo-opencrm-text-light.png'

interface Props {
  onComplete: () => void
}

export function SplashScreen({ onComplete }: Props) {
  const { theme } = useTheme()
  const { config } = useAppConfig()

  useEffect(() => {
    const t = setTimeout(onComplete, 2800)
    return () => clearTimeout(t)
  }, [onComplete])

  const configLoaded = config !== null
  const logoUrl = config?.foretag_logo_url ?? ''

  return (
    <div className="splash-container fixed inset-0 bg-bg flex items-center justify-center">
      <div className="splash-scan" />

      <div className="relative flex flex-col items-center gap-9">
        {configLoaded && (
          <img
            src={logoUrl || (theme === 'dark' ? openCrmTextDark : openCrmTextLight)}
            alt={logoUrl ? 'Logotyp' : 'OpenCRM'}
            className="splash-logo max-h-14 max-w-[260px] object-contain"
          />
        )}

        <div className="relative h-[1px] w-28 bg-border overflow-hidden">
          <div className="splash-progress-fill absolute inset-0 bg-emerald-400" />
        </div>
      </div>
    </div>
  )
}
