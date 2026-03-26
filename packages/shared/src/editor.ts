// ---------------------------------------------------------------------------
// Editor types and constants
// ---------------------------------------------------------------------------

export type EditorId = 'cursor' | 'vscode' | 'zed' | 'file-manager'

export type EditorInfo = {
  id: EditorId
  label: string
  /** CLI command to launch the editor, or null for platform file manager */
  command: string | null
}

export const EDITORS: readonly EditorInfo[] = [
  { id: 'cursor', label: 'Cursor', command: 'cursor' },
  { id: 'vscode', label: 'VS Code', command: 'code' },
  { id: 'zed', label: 'Zed', command: 'zed' },
  { id: 'file-manager', label: 'Finder', command: null }
] as const

export type EditorApi = {
  getAvailableEditors(): Promise<EditorId[]>
  openInEditor(cwd: string, editorId: EditorId): Promise<void>
}
