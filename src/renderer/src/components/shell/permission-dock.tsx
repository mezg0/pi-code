import { memo, useCallback, useEffect, useState } from 'react'
import { ShieldAlertIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
  const [rejecting, setRejecting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const handleDecision = useCallback(
    async (response: 'once' | 'always' | 'reject', message?: string) => {
      if (sending) return
      setSending(true)
      try {
        await permissionReply(request.id, response, message)
        onDone()
      } catch {
        setSending(false)
      }
    },
    [sending, request.id, onDone]
  )

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (sending) return

      if (e.key === 'Escape') {
        e.preventDefault()
        if (rejecting) {
          setRejecting(false)
          return
        }
        void handleDecision('reject')
      }

      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLInputElement)
      ) {
        e.preventDefault()
        if (!rejecting) {
          void handleDecision('once')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDecision, rejecting, sending])

  const label = getPermissionLabel(request)
  const sourceLabel =
    request.permission === request.toolName ? null : getToolLabel(request.toolName)
  const detail = getPrimaryDetail(request)
  const diff = getDiffPreview(request)
  const diffTruncated = Boolean(request.metadata.diffTruncated)
  const patterns = getPatternList(request)

  return (
    <div className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <ShieldAlertIcon className="size-4 text-orange-500" />
        <span className="text-[13px] font-medium text-foreground">Permission Required</span>
        <span className="text-xs text-muted-foreground">— {label}</span>
        {sourceLabel && <span className="text-xs text-muted-foreground/70">via {sourceLabel}</span>}
      </div>

      <div className="space-y-2.5 px-3 py-2.5">
        {detail ? (
          <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
            <code className="break-all text-[12.5px] text-foreground">{detail}</code>
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">{request.description}</p>
        )}

        {patterns.length > 0 && request.permission === 'external_directory' && (
          <div className="rounded-md border border-border/70 bg-background/40 px-2.5 py-2">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Allow for session
            </p>
            <div className="space-y-1">
              {patterns.map((pattern) => (
                <code key={pattern} className="block break-all text-[12px] text-foreground/90">
                  {pattern}
                </code>
              ))}
            </div>
          </div>
        )}

        {diff && (
          <div className="overflow-hidden rounded-md border border-border/70 bg-background/40">
            <div className="flex items-center justify-between border-b border-border/70 px-2.5 py-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Diff preview
              </span>
              {diffTruncated && (
                <span className="text-[11px] text-muted-foreground">truncated</span>
              )}
            </div>
            <div className="max-h-64 overflow-auto px-2 py-1.5 font-mono text-[12px] leading-5">
              {diff.split('\n').map((line, index) => (
                <div key={`${request.id}-diff-${index}`} className={diffLineClassName(line)}>
                  {line || ' '}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border px-3 py-2">
        {rejecting ? (
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-[12px] font-medium text-foreground">
                Tell Pi what to do differently
              </p>
              <p className="text-[12px] text-muted-foreground">
                Optional feedback helps the agent adjust instead of retrying the same action.
              </p>
            </div>
            <Textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Don’t edit that file — update the test instead."
              disabled={sending}
              rows={3}
              className="min-h-20 resize-none text-[13px]"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] text-muted-foreground/70">Esc to go back</div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={sending}
                  onClick={() => setRejecting(false)}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={sending}
                  onClick={() => void handleDecision('reject', feedback.trim() || undefined)}
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                Esc
              </kbd>
              <span>deny</span>
              <span className="mx-1">·</span>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                ↵
              </kbd>
              <span>allow once</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                disabled={sending}
                onClick={() => setRejecting(true)}
                className="text-muted-foreground"
              >
                Deny…
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
        )}
      </div>
    </div>
  )
})

function getPermissionLabel(request: PermissionRequest): string {
  if (request.permission === 'external_directory') {
    return 'External directory access'
  }
  return getToolLabel(request.toolName)
}

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

function getPrimaryDetail(request: PermissionRequest): string | null {
  const { permission, metadata, toolName, input } = request

  if (permission === 'external_directory') {
    const path = metadata.filepath ?? metadata.parentDir
    if (typeof path === 'string') return path

    const command = metadata.command
    if (typeof command === 'string') return command
  }

  if (toolName === 'bash') {
    const command = input.command
    if (typeof command === 'string') return command
  }

  if (toolName === 'edit' || toolName === 'write' || toolName === 'read') {
    const path = input.path ?? input.filePath ?? input.file_path
    if (typeof path === 'string') return path
  }

  if (toolName === 'grep') {
    const path = input.path ?? input.filePath ?? input.file_path
    if (typeof path === 'string') return path

    const pattern = input.pattern ?? input.regex
    if (typeof pattern === 'string') return pattern
  }

  if (toolName === 'find') {
    const path = input.path ?? input.directory
    if (typeof path === 'string') return path

    const pattern = input.pattern ?? input.glob
    if (typeof pattern === 'string') return pattern
  }

  if (toolName === 'ls') {
    const path = input.path ?? input.directory
    if (typeof path === 'string') return path
  }

  return null
}

function getPatternList(request: PermissionRequest): string[] {
  if (request.permission !== 'external_directory') return []
  return request.always.filter((pattern): pattern is string => typeof pattern === 'string')
}

function getDiffPreview(request: PermissionRequest): string | null {
  const diff = request.metadata.diff
  return typeof diff === 'string' && diff.trim() ? diff : null
}

function diffLineClassName(line: string): string {
  return cn(
    'whitespace-pre',
    line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')
      ? 'text-sky-400'
      : line.startsWith('+')
        ? 'bg-emerald-500/10 text-emerald-300'
        : line.startsWith('-')
          ? 'bg-red-500/10 text-red-300'
          : 'text-foreground/85'
  )
}
