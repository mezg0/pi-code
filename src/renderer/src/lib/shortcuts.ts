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

export interface ShortcutDef {
  /** Display label for UIs */
  label: string
  /** TanStack Hotkeys key string, e.g. "Mod+Shift+P" */
  keys: string
}

export const SHORTCUTS = {
  // Global
  'toggle-sidebar': { label: 'Toggle sidebar', keys: 'Mod+B' },
  'new-session': { label: 'New session', keys: 'Mod+N' },
  'open-settings': { label: 'Open settings', keys: 'Mod+,' },

  // Session-scoped
  'open-in-editor': { label: 'Open in editor', keys: 'Mod+O' },
  'toggle-panel': { label: 'Toggle panel', keys: 'Mod+E' },
  'focus-input': { label: 'Focus chat input', keys: 'Mod+K' },
  'toggle-plan-mode': { label: 'Toggle plan mode', keys: 'Mod+Shift+P' },
  'open-commit': { label: 'Open commit dialog', keys: 'Mod+Shift+C' },
  'scroll-to-bottom': { label: 'Scroll to bottom', keys: 'Mod+ArrowDown' },

  // Tool tabs
  'tab-plan': { label: 'Plan tab', keys: 'Mod+1' },
  'tab-git': { label: 'Git tab', keys: 'Mod+2' },
  'tab-terminal': { label: 'Terminal tab', keys: 'Mod+3' },
  'tab-files': { label: 'Files tab', keys: 'Mod+4' },
  'tab-browser': { label: 'Browser tab', keys: 'Mod+5' },

  // Model shortcuts (user-configurable model + thinking level combos)
  'model-1': { label: 'Model shortcut 1', keys: 'Mod+Shift+1' },
  'model-2': { label: 'Model shortcut 2', keys: 'Mod+Shift+2' },
  'model-3': { label: 'Model shortcut 3', keys: 'Mod+Shift+3' },
  'model-4': { label: 'Model shortcut 4', keys: 'Mod+Shift+4' },
  'model-5': { label: 'Model shortcut 5', keys: 'Mod+Shift+5' },
  'model-6': { label: 'Model shortcut 6', keys: 'Mod+Shift+6' },
  'model-7': { label: 'Model shortcut 7', keys: 'Mod+Shift+7' },
  'model-8': { label: 'Model shortcut 8', keys: 'Mod+Shift+8' },
  'model-9': { label: 'Model shortcut 9', keys: 'Mod+Shift+9' },

  // Context-specific
  'save-file': { label: 'Save file', keys: 'Mod+S' },
} as const satisfies Record<string, ShortcutDef>

export type ShortcutId = keyof typeof SHORTCUTS

/**
 * Get the platform-aware display string for a shortcut.
 * e.g. "Mod+Shift+P" → "⌘⇧P" on Mac, "Ctrl+Shift+P" on Windows
 */
export function getShortcutDisplay(id: ShortcutId): string {
  return formatForDisplay(SHORTCUTS[id].keys)
}

/**
 * Get display string for a model shortcut slot (1-9).
 */
export function getModelShortcutDisplay(slot: string): string {
  const id = `model-${slot}` as ShortcutId
  return id in SHORTCUTS ? formatForDisplay(SHORTCUTS[id].keys) : `⇧${slot}`
}
