import type { FileEntry, FilesChangedPayload } from '@pi-code/shared/session'
import { apiGet, apiPost } from './api-client'
import { onServerEvent } from './event-stream'

export type { FileEntry, FilesChangedPayload }

const qs = (params: Record<string, string | undefined>): string => {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined)
  ) as Record<string, string>
  return '?' + new URLSearchParams(filtered).toString()
}

export const listFiles = (cwd: string, dirPath?: string): Promise<FileEntry[]> =>
  apiGet(`/files/list${qs({ cwd, dirPath })}`)
export const readFileContents = (cwd: string, filePath: string): Promise<string> =>
  apiGet(`/files/read${qs({ cwd, filePath })}`)
export const writeFileContents = (cwd: string, filePath: string, content: string): Promise<void> =>
  apiPost('/files/write', { cwd, filePath, content })
export const watchFiles = (cwd: string): Promise<void> => apiPost('/files/watch', { cwd })
export const unwatchFiles = (cwd: string): Promise<void> => apiPost('/files/unwatch', { cwd })
export function onFilesChanged(listener: (payload: FilesChangedPayload) => void): () => void {
  return onServerEvent('files:changed', listener as (payload: unknown) => void)
}
