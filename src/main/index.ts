import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createServer, type PiServer } from '@pi-code/server'
import { setRemoteAccessHandlers } from '@pi-code/server/remote'
import icon from '../../resources/icon.png?asset'
import { registerAuthIpc } from './ipc/auth'
import { registerBrowserIpc } from './ipc/browser'
import { registerEditorIpc } from './ipc/editor'
import { registerFilesIpc } from './ipc/files'
import { registerGitIpc } from './ipc/git'
import { registerSessionIpc } from './ipc/sessions'
import { registerTerminalIpc } from './ipc/terminal'
import { disposeAllBrowsers } from './services/browser'
import { disposeAllWatchers } from './services/file-watcher'
import { disposeAllSessions } from './services/pi-runner'
import { disposeAllTerminals } from './services/terminal'
import {
  generatePassword,
  getLanAddresses,
  loadRemoteAccessConfig,
  saveRemoteAccessConfig,
  type RemoteAccessConfig
} from './services/remote-access'

let piServer: PiServer | null = null
let sidecarServerReady: Promise<void>
let resolveSidecarReady: () => void
let remoteConfig: RemoteAccessConfig = { enabled: false, port: 4311, password: null }

sidecarServerReady = new Promise<void>((resolve) => {
  resolveSidecarReady = resolve
})

export function getSidecarServerUrl(): string {
  return piServer?.local.url ?? 'http://127.0.0.1:4310'
}

function getRemoteUrls(): string[] {
  if (!piServer?.remote) return []
  const port = piServer.remote.port
  return getLanAddresses().map((addr) => `http://${addr}:${port}`)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 16, y: 16 }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)

    if (is.dev) {
      window.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.code === 'KeyR' && (input.control || input.meta)) {
          event.preventDefault()
        }
      })
    }
  })

  ipcMain.handle('server:url', async () => {
    await sidecarServerReady
    return getSidecarServerUrl()
  })

  registerAuthIpc()
  registerEditorIpc()
  registerSessionIpc()
  registerTerminalIpc()
  registerBrowserIpc()
  registerFilesIpc()
  registerGitIpc()

  // Wire up remote access handlers so the /remote routes can manage the remote listener
  setRemoteAccessHandlers({
    async getStatus() {
      return {
        enabled: remoteConfig.enabled && piServer?.remote !== null,
        port: remoteConfig.port,
        password: remoteConfig.password,
        urls: getRemoteUrls()
      }
    },
    async enable(opts) {
      if (!piServer) throw new Error('Server not started')

      const port = opts.port ?? remoteConfig.port
      const password = opts.password === undefined ? remoteConfig.password : opts.password

      remoteConfig = { enabled: true, port, password: password ?? null }
      await saveRemoteAccessConfig(remoteConfig)

      const remote = await piServer.startRemote({
        port,
        password: password ?? undefined
      })

      console.info(`[main] remote access enabled on ${remote.url}${password ? ' (password protected)' : ' (no password)'}`)

      return {
        enabled: true,
        port: remote.port,
        password: remoteConfig.password,
        urls: getRemoteUrls()
      }
    },
    async disable() {
      if (piServer) {
        await piServer.stopRemote()
      }

      remoteConfig = { ...remoteConfig, enabled: false }
      await saveRemoteAccessConfig(remoteConfig)

      console.info('[main] remote access disabled')
      return { enabled: false }
    },
    generatePassword
  })

  const webRoot = join(__dirname, '../web')
  void (async () => {
    try {
      // Always start local server on 127.0.0.1
      const server = await createServer({
        hostname: '127.0.0.1',
        port: Number(process.env.PI_SERVER_PORT ?? '4310'),
        webRoot,
        devProxy: is.dev && process.env.ELECTRON_RENDERER_URL
          ? process.env.ELECTRON_RENDERER_URL
          : undefined
      })
      piServer = server
      console.info(`[main] local server listening on ${server.local.url}`)

      // Restore remote access if it was previously enabled
      remoteConfig = await loadRemoteAccessConfig()
      if (remoteConfig.enabled) {
        try {
          const remote = await server.startRemote({
            port: remoteConfig.port,
            password: remoteConfig.password ?? undefined
          })
          console.info(`[main] remote access restored on ${remote.url}`)
        } catch (error) {
          console.error('[main] Failed to restore remote access:', error)
          remoteConfig.enabled = false
        }
      }

      resolveSidecarReady()
    } catch (error) {
      console.error('[main] Failed to start server:', error)
      resolveSidecarReady()
    }
  })()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  void piServer?.stopRemote().catch(() => {})
  void piServer?.local.stop().catch((error) => {
    console.error('[main] Failed to stop server:', error)
  })

  disposeBuiltinProviderBootstrap()
  disposeAllBrowsers()
  disposeAllTerminals()
  disposeAllSessions()
  disposeAllWatchers()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
