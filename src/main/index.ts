import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
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

    // Block Cmd/Ctrl+R reload in dev mode (production is already handled by optimizer)
    if (is.dev) {
      window.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.code === 'KeyR' && (input.control || input.meta)) {
          event.preventDefault()
        }
      })
    }
  })

  registerAuthIpc()
  registerEditorIpc()
  registerSessionIpc()
  registerTerminalIpc()
  registerBrowserIpc()
  registerFilesIpc()
  registerGitIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  disposeAllBrowsers()
  disposeAllTerminals()
  disposeAllSessions()
  disposeAllWatchers()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
