import test from 'node:test'
import assert from 'node:assert/strict'

import { formatUserFacingError } from '../src/shared/format-error.ts'

// ---------------------------------------------------------------------------
// formatUserFacingError
// ---------------------------------------------------------------------------

test('extracts API key error and rewrites action text', () => {
  const error = new Error(
    'No API key found for anthropic.\n\nUse /login or set an API key via ANTHROPIC_API_KEY env var.'
  )
  assert.equal(
    formatUserFacingError(error),
    'No API key found for anthropic. Open Settings to add your API key.'
  )
})

test('handles API key error for different providers', () => {
  assert.equal(
    formatUserFacingError(new Error('No API key found for openai.\nSome extra info')),
    'No API key found for openai. Open Settings to add your API key.'
  )
})

test('returns first line for generic Error', () => {
  const error = new Error('Something went wrong\nStack trace line 1\nStack trace line 2')
  assert.equal(formatUserFacingError(error), 'Something went wrong')
})

test('truncates long first lines at 200 chars', () => {
  const longMessage = 'X'.repeat(300)
  const error = new Error(longMessage)
  const result = formatUserFacingError(error)
  assert.equal(result, 'X'.repeat(200) + '…')
  assert.equal(result.length, 201)
})

test('does not truncate messages at exactly 200 chars', () => {
  const exact = 'Y'.repeat(200)
  assert.equal(formatUserFacingError(new Error(exact)), exact)
})

test('handles string errors', () => {
  assert.equal(formatUserFacingError('plain string error'), 'plain string error')
})

test('handles non-string non-Error values', () => {
  assert.equal(formatUserFacingError(42), '42')
  assert.equal(formatUserFacingError(null), 'null')
  assert.equal(formatUserFacingError(undefined), 'undefined')
})

test('trims whitespace from first line', () => {
  assert.equal(formatUserFacingError(new Error('  spaced message  \nmore')), 'spaced message')
})

test('handles empty error message', () => {
  assert.equal(formatUserFacingError(new Error('')), '')
})
