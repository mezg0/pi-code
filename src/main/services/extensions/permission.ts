import { readFile, realpath, stat } from 'fs/promises'
import os from 'os'
import path from 'path'
import { createTwoFilesPatch } from 'diff'
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import type { PermissionMode } from '@pi-code/shared/session'
import { getSession } from '../session-manager'
import {
  arePatternsAlwaysApproved,
  askPermission,
  approveAllPermissionsForSession,
  deriveAlwaysPatterns,
  derivePattern,
  getCurrentPermissionSessionId,
  registerPermissionModeController,
  unregisterPermissionModeController
} from '../tools/permission'

type PermissionModeEntry = {
  type?: string
  customType?: string
  data?: {
    mode?: PermissionMode
  }
}

type AskOptions = {
  permission: string
  description: string
  patterns: string[]
  always: string[]
  metadata: Record<string, unknown>
}

const ASK_TOOLS = new Set(['bash', 'edit', 'write'])
const MAX_DIFF_LINES = 220
const MAX_DIFF_BYTES = 32 * 1024

function getActionForTool(toolName: string, mode: PermissionMode): 'allow' | 'ask' {
  if (mode === 'auto') return 'allow'
  if (mode === 'strict') return 'ask'
  return ASK_TOOLS.has(toolName) ? 'ask' : 'allow'
}

function expandHome(input: string): string {
  if (input === '~') return os.homedir()
  if (input.startsWith('~/')) return path.join(os.homedir(), input.slice(2))
  return input
}

function resolveSessionPath(root: string, input: string): string {
  const expanded = expandHome(input)
  if (path.isAbsolute(expanded)) return path.normalize(expanded)
  return path.resolve(root, expanded)
}

async function canonicalizePath(target: string): Promise<string> {
  const resolved = path.resolve(target)
  const exact = await realpath(resolved).catch(() => null)
  if (exact) return exact

  const parent = path.dirname(resolved)
  const parentReal = await realpath(parent).catch(() => null)
  if (parentReal) return path.join(parentReal, path.basename(resolved))

  return resolved
}

function isInsideRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function toGlob(dir: string): string {
  return `${dir.replace(/[\\/]+$/, '').replaceAll('\\', '/')}/*`
}

function countOccurrences(content: string, search: string): number {
  if (!search) return 0

  let count = 0
  let index = 0
  while (true) {
    const next = content.indexOf(search, index)
    if (next === -1) return count
    count += 1
    index = next + search.length
  }
}

function trimDiff(diff: string): { diff: string; truncated: boolean } {
  let truncated = false
  let value = diff

  if (Buffer.byteLength(value, 'utf8') > MAX_DIFF_BYTES) {
    value = Buffer.from(value, 'utf8').subarray(0, MAX_DIFF_BYTES).toString('utf8')
    truncated = true
  }

  const lines = value.split('\n')
  if (lines.length > MAX_DIFF_LINES) {
    value = lines.slice(0, MAX_DIFF_LINES).join('\n')
    truncated = true
  }

  if (!truncated) return { diff: value, truncated: false }
  return {
    diff: `${value}\n... preview truncated`,
    truncated: true
  }
}

async function buildDiffMetadata(
  toolName: string,
  input: Record<string, unknown>,
  root: string
): Promise<Record<string, unknown>> {
  if (toolName !== 'edit' && toolName !== 'write') return {}

  const rawPath = input.path
  if (typeof rawPath !== 'string' || !rawPath.trim()) return {}

  const filePath = await canonicalizePath(resolveSessionPath(root, rawPath))

  let before = ''
  try {
    before = await readFile(filePath, 'utf8')
  } catch {
    before = ''
  }

  let after: string | null = null
  if (toolName === 'write') {
    after = typeof input.content === 'string' ? input.content : null
  }

  if (toolName === 'edit') {
    const oldText = input.oldText
    const newText = input.newText

    if (typeof oldText === 'string' && typeof newText === 'string') {
      if (oldText === '') {
        after = newText
      } else if (countOccurrences(before, oldText) === 1) {
        after = before.replace(oldText, newText)
      }
    }
  }

  if (after === null) {
    return { filepath: filePath }
  }

  const patch =
    createTwoFilesPatch(
      filePath,
      filePath,
      before.replace(/\r\n/g, '\n'),
      after.replace(/\r\n/g, '\n'),
      '',
      '',
      { context: 3 }
    ) ?? ''

  const preview = trimDiff(patch)

  return {
    filepath: filePath,
    diff: preview.diff,
    diffTruncated: preview.truncated
  }
}

async function getToolTarget(
  toolName: string,
  input: Record<string, unknown>,
  root: string
): Promise<{ path: string; kind: 'file' | 'directory' } | null> {
  const raw =
    toolName === 'grep' ||
    toolName === 'find' ||
    toolName === 'ls' ||
    toolName === 'read' ||
    toolName === 'edit' ||
    toolName === 'write'
      ? input.path
      : null

  if (typeof raw !== 'string' || !raw.trim()) return null

  const targetPath = await canonicalizePath(resolveSessionPath(root, raw))

  if (toolName === 'ls' || toolName === 'find') {
    return { path: targetPath, kind: 'directory' }
  }

  const targetStat = await stat(targetPath).catch(() => null)
  if (targetStat?.isDirectory()) {
    return { path: targetPath, kind: 'directory' }
  }

  return { path: targetPath, kind: 'file' }
}

function tokenizeShell(command: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaped = false

  for (const char of command) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\' && quote !== "'") {
      escaped = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    if (char === ';' || char === '|' || char === '&' || char === '(' || char === ')') {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) tokens.push(current)
  return tokens
}

function looksLikePathToken(token: string): boolean {
  if (!token) return false
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(token)) return false
  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) return false
  if (token.startsWith('--')) return false
  return (
    token === '.' ||
    token === '..' ||
    token.startsWith('./') ||
    token.startsWith('../') ||
    token.startsWith('/') ||
    token.startsWith('~/')
  )
}

async function collectExternalBashDirectories(
  root: string,
  rootReal: string,
  command: string
): Promise<string[]> {
  const tokens = tokenizeShell(command)
  const directories = new Set<string>()

  async function maybeAdd(rawPath: string, kind: 'file' | 'directory'): Promise<void> {
    const targetPath = await canonicalizePath(resolveSessionPath(root, rawPath))
    if (isInsideRoot(rootReal, targetPath)) return
    directories.add(kind === 'directory' ? targetPath : path.dirname(targetPath))
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    const next = tokens[i + 1]

    if ((token === 'cd' || token === '-C' || token === '--directory') && typeof next === 'string') {
      await maybeAdd(next, 'directory')
      i += 1
      continue
    }

    if (looksLikePathToken(token)) {
      await maybeAdd(token, 'file')
    }
  }

  return Array.from(directories)
}

async function buildExternalDirectoryRequest(
  toolName: string,
  input: Record<string, unknown>,
  root: string,
  rootReal: string
): Promise<AskOptions | null> {
  if (toolName === 'bash') {
    const command = input.command
    if (typeof command !== 'string' || !command.trim()) return null

    const directories = await collectExternalBashDirectories(root, rootReal, command)
    if (directories.length === 0) return null

    const patterns = directories.map(toGlob)
    return {
      permission: 'external_directory',
      description: `Access external directory: ${directories[0]}`,
      patterns,
      always: patterns,
      metadata: {
        parentDir: directories[0],
        parentDirs: directories,
        command
      }
    }
  }

  const target = await getToolTarget(toolName, input, root)
  if (!target) return null
  if (isInsideRoot(rootReal, target.path)) return null

  const parentDir = target.kind === 'directory' ? target.path : path.dirname(target.path)
  const pattern = toGlob(parentDir)

  return {
    permission: 'external_directory',
    description: `Access external directory: ${parentDir}`,
    patterns: [pattern],
    always: [pattern],
    metadata: {
      filepath: target.path,
      parentDir
    }
  }
}

async function buildToolRequestOptions(
  toolName: string,
  input: Record<string, unknown>,
  root: string
): Promise<AskOptions> {
  return {
    permission: toolName,
    description:
      toolName === 'edit' || toolName === 'write'
        ? `${toolName === 'edit' ? 'Edit' : 'Write'} file: ${String(input.path ?? '')}`
        : toolName === 'bash'
          ? `Run command: ${String(input.command ?? '')}`
          : `Use tool: ${toolName}`,
    patterns: [derivePattern(toolName, input)],
    always: deriveAlwaysPatterns(toolName, input),
    metadata: await buildDiffMetadata(toolName, input, root)
  }
}

export default function permissionExtension(pi: ExtensionAPI): void {
  let permissionMode: PermissionMode = 'ask'
  let registeredSessionFile: string | null = null

  pi.on('tool_call', async (event) => {
    const sessionId = getCurrentPermissionSessionId()
    if (!sessionId) return

    const session = await getSession(sessionId)
    if (!session) return

    const root = session.worktreePath ?? session.repoPath
    const rootReal = await canonicalizePath(root)
    const input = event.input as Record<string, unknown>

    const externalRequest = await buildExternalDirectoryRequest(
      event.toolName,
      input,
      root,
      rootReal
    )

    try {
      if (
        externalRequest &&
        !arePatternsAlwaysApproved(sessionId, externalRequest.permission, externalRequest.patterns)
      ) {
        await askPermission(sessionId, event.toolName, event.toolCallId, input, externalRequest)
      }

      const action = getActionForTool(event.toolName, permissionMode)
      if (action === 'allow') return

      const request = await buildToolRequestOptions(event.toolName, input, root)
      if (arePatternsAlwaysApproved(sessionId, request.permission, request.patterns)) return

      await askPermission(sessionId, event.toolName, event.toolCallId, input, request)
      return
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'The user denied permission for this tool call.'
      return { block: true, reason }
    }
  })

  pi.on('session_start', async (_event, ctx) => {
    const sessionFile = ctx.sessionManager.getSessionFile?.() ?? null
    registeredSessionFile = sessionFile

    const lastEntry = ctx.sessionManager
      .getEntries()
      .filter(
        (entry) =>
          entry.type === 'custom' &&
          (entry as { customType?: string }).customType === 'permission-mode'
      )
      .pop() as PermissionModeEntry | undefined

    permissionMode = lastEntry?.data?.mode ?? 'ask'

    if (sessionFile) {
      registerPermissionModeController(sessionFile, {
        get: () => permissionMode,
        set: (mode: PermissionMode) => {
          const oldMode = permissionMode
          permissionMode = mode
          pi.appendEntry('permission-mode', { mode })

          if (mode === 'auto' && oldMode !== 'auto') {
            const sessionId = getCurrentPermissionSessionId()
            if (sessionId) {
              approveAllPermissionsForSession(sessionId)
            }
          }
        }
      })
    }
  })

  pi.on('session_shutdown', async () => {
    if (registeredSessionFile) {
      unregisterPermissionModeController(registeredSessionFile)
      registeredSessionFile = null
    }
  })
}
