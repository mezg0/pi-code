// ---------------------------------------------------------------------------
// Editor detection & launch service
// ---------------------------------------------------------------------------

import { spawn } from 'child_process'
import { accessSync, constants, statSync } from 'fs'
import { join, extname } from 'path'
import { EDITORS, type EditorId } from '../../shared/editor'

// ── Platform helpers ─────────────────────────────────────────────────

function fileManagerCommand(): string {
  switch (process.platform) {
    case 'darwin':
      return 'open'
    case 'win32':
      return 'explorer'
    default:
      return 'xdg-open'
  }
}

// ── Command availability (simplified from t3-code's approach) ────────

function resolvePathEntries(): string[] {
  const raw = process.env.PATH ?? process.env.Path ?? process.env.path ?? ''
  const delimiter = process.platform === 'win32' ? ';' : ':'
  return raw
    .split(delimiter)
    .map((e) => e.trim().replace(/^"+|"+$/g, ''))
    .filter((e) => e.length > 0)
}

function resolveWindowsExtensions(): string[] {
  const raw = process.env.PATHEXT
  const fallback = ['.COM', '.EXE', '.BAT', '.CMD']
  if (!raw) return fallback
  const parsed = raw
    .split(';')
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
    .map((e) => (e.startsWith('.') ? e.toUpperCase() : `.${e.toUpperCase()}`))
  return parsed.length > 0 ? [...new Set(parsed)] : fallback
}

function isExecutableFile(filePath: string): boolean {
  try {
    const stat = statSync(filePath)
    if (!stat.isFile()) return false
    if (process.platform === 'win32') {
      const ext = extname(filePath).toUpperCase()
      return ext.length > 0 && resolveWindowsExtensions().includes(ext)
    }
    accessSync(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function isCommandAvailable(command: string): boolean {
  const pathEntries = resolvePathEntries()
  if (process.platform === 'win32') {
    const exts = resolveWindowsExtensions()
    for (const dir of pathEntries) {
      for (const ext of exts) {
        if (isExecutableFile(join(dir, `${command}${ext}`))) return true
        if (isExecutableFile(join(dir, `${command}${ext.toLowerCase()}`))) return true
      }
    }
    return false
  }
  for (const dir of pathEntries) {
    if (isExecutableFile(join(dir, command))) return true
  }
  return false
}

// ── Public API ───────────────────────────────────────────────────────

export function getAvailableEditors(): EditorId[] {
  const available: EditorId[] = []
  for (const editor of EDITORS) {
    const command = editor.command ?? fileManagerCommand()
    if (isCommandAvailable(command)) {
      available.push(editor.id)
    }
  }
  return available
}

export async function openInEditor(cwd: string, editorId: EditorId): Promise<void> {
  const editorDef = EDITORS.find((e) => e.id === editorId)
  if (!editorDef) throw new Error(`Unknown editor: ${editorId}`)

  const command = editorDef.command ?? fileManagerCommand()
  if (!isCommandAvailable(command)) {
    throw new Error(`Editor command not found: ${command}`)
  }

  const args = [cwd]

  return new Promise<void>((resolve, reject) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        shell: process.platform === 'win32'
      })

      child.once('spawn', () => {
        child.unref()
        resolve()
      })

      child.once('error', (err) => {
        reject(new Error(`Failed to launch ${command}: ${err.message}`))
      })
    } catch (err) {
      reject(
        new Error(`Failed to spawn ${command}: ${err instanceof Error ? err.message : String(err)}`)
      )
    }
  })
}
