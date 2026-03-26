import { ElectronAPI } from '@electron-toolkit/preload'
import type { EditorApi } from '@pi-code/shared/editor'
import type { AuthApi, FilesApi, GitApi, SessionApi, TerminalApi } from '@pi-code/shared/session'

export type * from '@pi-code/shared/editor'
export type * from '@pi-code/shared/session'

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
