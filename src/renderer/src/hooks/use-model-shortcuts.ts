import { useCallback } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useQueryClient } from '@tanstack/react-query'

import { loadModelShortcuts } from '@/lib/model-shortcuts'
import { sessionKeys } from '@/lib/query-keys'
import { setSessionModel, setSessionThinking } from '@/lib/sessions'
import { SHORTCUTS } from '@/lib/shortcuts'

export function useModelShortcuts(sessionId: string | undefined): void {
  const queryClient = useQueryClient()
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
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: sessionKeys.runtimeState(sessionId) }),
            queryClient.invalidateQueries({ queryKey: sessionKeys.availableModels(sessionId) })
          ])
        }
      })()
    },
    [queryClient, sessionId]
  )

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
