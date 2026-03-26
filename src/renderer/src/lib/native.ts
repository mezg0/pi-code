import type { EditorId } from '@pi-code/shared/editor'
import type { Project } from '@pi-code/shared/session'

const api = window.api
const editor = window.editor

export type NativeCapabilities = {
  isDesktop: boolean
  canPickProject: boolean
  canOpenInEditor: boolean
}

export function getNativeCapabilities(): NativeCapabilities {
  const isDesktop = typeof window !== 'undefined' && typeof window.electron !== 'undefined'
  return {
    isDesktop,
    canPickProject: isDesktop,
    canOpenInEditor: isDesktop
  }
}

export const pickAndAddProject = (): Promise<Project | null> => api.projects.add()
export const getAvailableEditors = (): Promise<EditorId[]> => editor.getAvailableEditors()
export const openInEditor = (cwd: string, editorId: EditorId): Promise<void> =>
  editor.openInEditor(cwd, editorId)
