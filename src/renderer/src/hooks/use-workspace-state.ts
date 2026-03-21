import { useEffect, useMemo, useRef, useState } from 'react'

import { onSessionUpdated } from '@/lib/sessions'
import type { WorkspaceData } from '@/lib/workspace'
import { upsertSession } from '@/lib/workspace'

/**
 * Deduplicate sessions by id, keeping the first occurrence.
 * This is a safety net against race conditions between loader data
 * and real-time session update events.
 */
function deduplicateSessions(sessions: WorkspaceData['sessions']): WorkspaceData['sessions'] {
  const seen = new Set<string>()
  const unique = sessions.filter((session) => {
    if (seen.has(session.id)) return false
    seen.add(session.id)
    return true
  })
  return unique.length === sessions.length ? sessions : unique
}

export function useWorkspaceState(initialWorkspace: WorkspaceData): WorkspaceData {
  const [workspace, setWorkspace] = useState(initialWorkspace)

  // Sync initialWorkspace into state synchronously during render (React-recommended
  // pattern for adjusting state when a prop changes). This eliminates the timing
  // gap that useEffect would introduce — onSessionUpdated events that fire between
  // render and effect would otherwise apply upsertSession against stale state,
  // potentially creating duplicates.
  const prevInitialRef = useRef(initialWorkspace)
  // eslint-disable-next-line react-hooks/refs -- React-recommended pattern for adjusting state when a prop changes during render
  if (prevInitialRef.current !== initialWorkspace) {
    // eslint-disable-next-line react-hooks/refs -- React-recommended pattern for adjusting state when a prop changes during render
    prevInitialRef.current = initialWorkspace
    setWorkspace(initialWorkspace)
  }

  useEffect(() => {
    return onSessionUpdated((session) => {
      setWorkspace((current) => ({
        ...current,
        sessions: upsertSession(current.sessions, session)
      }))
    })
  }, [])

  // Safety-net deduplication — guarantees no duplicate session ids reach the UI
  // regardless of how they were introduced.
  return useMemo(() => {
    const dedupedSessions = deduplicateSessions(workspace.sessions)
    return dedupedSessions === workspace.sessions
      ? workspace
      : { ...workspace, sessions: dedupedSessions }
  }, [workspace])
}
