import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isPlanToolName,
  normalizePlanTitle,
  getPlanFromToolMessage,
  extractLatestPlan,
  getPlanMessageKey
} from '@pi-code/shared/plan'

// ---------------------------------------------------------------------------
// isPlanToolName
// ---------------------------------------------------------------------------

test('isPlanToolName accepts create_plan', () => {
  assert.equal(isPlanToolName('create_plan'), true)
})

test('isPlanToolName accepts update_plan', () => {
  assert.equal(isPlanToolName('update_plan'), true)
})

test('isPlanToolName rejects other strings', () => {
  assert.equal(isPlanToolName('delete_plan'), false)
  assert.equal(isPlanToolName(''), false)
  assert.equal(isPlanToolName('CREATE_PLAN'), false)
})

test('isPlanToolName rejects non-strings', () => {
  assert.equal(isPlanToolName(null), false)
  assert.equal(isPlanToolName(undefined), false)
  assert.equal(isPlanToolName(42), false)
  assert.equal(isPlanToolName({}), false)
})

// ---------------------------------------------------------------------------
// normalizePlanTitle
// ---------------------------------------------------------------------------

test('normalizePlanTitle uses explicit title when provided', () => {
  assert.equal(normalizePlanTitle('My Title', '# Heading\nBody'), 'My Title')
})

test('normalizePlanTitle trims whitespace from explicit title', () => {
  assert.equal(normalizePlanTitle('  Spaced  ', '# Heading'), 'Spaced')
})

test('normalizePlanTitle falls back to markdown heading when title is empty', () => {
  assert.equal(normalizePlanTitle('', '# My Heading\nSome body text'), 'My Heading')
})

test('normalizePlanTitle falls back to markdown heading when title is whitespace', () => {
  assert.equal(normalizePlanTitle('   ', '# Plan Title\ndetails'), 'Plan Title')
})

test('normalizePlanTitle falls back to markdown heading when title is non-string', () => {
  assert.equal(normalizePlanTitle(null, '# Fallback Heading\ncontent'), 'Fallback Heading')
  assert.equal(normalizePlanTitle(undefined, '# Another Heading'), 'Another Heading')
  assert.equal(normalizePlanTitle(42, '# Numeric Title'), 'Numeric Title')
})

test('normalizePlanTitle falls back to first non-empty line when no heading', () => {
  assert.equal(normalizePlanTitle('', 'Just a plain line\nMore text'), 'Just a plain line')
})

test('normalizePlanTitle truncates first line to 80 chars', () => {
  const longLine = 'A'.repeat(100)
  assert.equal(normalizePlanTitle('', longLine), longLine.slice(0, 80))
})

test('normalizePlanTitle skips blank lines to find first content line', () => {
  assert.equal(normalizePlanTitle('', '\n\n\nActual content\nmore'), 'Actual content')
})

test('normalizePlanTitle returns "Untitled plan" for completely empty markdown', () => {
  assert.equal(normalizePlanTitle('', ''), 'Untitled plan')
  assert.equal(normalizePlanTitle('', '   \n   \n   '), 'Untitled plan')
})

// ---------------------------------------------------------------------------
// getPlanFromToolMessage
// ---------------------------------------------------------------------------

function planToolMessage(overrides: Record<string, unknown> = {}): {
  role: string
  toolName: string
  timestamp: number
  details: {
    plan: {
      title?: unknown
      markdown?: unknown
      summary?: unknown
      updatedAt?: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
} {
  return {
    role: 'toolResult',
    toolName: 'create_plan',
    timestamp: 1000,
    details: {
      plan: {
        title: 'Test Plan',
        markdown: '# Test\nContent here',
        summary: 'A test summary',
        updatedAt: 2000,
        ...((overrides.plan as Record<string, unknown>) ?? {})
      },
      ...((overrides.details as Record<string, unknown>) ?? {})
    },
    ...Object.fromEntries(
      Object.entries(overrides).filter(([k]) => k !== 'plan' && k !== 'details')
    )
  }
}

test('getPlanFromToolMessage extracts a valid plan', () => {
  const result = getPlanFromToolMessage(planToolMessage())
  assert.deepEqual(result, {
    title: 'Test Plan',
    markdown: '# Test\nContent here',
    summary: 'A test summary',
    updatedAt: 2000,
    toolName: 'create_plan'
  })
})

test('getPlanFromToolMessage uses message timestamp when updatedAt missing', () => {
  const msg = planToolMessage({ plan: { updatedAt: undefined } })
  const result = getPlanFromToolMessage(msg)
  assert.equal(result?.updatedAt, 1000)
})

test('getPlanFromToolMessage returns null for non-toolResult role', () => {
  const msg = planToolMessage()
  msg.role = 'assistant'
  assert.equal(getPlanFromToolMessage(msg), null)
})

test('getPlanFromToolMessage returns null for non-plan tool name', () => {
  const msg = planToolMessage()
  msg.toolName = 'read_file'
  assert.equal(getPlanFromToolMessage(msg), null)
})

test('getPlanFromToolMessage returns null when markdown is empty', () => {
  const msg = planToolMessage({ plan: { markdown: '' } })
  assert.equal(getPlanFromToolMessage(msg), null)
})

test('getPlanFromToolMessage returns null when markdown is whitespace-only', () => {
  const msg = planToolMessage({ plan: { markdown: '   \n  ' } })
  assert.equal(getPlanFromToolMessage(msg), null)
})

test('getPlanFromToolMessage returns null when details is missing', () => {
  assert.equal(getPlanFromToolMessage({ role: 'toolResult', toolName: 'create_plan' }), null)
})

test('getPlanFromToolMessage returns null when plan object is missing', () => {
  assert.equal(
    getPlanFromToolMessage({
      role: 'toolResult',
      toolName: 'create_plan',
      details: { other: 'data' }
    }),
    null
  )
})

test('getPlanFromToolMessage normalizes null summary to null', () => {
  const msg = planToolMessage({ plan: { summary: null } })
  const result = getPlanFromToolMessage(msg)
  assert.equal(result?.summary, null)
})

test('getPlanFromToolMessage normalizes empty string summary to null', () => {
  const msg = planToolMessage({ plan: { summary: '' } })
  const result = getPlanFromToolMessage(msg)
  assert.equal(result?.summary, null)
})

test('getPlanFromToolMessage works with update_plan', () => {
  const msg = planToolMessage()
  msg.toolName = 'update_plan'
  const result = getPlanFromToolMessage(msg)
  assert.equal(result?.toolName, 'update_plan')
})

// ---------------------------------------------------------------------------
// extractLatestPlan
// ---------------------------------------------------------------------------

test('extractLatestPlan returns null for empty array', () => {
  assert.equal(extractLatestPlan([]), null)
})

test('extractLatestPlan returns null when no plan messages exist', () => {
  const messages = [
    { role: 'assistant', timestamp: 1 },
    { role: 'toolResult', toolName: 'read_file', timestamp: 2 }
  ]
  assert.equal(extractLatestPlan(messages), null)
})

test('extractLatestPlan finds the last plan in a list', () => {
  const messages = [
    planToolMessage(),
    { role: 'assistant', timestamp: 3 },
    {
      ...planToolMessage(),
      toolName: 'update_plan',
      details: {
        plan: {
          title: 'Updated',
          markdown: '# Updated\nNew content',
          summary: null,
          updatedAt: 3000
        }
      }
    }
  ]
  const result = extractLatestPlan(messages)
  assert.equal(result?.title, 'Updated')
  assert.equal(result?.toolName, 'update_plan')
})

test('extractLatestPlan skips malformed plan messages at the end', () => {
  const messages = [
    planToolMessage(),
    { role: 'toolResult', toolName: 'create_plan', details: { plan: { markdown: '' } } }
  ]
  const result = extractLatestPlan(messages)
  assert.equal(result?.title, 'Test Plan')
})

// ---------------------------------------------------------------------------
// getPlanMessageKey
// ---------------------------------------------------------------------------

test('getPlanMessageKey returns null for null plan', () => {
  assert.equal(getPlanMessageKey(null), null)
})

test('getPlanMessageKey returns a deterministic key', () => {
  const plan = {
    title: 'My Plan',
    markdown: '# Content',
    summary: null,
    updatedAt: 12345,
    toolName: 'create_plan' as const
  }
  assert.equal(getPlanMessageKey(plan), 'create_plan:12345:My Plan')
})

test('getPlanMessageKey produces different keys for different plans', () => {
  const plan1 = {
    title: 'Plan A',
    markdown: '# A',
    summary: null,
    updatedAt: 100,
    toolName: 'create_plan' as const
  }
  const plan2 = {
    title: 'Plan B',
    markdown: '# B',
    summary: null,
    updatedAt: 200,
    toolName: 'update_plan' as const
  }
  assert.notEqual(getPlanMessageKey(plan1), getPlanMessageKey(plan2))
})
