import { useCallback, useEffect, useState } from 'react'

import {
  onAgentMessages,
  onSessionUpdated,
  onStreamingEvent,
  type AgentMessage,
  type Session,
  type SessionStreamingEvent
} from '@/lib/sessions'
import { cloneStreamingSnapshot } from '../../../shared/streaming-contract'

type UseSessionStateResult = {
  session: Session
  messages: AgentMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingMessage: AgentMessage | null
  pendingMessages: string[]
  errorMessage: string | null
  setLoading: () => void
  clearError: () => void
}

export function useSessionState(
  sessionId: string,
  initialSession: Session,
  initialMessages: AgentMessage[]
): UseSessionStateResult {
  const [session, setSession] = useState(initialSession)
  const [messages, setMessages] = useState(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState<AgentMessage | null>(null)
  const [pendingMessages, setPendingMessages] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
      }
      switch (event.type) {
        case 'message_update':
          pendingClear = false
          pendingEnd = false
          if (endTimeoutId) {
            clearTimeout(endTimeoutId)
            endTimeoutId = null
          }
          setIsLoading(false)
          setIsStreaming(true)
          pendingStreamingMessage = cloneStreamingSnapshot(event.message)
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
          setErrorMessage(event.message)
          break
      }
    })

    return () => {
      unsubscribeUpdated()
      unsubscribeMessages()
      unsubscribeStreaming()
      if (endTimeoutId) clearTimeout(endTimeoutId)
      clearStreamingBuffer()
    }
  }, [sessionId])

  const setLoading = useCallback((): void => {
    setIsLoading(true)
    setErrorMessage(null)
  }, [])

  const clearError = useCallback((): void => {
    setErrorMessage(null)
  }, [])

  return {
    session,
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
    pendingMessages,
    errorMessage,
    setLoading,
    clearError
  }
}
