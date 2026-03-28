import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronRightIcon } from 'lucide-react'

import { Shimmer } from '@/components/ai-elements/shimmer'

import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { ActionCard, type ActionType } from './action-card'
import { SkillChip } from './skill-chip'
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

// Tools grouped into a collapsible "Gathered context" row.
const CONTEXT_GROUP_TOOLS = new Set(['read', 'grep', 'rg', 'find', 'ls'])
const READ_ONLY_BASH_CONTEXT_COMMANDS = new Set(['rg', 'grep', 'find', 'ls'])

// Tools grouped into a collapsible "Edited files" row.
const EDIT_GROUP_TOOLS = new Set(['write', 'edit'])

type ToolGroupKind = 'context' | 'edit'

type ToolEntry = { toolCall: ToolCallBlock; pending: boolean }

type RenderRow =
  | { type: 'text'; key: string; text: string }
  | { type: 'thinking'; key: string; text: string }
  | { type: 'tool'; key: string; toolCall: ToolCallBlock; pending: boolean }
  | { type: 'toolGroup'; key: string; group: ToolGroupKind; tools: ToolEntry[] }

function getReadOnlyBashContextCommand(args: unknown): string | null {
  if (!args || typeof args !== 'object') return null

  const argsRecord = args as Record<string, unknown>
  const commandValue = argsRecord.command
  const command = typeof commandValue === 'string' ? commandValue.trim() : ''
  if (!command) return null

  // Only group simple, single read-only commands. Anything with shell control
  // operators or redirection stays as an individual Shell row.
  if (/[;&|<>\n]/.test(command)) return null

  const match = command.match(/^([A-Za-z0-9._-]+)/)
  const baseCommand = match?.[1]
  if (!baseCommand || !READ_ONLY_BASH_CONTEXT_COMMANDS.has(baseCommand)) {
    return null
  }

  return baseCommand
}

function toolGroupKind(toolCall: ToolCallBlock): ToolGroupKind | null {
  if (CONTEXT_GROUP_TOOLS.has(toolCall.name)) return 'context'
  if (toolCall.name === 'bash' && getReadOnlyBashContextCommand(toolCall.arguments)) {
    return 'context'
  }
  if (EDIT_GROUP_TOOLS.has(toolCall.name)) return 'edit'
  return null
}

/**
 * Convert an assistant message's content blocks into grouped render rows.
 *
 * Consecutive context-gathering tools and consecutive edit/write tools are
 * each merged into a single `toolGroup` row when 2+ appear in a run.
 * A single groupable tool in isolation stays as a normal `tool` row.
 * Different group kinds break each other's runs.
 */
function buildRenderRows(
  blocks: ContentBlock[],
  toolResultsById: Map<string, PiMessage>,
  pendingToolCalls: Set<string>
): RenderRow[] {
  const rows: RenderRow[] = []
  let currentRun: ToolEntry[] = []
  let currentKind: ToolGroupKind | null = null

  const flushRun = (): void => {
    if (currentRun.length === 0) return
    if (currentRun.length === 1) {
      const item = currentRun[0]!
      rows.push({
        type: 'tool',
        key: `tool-${item.toolCall.id}`,
        toolCall: item.toolCall,
        pending: item.pending
      })
    } else {
      rows.push({
        type: 'toolGroup',
        key: `toolGroup-${currentRun[0]!.toolCall.id}`,
        group: currentKind!,
        tools: currentRun
      })
    }
    currentRun = []
    currentKind = null
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as ContentBlock

    if (isToolCallBlock(block)) {
      const kind = toolGroupKind(block)
      if (kind !== null) {
        // If the kind changed, flush the previous run first
        if (currentKind !== null && currentKind !== kind) {
          flushRun()
        }
        const result = toolResultsById.get(block.id)
        const pending = pendingToolCalls.has(block.id) && !result
        currentRun.push({ toolCall: block, pending })
        currentKind = kind
        continue
      }
    }

    flushRun()

    if (isTextBlock(block) && block.text.trim()) {
      rows.push({ type: 'text', key: `text-${i}`, text: block.text })
    } else if (isThinkingBlock(block) && block.thinking.trim()) {
      rows.push({ type: 'thinking', key: `thinking-${i}`, text: block.thinking })
    } else if (isToolCallBlock(block)) {
      const result = toolResultsById.get(block.id)
      const pending = pendingToolCalls.has(block.id) && !result
      rows.push({ type: 'tool', key: `tool-${block.id}`, toolCall: block, pending })
    }
  }

  flushRun()
  return rows
}

function parseActionPrefix(
  text: string
): { type: ActionType; metadata: Record<string, unknown>; instruction: string } | null {
  const match = text.match(/^<!--action:(\w[\w-]*):({.*?})-->\n?/)
  if (!match) return null

  try {
    return {
      type: match[1] as ActionType,
      metadata: JSON.parse(match[2]),
      instruction: text.slice(match[0].length)
    }
  } catch {
    return null
  }
}

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

/**
 * Parse skill markers (<!--skill:name-->) from text.
 * Returns the list of skill names and the cleaned text (without markers or load instructions).
 */
function parseSkillMarkers(text: string): { skills: string[]; cleanText: string } {
  const skills: string[] = []
  const markerRegex = /<!--skill:([^>]+)-->/g
  let match
  while ((match = markerRegex.exec(text)) !== null) {
    skills.push(match[1]!)
  }

  // Remove markers from text
  let cleanText = text.replace(markerRegex, '').trim()

  // Remove the skill load instructions ("Load and use the X skill for this task.")
  // These appear at the beginning of the message
  const instructionRegex = /^Load and use the \w+ skill for this task\.\s*/gm
  cleanText = cleanText.replace(instructionRegex, '').trim()

  return { skills, cleanText }
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
    case 'rg':
      return 'Ripgrep'
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
    case 'grep':
    case 'rg': {
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
        <span className={streaming ? 'animate-pulse' : ''}>Thinking</span>
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
        <span className={cn('min-w-0 truncate text-muted-foreground/70', pending && 'opacity-50')}>
          {subtitle}
        </span>
      ) : null}
    </div>
  )
})

function getContextToolCategory(toolCall: ToolCallBlock): 'read' | 'search' | 'list' | null {
  switch (toolCall.name) {
    case 'read':
      return 'read'
    case 'grep':
    case 'rg':
    case 'find':
      return 'search'
    case 'ls':
      return 'list'
    case 'bash': {
      const command = getReadOnlyBashContextCommand(toolCall.arguments)
      if (command === 'ls') return 'list'
      if (command === 'grep' || command === 'rg' || command === 'find') return 'search'
      return null
    }
    default:
      return null
  }
}

function contextGroupSummary(tools: ToolEntry[]): string {
  let reads = 0
  let searches = 0
  let lists = 0
  for (const { toolCall } of tools) {
    switch (getContextToolCategory(toolCall)) {
      case 'read':
        reads++
        break
      case 'search':
        searches++
        break
      case 'list':
        lists++
        break
    }
  }
  const parts: string[] = []
  if (reads > 0) parts.push(`${reads} ${reads === 1 ? 'read' : 'reads'}`)
  if (searches > 0) parts.push(`${searches} ${searches === 1 ? 'search' : 'searches'}`)
  if (lists > 0) parts.push(`${lists} ${lists === 1 ? 'list' : 'lists'}`)
  return parts.join(', ')
}

function editGroupSummary(tools: ToolEntry[]): string {
  const paths = new Set<string>()
  for (const { toolCall } of tools) {
    const args = toolCall.arguments as Record<string, unknown> | undefined
    const path = typeof args?.path === 'string' ? args.path : undefined
    if (path) paths.add(path)
  }
  const count = paths.size || tools.length
  return `${count} ${count === 1 ? 'file' : 'files'}`
}

const GROUP_LABELS: Record<ToolGroupKind, { pending: string; done: string }> = {
  context: { pending: 'Gathering context…', done: 'Gathered context' },
  edit: { pending: 'Editing files…', done: 'Edited files' }
}

const GROUP_SUMMARY: Record<ToolGroupKind, (tools: ToolEntry[]) => string> = {
  context: contextGroupSummary,
  edit: editGroupSummary
}

const ToolCallGroupRowComponent = memo(function ToolCallGroupRowComponent({
  group,
  tools
}: {
  group: ToolGroupKind
  tools: ToolEntry[]
}) {
  const [open, setOpen] = useState(false)
  const anyPending = tools.some((t) => t.pending)
  const labels = GROUP_LABELS[group]
  const summary = GROUP_SUMMARY[group](tools)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-[13px] transition-colors hover:text-foreground">
        <ChevronRightIcon
          className={cn('size-3.5 shrink-0 transition-transform duration-200', open && 'rotate-90')}
        />
        {anyPending ? (
          <Shimmer as="span" className="shrink-0 font-medium" duration={1.5} spread={1}>
            {labels.pending}
          </Shimmer>
        ) : (
          <span className="shrink-0 font-medium text-muted-foreground">{labels.done}</span>
        )}
        {summary && !anyPending ? (
          <span className="min-w-0 truncate text-muted-foreground/70">{summary}</span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5">
          {tools.map((t) => (
            <ToolCallRowComponent
              key={`tool-${t.toolCall.id}`}
              toolCall={t.toolCall}
              pending={t.pending}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
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

  const rows = buildRenderRows(message.content as ContentBlock[], toolResultsById, pendingToolCalls)

  if (rows.length === 0) return null

  return (
    <>
      {rows.map((row) => {
        switch (row.type) {
          case 'text':
            return (
              <Message from="assistant" key={row.key}>
                <MessageContent>
                  <MessageResponse className={ASSISTANT_PROSE}>{row.text}</MessageResponse>
                </MessageContent>
              </Message>
            )
          case 'thinking':
            return (
              <ThinkingRowComponent
                key={row.key}
                text={row.text}
                streaming={isStreaming ?? false}
              />
            )
          case 'tool':
            return (
              <ToolCallRowComponent key={row.key} toolCall={row.toolCall} pending={row.pending} />
            )
          case 'toolGroup':
            return <ToolCallGroupRowComponent key={row.key} group={row.group} tools={row.tools} />
          default:
            return null
        }
      })}
    </>
  )
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
      {hasMore && (
        <LoadMoreTrigger onLoadMore={onLoadMore} scrollContainerRef={scrollContainerRef} />
      )}
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
            return <ActionCard key={key} type={action.type} metadata={action.metadata} />
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
                {(() => {
                  const { skills, cleanText } = parseSkillMarkers(text)
                  const hasContent = skills.length > 0 || !!cleanText.trim()
                  if (!hasContent) return null
                  return (
                    <>
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          {skills.map((skill) => (
                            <SkillChip key={skill} name={skill} variant="message" />
                          ))}
                        </div>
                      )}
                      {cleanText && (
                        <MessageResponse className="text-[13.5px] leading-[21px]">
                          {cleanText}
                        </MessageResponse>
                      )}
                    </>
                  )
                })()}
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

    // If the list shrank dramatically (session switch / clear), reset.
    if (visibleMessages.length < prevLength - LOAD_MORE_BATCH) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronous reset on shrink keeps pagination anchored correctly across session switches
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
