import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileTextIcon, PlayIcon, XIcon } from 'lucide-react'

import { MessageResponse } from '@/components/ai-elements/message'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  getAgentMessages,
  onAgentMessages,
  sendSessionMessage,
  setSessionPlanMode,
  type AgentMessage
} from '@/lib/sessions'
import { extractLatestPlan, type SavedPlan } from '@/lib/plan'

const PLAN_PROSE =
  'text-[13.5px] leading-[21px] [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-[13px] [&_table]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-1.5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6'

export function PlanView({
  sessionId,
  onDismiss
}: {
  sessionId?: string
  onDismiss?: () => void
}): React.JSX.Element {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- resetting state for new sessionId is intentional */
    setMessages([])
    setLoaded(false)
    /* eslint-enable react-hooks/set-state-in-effect */

    if (!sessionId) {
      setLoaded(true)
      return
    }

    let disposed = false

    void getAgentMessages(sessionId)
      .then((nextMessages) => {
        if (disposed) return
        setMessages(nextMessages)
        setLoaded(true)
      })
      .catch(() => {
        if (disposed) return
        setLoaded(true)
      })

    const unsubscribe = onAgentMessages((payload) => {
      if (payload.sessionId !== sessionId) return
      setMessages(payload.messages)
      setLoaded(true)
    })

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [sessionId])

  const plan = useMemo(() => extractLatestPlan(messages), [messages])

  if (!sessionId || !loaded || !plan) {
    return <EmptyPlanState loaded={loaded} hasSession={Boolean(sessionId)} />
  }

  return <PublishedPlan sessionId={sessionId} plan={plan} onDismiss={onDismiss} />
}

function PublishedPlan({
  sessionId,
  plan,
  onDismiss
}: {
  sessionId: string
  plan: SavedPlan
  onDismiss?: () => void
}): React.JSX.Element {
  const [implementing, setImplementing] = useState(false)

  const handleImplement = useCallback(async (): Promise<void> => {
    if (implementing) return

    setImplementing(true)
    try {
      const planModeDisabled = await setSessionPlanMode(sessionId, false)
      if (!planModeDisabled) return

      await sendSessionMessage(
        sessionId,
        'Plan mode is now off. Use get_plan to read the published plan, then implement it starting with the first concrete step. If implementation reveals that the plan should change, use update_plan with the revised markdown.'
      )
    } finally {
      setImplementing(false)
    }
  }, [sessionId, implementing])

  const timeLabel = formatRelativeTime(plan.updatedAt)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate text-sm font-medium">{plan.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{timeLabel}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={() => void handleImplement()} disabled={implementing}>
                  {implementing ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <PlayIcon data-icon="inline-start" />
                  )}
                  Implement
                </Button>
              </TooltipTrigger>
              <TooltipContent>Turn off plan mode and start implementing this plan</TooltipContent>
            </Tooltip>
            {onDismiss ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={onDismiss}>
                    <XIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Dismiss plan</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
        {plan.summary ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{plan.summary}</p>
        ) : null}
      </div>

      {/* Markdown body */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 py-3">
          <MessageResponse className={PLAN_PROSE}>{plan.markdown}</MessageResponse>
        </div>
      </ScrollArea>
    </div>
  )
}

function EmptyPlanState({
  loaded,
  hasSession
}: {
  loaded: boolean
  hasSession: boolean
}): React.JSX.Element {
  const title = !hasSession ? 'No active session' : !loaded ? 'Loading…' : 'No plan yet'
  const description = !hasSession
    ? 'Open a session to view its plan.'
    : !loaded
      ? 'Fetching the latest plan.'
      : 'Toggle Plan mode in the composer, then ask the model to plan a task.'

  return (
    <div className="flex size-full items-center justify-center p-6 text-center">
      <div className="max-w-[220px] space-y-1.5">
        <FileTextIcon className="mx-auto size-5 text-muted-foreground/60" />
        <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground/70">{description}</p>
      </div>
    </div>
  )
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
