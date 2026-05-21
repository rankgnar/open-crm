import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

if (!app.isPackaged) {
  // dotenv only in dev — packaged app must read config from userData (db-config.json)
  // so it never carries credentials and a fresh install is unconfigured.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv/config')
}
import { join } from 'path'
import { promises as fsp } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerKunderHandlers } from './ipc/kunder'
import { registerProjektHandlers } from './ipc/projekt'
import { registerForslagHandlers } from './ipc/forslag'
import { registerEkonomiHandlers } from './ipc/ekonomi'
import { registerFaktureringHandlers } from './ipc/fakturering'
import { registerOrderHandlers } from './ipc/order'
import { registerAtaHandlers } from './ipc/ata'
import { registerInstallningarHandlers } from './ipc/installningar'
import { registerMaterialerHandlers } from './ipc/materialer'
import { registerAiHandlers } from './ipc/ai'
import { registerConfigHandlers } from './ipc/config'
import { registerPdfHandlers } from './ipc/pdf'
import { registerKalenderHandlers } from './ipc/kalender'
import { registerZohoHandlers } from './ipc/zoho'
import { registerGoogleHandlers } from './ipc/google'
import { registerEpostHandlers, processEpostKo } from './ipc/epost'
import { registerWorkflowHandlers } from './ipc/workflows'
import { registerWorkflowNodeHandlers } from './ipc/workflow-nodes'
import { registerPersonalHandlers } from './ipc/personal'
import { registerKundUsersHandlers, processKundPortalInviteQueue } from './ipc/kundUsers'
import { registerSignaturHandlers } from './ipc/signatur'
import { registerSigneraHandlers } from './ipc/signera'
import { registerWorkspaceHandlers } from './ipc/workspace'
import { registerCronHandlers } from './ipc/cron'
import { registerBrandingHandlers } from './ipc/branding'
import { registerChatHandlers } from './ipc/chat'
import { registerKvittoHandlers } from './ipc/kvitto'
import { registerInventarierHandlers } from './ipc/inventarier'
import { registerFrageblanktterHandlers } from './ipc/frageblankett'
import { registerKundAvslutHandlers } from './ipc/kund-avslut'
import { registerSmsHandlers } from './ipc/sms'
import appIcon from '../../resources/icon.png?asset'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#121212',
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin',
    trafficLightPosition: { x: 14, y: 14 },
    autoHideMenuBar: true,
    icon: process.platform === 'linux' ? appIcon : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const sectionWindows = new Map<string, BrowserWindow>()

const SECTION_ID_PATTERN = /^[a-z][a-z0-9_-]{0,40}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface SavedBounds { x?: number; y?: number; width: number; height: number }

function sectionBoundsPath(sectionId: string): string {
  return join(app.getPath('userData'), `section-window-${sectionId}.json`)
}

async function readSectionBounds(sectionId: string): Promise<SavedBounds | null> {
  try {
    const raw = await fsp.readFile(sectionBoundsPath(sectionId), 'utf8')
    const parsed = JSON.parse(raw) as SavedBounds
    if (typeof parsed.width === 'number' && typeof parsed.height === 'number') return parsed
    return null
  } catch {
    return null
  }
}

async function writeSectionBounds(sectionId: string, bounds: SavedBounds): Promise<void> {
  try {
    await fsp.writeFile(sectionBoundsPath(sectionId), JSON.stringify(bounds), 'utf8')
  } catch {
    // window position is non-critical
  }
}

async function createSectionWindow(sectionId: string): Promise<void> {
  if (!SECTION_ID_PATTERN.test(sectionId)) return

  const existing = sectionWindows.get(sectionId)
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
    return
  }

  const saved = await readSectionBounds(sectionId)
  const win = new BrowserWindow({
    width: saved?.width ?? 1100,
    height: saved?.height ?? 750,
    x: saved?.x,
    y: saved?.y,
    minWidth: 700,
    minHeight: 500,
    show: false,
    backgroundColor: '#121212',
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin',
    trafficLightPosition: { x: 14, y: 14 },
    autoHideMenuBar: true,
    icon: process.platform === 'linux' ? appIcon : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  sectionWindows.set(sectionId, win)

  win.on('ready-to-show', () => win.show())

  win.on('closed', () => {
    if (sectionWindows.get(sectionId) === win) sectionWindows.delete(sectionId)
  })

  const persistBounds = (): void => {
    if (win.isDestroyed()) return
    const b = win.getBounds()
    void writeSectionBounds(sectionId, { x: b.x, y: b.y, width: b.width, height: b.height })
  }
  win.on('resize', persistBounds)
  win.on('move', persistBounds)

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/${sectionId}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/${sectionId}` })
  }
}

async function createTidplanWindow(forslagId: string): Promise<void> {
  if (!UUID_PATTERN.test(forslagId)) return

  const key = 'tidplan'
  const existing = sectionWindows.get(key)
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
    return
  }

  const saved = await readSectionBounds(key)
  const win = new BrowserWindow({
    width: saved?.width ?? 1200,
    height: saved?.height ?? 750,
    x: saved?.x,
    y: saved?.y,
    minWidth: 800,
    minHeight: 500,
    show: false,
    backgroundColor: '#121212',
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin',
    trafficLightPosition: { x: 14, y: 14 },
    autoHideMenuBar: true,
    icon: process.platform === 'linux' ? appIcon : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  sectionWindows.set(key, win)
  win.on('ready-to-show', () => win.show())
  win.on('closed', () => { if (sectionWindows.get(key) === win) sectionWindows.delete(key) })

  const persistBounds = (): void => {
    if (win.isDestroyed()) return
    const b = win.getBounds()
    void writeSectionBounds(key, { x: b.x, y: b.y, width: b.width, height: b.height })
  }
  win.on('resize', persistBounds)
  win.on('move', persistBounds)

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const hash = `tidplan?forslag_id=${forslagId}`
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/${hash}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/${hash}` })
  }
}

async function createForslagWindow(projektId: string): Promise<void> {
  if (!UUID_PATTERN.test(projektId)) return

  const key = `forslag_${projektId}`
  const existing = sectionWindows.get(key)
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
    return
  }

  const saved = await readSectionBounds('forslag')
  const win = new BrowserWindow({
    width: saved?.width ?? 1200,
    height: saved?.height ?? 800,
    x: saved?.x,
    y: saved?.y,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#121212',
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin',
    trafficLightPosition: { x: 14, y: 14 },
    autoHideMenuBar: true,
    icon: process.platform === 'linux' ? appIcon : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  sectionWindows.set(key, win)

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (sectionWindows.get(key) === win) sectionWindows.delete(key)
  })

  const persistBounds = (): void => {
    if (win.isDestroyed()) return
    const b = win.getBounds()
    void writeSectionBounds('forslag', { x: b.x, y: b.y, width: b.width, height: b.height })
  }
  win.on('resize', persistBounds)
  win.on('move', persistBounds)

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const hash = `forslag?projekt_id=${projektId}`
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/${hash}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/${hash}` })
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.opencrm.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerKunderHandlers()
  registerProjektHandlers()
  registerForslagHandlers()
  registerEkonomiHandlers()
  registerFaktureringHandlers()
  registerOrderHandlers()
  registerAtaHandlers()
  registerInstallningarHandlers()
  registerMaterialerHandlers()
  registerAiHandlers()
  registerConfigHandlers()
  registerPdfHandlers()
  registerKalenderHandlers()
  registerZohoHandlers()
  registerGoogleHandlers()
  registerEpostHandlers()
  setInterval(() => { void processEpostKo().catch(() => {}) }, 60_000)
  registerWorkflowHandlers()
  registerWorkflowNodeHandlers()
  registerPersonalHandlers()
  registerKundUsersHandlers()
  setInterval(() => { void processKundPortalInviteQueue().catch(() => {}) }, 60_000)
  registerSignaturHandlers()
  registerSigneraHandlers()
  registerWorkspaceHandlers()
  registerCronHandlers()
  registerBrandingHandlers()
  registerChatHandlers()
  registerKvittoHandlers()
  registerInventarierHandlers()
  registerFrageblanktterHandlers()
  registerKundAvslutHandlers()
  registerSmsHandlers()
  createWindow()

  ipcMain.handle('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
  ipcMain.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.handle('window:close', () => BrowserWindow.getFocusedWindow()?.close())
  ipcMain.handle('window:open-section', (_, sectionId: string) => createSectionWindow(sectionId))
  ipcMain.handle('window:open-forslag', (_, projektId: string) => createForslagWindow(projektId))
  ipcMain.handle('window:open-tidplan', (_, forslagId: string) => createTidplanWindow(forslagId))
  ipcMain.handle('shell:open-external', (_, url: string) => shell.openExternal(url))
  ipcMain.handle('app:install-update', () => autoUpdater.quitAndInstall())

  if (app.isPackaged) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('update-downloaded', () => {
      BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('app:update-downloaded'))
    })
    void autoUpdater.checkForUpdates().catch(() => {})
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
