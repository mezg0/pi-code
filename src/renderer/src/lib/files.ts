import type { FileEntry, FilesChangedPayload } from '@pi-code/shared/session'

const files = window.files

export type { FileEntry, FilesChangedPayload }

export const listFiles = (cwd: string, dirPath?: string): Promise<FileEntry[]> =>
  files.list(cwd, dirPath)
export const readFileContents = (cwd: string, filePath: string): Promise<string> =>
  files.read(cwd, filePath)
export const writeFileContents = (cwd: string, filePath: string, content: string): Promise<void> =>
  files.write(cwd, filePath, content)
export const watchFiles = (cwd: string): Promise<void> => files.watch(cwd)
export const unwatchFiles = (cwd: string): Promise<void> => files.unwatch(cwd)
export const onFilesChanged = (listener: (payload: FilesChangedPayload) => void): (() => void) =>
  files.onChanged(listener)
