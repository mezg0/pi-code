import { ElectronAPI } from '@electron-toolkit/preload'
import type { EditorApi } from '../shared/editor'
import type { AuthApi, FilesApi, GitApi, SessionApi, TerminalApi } from '../shared/session'

export type * from '../shared/editor'
export type * from '../shared/session'

declare global {
  interface Window {
    electron: ElectronAPI
    api: SessionApi
    auth: AuthApi
    editor: EditorApi
    terminal: TerminalApi
    files: FilesApi
    git: GitApi
  }
}
