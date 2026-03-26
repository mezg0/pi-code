import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronRightIcon } from 'lucide-react'

import { Shimmer } from '@/components/ai-elements/shimmer'

import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { ActionCard, parseActionPrefix } from './action-card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { AgentMessage } from '@/lib/sessions'
import { cn } from '@/lib/utils'
import { shouldRenderStreamingMessage } from '@pi-code/shared/streaming-contract'

type TextBlock = { type: 'text'; text: string }
type ImageBlock = { type: 'image'; data: string; mimeType: string }
type ThinkingBlock = { type: 'thinking'; thinking: string }
type ToolCallBlock = { type: 'toolCall'; id: string; name: string; arguments?: unknown }
type ContentBlock =
  | TextBlock
  | ImageBlock
  | ThinkingBlock
  | ToolCallBlock
  | { type: string; [key: string]: unknown }

type PiMessage = {
  role: string
  content?: string | ContentBlock[]
  text?: string
  toolCallId?: string
  isError?: boolean
  details?: unknown
  timestamp?: number
  [key: string]: unknown
}

const INITIAL_VISIBLE = 20
const LOAD_MORE_BATCH = 20
const EMPTY_PENDING_TOOL_CALLS = new Set<string>()

/**
 * Produce a stable React key for a message.
 * Prefer role + timestamp (unique per message) so that prepending/appending
 * never causes index-based key collisions.
 */
function stableMessageKey(msg: PiMessage, index: number): string {
  if (msg.role === 'toolResult' && typeof msg.toolCallId === 'string') {
    return `tr-${msg.toolCallId}`
  }
  if (typeof msg.timestamp === 'number') {
    return `${msg.role}-${msg.timestamp}`
  }
  // Fallback — should be rare once all messages carry timestamps
  return `${msg.role}-idx-${index}`
}

function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === 'text' && 'text' in block && typeof (block as TextBlock).text === 'string'
}

function isThinkingBlock(block: ContentBlock): block is ThinkingBlock {
  return (
    block.type === 'thinking' &&
    'thinking' in block &&
    typeof (block as ThinkingBlock).thinking === 'string'
  )
}

function isImageBlock(block: ContentBlock): block is ImageBlock {
  return block.type === 'image' && 'data' in block && 'mimeType' in block
}

function isToolCallBlock(block: ContentBlock): block is ToolCallBlock {
  return block.type === 'toolCall' && 'id' in block && 'name' in block
}

function extractUserText(message: PiMessage): string {
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) {
    return message.content
      .filter(isTextBlock)
      .map((b) => b.text)
      .join('')
  }
  if (typeof message.text === 'string') return message.text
  return ''
}

function extractUserImages(message: PiMessage): ImageBlock[] {
  if (!Array.isArray(message.content)) return []
  return (message.content as ContentBlock[]).filter(isImageBlock)
}

function buildToolResultsMap(messages: PiMessage[]): Map<string, PiMessage> {
  const map = new Map<string, PiMessage>()
  for (const msg of messages) {
    if (msg.role === 'toolResult' && typeof msg.toolCallId === 'string') {
      map.set(msg.toolCallId, msg)
    }
  }
  return map
}

function getToolTitle(name: string): string {
  switch (name) {
    case 'read':
      return 'Read'
    case 'write':
      return 'Write'
    case 'edit':
      return 'Edit'
    case 'bash':
      return 'Shell'
    case 'grep':
      return 'Grep'
    case 'find':
      return 'Find'
    case 'ls':
      return 'List'
    case 'webfetch':
      return 'Web Fetch'
    case 'ask_user_question':
      return 'Question'
    case 'load_skill':
      return 'Load Skill'
    case 'get_plan':
      return 'Get Plan'
    case 'create_plan':
      return 'Create Plan'
    case 'update_plan':
      return 'Update Plan'
    default:
      return name
  }
}

function getToolSubtitle(name: string, args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined
  const a = args as Record<string, unknown>
  switch (name) {
    case 'read':
    case 'write':
    case 'edit':
      return typeof a.path === 'string' ? a.path : undefined
    case 'bash':
      return typeof a.command === 'string' ? a.command : undefined
    case 'grep': {
      const parts: string[] = []
      if (typeof a.pattern === 'string') parts.push(`"${a.pattern}"`)
      if (typeof a.path === 'string') parts.push(a.path)
      if (typeof a.glob === 'string') parts.push(`-g ${a.glob}`)
      return parts.length > 0 ? parts.join(' ') : undefined
    }
    case 'find': {
      const parts: string[] = []
      if (typeof a.pattern === 'string') parts.push(a.pattern)
      if (typeof a.path === 'string') parts.push(`in ${a.path}`)
      return parts.length > 0 ? parts.join(' ') : undefined
    }
    case 'ls':
      return typeof a.path === 'string' ? a.path : '.'
    case 'webfetch':
      return typeof a.url === 'string' ? a.url : undefined
    case 'ask_user_question': {
      const questions = a.questions as Array<{ question?: string }> | undefined
      if (!questions?.length) return undefined
      if (questions.length === 1) return questions[0]?.question
      return `${questions.length} questions`
    }
    case 'load_skill':
      return typeof a.name === 'string' && a.name.trim() ? a.name : undefined
    case 'get_plan':
      return 'Current published plan'
    case 'create_plan':
    case 'update_plan':
      return typeof a.title === 'string' && a.title.trim() ? a.title : 'Markdown plan'
    default:
      return undefined
  }
}

function LoadMoreTrigger({
  onLoadMore,
  scrollContainerRef
}: {
  onLoadMore: () => void
  scrollContainerRef: React.RefObject<HTMLElement | null>
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const scrollEl = scrollContainerRef.current
          if (!scrollEl) {
            onLoadMore()
            return
          }

          // Snapshot scroll geometry BEFORE the state update
          const prevScrollTop = scrollEl.scrollTop
          const prevScrollHeight = scrollEl.scrollHeight

          onLoadMore()

          // After React renders the new rows, compensate scrollTop
          // so the viewport content stays in place.
          requestAnimationFrame(() => {
            const delta = scrollEl.scrollHeight - prevScrollHeight
            if (delta > 0) {
              scrollEl.scrollTop = prevScrollTop + delta
            }
          })
        }
      },
      { threshold: 0 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [onLoadMore, scrollContainerRef])

  return <div ref={ref} className="h-1" />
}

const ASSISTANT_PROSE =
  'text-[13.5px] leading-[21px] [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-[13px] [&_table]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-1.5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6'

const ThinkingRowComponent = memo(function ThinkingRowComponent({
  text,
  streaming
}: {
  text: string
  streaming: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRightIcon
          className={cn('size-3.5 shrink-0 transition-transform duration-200', open && 'rotate-90')}
        />
        <span className={streaming ? 'animate-pulse' : ''}>Thinking…</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-1 mb-2">
          <MessageResponse className="text-[13px] text-muted-foreground">{text}</MessageResponse>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
})

const ToolCallRowComponent = memo(function ToolCallRowComponent({
  toolCall,
  pending
}: {
  toolCall: ToolCallBlock
  result?: PiMessage
  pending: boolean
}) {
  const title = getToolTitle(toolCall.name)
  const subtitle = getToolSubtitle(toolCall.name, toolCall.arguments)

  return (
    <div className="flex min-h-[28px] items-center gap-2 px-3 py-0.5 text-[13px]">
      {pending ? (
        <Shimmer as="span" className="shrink-0 font-medium" duration={1.5} spread={1}>
          {title}
        </Shimmer>
      ) : (
        <span className="shrink-0 font-medium text-muted-foreground">{title}</span>
      )}
      {subtitle ? (
        <span
          className={cn(
            'min-w-0 truncate text-muted-foreground/70',
            pending && 'opacity-50'
          )}
        >
          {subtitle}
        </span>
      ) : null}
    </div>
  )
})

const AssistantMessageDisplay = memo(function AssistantMessageDisplay({
  message,
  toolResultsById,
  pendingToolCalls,
  isStreaming
}: {
  message: PiMessage
  toolResultsById: Map<string, PiMessage>
  pendingToolCalls: Set<string>
  isStreaming?: boolean
}) {
  if (!Array.isArray(message.content)) return null

  const parts: React.JSX.Element[] = []

  for (let i = 0; i < message.content.length; i++) {
    const block = message.content[i] as ContentBlock
    if (isTextBlock(block) && block.text.trim()) {
      parts.push(
        <Message from="assistant" key={`text-${i}`}>
          <MessageContent>
            <MessageResponse className={ASSISTANT_PROSE}>{block.text}</MessageResponse>
          </MessageContent>
        </Message>
      )
    } else if (isThinkingBlock(block) && block.thinking.trim()) {
      parts.push(
        <ThinkingRowComponent
          key={`thinking-${i}`}
          text={block.thinking}
          streaming={isStreaming ?? false}
        />
      )
    } else if (isToolCallBlock(block)) {
      const result = toolResultsById.get(block.id)
      const pending = pendingToolCalls.has(block.id) && !result
      parts.push(
        <ToolCallRowComponent
          key={`tool-${block.id}`}
          toolCall={block}
          result={result}
          pending={pending}
        />
      )
    }
  }

  if (parts.length === 0) return null
  return <>{parts}</>
})

const StableMessageList = memo(function StableMessageList({
  displayMessages,
  globalIndexOffset,
  hasMore,
  onLoadMore,
  toolResultsById,
  scrollContainerRef
}: {
  displayMessages: PiMessage[]
  globalIndexOffset: number
  hasMore: boolean
  onLoadMore: () => void
  toolResultsById: Map<string, PiMessage>
  scrollContainerRef: React.RefObject<HTMLElement | null>
}): React.JSX.Element {
  return (
    <>
      {hasMore && <LoadMoreTrigger onLoadMore={onLoadMore} scrollContainerRef={scrollContainerRef} />}
      {displayMessages.map((msg, localIndex) => {
        const globalIndex = globalIndexOffset + localIndex
        const key = stableMessageKey(msg, globalIndex)

        if (msg.role === 'user' || msg.role === 'user-with-attachments') {
          const text = extractUserText(msg)
          const images = extractUserImages(msg)
          if (!text.trim() && images.length === 0) return null

          // Check for action card prefix (e.g. commit-pr dispatched from the commit dialog)
          const action = parseActionPrefix(text)
          if (action) {
            return (
              <ActionCard
                key={key}
                type={action.type}
                metadata={action.metadata}
              />
            )
          }

          return (
            <Message from="user" key={key}>
              <MessageContent>
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {images.map((img, imageIndex) => (
                      <img
                        key={imageIndex}
                        src={`data:${img.mimeType};base64,${img.data}`}
                        alt="Attached image"
                        className="max-h-24 rounded object-contain"
                      />
                    ))}
                  </div>
                )}
                {text.trim() && (
                  <MessageResponse className="text-[13.5px] leading-[21px]">{text}</MessageResponse>
                )}
              </MessageContent>
            </Message>
          )
        }

        if (msg.role === 'assistant') {
          return (
            <AssistantMessageDisplay
              key={key}
              message={msg}
              toolResultsById={toolResultsById}
              pendingToolCalls={EMPTY_PENDING_TOOL_CALLS}
              isStreaming={false}
            />
          )
        }

        return null
      })}
    </>
  )
})

const StreamingAssistantMessage = memo(function StreamingAssistantMessage({
  message,
  toolResultsById,
  pendingToolCalls,
  isStreaming
}: {
  message: PiMessage | null
  toolResultsById: Map<string, PiMessage>
  pendingToolCalls: Set<string>
  isStreaming: boolean
}): React.JSX.Element | null {
  if (!isStreaming || message === null || message.role !== 'assistant') {
    return null
  }

  return (
    <AssistantMessageDisplay
      key="streaming"
      message={message}
      toolResultsById={toolResultsById}
      pendingToolCalls={pendingToolCalls}
      isStreaming={true}
    />
  )
})

export function PiMessages({
  messages,
  isStreaming,
  streamingMessage,
  scrollContainerRef
}: {
  messages: AgentMessage[]
  isStreaming: boolean
  streamingMessage: AgentMessage | null
  scrollContainerRef: React.RefObject<HTMLElement | null>
}): React.JSX.Element {
  const piMessages = messages as unknown as PiMessage[]
  const streamMsg = streamingMessage as PiMessage | null

  const toolResultsById = useMemo(() => buildToolResultsMap(piMessages), [piMessages])

  const pendingToolCalls = useMemo(() => {
    const set = new Set<string>()
    if (!isStreaming || streamMsg?.role !== 'assistant' || !Array.isArray(streamMsg.content))
      return set

    for (const block of streamMsg.content as ContentBlock[]) {
      if (isToolCallBlock(block) && !toolResultsById.has(block.id)) {
        set.add(block.id)
      }
    }

    return set
  }, [isStreaming, streamMsg, toolResultsById])

  const showStreaming = useMemo(
    () => shouldRenderStreamingMessage(messages, streamingMessage, isStreaming),
    [isStreaming, messages, streamingMessage]
  )

  const visibleMessages = useMemo(
    () => piMessages.filter((msg) => msg.role !== 'toolResult'),
    [piMessages]
  )

  // Anchored start-index model: instead of sliding a tail window (which
  // shifts ALL messages when new ones arrive), we keep a stable start index.
  // New messages appended at the end naturally become visible without
  // disturbing already-rendered rows.
  const [startIndex, setStartIndex] = useState(() =>
    Math.max(0, visibleMessages.length - INITIAL_VISIBLE)
  )

  // When the message list changes (e.g. session switch via key prop),
  // reset the start index.
  const prevLengthRef = useRef(visibleMessages.length)
  useLayoutEffect(() => {
    const prevLength = prevLengthRef.current
    prevLengthRef.current = visibleMessages.length

    // If the list shrank dramatically (session switch / clear), reset
    if (visibleMessages.length < prevLength - LOAD_MORE_BATCH) {
      setStartIndex(Math.max(0, visibleMessages.length - INITIAL_VISIBLE))
    }
  }, [visibleMessages.length])

  const hasMore = startIndex > 0
  const displayMessages = useMemo(
    () => visibleMessages.slice(startIndex),
    [startIndex, visibleMessages]
  )

  const loadMore = useCallback(() => {
    setStartIndex((prev) => Math.max(0, prev - LOAD_MORE_BATCH))
  }, [])

  return (
    <>
      <StableMessageList
        displayMessages={displayMessages}
        globalIndexOffset={startIndex}
        hasMore={hasMore}
        onLoadMore={loadMore}
        toolResultsById={toolResultsById}
        scrollContainerRef={scrollContainerRef}
      />

      {showStreaming && (
        <StreamingAssistantMessage
          message={streamMsg}
          toolResultsById={toolResultsById}
          pendingToolCalls={pendingToolCalls}
          isStreaming={isStreaming}
        />
      )}
    </>
  )
}
