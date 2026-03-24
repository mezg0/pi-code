import { ElectronAPI } from '@electron-toolkit/preload'
import type { AuthApi, FilesApi, GitApi, SessionApi, TerminalApi } from '../shared/session'

export type * from '../shared/session'

declare global {
  interface Window {
    electron: ElectronAPI
    api: SessionApi
    auth: AuthApi
    terminal: TerminalApi
    files: FilesApi
    git: GitApi
  }
}
