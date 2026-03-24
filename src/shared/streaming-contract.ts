import type { AgentMessage } from '@mariozechner/pi-agent-core'

/**
 * Streaming contract helpers shared by the Electron main process and renderer.
 *
 * Contract:
 * - streaming renders the latest full assistant snapshot, not reconstructed deltas
 * - committed messages remain the source of truth once message_end lands
 * - the temporary streaming ghost should disappear as soon as the committed
 *   assistant message with the same timestamp is present in the stable list
 */

export function cloneStreamingSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function shouldRenderStreamingMessage(
  messages: AgentMessage[],
  streamingMessage: AgentMessage | null,
  isStreaming: boolean
): boolean {
  if (!isStreaming || !streamingMessage || streamingMessage.role !== 'assistant') {
    return false
  }

  if (!Array.isArray(streamingMessage.content) || streamingMessage.content.length === 0) {
    return false
  }

  // Check if ANY committed assistant already has this timestamp.
  // The previous logic only checked the LAST committed assistant, which broke
  // during tool-call loops: message_end commits assistant A, then message_start
  // immediately adds an empty assistant B.  If the streaming ghost of A hasn't
  // been cleared yet, comparing against B (different timestamp) made A reappear
  // alongside the committed version — doubling content height for one frame.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const committed = messages[i]
    if (committed.role !== 'assistant') continue
    if (committed.timestamp === streamingMessage.timestamp) return false
  }

  return true
}
