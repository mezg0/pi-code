import { useCallback } from 'react'
import { ListChecksIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSessionPlanMode, useSessionRuntimeMutations } from '@/lib/session-runtime-query'
import { useShortcutAction } from '@/lib/shortcut-actions'
import { getShortcutDisplay } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

export function PlanModeToggle({ sessionId }: { sessionId: string }): React.JSX.Element {
  const planModeQuery = useSessionPlanMode(sessionId)
  const { setPlanMode } = useSessionRuntimeMutations(sessionId)

  const enabled = planModeQuery.data ?? false
  const loading = planModeQuery.isPending
  const pending = setPlanMode.isPending

  const handleToggle = useCallback(async (): Promise<void> => {
    if (loading || pending) return
    await setPlanMode.mutateAsync(!enabled)
  }, [enabled, loading, pending, setPlanMode])

  useShortcutAction(
    'toggle-plan-mode',
    useCallback(() => void handleToggle(), [handleToggle])
  )

  const shortcutHint = getShortcutDisplay('toggle-plan-mode')
  const label = enabled ? 'Plan mode on — read‑only' : 'Plan mode off'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={enabled ? 'outline' : 'ghost'}
          size="sm"
          className={cn(
            'gap-1.5 transition-colors',
            enabled && 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10',
            pending && 'pointer-events-none opacity-70'
          )}
          onClick={() => void handleToggle()}
          aria-pressed={enabled}
          aria-disabled={loading || pending}
        >
          {pending ? <Spinner className="size-3.5" /> : <ListChecksIcon className="size-3.5" />}
          Plan
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}{' '}
        <kbd className="ml-1.5 inline-flex font-sans text-[11px] opacity-60">{shortcutHint}</kbd>
      </TooltipContent>
    </Tooltip>
  )
}
