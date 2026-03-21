import { useEffect, useState } from 'react'
import { ListChecksIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getSessionPlanMode, onPlanModeEvent, setSessionPlanMode } from '@/lib/sessions'
import { cn } from '@/lib/utils'

export function PlanModeToggle({ sessionId }: { sessionId: string }): React.JSX.Element {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let disposed = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting loading state for new sessionId is intentional
    setLoading(true)

    void getSessionPlanMode(sessionId)
      .then((value) => {
        if (disposed) return
        setEnabled(value)
      })
      .finally(() => {
        if (disposed) return
        setLoading(false)
      })

    const unsubscribe = onPlanModeEvent((payload) => {
      if (payload.sessionId !== sessionId) return
      setEnabled(payload.enabled)
      setLoading(false)
      setPending(false)
    })

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [sessionId])

  async function handleToggle(): Promise<void> {
    if (loading || pending) return

    const next = !enabled
    setPending(true)
    setEnabled(next)

    const success = await setSessionPlanMode(sessionId, next)
    if (!success) {
      setEnabled(!next)
    }

    setPending(false)
  }

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
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
