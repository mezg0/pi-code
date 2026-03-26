import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'

import { getGitPRStatus } from '@/lib/git'
import { gitKeys } from '@/lib/query-keys'
import type { GitPRStatus, Session } from '@/lib/sessions'

const POLL_INTERVAL = 30_000

type PRStatusMap = Map<string, GitPRStatus>

export function usePRStatus(sessions: Session[]): PRStatusMap {
  const worktreeSessions = sessions.filter(
    (session) => !session.archived && session.worktreePath && session.branch
  )

  const results = useQueries({
    queries: worktreeSessions.map((session) => ({
      queryKey: gitKeys.prStatus(session.repoPath, session.branch!),
      queryFn: () => getGitPRStatus(session.repoPath, session.branch!),
      staleTime: POLL_INTERVAL,
      refetchInterval: POLL_INTERVAL,
      enabled: Boolean(session.branch)
    }))
  })

  return useMemo(() => {
    const next = new Map<string, GitPRStatus>()
    worktreeSessions.forEach((session, index) => {
      const data = results[index]?.data
      if (data) {
        next.set(session.id, data)
      }
    })
    return next
  }, [results, worktreeSessions])
}
