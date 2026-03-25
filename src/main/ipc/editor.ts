import { ipcMain } from 'electron'
import { getAvailableEditors, openInEditor } from '../services/editor'
import type { EditorId } from '../../shared/editor'

export function registerEditorIpc(): void {
  ipcMain.handle('editor:available', () => getAvailableEditors())
  ipcMain.handle('editor:open', (_event, cwd: string, editorId: EditorId) =>
    openInEditor(cwd, editorId)
  )
}
