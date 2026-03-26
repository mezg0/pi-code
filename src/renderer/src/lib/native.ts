import type { EditorId } from '@pi-code/shared/editor'
import type { Project } from '@pi-code/shared/session'

export type NativeCapabilities = {
  isDesktop: boolean
  canPickProject: boolean
  canOpenInEditor: boolean
}

const _isDesktop = typeof window !== 'undefined' && typeof window.electron !== 'undefined'

export function getNativeCapabilities(): NativeCapabilities {
  return {
    isDesktop: _isDesktop,
    canPickProject: _isDesktop,
    canOpenInEditor: _isDesktop
  }
}

export const pickAndAddProject = (): Promise<Project | null> => {
  if (!_isDesktop) return Promise.resolve(null)
  return window.api.projects.add()
}

export const getAvailableEditors = (): Promise<EditorId[]> => {
  if (!_isDesktop) return Promise.resolve([])
  return window.editor.getAvailableEditors()
}

export const openInEditor = (cwd: string, editorId: EditorId): Promise<void> => {
  if (!_isDesktop) return Promise.resolve()
  return window.editor.openInEditor(cwd, editorId)
}
