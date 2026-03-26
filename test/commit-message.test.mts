import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCommitMessage, parseStatusLine } from '@pi-code/shared/commit-message'

// ---------------------------------------------------------------------------
// parseStatusLine
// ---------------------------------------------------------------------------

test('parseStatusLine parses modified file', () => {
  const result = parseStatusLine(' M src/app.ts')
  assert.equal(result.status, ' M')
  assert.equal(result.fileName, 'app.ts')
  assert.equal(result.filePath, 'src/app.ts')
})

test('parseStatusLine parses untracked file', () => {
  const result = parseStatusLine('?? new-file.txt')
  assert.equal(result.status, '??')
  assert.equal(result.fileName, 'new-file.txt')
  assert.equal(result.filePath, 'new-file.txt')
})

test('parseStatusLine parses renamed file', () => {
  const result = parseStatusLine('R  old-name.ts -> src/new-name.ts')
  assert.equal(result.status, 'R ')
  assert.equal(result.fileName, 'new-name.ts')
  assert.equal(result.filePath, 'src/new-name.ts')
})

test('parseStatusLine parses added file', () => {
  const result = parseStatusLine('A  lib/helpers.ts')
  assert.equal(result.status, 'A ')
  assert.equal(result.fileName, 'helpers.ts')
})

test('parseStatusLine parses deleted file', () => {
  const result = parseStatusLine(' D old-file.ts')
  assert.equal(result.status, ' D')
  assert.equal(result.fileName, 'old-file.ts')
})

// ---------------------------------------------------------------------------
// buildCommitMessage
// ---------------------------------------------------------------------------

test('returns "No changes" for empty input', () => {
  assert.equal(buildCommitMessage([]), 'No changes')
})

test('returns "No changes" for lines that are all empty strings', () => {
  assert.equal(buildCommitMessage(['', '', '']), 'No changes')
})

// Single-file special cases

test('single added file', () => {
  assert.equal(buildCommitMessage(['?? readme.md']), 'Add readme.md')
})

test('single staged added file', () => {
  assert.equal(buildCommitMessage(['A  index.ts']), 'Add index.ts')
})

test('single deleted file', () => {
  assert.equal(buildCommitMessage([' D old.ts']), 'Remove old.ts')
})

test('single modified file', () => {
  assert.equal(buildCommitMessage([' M app.ts']), 'Update app.ts')
})

// Multi-file summaries

test('multiple added files', () => {
  assert.equal(
    buildCommitMessage(['?? a.ts', '?? b.ts']),
    'Add 2 files'
  )
})

test('multiple modified files', () => {
  assert.equal(
    buildCommitMessage([' M a.ts', ' M b.ts', ' M c.ts']),
    'Update 3 files'
  )
})

test('mixed added and modified', () => {
  assert.equal(
    buildCommitMessage(['?? new.ts', ' M existing.ts']),
    'Add 1 file, update 1 file'
  )
})

test('mixed added, modified, and deleted', () => {
  const result = buildCommitMessage(['?? new.ts', ' M changed.ts', ' D removed.ts'])
  assert.equal(result, 'Add 1 file, update 1 file, remove 1 file')
})

test('rename with a modified file — single-file shortcut triggers for modified', () => {
  // The single-file special cases don't check renamed.length,
  // so 1 modified + 1 renamed still returns "Update other.ts"
  const result = buildCommitMessage(['R  old.ts -> new.ts', ' M other.ts'])
  assert.equal(result, 'Update other.ts')
})

test('rename-only changes', () => {
  const result = buildCommitMessage(['R  old.ts -> new.ts'])
  // No special single-rename case, falls through to multi-file summary
  assert.equal(result, 'Rename 1 file')
})

test('multiple renames', () => {
  const result = buildCommitMessage(['R  a.ts -> b.ts', 'R  c.ts -> d.ts'])
  assert.equal(result, 'Rename 2 files')
})

// Directory grouping

test('all changes in one directory', () => {
  const result = buildCommitMessage([' M src/a.ts', ' M src/b.ts'])
  assert.equal(result, 'update 2 files in src')
})

test('all changes in nested directory', () => {
  const result = buildCommitMessage([' M src/lib/a.ts', '?? src/lib/b.ts'])
  assert.equal(result, 'add 1 file, update 1 file in src/lib')
})

test('changes across multiple directories', () => {
  const result = buildCommitMessage([' M src/a.ts', ' M lib/b.ts'])
  assert.equal(result, 'Update 2 files')
})

test('root-level files mixed with directory files', () => {
  // root file has empty dir string which gets filtered out,
  // leaving only 'src' as a unique dir → single-directory behavior
  const result = buildCommitMessage([' M root.ts', ' M src/nested.ts'])
  assert.equal(result, 'update 2 files in src')
})

// Capitalization

test('multi-file message starts with capital letter', () => {
  const result = buildCommitMessage([' M a.ts', ' M b.ts'])
  assert.match(result, /^[A-Z]/)
})

test('single-directory message is lowercase (action prefix)', () => {
  const result = buildCommitMessage([' M src/a.ts', ' M src/b.ts'])
  // "update 2 files in src" — starts lowercase because it's a joined action string
  assert.match(result, /^update/)
})
