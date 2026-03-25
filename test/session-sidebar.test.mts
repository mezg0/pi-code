import test from 'node:test'
import assert from 'node:assert/strict'

import { hasUnseenSessionCompletion } from '../src/renderer/src/lib/session-sidebar.ts'

type SessionInput = Parameters<typeof hasUnseenSessionCompletion>[0]

function makeSession(
  status: SessionInput['status'],
  updatedAt: string
): SessionInput {
  return { id: 'test-id', status, updatedAt }
}

// ---------------------------------------------------------------------------
// hasUnseenSessionCompletion
// ---------------------------------------------------------------------------

test('returns true for completed session with no prior visit', () => {
  assert.equal(hasUnseenSessionCompletion(makeSession('completed', '2025-06-01T00:00:00Z')), true)
})

test('returns true for awaiting_input session with no prior visit', () => {
  assert.equal(
    hasUnseenSessionCompletion(makeSession('awaiting_input', '2025-06-01T00:00:00Z')),
    true
  )
})

test('returns false for running session', () => {
  assert.equal(hasUnseenSessionCompletion(makeSession('running', '2025-06-01T00:00:00Z')), false)
})

test('returns false for draft session', () => {
  assert.equal(hasUnseenSessionCompletion(makeSession('draft', '2025-06-01T00:00:00Z')), false)
})

test('returns false for failed session', () => {
  assert.equal(hasUnseenSessionCompletion(makeSession('failed', '2025-06-01T00:00:00Z')), false)
})

test('returns false for stopped session', () => {
  assert.equal(hasUnseenSessionCompletion(makeSession('stopped', '2025-06-01T00:00:00Z')), false)
})

test('returns true when completed after last visit', () => {
  assert.equal(
    hasUnseenSessionCompletion(
      makeSession('completed', '2025-06-02T00:00:00Z'),
      '2025-06-01T00:00:00Z'
    ),
    true
  )
})

test('returns false when completed before last visit', () => {
  assert.equal(
    hasUnseenSessionCompletion(
      makeSession('completed', '2025-06-01T00:00:00Z'),
      '2025-06-02T00:00:00Z'
    ),
    false
  )
})

test('returns false when completed at exactly the same time as last visit', () => {
  assert.equal(
    hasUnseenSessionCompletion(
      makeSession('completed', '2025-06-01T00:00:00Z'),
      '2025-06-01T00:00:00Z'
    ),
    false
  )
})

test('returns true when lastVisitedAt is an invalid date string', () => {
  assert.equal(
    hasUnseenSessionCompletion(makeSession('completed', '2025-06-01T00:00:00Z'), 'not-a-date'),
    true
  )
})

test('returns false when updatedAt is an invalid date string', () => {
  assert.equal(
    hasUnseenSessionCompletion(makeSession('completed', 'not-a-date'), '2025-01-01T00:00:00Z'),
    false
  )
})
