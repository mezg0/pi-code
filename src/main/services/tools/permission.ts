import { BrowserWindow } from 'electron'
import type {
  PermissionMode,
  PermissionRequest,
  PermissionResponse
} from '../../../shared/session'

// ── Pending permission state ────────────────────────────────────────

type PendingPermission = {
  sessionId: string
  request: PermissionRequest
  resolve: () => void
  reject: (error: Error) => void
}

const pending = new Map<string, PendingPermission>()
let nextId = 1

// Session-scoped "always" approvals: sessionId → Set of "toolName:pattern"
const alwaysApproved = new Map<string, Set<string>>()

function generateRequestId(): string {
  return `perm_${Date.now()}_${nextId++}`
}

function emitToRenderers(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

// ── Pattern derivation ──────────────────────────────────────────────

/**
 * Derive a pattern from a tool call for "always" approval matching.
 * For bash: first 1-2 tokens of the command (e.g., "git *", "npm run *").
 * For edit/write: the file path.
 * For others: wildcard.
 */
export function derivePattern(
  toolName: string,
  input: Record<string, unknown>
): string {
  if (toolName === 'bash') {
    const command = input.command
    if (typeof command !== 'string') return '*'
    const tokens = command.trim().split(/\s+/)
    if (tokens.length === 0) return '*'
    // Use first token for simple commands, first 2 for compound (git, npm, etc.)
    const COMPOUND_COMMANDS = new Set([
      'git', 'npm', 'yarn', 'pnpm', 'bun', 'cargo', 'docker', 'kubectl',
      'pip', 'brew', 'apt', 'apt-get', 'make', 'go', 'python', 'node'
    ])
    if (COMPOUND_COMMANDS.has(tokens[0]) && tokens.length > 1) {
      return `${tokens[0]} ${tokens[1]} *`
    }
    return `${tokens[0]} *`
  }

  if (toolName === 'edit' || toolName === 'write') {
    const path = input.path ?? input.filePath ?? input.file_path
    if (typeof path === 'string') return path
    return '*'
  }

  if (toolName === 'read') {
    const path = input.path ?? input.filePath ?? input.file_path
    if (typeof path === 'string') return path
    return '*'
  }

  return '*'
}

/**
 * Derive patterns for the "always" approval option shown in the UI.
 * Returns a list of human-readable patterns the user would approve.
 */
export function deriveAlwaysPatterns(
  toolName: string,
  input: Record<string, unknown>
): string[] {
  const pattern = derivePattern(toolName, input)
  return [pattern]
}

/**
 * Create a human-readable description of a tool call.
 */
export function describeToolCall(
  toolName: string,
  input: Record<string, unknown>
): string {
  if (toolName === 'bash') {
    const command = input.command
    if (typeof command === 'string') return `Run command: ${command}`
    return 'Run a shell command'
  }

  if (toolName === 'edit') {
    const path = input.path ?? input.filePath ?? input.file_path
    if (typeof path === 'string') return `Edit file: ${path}`
    return 'Edit a file'
  }

  if (toolName === 'write') {
    const path = input.path ?? input.filePath ?? input.file_path
    if (typeof path === 'string') return `Write file: ${path}`
    return 'Write a file'
  }

  if (toolName === 'read') {
    const path = input.path ?? input.filePath ?? input.file_path
    if (typeof path === 'string') return `Read file: ${path}`
    return 'Read a file'
  }

  if (toolName === 'grep') {
    const pattern = input.pattern ?? input.regex
    if (typeof pattern === 'string') return `Search: ${pattern}`
    return 'Search file contents'
  }

  if (toolName === 'find') {
    const pattern = input.pattern ?? input.glob
    if (typeof pattern === 'string') return `Find files: ${pattern}`
    return 'Find files'
  }

  if (toolName === 'ls') {
    const path = input.path ?? input.directory
    if (typeof path === 'string') return `List directory: ${path}`
    return 'List directory contents'
  }

  return `Use tool: ${toolName}`
}

// ── Always-approved checks ──────────────────────────────────────────

function alwaysKey(toolName: string, pattern: string): string {
  return `${toolName}:${pattern}`
}

export function isAlwaysApproved(
  sessionId: string,
  toolName: string,
  pattern: string
): boolean {
  const approved = alwaysApproved.get(sessionId)
  if (!approved) return false

  // Check exact match
  if (approved.has(alwaysKey(toolName, pattern))) return true

  // Check wildcard match: if "toolName:*" is approved, everything matches
  if (approved.has(alwaysKey(toolName, '*'))) return true

  // Check prefix match for commands like "git *" matching "git status *"
  for (const key of approved) {
    if (!key.startsWith(`${toolName}:`)) continue
    const approvedPattern = key.slice(toolName.length + 1)
    if (approvedPattern.endsWith(' *')) {
      const prefix = approvedPattern.slice(0, -2)
      if (pattern.startsWith(prefix)) return true
    }
  }

  return false
}

function addAlwaysApproval(
  sessionId: string,
  toolName: string,
  patterns: string[]
): void {
  let approved = alwaysApproved.get(sessionId)
  if (!approved) {
    approved = new Set()
    alwaysApproved.set(sessionId, approved)
  }
  for (const pattern of patterns) {
    approved.add(alwaysKey(toolName, pattern))
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Ask the user for permission to execute a tool call.
 * Returns a promise that resolves when approved, or rejects when denied.
 */
export function askPermission(
  sessionId: string,
  toolName: string,
  toolCallId: string,
  input: Record<string, unknown>
): Promise<void> {
  const requestId = generateRequestId()
  const request: PermissionRequest = {
    id: requestId,
    sessionId,
    toolName,
    toolCallId,
    description: describeToolCall(toolName, input),
    input,
    patterns: deriveAlwaysPatterns(toolName, input)
  }

  return new Promise<void>((resolve, reject) => {
    pending.set(requestId, { sessionId, request, resolve, reject })
    emitToRenderers('sessions:permission', { sessionId, request })
  })
}

/**
 * Respond to a pending permission request.
 */
export function replyToPermission(
  requestId: string,
  response: PermissionResponse,
  message?: string
): boolean {
  const entry = pending.get(requestId)
  if (!entry) return false
  pending.delete(requestId)

  // Emit null to clear the permission UI
  emitToRenderers('sessions:permission', {
    sessionId: entry.sessionId,
    request: null
  })

  switch (response) {
    case 'once':
      entry.resolve()
      break
    case 'always':
      addAlwaysApproval(
        entry.sessionId,
        entry.request.toolName,
        entry.request.patterns
      )
      entry.resolve()

      // Auto-resolve other pending permissions for this session that now match
      for (const [id, other] of pending) {
        if (other.sessionId !== entry.sessionId) continue
        const pattern = derivePattern(other.request.toolName, other.request.input)
        if (isAlwaysApproved(entry.sessionId, other.request.toolName, pattern)) {
          pending.delete(id)
          emitToRenderers('sessions:permission', {
            sessionId: other.sessionId,
            request: null
          })
          other.resolve()
        }
      }
      break
    case 'reject':
      entry.reject(
        message
          ? new Error(
              `The user denied permission with feedback: ${message}`
            )
          : new Error(
              'The user denied permission for this tool call. You may try again with different parameters.'
            )
      )
      break
  }

  return true
}

/**
 * Get the pending permission request for a given session, if any.
 */
export function getPendingPermission(
  sessionId: string
): PermissionRequest | null {
  for (const [, entry] of pending) {
    if (entry.sessionId === sessionId) {
      return entry.request
    }
  }
  return null
}

/**
 * Reject all pending permissions for a session (on abort/dispose).
 */
export function rejectAllPermissionsForSession(sessionId: string): void {
  for (const [requestId, entry] of pending) {
    if (entry.sessionId === sessionId) {
      pending.delete(requestId)
      emitToRenderers('sessions:permission', { sessionId, request: null })
      entry.reject(new Error('Session was aborted'))
    }
  }
}

/**
 * Auto-approve all pending permissions for a session.
 * Called when the user switches to "auto" mode.
 */
export function approveAllPermissionsForSession(sessionId: string): void {
  for (const [requestId, entry] of pending) {
    if (entry.sessionId === sessionId) {
      pending.delete(requestId)
      emitToRenderers('sessions:permission', { sessionId, request: null })
      entry.resolve()
    }
  }
}

/**
 * Clear always-approved state for a session (on dispose).
 */
export function clearAlwaysApprovedForSession(sessionId: string): void {
  alwaysApproved.delete(sessionId)
}

// ── Permission mode ─────────────────────────────────────────────────

export type PermissionModeController = {
  get(): PermissionMode
  set(mode: PermissionMode): void
}

const controllersBySessionFile = new Map<string, PermissionModeController>()

export function registerPermissionModeController(
  sessionFile: string,
  controller: PermissionModeController
): void {
  controllersBySessionFile.set(sessionFile, controller)
}

export function unregisterPermissionModeController(
  sessionFile: string
): void {
  controllersBySessionFile.delete(sessionFile)
}

export function getPermissionModeController(
  sessionFile: string
): PermissionModeController | undefined {
  return controllersBySessionFile.get(sessionFile)
}

// ── Session ID context ──────────────────────────────────────────────
// Shared with the question tool — set before each prompt execution.

let currentSessionId: string | null = null

export function setCurrentPermissionSessionId(
  sessionId: string | null
): void {
  currentSessionId = sessionId
}

export function getCurrentPermissionSessionId(): string | null {
  return currentSessionId
}
