import { ElectronAPI } from '@electron-toolkit/preload'
import type { FilesApi, GitApi, SessionApi, TerminalApi } from '../shared/session'

export type * from '../shared/session'

declare global {
  interface Window {
    electron: ElectronAPI
    api: SessionApi
    terminal: TerminalApi
    files: FilesApi
    git: GitApi
  }
}
