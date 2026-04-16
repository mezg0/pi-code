import { useCallback } from 'react'
import {
  CheckIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldIcon,
  ShieldQuestionIcon
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSessionPermissionMode, useSessionRuntimeMutations } from '@/lib/session-runtime-query'
import { useShortcutAction } from '@/lib/shortcut-actions'
import { getShortcutDisplay } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'
import type { PermissionMode } from '@/lib/sessions'

const MODE_CONFIG: Record<
  PermissionMode,
  {
    label: string
    description: string
    icon: typeof ShieldIcon
    buttonClass: string
  }
> = {
  ask: {
    label: 'Ask',
    description: 'Approve bash, edit, write',
    icon: ShieldQuestionIcon,
    buttonClass: ''
  },
  auto: {
    label: 'Auto',
    description: 'Allow all tools and external directory access automatically',
    icon: ShieldCheckIcon,
    buttonClass:
      'border-green-500/30 bg-green-500/5 text-green-600 hover:bg-green-500/10 dark:text-green-400'
  },
  strict: {
    label: 'Strict',
    description: 'Approve every tool call',
    icon: ShieldAlertIcon,
    buttonClass:
      'border-orange-500/30 bg-orange-500/5 text-orange-600 hover:bg-orange-500/10 dark:text-orange-400'
  }
}

const MODES: PermissionMode[] = ['ask', 'auto', 'strict']

export function PermissionModeToggle({ sessionId }: { sessionId: string }): React.JSX.Element {
  const permissionModeQuery = useSessionPermissionMode(sessionId)
  const { setPermissionMode } = useSessionRuntimeMutations(sessionId)

  const mode = permissionModeQuery.data ?? 'ask'
  const loading = permissionModeQuery.isPending
  const pending = setPermissionMode.isPending

  async function handleSetMode(newMode: PermissionMode): Promise<void> {
    if (loading || pending || newMode === mode) return
    await setPermissionMode.mutateAsync(newMode)
  }

  useShortcutAction(
    'cycle-permission-mode',
    useCallback(() => {
      if (loading || pending) return
      const currentIndex = MODES.indexOf(mode)
      const nextMode = MODES[(currentIndex + 1) % MODES.length]
      void setPermissionMode.mutateAsync(nextMode)
    }, [loading, mode, pending, setPermissionMode])
  )

  const config = MODE_CONFIG[mode]
  const Icon = config.icon
  const cycleShortcut = getShortcutDisplay('cycle-permission-mode')

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant={mode === 'ask' ? 'ghost' : 'outline'}
              size="sm"
              className={cn(
                'gap-1.5 transition-colors',
                mode !== 'ask' && config.buttonClass,
                pending && 'pointer-events-none opacity-70'
              )}
              aria-disabled={loading || pending}
            >
              {pending ? <Spinner className="size-3.5" /> : <Icon className="size-3.5" />}
              {config.label}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Permission mode: {config.label.toLowerCase()}{' '}
          <kbd className="ml-1.5 inline-flex font-sans text-[11px] opacity-60">{cycleShortcut}</kbd>
          <br />
          <span className="text-[10px] opacity-60">{config.description}</span>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-56">
        {MODES.map((m) => {
          const c = MODE_CONFIG[m]
          const ModeIcon = c.icon
          const isActive = m === mode
          return (
            <DropdownMenuItem
              key={m}
              onClick={() => void handleSetMode(m)}
              className={cn(isActive && 'bg-accent')}
            >
              <ModeIcon className="size-4" />
              <div className="flex flex-1 flex-col">
                <span className="text-[13px] font-medium">{c.label}</span>
                <span className="text-[11px] text-muted-foreground">{c.description}</span>
              </div>
              {isActive && <CheckIcon className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
