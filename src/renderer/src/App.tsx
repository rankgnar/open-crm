import { useState, useCallback, useEffect } from 'react'
import { TitleBar } from '@/components/TitleBar'
import { Sidebar } from '@/components/Sidebar'
import { SplashScreen } from '@/components/SplashScreen'
import { SetupWizardModal } from '@/components/SetupWizardModal'
import { WorkspaceSection } from '@/sections/workspace/WorkspaceSection'
import { KunderSection } from '@/sections/kunder/KunderSection'
import { ProjektSection } from '@/sections/projekt/ProjektSection'
import { ForslagSection } from '@/sections/forslag/ForslagSection'
import { TidplanSection } from '@/sections/tidplan/TidplanSection'
import { EkonomiSection } from '@/sections/ekonomi/EkonomiSection'
import { FaktureringSection } from '@/sections/fakturering/FaktureringSection'
import { KvittoSection } from '@/sections/kvitto/KvittoSection'
import { OrderSection } from '@/sections/order/OrderSection'
import { ATASection } from '@/sections/ata/ATASection'
import { SigneraSection } from '@/sections/signera/SigneraSection'
import { InställningarSection } from '@/sections/installningar/InställningarSection'
import { AvanceratSection } from '@/sections/avancerat/AvanceratSection'
import { EpostSection } from '@/sections/epost/EpostSection'
import { KalenderSection } from '@/sections/kalender/KalenderSection'
import { PersonalSection } from '@/sections/personal/PersonalSection'
import { ChatSection } from '@/sections/chat/ChatSection'
import { LeverantorSection } from '@/sections/leverantor/LeverantorSection'
import { InventarierSection } from '@/sections/inventarier/InventarierSection'
import type { InstallningarPanel } from '@/sections/installningar/types'

type Section = 'workspace' | 'kunder' | 'projekt' | 'forslag' | 'signera' | 'tidplan' | 'ekonomi' | 'fakturering' | 'kvitto' | 'order' | 'ata' | 'epost' | 'kalender' | 'personal' | 'leverantor' | 'chat' | 'installningar' | 'avancerat' | 'inventarier'

const VALID_SECTIONS: Section[] = ['workspace', 'kunder', 'projekt', 'forslag', 'signera', 'tidplan', 'ekonomi', 'fakturering', 'kvitto', 'order', 'ata', 'epost', 'kalender', 'personal', 'leverantor', 'chat', 'installningar', 'avancerat', 'inventarier']

function sectionFromHash(): Section {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return VALID_SECTIONS.includes(raw as Section) ? (raw as Section) : 'workspace'
}

function popoutQueryParam(key: string): string | undefined {
  const qIndex = window.location.hash.indexOf('?')
  if (qIndex === -1) return undefined
  return new URLSearchParams(window.location.hash.slice(qIndex + 1)).get(key) ?? undefined
}

// Popout windows are identified by a section hash (e.g. #/inventarier)
const isPopout = window.location.hash.startsWith('#/')

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>(sectionFromHash)
  const [installningarPanel, setInstallningarPanel] = useState<InstallningarPanel | undefined>(undefined)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [splash, setSplash] = useState(!isPopout)
  const hideSplash = useCallback(() => setSplash(false), [])
  const [chatUnread, setChatUnread] = useState(0)
  const [updateReady, setUpdateReady] = useState(false)
  const [setupChecked, setSetupChecked] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [projektFromForslagId, setProjektFromForslagId] = useState<string | undefined>(undefined)
  const [projektFromKundId, setProjektFromKundId] = useState<string | undefined>(undefined)
  const [forslagFromKundId, setForslagFromKundId] = useState<string | undefined>(undefined)
  const [kundIdForNewProjekt, setKundIdForNewProjekt] = useState<string | undefined>(undefined)
  const [projektIdForNewForslag, setProjektIdForNewForslag] = useState<string | undefined>(undefined)
  const [tidplanReturnForslagId, setTidplanReturnForslagId] = useState<string | undefined>(undefined)
  const [tidplanReturnMode, setTidplanReturnMode] = useState<'send' | 'direct'>('send')
  const [openTidplanReminderForForslagId, setOpenTidplanReminderForForslagId] = useState<string | undefined>(undefined)
  const [forslagDirectReturnId, setForslagDirectReturnId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (activeSection !== 'projekt') { setProjektFromForslagId(undefined); setProjektFromKundId(undefined); setKundIdForNewProjekt(undefined) }
    if (activeSection !== 'tidplan') setTidplanReturnForslagId(undefined)
    if (activeSection !== 'forslag') setOpenTidplanReminderForForslagId(undefined)
    if (activeSection !== 'forslag') { setForslagDirectReturnId(undefined); setForslagFromKundId(undefined); setProjektIdForNewForslag(undefined) }
  }, [activeSection])

  const checkSetup = useCallback(async () => {
    try {
      const ready = await window.api.invoke('config:db:is-ready') as boolean
      if (!ready) {
        setNeedsSetup(true)
        return
      }
      try {
        const cfg = await window.api.invoke('db:installningar:get') as { foretag_namn?: string }
        setNeedsSetup(!cfg.foretag_namn?.trim())
      } catch {
        // DB ready but installningar read failed — still trigger wizard, the user can re-test there
        setNeedsSetup(true)
      }
    } catch {
      setNeedsSetup(true)
    } finally {
      setSetupChecked(true)
    }
  }, [])

  useEffect(() => {
    if (isPopout) { setSetupChecked(true); return }
    void checkSetup()
  }, [checkSetup])

  const handleSetupComplete = useCallback(() => {
    setNeedsSetup(false)
  }, [])

  useEffect(() => {
    if (!setupChecked || needsSetup || isPopout) return
    let cancelled = false
    async function refresh(): Promise<void> {
      try {
        const n = await window.api.invoke('db:chat:unread-total') as number
        if (!cancelled) setChatUnread(n)
      } catch {
        // tyst — badgen är icke-kritisk
      }
    }
    void refresh()
    const id = window.setInterval(refresh, 15000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [activeSection, setupChecked, needsSetup])

  useEffect(() => {
    const handler = (): void => setUpdateReady(true)
    window.api.on('app:update-downloaded', handler)
    return () => window.api.off('app:update-downloaded', handler)
  }, [])

  const handleNavigate = useCallback((section: Section) => {
    setActiveSection(section)
    if (section !== 'installningar') setInstallningarPanel(undefined)
  }, [])

  const handleNavigateConfig = useCallback((panel: InstallningarPanel) => {
    setInstallningarPanel(panel)
    setActiveSection('installningar')
  }, [])

  if (splash) return <SplashScreen onComplete={hideSplash} />

  // Hold the shell back until the setup check has resolved AND credentials are
  // saved. Mounting any section before then triggers Supabase queries with an
  // empty client config, and the resulting error state survives the wizard
  // close — the user would have to restart the app to recover.
  if (!setupChecked) return null
  if (!isPopout && needsSetup) return <SetupWizardModal onComplete={handleSetupComplete} />

  const sectionContent = (
    <>
      {activeSection === 'workspace' && <WorkspaceSection onNavigate={handleNavigate} />}
      {activeSection === 'kunder' && (
        <KunderSection
          onNavigateProjekt={(id) => { setProjektFromKundId(id); handleNavigate('projekt') }}
          onNavigateForslag={(id) => { setForslagFromKundId(id); handleNavigate('forslag') }}
          onCreateProjekt={(kundId) => { setKundIdForNewProjekt(kundId); handleNavigate('projekt') }}
          onCreateForslag={(projektId) => { setProjektIdForNewForslag(projektId); handleNavigate('forslag') }}
        />
      )}
      {activeSection === 'projekt' && (
        <ProjektSection
          initialProjektId={projektFromForslagId ?? projektFromKundId}
          initialKundId={kundIdForNewProjekt}
          onCreateForslag={(projektId) => { setProjektIdForNewForslag(projektId); handleNavigate('forslag') }}
        />
      )}
      {activeSection === 'forslag' && (
        <ForslagSection
          initialProjektId={isPopout ? popoutQueryParam('projekt_id') : undefined}
          onNavigateProjekt={!isPopout ? (projektId) => { setProjektFromForslagId(projektId); handleNavigate('projekt') } : undefined}
          initialForslagId={!isPopout ? (openTidplanReminderForForslagId ?? forslagDirectReturnId ?? forslagFromKundId) : undefined}
          initialProjektIdForNew={!isPopout ? projektIdForNewForslag : undefined}
          openTidplanReminderOnLoad={!isPopout && !!openTidplanReminderForForslagId}
          onNavigateTidplan={!isPopout ? (forslagId, mode) => { setTidplanReturnForslagId(forslagId); setTidplanReturnMode(mode); handleNavigate('tidplan') } : undefined}
        />
      )}
      {activeSection === 'tidplan' && (
        <TidplanSection
          initialForslagId={isPopout ? popoutQueryParam('forslag_id') : tidplanReturnForslagId}
          navigateBackLabel={
            isPopout
              ? 'Tillbaka till förslag'
              : tidplanReturnMode === 'direct' ? 'Tillbaka till förslag' : 'Tillbaka — fortsätt skicka för signatur'
          }
          onNavigateBack={
            isPopout && popoutQueryParam('forslag_id')
              ? () => void window.api.invoke('window:close')
              : tidplanReturnForslagId
                ? () => {
                    if (tidplanReturnMode === 'send') {
                      setOpenTidplanReminderForForslagId(tidplanReturnForslagId)
                    } else {
                      setForslagDirectReturnId(tidplanReturnForslagId)
                    }
                    handleNavigate('forslag')
                  }
                : undefined
          }
        />
      )}
      {activeSection === 'ekonomi' && <EkonomiSection />}
      {activeSection === 'fakturering' && <FaktureringSection />}
      {activeSection === 'kvitto' && <KvittoSection />}
      {activeSection === 'order' && <OrderSection />}
      {activeSection === 'ata' && <ATASection />}
      {activeSection === 'signera' && <SigneraSection />}
      {activeSection === 'epost' && <EpostSection />}
      {activeSection === 'kalender' && <KalenderSection onNavigate={s => handleNavigate(s as Parameters<typeof handleNavigate>[0])} />}
      {activeSection === 'personal' && <PersonalSection />}
      {activeSection === 'leverantor' && <LeverantorSection />}
      {activeSection === 'inventarier' && <InventarierSection />}
      {activeSection === 'chat' && <ChatSection />}
      {activeSection === 'installningar' && <InställningarSection key={installningarPanel} initialPanel={installningarPanel} />}
      {activeSection === 'avancerat' && <AvanceratSection />}
    </>
  )

  if (isPopout) {
    return (
      <div className="flex flex-col h-screen bg-bg text-fg overflow-hidden">
        <TitleBar />
        <main className="flex-1 overflow-hidden">{sectionContent}</main>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-bg text-fg overflow-hidden">
      <TitleBar onNavigate={sidebarCollapsed ? handleNavigate as (s: string) => void : undefined} />
      {updateReady && (
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/30 shrink-0">
          <span className="text-sm text-emerald-400">Ny version nedladdad och klar att installera.</span>
          <button
            onClick={() => window.api.invoke('app:install-update')}
            className="text-xs font-medium text-emerald-400 border border-emerald-500/40 rounded px-3 py-1 hover:bg-emerald-500/20 transition-colors"
          >
            Starta om och uppdatera
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          active={activeSection}
          onNavigate={handleNavigate}
          onNavigateConfig={handleNavigateConfig}
          badges={{ chat: chatUnread }}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
        <main className="flex-1 overflow-hidden">{sectionContent}</main>
      </div>
    </div>
  )
}
