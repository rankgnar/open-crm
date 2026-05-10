import { useAppConfig } from '@/context/AppConfig'
import { useTheme } from '@/hooks/useTheme'
import openCrmIcon from '@/assets/branding/logo-opencrm-icon.png'
import openCrmTextDark from '@/assets/branding/logo-opencrm-text-dark.png'
import openCrmTextLight from '@/assets/branding/logo-opencrm-text-light.png'

interface Props {
  collapsed?: boolean
  className?: string
}

export function Logo({ collapsed = false, className = '' }: Props) {
  const { config } = useAppConfig()
  const { theme } = useTheme()
  const logoUrl = config?.foretag_logo_url

  if (logoUrl) {
    if (collapsed) {
      return (
        <span className={`inline-flex items-center justify-center ${className}`}>
          <img src={logoUrl} alt="Logotyp" className="h-5 w-5 object-contain" />
        </span>
      )
    }
    return (
      <span className={`inline-flex items-center ${className}`}>
        <img src={logoUrl} alt={config?.foretag_namn ?? 'Logotyp'} className="h-7 max-w-[140px] object-contain" />
      </span>
    )
  }

  if (collapsed) {
    return (
      <span className={`inline-flex items-center justify-center ${className}`}>
        <img src={openCrmIcon} alt="OpenCRM" className="h-5 w-5 object-contain" />
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center ${className}`}>
      <img
        src={theme === 'dark' ? openCrmTextDark : openCrmTextLight}
        alt="OpenCRM"
        className="h-6 max-w-[140px] object-contain"
      />
    </span>
  )
}
