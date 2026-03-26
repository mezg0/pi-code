import { memo, useCallback, useEffect, useState } from 'react'
import { ShieldAlertIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { PermissionRequest } from '@/lib/sessions'
import { permissionReply } from '@/lib/sessions'
import { cn } from '@/lib/utils'

export const PermissionDock = memo(function PermissionDock({
  request,
  onDone
}: {
  request: PermissionRequest
  onDone: () => void
}): React.JSX.Element {
  const [sending, setSending] = useState(false)

  // Keyboard handling
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (sending) return

      if (e.key === 'Escape') {
        e.preventDefault()
        void handleDecision('reject')
      }

      // Enter = allow once (only when not in an input)
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLInputElement)
      ) {
        e.preventDefault()
        void handleDecision('once')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sending]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDecision = useCallback(
    async (response: 'once' | 'always' | 'reject') => {
      if (sending) return
      setSending(true)
      try {
        await permissionReply(request.id, response)
        onDone()
      } catch {
        setSending(false)
      }
    },
    [sending, request.id, onDone]
  )

  // Extract display info from the request
  const toolLabel = getToolLabel(request.toolName)
  const detail = getToolDetail(request)

  return (
    <div className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <ShieldAlertIcon className="size-4 text-orange-500" />
        <span className="text-[13px] font-medium text-foreground">Permission Required</span>
        <span className="text-xs text-muted-foreground">— {toolLabel}</span>
      </div>

      {/* Detail */}
      <div className="px-3 py-2.5">
        {detail && (
          <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
            <code className="break-all text-[12.5px] text-foreground">{detail}</code>
          </div>
        )}
        {!detail && (
          <p className="text-[13px] text-muted-foreground">{request.description}</p>
        )}
      </div>

      {/* Footer with actions */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            Esc
          </kbd>
          <span>deny</span>
          <span className="mx-1">·</span>
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ↵
          </kbd>
          <span>allow</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            disabled={sending}
            onClick={() => void handleDecision('reject')}
            className="text-muted-foreground"
          >
            Deny
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={sending}
            onClick={() => void handleDecision('always')}
          >
            Allow for Session
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={sending}
            onClick={() => void handleDecision('once')}
          >
            Allow Once
          </Button>
        </div>
      </div>
    </div>
  )
})

function getToolLabel(toolName: string): string {
  switch (toolName) {
    case 'bash':
      return 'Shell command'
    case 'edit':
      return 'Edit file'
    case 'write':
      return 'Write file'
    case 'read':
      return 'Read file'
    case 'grep':
      return 'Search'
    case 'find':
      return 'Find files'
    case 'ls':
      return 'List directory'
    default:
      return toolName
  }
}

function getToolDetail(request: PermissionRequest): string | null {
  const { toolName, input } = request

  if (toolName === 'bash') {
    const command = input.command
    if (typeof command === 'string') return command
  }

  if (toolName === 'edit' || toolName === 'write' || toolName === 'read') {
    const path = input.path ?? input.filePath ?? input.file_path
    if (typeof path === 'string') return path
  }

  if (toolName === 'grep') {
    const pattern = input.pattern ?? input.regex
    if (typeof pattern === 'string') return pattern
  }

  if (toolName === 'find') {
    const pattern = input.pattern ?? input.glob
    if (typeof pattern === 'string') return pattern
  }

  if (toolName === 'ls') {
    const path = input.path ?? input.directory
    if (typeof path === 'string') return path
  }

  return null
}
