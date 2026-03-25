// ---------------------------------------------------------------------------
// Model Shortcut Persistence
// ---------------------------------------------------------------------------
// Users can assign up to 9 model + thinking-level combos to keyboard shortcuts
// (Mod+Shift+1 through Mod+Shift+9). This module manages localStorage I/O.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'pi.model-shortcuts'

/** A single model shortcut assignment. */
export type ModelShortcut = {
  /** Provider identifier, e.g. "openai" */
  provider: string
  /** Model identifier, e.g. "gpt-5.4" */
  modelId: string
  /** Thinking level to set, or null if model doesn't support it / user doesn't want to change it */
  thinkingLevel: string | null
  /** Human-readable display label, e.g. "gpt-5.4 · high" */
  label: string
}

/** Map from slot key ("1"–"9") to shortcut assignment. Missing keys = unassigned. */
export type ModelShortcutMap = Partial<Record<string, ModelShortcut>>

/** Valid slot identifiers. */
export const SHORTCUT_SLOTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
export type ShortcutSlot = (typeof SHORTCUT_SLOTS)[number]

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

export function loadModelShortcuts(): ModelShortcutMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as ModelShortcutMap
  } catch {
    return {}
  }
}

export function saveModelShortcuts(map: ModelShortcutMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage errors to avoid breaking the UI.
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export function getModelShortcut(slot: string): ModelShortcut | null {
  const map = loadModelShortcuts()
  return map[slot] ?? null
}

export function setModelShortcut(slot: string, shortcut: ModelShortcut | null): void {
  const map = loadModelShortcuts()
  if (shortcut) {
    map[slot] = shortcut
  } else {
    delete map[slot]
  }
  saveModelShortcuts(map)
}

export function removeModelShortcut(slot: string): void {
  setModelShortcut(slot, null)
}

/**
 * Build a display label for a model + thinking level combo.
 * e.g. "gpt-5.4" or "gpt-5.4 · high"
 */
export function buildShortcutLabel(modelId: string, thinkingLevel: string | null): string {
  if (thinkingLevel && thinkingLevel !== 'off') {
    return `${modelId} · ${thinkingLevel}`
  }
  return modelId
}

/**
 * Find the slot number assigned to a given provider + modelId combo.
 * Returns the slot string (e.g. "1") or null if not assigned.
 */
export function findSlotForModel(provider: string, modelId: string): string | null {
  const map = loadModelShortcuts()
  for (const [slot, shortcut] of Object.entries(map)) {
    if (shortcut && shortcut.provider === provider && shortcut.modelId === modelId) {
      return slot
    }
  }
  return null
}
