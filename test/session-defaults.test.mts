import test from 'node:test'
import assert from 'node:assert/strict'

import { deriveSessionTitle, NEW_SESSION_TITLE } from '../src/shared/session-defaults.ts'

// ---------------------------------------------------------------------------
// deriveSessionTitle
// ---------------------------------------------------------------------------

test('deriveSessionTitle returns the text when short enough', () => {
  assert.equal(deriveSessionTitle('Fix the bug'), 'Fix the bug')
})

test('deriveSessionTitle truncates at 40 characters with ellipsis', () => {
  const long = 'A'.repeat(50)
  const result = deriveSessionTitle(long)
  assert.equal(result, 'A'.repeat(40) + '…')
  assert.equal(result.length, 41) // 40 chars + ellipsis
})

test('deriveSessionTitle keeps exactly 40 chars without truncation', () => {
  const exact = 'B'.repeat(40)
  assert.equal(deriveSessionTitle(exact), exact)
})

test('deriveSessionTitle trims leading and trailing whitespace', () => {
  assert.equal(deriveSessionTitle('  hello  '), 'hello')
})

test('deriveSessionTitle collapses internal whitespace', () => {
  assert.equal(deriveSessionTitle('hello   world'), 'hello world')
})

test('deriveSessionTitle returns NEW_SESSION_TITLE for empty string', () => {
  assert.equal(deriveSessionTitle(''), NEW_SESSION_TITLE)
})

test('deriveSessionTitle returns NEW_SESSION_TITLE for whitespace-only string', () => {
  assert.equal(deriveSessionTitle('   '), NEW_SESSION_TITLE)
})

test('deriveSessionTitle returns NEW_SESSION_TITLE for tabs and newlines', () => {
  assert.equal(deriveSessionTitle('\t\n  \n'), NEW_SESSION_TITLE)
})

test('deriveSessionTitle handles multiline input by collapsing newlines', () => {
  assert.equal(deriveSessionTitle('line one\nline two'), 'line one line two')
})
