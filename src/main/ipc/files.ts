import { ipcMain } from 'electron'
import { listDirectory, getFileContent, saveFileContent } from '../services/files'
import { startWatching, stopWatching } from '../services/file-watcher'

export function registerFilesIpc(): void {
  ipcMain.handle('files:list', (_event, cwd: string, dirPath?: string) =>
    listDirectory(cwd, dirPath)
  )

  ipcMain.handle('files:read', (_event, cwd: string, filePath: string) =>
    getFileContent(cwd, filePath)
  )

  ipcMain.handle('files:write', (_event, cwd: string, filePath: string, content: string) =>
    saveFileContent(cwd, filePath, content)
  )

  ipcMain.handle('files:watch', (_event, cwd: string) => startWatching(cwd))

  ipcMain.handle('files:unwatch', (_event, cwd: string) => stopWatching(cwd))
}
