import { BrowserWindow } from 'electron'
import { publishServerEvent } from '@pi-code/server/event-bus'
import type { PermissionMode, PermissionRequest, PermissionResponse } from '@pi-code/shared/session'

// ── Pending permission state ────────────────────────────────────────

type PendingPermission = {
  sessionId: string
  request: PermissionRequest
  resolve: () => void
  reject: (error: Error) => void
}

const pending = new Map<string, PendingPermission>()
let nextId = 1

// Session-scoped "always" approvals: sessionId → Set of "permission:pattern"
const alwaysApproved = new Map<string, Set<string>>()

function generateRequestId(): string {
  return `perm_${Date.now()}_${nextId++}`
}

function emitToRenderers(channel: string, payload: unknown): void {
  publishServerEvent(channel, payload)

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

// ── Pattern derivation ──────────────────────────────────────────────

/**
 * Derive a pattern from a tool call for "always" approval matching.
 * For bash: first 1-2 tokens of the command (e.g., "git *", "npm run *").
 * For path-based tools: the path.
 * For grep: the path when present, otherwise the pattern.
 * For others: wildcard.
 */
export function derivePattern(toolName: string, input: Record<string, unknown>): string {
  if (toolName === 'bash') {
    const command = input.command
    if (typeof command !== 'string') return '*'
    const tokens = command.trim().split(/\s+/)
    if (tokens.length === 0) return '*'
    // Use first token for simple commands, first 2 for compound (git, npm, etc.)
    const COMPOUND_COMMANDS = new Set([
      'git',
      'npm',
      'yarn',
      'pnpm',
      'bun',
      'cargo',
      'docker',
      'kubectl',
      'pip',
      'brew',
      'apt',
      'apt-get',
      'make',
      'go',
      'python',
      'node'
    ])
    if (COMPOUND_COMMANDS.has(tokens[0]) && tokens.length > 1) {
      return `${tokens[0]} ${tokens[1]} *`
    }
    return `${tokens[0]} *`
  }

  if (
    toolName === 'edit' ||
    toolName === 'write' ||
    toolName === 'read' ||
    toolName === 'find' ||
    toolName === 'ls'
  ) {
    const path = input.path ?? input.filePath ?? input.file_path
    if (typeof path === 'string') return path
    return '*'
  }

  if (toolName === 'grep') {
    const path = input.path ?? input.filePath ?? input.file_path
    if (typeof path === 'string') return path
    const pattern = input.pattern ?? input.regex
    if (typeof pattern === 'string') return pattern
    return '*'
  }

  return '*'
}

/**
 * Derive patterns for the "always" approval option shown in the UI.
 * Returns a list of human-readable patterns the user would approve.
 */
export function deriveAlwaysPatterns(toolName: string, input: Record<string, unknown>): string[] {
  const pattern = derivePattern(toolName, input)
  return [pattern]
}

/**
 * Create a human-readable description of a tool call.
 */
export function describeToolCall(toolName: string, input: Record<string, unknown>): string {
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

function alwaysKey(permission: string, pattern: string): string {
  return `${permission}:${pattern}`
}

export function isAlwaysApproved(sessionId: string, permission: string, pattern: string): boolean {
  const approved = alwaysApproved.get(sessionId)
  if (!approved) return false

  // Check exact match
  if (approved.has(alwaysKey(permission, pattern))) return true

  // Check wildcard match: if "permission:*" is approved, everything matches
  if (approved.has(alwaysKey(permission, '*'))) return true

  // Check prefix match for commands like "git *" matching "git status *"
  for (const key of approved) {
    if (!key.startsWith(`${permission}:`)) continue
    const approvedPattern = key.slice(permission.length + 1)
    if (approvedPattern.endsWith(' *')) {
      const prefix = approvedPattern.slice(0, -2)
      if (pattern.startsWith(prefix)) return true
    }
  }

  return false
}

export function arePatternsAlwaysApproved(
  sessionId: string,
  permission: string,
  patterns: string[]
): boolean {
  if (patterns.length === 0) return false
  return patterns.every((pattern) => isAlwaysApproved(sessionId, permission, pattern))
}

function addAlwaysApproval(sessionId: string, permission: string, patterns: string[]): void {
  let approved = alwaysApproved.get(sessionId)
  if (!approved) {
    approved = new Set()
    alwaysApproved.set(sessionId, approved)
  }
  for (const pattern of patterns) {
    approved.add(alwaysKey(permission, pattern))
  }
}

// ── Public API ──────────────────────────────────────────────────────

type AskPermissionOptions = {
  permission?: string
  description?: string
  patterns?: string[]
  always?: string[]
  metadata?: Record<string, unknown>
}

/**
 * Ask the user for permission to execute a tool call.
 * Returns a promise that resolves when approved, or rejects when denied.
 */
export function askPermission(
  sessionId: string,
  toolName: string,
  toolCallId: string,
  input: Record<string, unknown>,
  options: AskPermissionOptions = {}
): Promise<void> {
  const requestId = generateRequestId()
  const permission = options.permission ?? toolName
  const patterns = options.patterns ?? [derivePattern(toolName, input)]
  const always = options.always ?? deriveAlwaysPatterns(toolName, input)
  const request: PermissionRequest = {
    id: requestId,
    sessionId,
    toolName,
    toolCallId,
    permission,
    description: options.description ?? describeToolCall(toolName, input),
    input,
    patterns,
    always,
    metadata: options.metadata ?? {}
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
      addAlwaysApproval(entry.sessionId, entry.request.permission, entry.request.always)
      entry.resolve()

      // Auto-resolve other pending permissions for this session that now match
      for (const [id, other] of pending) {
        if (other.sessionId !== entry.sessionId) continue
        if (
          arePatternsAlwaysApproved(
            entry.sessionId,
            other.request.permission,
            other.request.patterns
          )
        ) {
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
          ? new Error(`The user denied permission with feedback: ${message}`)
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
export function getPendingPermission(sessionId: string): PermissionRequest | null {
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

export function unregisterPermissionModeController(sessionFile: string): void {
  controllersBySessionFile.delete(sessionFile)
}

export function getPermissionModeController(
  sessionFile: string
): PermissionModeController | undefined {
  return controllersBySessionFile.get(sessionFile)
}
