import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { DEFAULT_SHORTCUTS, type ShortcutDef, type ShortcutId } from '@/lib/shortcuts'

type ShortcutRegistry = Map<ShortcutId, ShortcutDef>

const ShortcutContext = createContext<ShortcutRegistry | null>(null)

/**
 * Provides the shortcut registry to the component tree.
 * In the future, this can accept user overrides and merge them with defaults.
 */
export function ShortcutProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const registry = useMemo(() => {
    const map = new Map<ShortcutId, ShortcutDef>()
    for (const def of DEFAULT_SHORTCUTS) {
      map.set(def.id, def)
    }
    return map
  }, [])

  return <ShortcutContext value={registry}>{children}</ShortcutContext>
}

/**
 * Returns the full shortcut registry map. Used by `useShortcut` hook.
 */
export function useShortcutRegistry(): ShortcutRegistry {
  const ctx = useContext(ShortcutContext)
  if (!ctx) {
    throw new Error('useShortcutRegistry must be used within a ShortcutProvider')
  }
  return ctx
}

/**
 * Returns all shortcut definitions as an array. Useful for rendering
 * shortcut lists in settings or help panels.
 */
export function useAllShortcuts(): ShortcutDef[] {
  const registry = useShortcutRegistry()
  return useMemo(() => Array.from(registry.values()), [registry])
}
