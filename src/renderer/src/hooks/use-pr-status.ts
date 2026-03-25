import { useEffect, useRef, useState } from 'react'
import type { GitPRStatus, Session } from '@/lib/sessions'

/** How often to re-check PR status (ms) */
const POLL_INTERVAL = 60_000

type PRStatusMap = Map<string, GitPRStatus>

/**
 * Fetches PR status for all worktree sessions and polls periodically.
 * Returns a map of session ID → GitPRStatus.
 */
export function usePRStatus(sessions: Session[]): PRStatusMap {
  const [statusMap, setStatusMap] = useState<PRStatusMap>(new Map())
  const mountedRef = useRef(true)

  // Only care about worktree sessions that have a branch
  const worktreeSessions = sessions.filter((s) => s.worktreePath && s.branch)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (worktreeSessions.length === 0) {
      setStatusMap(new Map())
      return
    }

    async function fetchAll(): Promise<void> {
      const next = new Map<string, GitPRStatus>()

      // Fetch PR status for each worktree session concurrently
      const results = await Promise.allSettled(
        worktreeSessions.map(async (session) => {
          const status = await window.git.getPRStatus(session.repoPath, session.branch!)
          return { sessionId: session.id, status }
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          next.set(result.value.sessionId, result.value.status)
        }
      }

      if (mountedRef.current) {
        setStatusMap(next)
      }
    }

    void fetchAll()
    const timer = setInterval(() => void fetchAll(), POLL_INTERVAL)
    return () => clearInterval(timer)
    // Re-run when the set of worktree session IDs changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worktreeSessions.map((s) => s.id).join(',')])

  return statusMap
}
