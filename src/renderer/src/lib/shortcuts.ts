// ---------------------------------------------------------------------------
// Keyboard Shortcut Definitions
// ---------------------------------------------------------------------------
// All app shortcuts are defined here in a single object. To change a binding,
// just edit the `keys` string. The format follows TanStack Hotkeys:
//   "Mod+Shift+K"  — "Mod" = ⌘ on Mac, Ctrl elsewhere
//   "Mod+1"        — number keys
//
// See: https://tanstack.com/hotkeys/latest/docs/overview
// ---------------------------------------------------------------------------

import { formatForDisplay } from '@tanstack/react-hotkeys'

/** Categories used to group shortcuts in the cheatsheet and Settings view. */
export type ShortcutCategory = 'Global' | 'Navigation' | 'Session' | 'Tabs' | 'Modes'

export interface ShortcutDef {
  /** Display label for UIs */
  label: string
  /** TanStack Hotkeys key string, e.g. "Mod+Shift+P" */
  keys: string
  /** Category for grouped display in cheatsheet/Settings */
  category: ShortcutCategory
  /** Optional longer description for the cheatsheet */
  description?: string
}

export const SHORTCUTS = {
  // ── Global ──────────────────────────────────────────────────────────
  'command-palette': {
    label: 'Command palette',
    keys: 'Mod+K',
    category: 'Global',
    description: 'Coming soon — opens the shortcuts cheatsheet for now'
  },
  'show-shortcuts': {
    label: 'Show keyboard shortcuts',
    keys: 'Mod+/',
    category: 'Global'
  },
  'toggle-sidebar': { label: 'Toggle sidebar', keys: 'Mod+B', category: 'Global' },
  'new-session': { label: 'New session', keys: 'Mod+N', category: 'Global' },
  'new-worktree-session': {
    label: 'New worktree session',
    keys: 'Mod+Shift+N',
    category: 'Global',
    description: "Creates a worktree off the active project's current branch"
  },
  'open-settings': { label: 'Open settings', keys: 'Mod+,', category: 'Global' },

  // ── Navigation ──────────────────────────────────────────────────────
  'next-session': {
    label: 'Next session',
    keys: 'Mod+Alt+ArrowDown',
    category: 'Navigation'
  },
  'prev-session': {
    label: 'Previous session',
    keys: 'Mod+Alt+ArrowUp',
    category: 'Navigation'
  },
  'jump-session-1': { label: 'Jump to session 1', keys: 'Mod+1', category: 'Navigation' },
  'jump-session-2': { label: 'Jump to session 2', keys: 'Mod+2', category: 'Navigation' },
  'jump-session-3': { label: 'Jump to session 3', keys: 'Mod+3', category: 'Navigation' },
  'jump-session-4': { label: 'Jump to session 4', keys: 'Mod+4', category: 'Navigation' },
  'jump-session-5': { label: 'Jump to session 5', keys: 'Mod+5', category: 'Navigation' },
  'jump-session-6': { label: 'Jump to session 6', keys: 'Mod+6', category: 'Navigation' },
  'jump-session-7': { label: 'Jump to session 7', keys: 'Mod+7', category: 'Navigation' },
  'jump-session-8': { label: 'Jump to session 8', keys: 'Mod+8', category: 'Navigation' },
  'jump-session-9': { label: 'Jump to session 9', keys: 'Mod+9', category: 'Navigation' },

  // ── Session ─────────────────────────────────────────────────────────
  'stop-response': { label: 'Stop response', keys: 'Escape', category: 'Session' },
  'open-in-editor': { label: 'Open in editor', keys: 'Mod+O', category: 'Session' },
  'toggle-panel': { label: 'Toggle panel', keys: 'Mod+E', category: 'Session' },
  'focus-input': { label: 'Focus chat input', keys: 'Mod+L', category: 'Session' },
  'branch-picker': { label: 'Open branch picker', keys: 'Mod+Shift+B', category: 'Session' },
  'open-commit': { label: 'Open commit dialog', keys: 'Mod+Shift+C', category: 'Session' },
  'scroll-to-bottom': { label: 'Scroll to bottom', keys: 'Mod+ArrowDown', category: 'Session' },

  // ── Modes ───────────────────────────────────────────────────────────
  'toggle-plan-mode': {
    label: 'Toggle plan mode',
    keys: 'Mod+Shift+P',
    category: 'Modes'
  },
  'cycle-permission-mode': {
    label: 'Cycle permission mode',
    keys: 'Mod+Shift+A',
    category: 'Modes',
    description: 'Cycles ask → auto → strict'
  },
  'cycle-thinking-level': {
    label: 'Cycle thinking level',
    keys: 'Mod+Shift+T',
    category: 'Modes',
    description: 'Cycles through the current model’s thinking levels'
  },
  'open-model-picker': {
    label: 'Open model picker',
    keys: 'Mod+Shift+M',
    category: 'Modes'
  },

  // ── Tool tabs ───────────────────────────────────────────────────────
  'tab-plan': { label: 'Plan tab', keys: 'Mod+P', category: 'Tabs' },
  'tab-git': { label: 'Git tab', keys: 'Mod+G', category: 'Tabs' },
  'tab-terminal': { label: 'Terminal tab', keys: 'Mod+J', category: 'Tabs' },
  'tab-files': { label: 'Files tab', keys: 'Mod+Y', category: 'Tabs' },
  'tab-browser': { label: 'Browser tab', keys: 'Mod+U', category: 'Tabs' },

  // ── Context-specific ────────────────────────────────────────────────
  'save-file': { label: 'Save file', keys: 'Mod+S', category: 'Session' }
} as const satisfies Record<string, ShortcutDef>

export type ShortcutId = keyof typeof SHORTCUTS

/**
 * Get the platform-aware display string for a shortcut.
 * e.g. "Mod+Shift+P" → "⌘⇧P" on Mac, "Ctrl+Shift+P" on Windows
 */
export function getShortcutDisplay(id: ShortcutId): string {
  return formatForDisplay(SHORTCUTS[id].keys)
}

/** Ordered list of categories so the cheatsheet presents them in a stable order. */
export const SHORTCUT_CATEGORY_ORDER: ShortcutCategory[] = [
  'Global',
  'Navigation',
  'Session',
  'Tabs',
  'Modes'
]

export type GroupedShortcut = {
  id: ShortcutId
  def: ShortcutDef
  display: string
}

/**
 * Return shortcuts grouped by category, preserving the declaration order
 * within each category. Useful for the cheatsheet and settings section.
 */
export function getShortcutsByCategory(): Array<{
  category: ShortcutCategory
  items: GroupedShortcut[]
}> {
  const grouped = new Map<ShortcutCategory, GroupedShortcut[]>()

  for (const category of SHORTCUT_CATEGORY_ORDER) {
    grouped.set(category, [])
  }

  for (const [id, def] of Object.entries(SHORTCUTS) as Array<[ShortcutId, ShortcutDef]>) {
    const list = grouped.get(def.category)
    if (!list) continue
    list.push({ id, def, display: formatForDisplay(def.keys) })
  }

  return SHORTCUT_CATEGORY_ORDER.filter((category) => (grouped.get(category)?.length ?? 0) > 0).map(
    (category) => ({
      category,
      items: grouped.get(category) ?? []
    })
  )
}
