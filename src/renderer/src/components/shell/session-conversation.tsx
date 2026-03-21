import { useCallback, useEffect, useState } from 'react'
import { ArrowDownIcon, CornerDownRightIcon, WaypointsIcon } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import type { AgentMessage, Session, SessionImageInput } from '@/lib/sessions'
import { cn } from '@/lib/utils'

import { ModelSelector } from './model-selector'
import { PiMessages } from './pi-messages'
import { PlanModeToggle } from './plan-mode-toggle'

export function SessionConversation(props: {
  session: Session
  messages: AgentMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingMessage: AgentMessage | null
  pendingMessages: string[]
  onSend: (text: string, images?: SessionImageInput[]) => Promise<void>
  onStop: () => Promise<void>
}): React.JSX.Element {
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
    resize: 'instant',
    initial: 'instant'
  })

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="h-full overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5 [overflow-anchor:none]"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent, black 32px, black)'
          }}
        >
          <div ref={contentRef} className="mx-auto flex min-h-full w-full max-w-[700px] flex-col">
            {props.messages.length === 0 && !props.isStreaming && !props.isLoading ? (
              <ConversationEmptyState
                className="flex-1"
                icon={<WaypointsIcon className="size-8" />}
                title="New session"
                description="Send your first message to start this session."
              />
            ) : (
              <div className="flex flex-col gap-4">
                <PiMessages
                  key={props.session.id}
                  messages={props.messages}
                  isStreaming={props.isStreaming}
                  streamingMessage={props.streamingMessage}
                />
              </div>
            )}
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
              maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)'
            }}
          >
            <div className="h-full w-1/4 animate-shimmer rounded-full bg-primary/50" />
          </div>
        </div>
      </div>

      <SessionPromptInput
        session={props.session}
        isLoading={props.isLoading}
        isStreaming={props.isStreaming}
        pendingMessages={props.pendingMessages}
        onSend={props.onSend}
        onStop={props.onStop}
      />
    </div>
  )
}

function SessionPromptInput({
  session,
  isLoading,
  isStreaming,
  pendingMessages,
  onSend,
  onStop
}: {
  session: Session
  isLoading: boolean
  isStreaming: boolean
  pendingMessages: string[]
  onSend: (text: string, images?: SessionImageInput[]) => Promise<void>
  onStop: () => Promise<void>
}): React.JSX.Element {
  const [input, setInput] = useState('')

  const handleSubmit = useCallback(
    (message: { text: string; files: FileUIPart[] }): void => {
      const text = message.text.trim()
      if (!text && message.files.length === 0) return
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
    [onSend]
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
          className="w-full [&_[data-slot=input-group]]:transition-none"
        >
          <AttachmentBar />
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              placeholder={
                isStreaming
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
