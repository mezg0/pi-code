import { useCallback, useEffect, useState } from 'react'

import {
  getPendingPermission,
  getPendingQuestion,
  onAgentMessages,
  onPermissionEvent,
  onQuestionEvent,
  onSessionUpdated,
  onStreamingEvent,
  type AgentMessage,
  type PermissionRequest,
  type QuestionRequest,
  type Session,
  type SessionStatus,
  type SessionStreamingEvent
} from '@/lib/sessions'

const BUSY_STATUSES: Set<SessionStatus> = new Set(['queued', 'starting', 'running'])

type UseSessionStateResult = {
  session: Session
  messages: AgentMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingMessage: AgentMessage | null
  pendingMessages: string[]
  errorMessage: string | null
  questionRequest: QuestionRequest | null
  permissionRequest: PermissionRequest | null
  setLoading: () => void
  addOptimisticPending: (text: string) => void
  clearError: () => void
  clearQuestion: () => void
  clearPermission: () => void
}

export function useSessionState(
  sessionId: string,
  initialSession: Session,
  initialMessages: AgentMessage[]
): UseSessionStateResult {
  const [session, setSession] = useState(initialSession)
  const [messages, setMessages] = useState(initialMessages)
  // Initialize isLoading from session status so navigating to a running
  // session immediately shows the loading indicator instead of blank silence.
  const [isLoading, setIsLoading] = useState(BUSY_STATUSES.has(initialSession.status))
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState<AgentMessage | null>(null)
  const [pendingMessages, setPendingMessages] = useState<string[]>([])
  const [optimisticPendingMessages, setOptimisticPendingMessages] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [questionRequest, setQuestionRequest] = useState<QuestionRequest | null>(null)
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)

  useEffect(() => {
    // Flags to sync streaming state clearing with committed message arrival.
    // This prevents scroll jumps caused by the streaming content disappearing
    // before the committed messages have rendered.
    let pendingClear = false
    let pendingEnd = false
    let endTimeoutId: ReturnType<typeof setTimeout> | null = null
    let streamingFrameId: number | null = null
    let pendingStreamingMessage: AgentMessage | null = null
    let renderedStreamingMessage: AgentMessage | null = null

    const flushStreamingMessage = (): void => {
      streamingFrameId = null
      renderedStreamingMessage = pendingStreamingMessage
      pendingStreamingMessage = null
      setStreamingMessage(renderedStreamingMessage)
    }

    const scheduleStreamingMessageFlush = (): void => {
      if (streamingFrameId !== null) return
      streamingFrameId = window.requestAnimationFrame(flushStreamingMessage)
    }

    const clearStreamingBuffer = (): void => {
      pendingStreamingMessage = null
      renderedStreamingMessage = null
      if (streamingFrameId !== null) {
        window.cancelAnimationFrame(streamingFrameId)
        streamingFrameId = null
      }
    }

    const unsubscribeUpdated = onSessionUpdated((nextSession) => {
      if (nextSession.id === sessionId) {
        setSession(nextSession)
      }
    })

    const unsubscribeMessages = onAgentMessages((payload) => {
      if (payload.sessionId === sessionId) {
        setMessages(payload.messages)

        // Clear streaming state in the SAME React batch as the committed
        // message update — no gap, no height collapse, no scroll jump.
        // We clear synchronously (not deferred to rAF) so that both the
        // committed message render and the streaming ghost removal happen
        // in a single React render pass.  shouldRenderStreamingMessage()
        // already prevents visual duplication within the same render.
        if (pendingClear) {
          pendingClear = false
          clearStreamingBuffer()
          setStreamingMessage(null)
        }
        if (pendingEnd) {
          pendingEnd = false
          if (endTimeoutId) {
            clearTimeout(endTimeoutId)
            endTimeoutId = null
          }
          clearStreamingBuffer()
          setIsLoading(false)
          setIsStreaming(false)
          setStreamingMessage(null)
        }
      }
    })

    const unsubscribeStreaming = onStreamingEvent((payload) => {
      if (payload.sessionId !== sessionId) return

      const event: SessionStreamingEvent = payload.event
      if ('pendingMessages' in event) {
        setPendingMessages(event.pendingMessages)
        // Server is authoritative — clear only the optimistic entries it now
        // includes, preserving duplicate queued texts if the server has only
        // acknowledged some of them so far.
        setOptimisticPendingMessages((prev) => {
          if (prev.length === 0) return prev

          const acknowledgedCounts = new Map<string, number>()
          for (const text of event.pendingMessages) {
            acknowledgedCounts.set(text, (acknowledgedCounts.get(text) ?? 0) + 1)
          }

          const remaining: string[] = []
          for (const text of prev) {
            const count = acknowledgedCounts.get(text) ?? 0
            if (count > 0) {
              acknowledgedCounts.set(text, count - 1)
            } else {
              remaining.push(text)
            }
          }

          return remaining.length === prev.length ? prev : remaining
        })
      }
      switch (event.type) {
        case 'stream_start':
          // Agent turn started — show loading before first token arrives.
          setIsLoading(true)
          break
        case 'message_update':
          pendingClear = false
          pendingEnd = false
          if (endTimeoutId) {
            clearTimeout(endTimeoutId)
            endTimeoutId = null
          }
          setIsLoading(false)
          setIsStreaming(true)
          // The SSE layer already delivered us a fresh object via JSON.parse —
          // no further cloning needed.
          pendingStreamingMessage = event.message
          scheduleStreamingMessageFlush()
          break
        case 'message_end':
          // Don't clear streamingMessage here — wait for onAgentMessages
          // so both updates land in the same render batch.
          pendingClear = true
          break
        case 'agent_end':
          pendingClear = false
          pendingEnd = true
          setOptimisticPendingMessages([])
          // Fallback: if onAgentMessages doesn't arrive within 300ms, force clear
          endTimeoutId = setTimeout(() => {
            endTimeoutId = null
            if (pendingEnd) {
              pendingEnd = false
              clearStreamingBuffer()
              setIsLoading(false)
              setIsStreaming(false)
              setStreamingMessage(null)
            }
          }, 300)
          break
        case 'error':
          clearStreamingBuffer()
          setIsLoading(false)
          setIsStreaming(false)
          setStreamingMessage(null)
          setOptimisticPendingMessages([])
          setErrorMessage(event.message)
          break
      }
    })

    const unsubscribeQuestion = onQuestionEvent((payload) => {
      if (payload.sessionId !== sessionId) return
      setQuestionRequest(payload.request)
    })

    const unsubscribePermission = onPermissionEvent((payload) => {
      if (payload.sessionId !== sessionId) return
      setPermissionRequest(payload.request)
    })

    // Recover pending question/permission when navigating back to a session
    void getPendingQuestion(sessionId).then((request) => {
      if (request) setQuestionRequest(request)
    })
    void getPendingPermission(sessionId).then((request) => {
      if (request) setPermissionRequest(request)
    })

    return () => {
      unsubscribeUpdated()
      unsubscribeMessages()
      unsubscribeStreaming()
      unsubscribeQuestion()
      unsubscribePermission()
      if (endTimeoutId) clearTimeout(endTimeoutId)
      clearStreamingBuffer()
    }
  }, [sessionId])

  const setLoading = useCallback((): void => {
    setIsLoading(true)
    setErrorMessage(null)
  }, [])

  const addOptimisticPending = useCallback((text: string): void => {
    setOptimisticPendingMessages((prev) => [...prev, text])
  }, [])

  const clearError = useCallback((): void => {
    setErrorMessage(null)
  }, [])

  const clearQuestion = useCallback((): void => {
    setQuestionRequest(null)
  }, [])

  const clearPermission = useCallback((): void => {
    setPermissionRequest(null)
  }, [])

  // Merge server-authoritative pending messages with local optimistic ones
  const effectivePendingMessages =
    optimisticPendingMessages.length > 0
      ? [...pendingMessages, ...optimisticPendingMessages]
      : pendingMessages

  return {
    session,
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
    pendingMessages: effectivePendingMessages,
    errorMessage,
    questionRequest,
    permissionRequest,
    setLoading,
    addOptimisticPending,
    clearError,
    clearQuestion,
    clearPermission
  }
}
