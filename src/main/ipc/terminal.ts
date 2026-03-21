import { ipcMain } from 'electron'
import { openTerminal, writeTerminal, resizeTerminal, disposeTerminal } from '../services/terminal'

export function registerTerminalIpc(): void {
  ipcMain.handle('terminal:open', (_event, id: string, cwd: string) => openTerminal(id, cwd))
  ipcMain.handle('terminal:write', (_event, id: string, data: string) => writeTerminal(id, data))
  ipcMain.handle('terminal:resize', (_event, id: string, cols: number, rows: number) =>
    resizeTerminal(id, cols, rows)
  )
  ipcMain.handle('terminal:dispose', (_event, id: string) => disposeTerminal(id))
}
