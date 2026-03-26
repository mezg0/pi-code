import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import type { PermissionMode } from '../../../shared/session'
import {
  askPermission,
  approveAllPermissionsForSession,
  derivePattern,
  getCurrentPermissionSessionId,
  isAlwaysApproved,
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

const ASK_TOOLS = new Set(['bash', 'edit', 'write'])

function getActionForTool(
  toolName: string,
  mode: PermissionMode
): 'allow' | 'ask' {
  if (mode === 'auto') return 'allow'
  if (mode === 'strict') return 'ask'
  // 'ask' mode — only gate dangerous tools
  return ASK_TOOLS.has(toolName) ? 'ask' : 'allow'
}

export default function permissionExtension(pi: ExtensionAPI): void {
  let permissionMode: PermissionMode = 'ask'
  let registeredSessionFile: string | null = null

  pi.on('tool_call', async (event) => {
    const action = getActionForTool(event.toolName, permissionMode)
    if (action === 'allow') return

    const sessionId = getCurrentPermissionSessionId()
    if (!sessionId) return

    // Check session "always" memory
    const pattern = derivePattern(event.toolName, event.input as Record<string, unknown>)
    if (isAlwaysApproved(sessionId, event.toolName, pattern)) return

    // Ask user for permission
    try {
      await askPermission(
        sessionId,
        event.toolName,
        event.toolCallId,
        event.input as Record<string, unknown>
      )
      // User approved — proceed
      return
    } catch (error) {
      // User denied
      const reason =
        error instanceof Error
          ? error.message
          : 'The user denied permission for this tool call.'
      return { block: true, reason }
    }
  })

  pi.on('session_start', async (_event, ctx) => {
    const sessionFile = ctx.sessionManager.getSessionFile?.() ?? null
    registeredSessionFile = sessionFile

    // Restore persisted permission mode
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

          // If switching to auto, auto-approve any pending permissions
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
