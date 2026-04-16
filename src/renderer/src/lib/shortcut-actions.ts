// ---------------------------------------------------------------------------
// Shortcut Action Bus
// ---------------------------------------------------------------------------
// Lightweight pub/sub so a global hotkey (or a future command palette / Electron
// menu) can dispatch an "action" that is handled by whichever component owns
// the relevant state. Handlers register with `useShortcutAction(id, fn)` and
// are unregistered automatically on unmount.
//
// If no handler is registered for an action, calling `emitAction` is a no-op.
// If multiple handlers register for the same action, the most-recently-mounted
// one wins. This mirrors how stacked UI owns a given interaction at a time
// (e.g., the active session conversation owns "focus-input").
// ---------------------------------------------------------------------------

import { useEffect } from 'react'

/**
 * Identifiers for every keyboard-accessible action. Add new ones here rather
 * than ad-hoc strings so TypeScript catches typos.
 */
export type ShortcutActionId =
  | 'command-palette'
  | 'show-shortcuts'
  | 'toggle-sidebar'
  | 'new-session'
  | 'new-worktree-session'
  | 'open-settings'
  | 'next-session'
  | 'prev-session'
  | `jump-session-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | 'stop-response'
  | 'open-in-editor'
  | 'toggle-panel'
  | 'focus-input'
  | 'branch-picker'
  | 'open-commit'
  | 'scroll-to-bottom'
  | 'toggle-plan-mode'
  | 'cycle-permission-mode'
  | 'cycle-thinking-level'
  | 'open-model-picker'
  | 'tab-plan'
  | 'tab-git'
  | 'tab-terminal'
  | 'tab-files'
  | 'tab-browser'

type Handler = () => void

const handlers = new Map<ShortcutActionId, Handler[]>()

function registerAction(id: ShortcutActionId, handler: Handler): () => void {
  const list = handlers.get(id) ?? []
  list.push(handler)
  handlers.set(id, list)

  return () => {
    const current = handlers.get(id)
    if (!current) return
    const index = current.lastIndexOf(handler)
    if (index !== -1) current.splice(index, 1)
    if (current.length === 0) handlers.delete(id)
  }
}

/**
 * Fire the most recently registered handler for `id`. Returns `true` if a
 * handler ran, `false` otherwise.
 */
export function emitAction(id: ShortcutActionId): boolean {
  const list = handlers.get(id)
  if (!list || list.length === 0) return false
  const handler = list[list.length - 1]
  try {
    handler()
  } catch (err) {
    console.error(`[shortcut-actions] handler for "${id}" threw`, err)
  }
  return true
}

/** True if at least one handler is currently registered for `id`. */
export function hasActionHandler(id: ShortcutActionId): boolean {
  const list = handlers.get(id)
  return Boolean(list && list.length > 0)
}

export interface UseShortcutActionOptions {
  /** Skip registration entirely when false (handler stays unmounted). */
  enabled?: boolean
}

/**
 * Register `handler` for `id` while the component is mounted. Updates to
 * `handler` take effect on the next render without re-registering.
 */
export function useShortcutAction(
  id: ShortcutActionId,
  handler: Handler,
  options: UseShortcutActionOptions = {}
): void {
  const { enabled = true } = options

  useEffect(() => {
    if (!enabled) return
    // Wrap so future handler references always use the latest closure
    // (we re-register on every render since handler identity is unstable).
    return registerAction(id, handler)
  }, [enabled, handler, id])
}
