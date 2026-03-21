import test from 'node:test'
import assert from 'node:assert/strict'

import type { AgentMessage } from '../src/shared/session.ts'
import {
  cloneStreamingSnapshot,
  shouldRenderStreamingMessage
} from '../src/shared/streaming-contract.ts'

function assistantMessage(timestamp: number, text: string): AgentMessage {
  return {
    role: 'assistant',
    api: 'openai-responses',
    provider: 'openai',
    model: 'gpt-test',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0
      }
    },
    stopReason: 'stop',
    timestamp,
    content: [{ type: 'text', text }]
  }
}

test('cloneStreamingSnapshot returns a deep clone', () => {
  const original = assistantMessage(1, 'hello')
  const cloned = cloneStreamingSnapshot(original)

  assert.deepEqual(cloned, original)
  assert.notStrictEqual(cloned, original)
  ;(cloned.content[0] as { type: 'text'; text: string }).text = 'changed'
  assert.equal((original.content[0] as { type: 'text'; text: string }).text, 'hello')
})

test('shouldRenderStreamingMessage shows a new in-flight assistant message', () => {
  const committed = [assistantMessage(1, 'older')]
  const streaming = assistantMessage(2, 'newer')

  assert.equal(shouldRenderStreamingMessage(committed, streaming, true), true)
})

test('shouldRenderStreamingMessage hides the streaming ghost once the same assistant message is committed', () => {
  const committed = [assistantMessage(2, 'complete')]
  const streaming = assistantMessage(2, 'complete')

  assert.equal(shouldRenderStreamingMessage(committed, streaming, true), false)
})

test('shouldRenderStreamingMessage hides empty or inactive streaming state', () => {
  const streaming = assistantMessage(3, '')
  streaming.content = []

  assert.equal(shouldRenderStreamingMessage([], streaming, true), false)
  assert.equal(shouldRenderStreamingMessage([], assistantMessage(3, 'text'), false), false)
  assert.equal(shouldRenderStreamingMessage([], null, true), false)
})
