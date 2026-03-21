import type { Session } from './sessions'

const SESSION_VISITED_AT_STORAGE_KEY = 'pi.session-visited-at'

export type SessionVisitedAtMap = Record<string, string>

type SessionCompletionInput = Pick<Session, 'id' | 'status' | 'updatedAt'>

export function loadSessionVisitedAt(): SessionVisitedAtMap {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const stored = window.localStorage.getItem(SESSION_VISITED_AT_STORAGE_KEY)
    if (!stored) return {}

    const parsed = JSON.parse(stored) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    )
  } catch {
    return {}
  }
}

function persistSessionVisitedAt(visitedAtBySessionId: SessionVisitedAtMap): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      SESSION_VISITED_AT_STORAGE_KEY,
      JSON.stringify(visitedAtBySessionId)
    )
  } catch {
    // Ignore storage errors to avoid breaking session navigation.
  }
}

export function markSessionVisited(
  current: SessionVisitedAtMap,
  sessionId: string,
  visitedAt = new Date().toISOString()
): SessionVisitedAtMap {
  if (current[sessionId] === visitedAt) {
    return current
  }

  const next = { ...current, [sessionId]: visitedAt }
  persistSessionVisitedAt(next)
  return next
}

export function hasUnseenSessionCompletion(
  session: SessionCompletionInput,
  lastVisitedAt?: string
): boolean {
  if (session.status !== 'awaiting_input' && session.status !== 'completed') {
    return false
  }

  const completedAt = Date.parse(session.updatedAt)
  if (Number.isNaN(completedAt)) {
    return false
  }

  if (!lastVisitedAt) {
    return true
  }

  const visitedAt = Date.parse(lastVisitedAt)
  if (Number.isNaN(visitedAt)) {
    return true
  }

  return completedAt > visitedAt
}
