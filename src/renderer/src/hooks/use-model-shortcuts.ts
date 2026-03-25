import { useCallback } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'

import { loadModelShortcuts } from '@/lib/model-shortcuts'
import { setSessionModel, setSessionThinking } from '@/lib/sessions'
import { SHORTCUTS } from '@/lib/shortcuts'

/** Custom event name dispatched after a model shortcut is applied. */
export const MODEL_SHORTCUT_APPLIED_EVENT = 'pi:model-shortcut-applied'

/**
 * Register Mod+Shift+1 through Mod+Shift+9 hotkeys that switch the active
 * session's model (and optionally thinking level) based on user-configured
 * model shortcuts stored in localStorage.
 */
export function useModelShortcuts(sessionId: string | undefined): void {
  const enabled = Boolean(sessionId)

  const applyShortcut = useCallback(
    (slot: string) => {
      if (!sessionId) return
      const shortcut = loadModelShortcuts()[slot]
      if (!shortcut) return

      void (async () => {
        const ok = await setSessionModel(sessionId, shortcut.provider, shortcut.modelId)
        if (ok && shortcut.thinkingLevel) {
          await setSessionThinking(sessionId, shortcut.thinkingLevel)
        }
        if (ok) {
          window.dispatchEvent(new CustomEvent(MODEL_SHORTCUT_APPLIED_EVENT))
        }
      })()
    },
    [sessionId]
  )

  // Each useHotkey call below corresponds to a fixed slot (1–9).
  // The hooks are always called in the same order.
  const cb1 = useCallback(() => applyShortcut('1'), [applyShortcut])
  const cb2 = useCallback(() => applyShortcut('2'), [applyShortcut])
  const cb3 = useCallback(() => applyShortcut('3'), [applyShortcut])
  const cb4 = useCallback(() => applyShortcut('4'), [applyShortcut])
  const cb5 = useCallback(() => applyShortcut('5'), [applyShortcut])
  const cb6 = useCallback(() => applyShortcut('6'), [applyShortcut])
  const cb7 = useCallback(() => applyShortcut('7'), [applyShortcut])
  const cb8 = useCallback(() => applyShortcut('8'), [applyShortcut])
  const cb9 = useCallback(() => applyShortcut('9'), [applyShortcut])

  useHotkey(SHORTCUTS['model-1'].keys, cb1, { enabled })
  useHotkey(SHORTCUTS['model-2'].keys, cb2, { enabled })
  useHotkey(SHORTCUTS['model-3'].keys, cb3, { enabled })
  useHotkey(SHORTCUTS['model-4'].keys, cb4, { enabled })
  useHotkey(SHORTCUTS['model-5'].keys, cb5, { enabled })
  useHotkey(SHORTCUTS['model-6'].keys, cb6, { enabled })
  useHotkey(SHORTCUTS['model-7'].keys, cb7, { enabled })
  useHotkey(SHORTCUTS['model-8'].keys, cb8, { enabled })
  useHotkey(SHORTCUTS['model-9'].keys, cb9, { enabled })
}
