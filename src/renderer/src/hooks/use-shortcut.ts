import { useEffect, useRef } from 'react'
import {
  matchesShortcut,
  isEditableTarget,
  type ShortcutId
} from '@/lib/shortcuts'
import { useShortcutRegistry } from '@/app/shortcut-provider'

/**
 * Register a keyboard shortcut by id. The handler fires on keydown when the
 * shortcut matches. Automatically cleans up on unmount.
 *
 * @param id       - Shortcut identifier from the registry
 * @param handler  - Callback to invoke
 * @param enabled  - Set to false to temporarily disable (default: true)
 */
export function useShortcut(
  id: ShortcutId,
  handler: () => void,
  enabled: boolean = true
): void {
  const registry = useShortcutRegistry()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return

    const def = registry.get(id)
    if (!def) return

    // Shortcuts that use only modifier+key are safe in inputs.
    // But if the shortcut has NO modifier (e.g. just "/"), skip when editing.
    const hasModifier = def.keys.toLowerCase().includes('mod') ||
      def.keys.toLowerCase().includes('alt')

    function onKeyDown(event: KeyboardEvent): void {
      if (!hasModifier && isEditableTarget(event)) return
      if (matchesShortcut(event, def!.keys)) {
        event.preventDefault()
        handlerRef.current()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [id, enabled, registry])
}
