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

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const committed = messages[i]
    if (committed.role !== 'assistant') continue
    return committed.timestamp !== streamingMessage.timestamp
  }

  return true
}
