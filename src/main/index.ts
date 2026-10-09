import { app, BrowserWindow, Menu, Tray, dialog, globalShortcut, ipcMain, nativeImage, screen, shell } from 'electron'
import { join } from 'path'
import { appendFileSync, mkdirSync, writeFileSync } from 'fs'
import iconPath from '../../build/icon.png?asset'
import { flushSettings, loadSettings, saveSettings } from './settings'
import { LINKS, isLinkReady } from '../shared/links'
import { TikTokService } from './tiktok'
import { YouTubeService } from './youtube'
import type { Settings } from '../shared/types'

/* ---------- Log startup & error ---------- */
// File ada di folder data aplikasi (Windows: %APPDATA%\live-comment-overlay).
// startup.log = jejak tahap start (ditimpa tiap kali aplikasi dibuka); error.log = error yang tertangkap.
let bootStarted = false
function bootLog(msg: string): void {
  try {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    const line = `[${new Date().toISOString()}] ${msg}\n`
    if (!bootStarted) {
      bootStarted = true
      writeFileSync(join(dir, 'startup.log'), line)
    } else appendFileSync(join(dir, 'startup.log'), line)
  } catch {
    /* log tidak boleh membuat aplikasi gagal */
  }
}

function logError(where: string, err: unknown): void {
  try {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    const text = err instanceof Error ? (err.stack ?? err.message) : String(err)
    appendFileSync(join(dir, 'error.log'), `[${new Date().toISOString()}] ${where}: ${text}\n`)
  } catch {
    /* abaikan */
  }
}

function fatal(where: string, err: unknown): void {
  logError(where, err)
  try {
    dialog.showErrorBox('Live Comment Overlay gagal dibuka', `${where}\n\n${String((err as Error)?.message ?? err)}`)
  } catch {
    /* abaikan */
  }
  app.quit()
}

bootLog(`main dimuat | v${app.getVersion()} | packaged=${app.isPackaged} | electron ${process.versions.electron}`)

let uncaughtShown = false
process.on('uncaughtException', (e) => {
  logError('uncaughtException', e)
  if (uncaughtShown) return
  uncaughtShown = true
  try {
    dialog.showErrorBox('Live Comment Overlay: error tak terduga', String((e as Error)?.message ?? e))
  } catch {
    /* abaikan */
  }
})
process.on('unhandledRejection', (e) => logError('unhandledRejection', e))

// Harus dipanggil sebelum app ready
const initial = loadSettings()
if (initial.disableGpu) app.disableHardwareAcceleration()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  // Jangan keluar diam-diam: beri tahu pengguna bahwa instance lain sudah berjalan
  bootLog('instance lain sudah berjalan, keluar')
  app.whenReady().then(() => {
    dialog.showMessageBoxSync({
      type: 'info',
      title: 'Live Comment Overlay',
      message: 'Aplikasi sudah berjalan.',
      detail:
        'Cari ikon di tray (dekat jam), atau tekan Ctrl+Shift+O untuk menampilkan overlay. ' +
        'Jika tidak terlihat, akhiri proses Live Comment Overlay di Task Manager lalu buka lagi.'
    })
    app.quit()
  })
}

let win: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
const service = new TikTokService(() => win)
const youtube = new YouTubeService(() => win)

function boundsVisible(b: NonNullable<Settings['bounds']>): boolean {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return b.x + 60 < a.x + a.width && b.x + b.width - 60 > a.x && b.y + 20 < a.y + a.height && b.y + 40 > a.y
  })
}

function applyClickThrough(on: boolean): void {
  if (!win) return
  win.setIgnoreMouseEvents(on, { forward: true })
  saveSettings({ clickThrough: on })
  win.webContents.send('overlay:clickthrough', on)
  rebuildTrayTooltip()
}

function toggleVisible(): void {
  if (!win) return
  if (win.isVisible()) win.hide()
  else win.showInactive()
}

function createWindow(): void {
  const s = loadSettings()
  const b = s.bounds && boundsVisible(s.bounds) ? s.bounds : undefined

  win = new BrowserWindow({
    width: b?.width ?? 380,
    height: b?.height ?? 560,
    x: b?.x,
    y: b?.y,
    minWidth: 260,
    minHeight: 180,
    show: false,
    frame: false,
    // Tidak transparan: lebih ringan di GPU lemah dan tetap bisa di-resize di Windows.
    // Transparansi diatur lewat slider opacity (win.setOpacity).
    transparent: false,
    backgroundColor: '#0e1013',
    hasShadow: false,
    resizable: true,
    alwaysOnTop: true,
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  })

  win.setMenuBarVisibility(false)
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setOpacity(s.opacity)

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e) => e.preventDefault())

  win.once('ready-to-show', () => {
    bootLog('ready-to-show: jendela ditampilkan')
    win?.showInactive()
  })
  win.webContents.on('render-process-gone', (_e, d) => logError('render-process-gone', JSON.stringify(d)))
  win.webContents.on('did-fail-load', (_e, code, desc, url) => logError('did-fail-load', `${code} ${desc} ${url}`))

  let t: NodeJS.Timeout | null = null
  const persistBounds = () => {
    if (t) clearTimeout(t)
    t = setTimeout(() => {
      if (win && !win.isDestroyed() && !win.isMinimized()) saveSettings({ bounds: win.getBounds() })
    }, 500)
  }
  win.on('resize', persistBounds)
  win.on('move', persistBounds)
  win.on('closed', () => (win = null))

  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

function memoryMB(): number {
  const kb = app.getAppMetrics().reduce((sum, m) => sum + (m.memory?.workingSetSize ?? 0), 0)
  return Math.round(kb / 1024)
}

function trayMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: win?.isVisible() ? 'Sembunyikan overlay' : 'Tampilkan overlay', click: toggleVisible },
    {
      label: 'Click-through (Ctrl+Shift+C)',
      type: 'checkbox',
      checked: loadSettings().clickThrough,
      click: (item) => applyClickThrough(item.checked)
    },
    { type: 'separator' },
    { label: `Memori aplikasi: ${memoryMB()} MB`, enabled: false },
    { type: 'separator' },
    { label: 'Keluar', click: () => app.quit() }
  ])
}

function rebuildTrayTooltip(): void {
  tray?.setToolTip(
    loadSettings().clickThrough ? 'Live Comment Overlay (click-through aktif)' : 'Live Comment Overlay'
  )
}

function createTray(): void {
  const img = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(img)
  rebuildTrayTooltip()
  tray.on('click', toggleVisible)
  tray.on('right-click', () => tray?.popUpContextMenu(trayMenu()))
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => loadSettings())

  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    const next = saveSettings(patch ?? {})
    if (patch && 'opacity' in patch) win?.setOpacity(next.opacity)
    if (patch && 'clickThrough' in patch) applyClickThrough(next.clickThrough)
    return next
  })

  ipcMain.handle('tiktok:connect', async (_e, username: string) => {
    saveSettings({ username: String(username ?? '') })
    await service.connect(String(username ?? ''))
  })
  ipcMain.handle('tiktok:disconnect', () => service.disconnect())

  ipcMain.handle('youtube:connect', async (_e, input: string) => {
    saveSettings({ youtubeInput: String(input ?? '') })
    await youtube.connect(String(input ?? ''))
  })
  ipcMain.handle('youtube:disconnect', () => youtube.disconnect())

  ipcMain.handle('app:memory', () => memoryMB())
  ipcMain.handle('app:diag', () => service.getDiag())
  ipcMain.handle('youtube:report', () => youtube.getReport())
  ipcMain.handle('app:minimize', () => win?.minimize())
  ipcMain.handle('app:quit', () => app.quit())
  // Hanya URL yang persis sama dengan salah satu LINKS yang boleh dibuka
  ipcMain.handle('app:openExternal', (_e, url: unknown) => {
    const u = String(url ?? '')
    if ((Object.values(LINKS) as string[]).includes(u) && isLinkReady(u)) void shell.openExternal(u)
  })
  ipcMain.handle('app:restart', () => {
    flushSettings()
    app.relaunch()
    app.exit(0)
  })
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.showInactive()
  }
})

app.whenReady().then(() => {
  if (!gotLock) return
  bootLog('app ready')
  try {
    registerIpc()
    createWindow()
    bootLog('jendela dibuat')
  } catch (e) {
    fatal('Gagal membuat jendela', e)
    return
  }
  try {
    createTray()
  } catch (e) {
    logError('createTray', e) // tray gagal tidak boleh membatalkan aplikasi
  }

  globalShortcut.register('CommandOrControl+Shift+O', toggleVisible)
  globalShortcut.register('CommandOrControl+Shift+C', () => applyClickThrough(!loadSettings().clickThrough))
})

app.on('before-quit', () => {
  quitting = true
  flushSettings()
  service.dispose()
  youtube.dispose()
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (quitting || process.platform !== 'darwin') app.quit()
})
