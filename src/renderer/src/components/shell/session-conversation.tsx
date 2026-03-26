import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  AlertCircleIcon,
  ArrowDownIcon,
  CornerDownRightIcon,
  SettingsIcon,
  WaypointsIcon,
  XIcon
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useStickToBottom } from 'use-stick-to-bottom'
import type { FileUIPart } from 'ai'

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments
} from '@/components/ai-elements/attachments'
import { ConversationEmptyState } from '@/components/ai-elements/conversation'
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments
} from '@/components/ai-elements/prompt-input'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useHotkey } from '@tanstack/react-hotkeys'
import { onBrowserGrab } from '@/lib/browser-grab'
import { isScrollContainerNearBottom } from '@/lib/chat-scroll'
import type {
  AgentMessage,
  PermissionRequest,
  QuestionRequest,
  Session,
  SessionImageInput
} from '@/lib/sessions'
import { clearSessionDraft, getSessionDraft, setSessionDraft } from '@/lib/session-drafts'
import { SHORTCUTS } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

import { ModelSelector } from './model-selector'
import { PermissionDock } from './permission-dock'
import { PermissionModeToggle } from './permission-mode-toggle'
import { PiMessages } from './pi-messages'
import { PlanModeToggle } from './plan-mode-toggle'
import { QuestionDock } from './question-dock'

export function SessionConversation(props: {
  session: Session
  messages: AgentMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingMessage: AgentMessage | null
  pendingMessages: string[]
  errorMessage: string | null
  questionRequest: QuestionRequest | null
  permissionRequest: PermissionRequest | null
  onSend: (text: string, images?: SessionImageInput[]) => Promise<void>
  onStop: () => Promise<void>
  onDismissError: () => void
  onQuestionDone: () => void
  onPermissionDone: () => void
}): React.JSX.Element {
  const { isLoading, isStreaming, onStop } = props
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
    resize: 'instant',
    initial: 'instant'
  })

  // Keep a ref to the scroll container for passing to child components
  // (e.g. PiMessages for scroll-preserving prepend)
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const setScrollRef = useCallback(
    (el: HTMLDivElement | null) => {
      scrollContainerRef.current = el
      // Forward to useStickToBottom
      ;(scrollRef as React.RefCallback<HTMLDivElement>)(el)
    },
    [scrollRef]
  )

  // Scroll to bottom on initial mount once messages are rendered
  const hasMessages = props.messages.length > 0
  useEffect(() => {
    if (hasMessages) {
      scrollToBottom('instant')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

  // Debounce isAtBottom so the scroll button doesn't flicker during fast scrolling
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  useEffect(() => {
    if (isAtBottom) {
      // Hide immediately when at bottom
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronous reset when at bottom is intentional
      setShowScrollBtn(false)
      return undefined
    }

    // Show after a short settle delay
    const id = setTimeout(() => setShowScrollBtn(true), 150)
    return () => clearTimeout(id)
  }, [isAtBottom])

  // --- Step 5: Composer / footer resize compensation ---
  // When the bottom-stack (pending pills + prompt) changes height, the scroll
  // viewport shrinks or grows. If the user is near bottom, restick. If not,
  // preserve the visible viewport position.
  const footerRef = useRef<HTMLDivElement>(null)
  const footerHeightRef = useRef(0)

  useLayoutEffect(() => {
    const footerEl = footerRef.current
    if (!footerEl || typeof ResizeObserver === 'undefined') return

    footerHeightRef.current = footerEl.getBoundingClientRect().height

    const observer = new ResizeObserver(([entry]) => {
      const nextHeight = entry.contentRect.height
      const prevHeight = footerHeightRef.current
      footerHeightRef.current = nextHeight

      if (Math.abs(nextHeight - prevHeight) < 0.5) return

      const scrollEl = scrollContainerRef.current
      if (!scrollEl) return

      if (isScrollContainerNearBottom(scrollEl)) {
        // User is at/near bottom — restick
        scrollToBottom('instant')
      } else {
        // User is reading above — compensate so their viewport stays put.
        // When the footer grows, the scroll viewport shrinks from the bottom,
        // which pushes content up. We offset scrollTop by the delta.
        const delta = nextHeight - prevHeight
        scrollEl.scrollTop += delta
      }
    })

    observer.observe(footerEl)
    return () => observer.disconnect()
  }, [scrollToBottom])

  // --- Step 6: Interaction-anchor compensation ---
  // When the user clicks an expand/collapse trigger (Thinking…, summary, etc.),
  // record the clicked element's position, then after the next frame adjust
  // scrollTop so the element doesn't jump away.
  const pendingInteractionAnchorRef = useRef<{ element: HTMLElement; top: number } | null>(null)
  const pendingAnchorFrameRef = useRef<number | null>(null)

  const cancelPendingAnchorAdjustment = useCallback(() => {
    if (pendingAnchorFrameRef.current !== null) {
      cancelAnimationFrame(pendingAnchorFrameRef.current)
      pendingAnchorFrameRef.current = null
    }
  }, [])

  const onMessagesClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const scrollEl = scrollContainerRef.current
      if (!scrollEl || !(event.target instanceof Element)) return

      const trigger = event.target.closest<HTMLElement>(
        'button, summary, [role="button"], [data-scroll-anchor-target]'
      )
      if (!trigger || !scrollEl.contains(trigger)) return
      if (trigger.closest('[data-scroll-anchor-ignore]')) return

      pendingInteractionAnchorRef.current = {
        element: trigger,
        top: trigger.getBoundingClientRect().top
      }

      cancelPendingAnchorAdjustment()
      pendingAnchorFrameRef.current = requestAnimationFrame(() => {
        pendingAnchorFrameRef.current = null
        const anchor = pendingInteractionAnchorRef.current
        pendingInteractionAnchorRef.current = null
        const activeScrollEl = scrollContainerRef.current
        if (!anchor || !activeScrollEl) return
        if (!anchor.element.isConnected || !activeScrollEl.contains(anchor.element)) return

        const nextTop = anchor.element.getBoundingClientRect().top
        const delta = nextTop - anchor.top
        if (Math.abs(delta) < 0.5) return

        activeScrollEl.scrollTop += delta
      })
    },
    [cancelPendingAnchorAdjustment]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelPendingAnchorAdjustment()
  }, [cancelPendingAnchorAdjustment])

  // --- Session keyboard shortcuts ---
  useHotkey(
    SHORTCUTS['stop-response'].keys,
    useCallback(() => {
      if (isLoading || isStreaming) {
        void onStop()
      }
    }, [isLoading, isStreaming, onStop])
  )

  useHotkey(
    SHORTCUTS['scroll-to-bottom'].keys,
    useCallback(() => scrollToBottom(), [scrollToBottom])
  )

  useHotkey(
    SHORTCUTS['focus-input'].keys,
    useCallback(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        'textarea[data-slot="input-group-control"]'
      )
      textarea?.focus()
    }, [])
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div
          ref={setScrollRef}
          className="h-full overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5 [overflow-anchor:none]"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent, black 32px, black)'
          }}
          onClickCapture={onMessagesClickCapture}
        >
          <div ref={contentRef} className="mx-auto flex min-h-full w-full max-w-[700px] flex-col">
            {props.messages.length === 0 && !props.isStreaming && !props.isLoading && (
              <ConversationEmptyState
                className="flex-1"
                icon={<WaypointsIcon className="size-8" />}
                title="New session"
                description="Send your first message to start this session."
              />
            )}
            <div className="flex flex-col gap-4">
              <PiMessages
                key={props.session.id}
                messages={props.messages}
                isStreaming={props.isStreaming}
                streamingMessage={props.streamingMessage}
                scrollContainerRef={scrollContainerRef}
              />
              {props.errorMessage && (
                <SessionError message={props.errorMessage} onDismiss={props.onDismissError} />
              )}
            </div>
          </div>
        </div>

        <Button
          className={cn(
            'absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md transition-all duration-200 dark:bg-background dark:hover:bg-muted',
            showScrollBtn
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-2 opacity-0'
          )}
          onClick={() => scrollToBottom()}
          size="icon"
          type="button"
          variant="outline"
        >
          <ArrowDownIcon className="size-4" />
        </Button>
      </div>

      {/* Footer stack — observed for height changes to compensate scroll position */}
      <div ref={footerRef} className="shrink-0">
        {/* Loading indicator — visible while the agent is working */}
        <div
          className={cn(
            'shrink-0 px-3 transition-opacity duration-300 sm:px-5',
            props.isLoading || props.isStreaming ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <div className="mx-auto w-full max-w-3xl">
            <div
              className="h-0.5 w-full overflow-hidden rounded-full bg-muted-foreground/10"
              style={{
                maskImage:
                  'linear-gradient(to right, transparent, black 15%, black 85%, transparent)'
              }}
            >
              <div className="h-full w-1/4 animate-shimmer rounded-full bg-primary/50" />
            </div>
          </div>
        </div>

        <div className="relative shrink-0">
          {/* Permission dock — highest priority overlay */}
          {props.permissionRequest && (
            <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 sm:px-5">
              <div className="mx-auto w-full max-w-3xl">
                <PermissionDock
                  key={props.permissionRequest.id}
                  request={props.permissionRequest}
                  onDone={props.onPermissionDone}
                />
              </div>
            </div>
          )}

          {/* Question dock — overlays the prompt input when the AI asks a question */}
          {!props.permissionRequest && props.questionRequest && (
            <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 sm:px-5">
              <div className="mx-auto w-full max-w-3xl">
                <QuestionDock request={props.questionRequest} onDone={props.onQuestionDone} />
              </div>
            </div>
          )}

          <div className={cn((props.questionRequest || props.permissionRequest) && 'invisible')}>
            <SessionPromptInput
              session={props.session}
              isLoading={props.isLoading}
              isStreaming={props.isStreaming}
              pendingMessages={props.pendingMessages}
              blocked={!!props.questionRequest || !!props.permissionRequest}
              onSend={props.onSend}
              onStop={props.onStop}
            />
          </div>
        </div>
      </div>
      {/* /footer stack */}
    </div>
  )
}

function SessionPromptInput({
  session,
  isLoading,
  isStreaming,
  pendingMessages,
  blocked,
  onSend,
  onStop
}: {
  session: Session
  isLoading: boolean
  isStreaming: boolean
  pendingMessages: string[]
  blocked: boolean
  onSend: (text: string, images?: SessionImageInput[]) => Promise<void>
  onStop: () => Promise<void>
}): React.JSX.Element {
  const [draftSessionId, setDraftSessionId] = useState(session.id)
  const [input, setInput] = useState(() => getSessionDraft(session.id))

  if (draftSessionId !== session.id) {
    setDraftSessionId(session.id)
    setInput(getSessionDraft(session.id))
  }

  useEffect(() => {
    setSessionDraft(session.id, input)
  }, [input, session.id])

  // Subscribe to react-grab element selections from the BrowserView.
  // When context is grabbed, append it to the prompt input.
  useEffect(() => {
    return onBrowserGrab((event) => {
      const contextBlock = `\`\`\`html\n${event.content}\n\`\`\`\n\n`
      setInput((prev) => {
        // If the input already has content, append on a new line
        if (prev.trim()) {
          return prev + '\n' + contextBlock
        }
        return contextBlock
      })

      // Focus the textarea so the user can immediately type their instruction
      requestAnimationFrame(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>(
          'textarea[data-slot="input-group-control"]'
        )
        if (textarea) {
          textarea.focus()
          // Move cursor to the end
          textarea.selectionStart = textarea.value.length
          textarea.selectionEnd = textarea.value.length
        }
      })
    })
  }, [])

  const handleSubmit = useCallback(
    (message: { text: string; files: FileUIPart[] }): void => {
      const text = message.text.trim()
      if (!text && message.files.length === 0) return
      clearSessionDraft(session.id)
      setInput('')

      const images: SessionImageInput[] = []
      for (const file of message.files) {
        if (file.mediaType?.startsWith('image/') && file.url) {
          const match = file.url.match(/^data:([^;]+);base64,(.+)$/)
          if (match) {
            images.push({ data: match[2], mimeType: match[1] })
          }
        }
      }

      void onSend(text || 'Describe this image', images.length > 0 ? images : undefined)
    },
    [onSend, session.id]
  )

  return (
    <div className="shrink-0 px-3 pb-3 sm:px-5">
      <div className="mx-auto w-full max-w-3xl">
        {/* Pending message pills — from SDK queue via streaming events */}
        {pendingMessages.length > 0 && (
          <div className="mb-2 animate-fade-in-up overflow-hidden rounded-lg border border-border bg-muted/50">
            {pendingMessages.map((msg, i) => (
              <div
                key={`${i}-${msg}`}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5',
                  i !== pendingMessages.length - 1 && 'border-b border-border/50'
                )}
              >
                <CornerDownRightIcon className="size-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{msg}</span>
              </div>
            ))}
          </div>
        )}

        <PromptInput
          onSubmit={(message) => handleSubmit(message)}
          accept="image/*"
          className={cn(
            'w-full [&_[data-slot=input-group]]:transition-none',
            blocked && 'pointer-events-none opacity-50'
          )}
        >
          <AttachmentBar />
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              disabled={blocked}
              placeholder={
                blocked
                  ? 'Respond above to continue…'
                  : isStreaming
                    ? 'Send to steer…'
                    : session.status === 'draft'
                      ? 'Send first message…'
                      : 'Send follow-up…'
              }
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <ModelSelector sessionId={session.id} />
              <PlanModeToggle sessionId={session.id} />
              <PermissionModeToggle sessionId={session.id} />
            </PromptInputTools>
            <PromptInputSubmit
              status={
                isStreaming && !input.trim() ? 'streaming' : isLoading ? 'submitted' : undefined
              }
              onStop={() => void onStop()}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

function SessionError({
  message,
  onDismiss
}: {
  message: string
  onDismiss: () => void
}): React.JSX.Element {
  const isApiKeyError = message.toLowerCase().includes('no api key')

  return (
    <Alert variant="destructive" className="animate-fade-in-up">
      <AlertCircleIcon />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>
        {message}
        {isApiKeyError && (
          <>
            {' '}
            <Link
              to="/settings"
              className="inline-flex items-center gap-1 font-medium underline underline-offset-3 hover:text-foreground"
            >
              <SettingsIcon className="size-3" />
              Open Settings
            </Link>
          </>
        )}
      </AlertDescription>
      <AlertAction>
        <Button variant="ghost" size="icon" className="size-6" onClick={onDismiss}>
          <XIcon />
          <span className="sr-only">Dismiss</span>
        </Button>
      </AlertAction>
    </Alert>
  )
}

function AttachmentBar(): React.JSX.Element | null {
  const { files, remove } = usePromptInputAttachments()

  if (files.length === 0) return null

  return (
    <PromptInputHeader>
      <Attachments variant="grid">
        {files.map((file) => (
          <Attachment key={file.id} data={file} onRemove={() => remove(file.id)}>
            <AttachmentPreview />
            <AttachmentRemove />
          </Attachment>
        ))}
      </Attachments>
    </PromptInputHeader>
  )
}
