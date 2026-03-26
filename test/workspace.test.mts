import test from 'node:test'
import assert from 'node:assert/strict'

import { groupSessions, upsertSession } from '@pi-code/shared/workspace'

import type { Project, Session } from '@pi-code/shared/session'

function makeProject(repoPath: string, name?: string): Project {
  return { id: repoPath, name: name ?? repoPath.split('/').pop()!, repoPath }
}

function makeSession(id: string, repoPath: string, updatedAt?: string): Session {
  return {
    id,
    title: `Session ${id}`,
    repoPath,
    taskInstruction: '',
    agent: 'Pi',
    model: 'gpt-5',
    status: 'draft',
    archived: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: updatedAt ?? '2025-01-01T00:00:00.000Z',
    branch: null,
    worktreePath: null
  }
}

// ---------------------------------------------------------------------------
// groupSessions
// ---------------------------------------------------------------------------

test('groupSessions groups sessions by project repoPath', () => {
  const projects = [makeProject('/repo/a'), makeProject('/repo/b')]
  const sessions = [
    makeSession('1', '/repo/a'),
    makeSession('2', '/repo/b'),
    makeSession('3', '/repo/a')
  ]
  const groups = groupSessions(projects, sessions)

  assert.equal(groups.length, 2)
  assert.equal(groups[0].project.repoPath, '/repo/a')
  assert.equal(groups[0].sessions.length, 2)
  assert.deepEqual(
    groups[0].sessions.map((s) => s.id),
    ['1', '3']
  )
  assert.equal(groups[1].project.repoPath, '/repo/b')
  assert.equal(groups[1].sessions.length, 1)
})

test('groupSessions returns empty sessions array for projects with no sessions', () => {
  const projects = [makeProject('/repo/a')]
  const groups = groupSessions(projects, [])

  assert.equal(groups.length, 1)
  assert.equal(groups[0].sessions.length, 0)
})

test('groupSessions handles empty projects array', () => {
  const groups = groupSessions([], [makeSession('1', '/repo/a')])
  assert.equal(groups.length, 0)
})

// ---------------------------------------------------------------------------
// upsertSession
// ---------------------------------------------------------------------------

test('upsertSession adds a new session and sorts by updatedAt', () => {
  const existing = [makeSession('1', '/repo', '2025-01-01T00:00:00.000Z')]
  const newSession = makeSession('2', '/repo', '2025-06-01T00:00:00.000Z')

  const result = upsertSession(existing, newSession)
  assert.equal(result.length, 2)
  assert.equal(result[0].id, '2') // newer first
  assert.equal(result[1].id, '1')
})

test('upsertSession replaces an existing session by id', () => {
  const existing = [
    makeSession('1', '/repo', '2025-01-01T00:00:00.000Z'),
    makeSession('2', '/repo', '2025-02-01T00:00:00.000Z')
  ]
  const updated: Session = {
    ...makeSession('1', '/repo', '2025-12-01T00:00:00.000Z'),
    title: 'Updated title'
  }

  const result = upsertSession(existing, updated)
  assert.equal(result.length, 2)
  assert.equal(result[0].id, '1') // now newest
  assert.equal(result[0].title, 'Updated title')
})

test('upsertSession does not mutate the original array', () => {
  const existing = [makeSession('1', '/repo')]
  const newSession = makeSession('2', '/repo', '2025-06-01T00:00:00.000Z')

  const result = upsertSession(existing, newSession)
  assert.equal(existing.length, 1)
  assert.equal(result.length, 2)
  assert.notStrictEqual(result, existing)
})

test('upsertSession into empty array', () => {
  const result = upsertSession([], makeSession('1', '/repo'))
  assert.equal(result.length, 1)
  assert.equal(result[0].id, '1')
})
