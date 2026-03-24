// ---------------------------------------------------------------------------
// Keyboard Shortcut Registry
// ---------------------------------------------------------------------------
// All app shortcuts are defined here in a single array. To change a binding,
// just edit the `keys` string. The format is:
//   "mod+shift+k"  — "mod" = ⌘ on Mac, Ctrl elsewhere
//   "mod+1"        — number keys
//   "mod+\\"       — backslash (escaped)
//
// Supported modifiers: mod, shift, alt
// The key portion is matched against `event.key` (lowercased).
// ---------------------------------------------------------------------------

export type ShortcutId =
  | 'toggle-sidebar'
  | 'new-session'
  | 'open-settings'
  | 'toggle-panel'
  | 'focus-input'
  | 'toggle-plan-mode'
  | 'open-commit'
  | 'tab-plan'
  | 'tab-git'
  | 'tab-terminal'
  | 'tab-files'
  | 'tab-browser'
  | 'save-file'
  | 'scroll-to-bottom'

export type ShortcutScope = 'global' | 'session'

export interface ShortcutDef {
  id: ShortcutId
  label: string
  /** Key combo string, e.g. "mod+b", "mod+shift+p" */
  keys: string
  scope: ShortcutScope
}

// ---- Default shortcut definitions ----------------------------------------

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  // Global
  { id: 'toggle-sidebar', label: 'Toggle sidebar', keys: 'mod+b', scope: 'global' },
  { id: 'new-session', label: 'New session', keys: 'mod+n', scope: 'global' },
  { id: 'open-settings', label: 'Open settings', keys: 'mod+,', scope: 'global' },

  // Session-scoped
  { id: 'toggle-panel', label: 'Toggle panel', keys: 'mod+e', scope: 'session' },
  { id: 'focus-input', label: 'Focus chat input', keys: 'mod+k', scope: 'session' },
  { id: 'toggle-plan-mode', label: 'Toggle plan mode', keys: 'mod+shift+p', scope: 'session' },
  { id: 'open-commit', label: 'Open commit dialog', keys: 'mod+shift+c', scope: 'session' },
  { id: 'scroll-to-bottom', label: 'Scroll to bottom', keys: 'mod+arrowdown', scope: 'session' },

  // Tool tabs
  { id: 'tab-plan', label: 'Plan tab', keys: 'mod+1', scope: 'session' },
  { id: 'tab-git', label: 'Git tab', keys: 'mod+2', scope: 'session' },
  { id: 'tab-terminal', label: 'Terminal tab', keys: 'mod+3', scope: 'session' },
  { id: 'tab-files', label: 'Files tab', keys: 'mod+4', scope: 'session' },
  { id: 'tab-browser', label: 'Browser tab', keys: 'mod+5', scope: 'session' },

  // Context-specific
  { id: 'save-file', label: 'Save file', keys: 'mod+s', scope: 'session' }
]

// ---- Shortcut matching ----------------------------------------------------

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

interface ParsedShortcut {
  mod: boolean
  shift: boolean
  alt: boolean
  key: string // lowercased
}

function parseKeys(keys: string): ParsedShortcut {
  const parts = keys.toLowerCase().split('+')
  return {
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts.filter((p) => p !== 'mod' && p !== 'shift' && p !== 'alt').join('+') || ''
  }
}

/**
 * Returns true if the keyboard event matches the given shortcut key string.
 */
export function matchesShortcut(event: KeyboardEvent, keys: string): boolean {
  const parsed = parseKeys(keys)

  const modPressed = isMac ? event.metaKey : event.ctrlKey
  if (parsed.mod && !modPressed) return false
  if (!parsed.mod && modPressed) return false

  if (parsed.shift !== event.shiftKey) return false
  if (parsed.alt !== event.altKey) return false

  return event.key.toLowerCase() === parsed.key
}

/**
 * Check if the event target is an editable field where single-key shortcuts
 * should not fire (inputs, textareas, contenteditable).
 */
export function isEditableTarget(event: KeyboardEvent): boolean {
  const el = event.target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

// ---- Display formatting ---------------------------------------------------

const MAC_SYMBOLS: Record<string, string> = {
  mod: '⌘',
  shift: '⇧',
  alt: '⌥',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  backspace: '⌫',
  delete: '⌦',
  enter: '↩',
  escape: 'Esc',
  tab: '⇥',
  ' ': 'Space',
  '\\': '\\'
}

const PC_SYMBOLS: Record<string, string> = {
  mod: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  backspace: 'Backspace',
  delete: 'Delete',
  enter: 'Enter',
  escape: 'Esc',
  tab: 'Tab',
  ' ': 'Space',
  '\\': '\\'
}

/**
 * Formats a key string for display. Returns platform-aware symbols.
 * e.g. "mod+shift+p" → "⌘⇧P" on Mac, "Ctrl+Shift+P" on PC
 */
export function formatShortcut(keys: string): string {
  const symbols = isMac ? MAC_SYMBOLS : PC_SYMBOLS
  const parts = keys.toLowerCase().split('+')

  if (isMac) {
    // Mac uses compact symbol notation without separators
    return parts
      .map((p) => symbols[p] ?? p.toUpperCase())
      .join('')
  }

  // PC uses "Ctrl+Shift+P" style
  return parts
    .map((p) => symbols[p] ?? p.toUpperCase())
    .join('+')
}

// ---- Lookup helper --------------------------------------------------------

const shortcutMap = new Map<ShortcutId, ShortcutDef>()
for (const def of DEFAULT_SHORTCUTS) {
  shortcutMap.set(def.id, def)
}

export function getShortcut(id: ShortcutId): ShortcutDef | undefined {
  return shortcutMap.get(id)
}

export function getShortcutDisplay(id: ShortcutId): string {
  const def = shortcutMap.get(id)
  return def ? formatShortcut(def.keys) : ''
}
