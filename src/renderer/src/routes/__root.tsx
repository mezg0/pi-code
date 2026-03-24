import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Outlet,
  createRootRoute,
  useMatchRoute,
  useNavigate,
  useRouter
} from '@tanstack/react-router'
import { useHotkey } from '@tanstack/react-hotkeys'

import { useWorkspaceState } from '@/hooks/use-workspace-state'
import { SHORTCUTS } from '@/lib/shortcuts'
import { loadWorkspace } from '@/lib/workspace'
import { AppShell } from '@/components/shell/app-shell'
import {
  addProject,
  createSession,
  DEFAULT_AGENT,
  DEFAULT_MODEL,
  NEW_SESSION_TITLE,
  onQuestionEvent,
  removeProject,
  updateSession,
  type Project,
  type Session
} from '@/lib/sessions'
import { clearProjectViewState } from '@/lib/view-state'

import {
  hasUnseenSessionCompletion,
  loadSessionVisitedAt,
  markSessionVisited
} from '@/lib/session-sidebar'

function RootComponent(): React.JSX.Element {
  const router = useRouter()
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const initialWorkspace = Route.useLoaderData()
  const workspace = useWorkspaceState(initialWorkspace)
  const sessionMatch = matchRoute({ to: '/sessions/$sessionId/overview', fuzzy: true })
  const activeSessionId =
    sessionMatch && 'sessionId' in sessionMatch ? sessionMatch.sessionId : undefined
  const activeSession = workspace.sessions.find((session) => session.id === activeSessionId) ?? null
  const isSettings = Boolean(matchRoute({ to: '/settings' }))
  const visitedAtBySessionId = loadSessionVisitedAt()

  useEffect(() => {
    if (!activeSessionId) {
      return
    }

    markSessionVisited(loadSessionVisitedAt(), activeSessionId)
  }, [activeSessionId, activeSession?.updatedAt])

  // Track sessions with pending questions globally for sidebar indicators
  const [questionSessionIds, setQuestionSessionIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    return onQuestionEvent((payload) => {
      setQuestionSessionIds((prev) => {
        const next = new Set(prev)
        if (payload.request) {
          next.add(payload.sessionId)
        } else {
          next.delete(payload.sessionId)
        }
        return next
      })
    })
  }, [])

  const unreadSessionIds = useMemo(() => {
    return new Set(
      workspace.sessions
        .filter((session) => session.id !== activeSessionId)
        .filter((session) => hasUnseenSessionCompletion(session, visitedAtBySessionId[session.id]))
        .map((session) => session.id)
    )
  }, [activeSessionId, visitedAtBySessionId, workspace.sessions])

  async function handleAddProject(): Promise<void> {
    const project = await addProject()
    if (!project) return
    await router.invalidate()
  }

  async function handleRemoveProject(project: Project): Promise<void> {
    const removed = await removeProject(project.id)
    if (!removed) return

    clearProjectViewState(project.repoPath)

    if (activeSession?.repoPath === project.repoPath) {
      await navigate({ to: '/' })
    }

    await router.invalidate()
  }

  async function handleCreateSession(
    project: Project,
    options?: { branch?: string | null; worktreePath?: string | null }
  ): Promise<void> {
    const session = await createSession({
      title: options?.branch ?? NEW_SESSION_TITLE,
      repoPath: project.repoPath,
      taskInstruction: '',
      agent: DEFAULT_AGENT,
      model: DEFAULT_MODEL,
      branch: options?.branch ?? null,
      worktreePath: options?.worktreePath ?? null
    })

    await router.invalidate()
    await navigate({ to: '/sessions/$sessionId/overview', params: { sessionId: session.id } })
  }

  async function handleToggleArchiveSession(session: Session, archived: boolean): Promise<void> {
    // Worktree cleanup: if archiving a session that has a worktree, check if
    // it's the only session using that worktree and offer to delete it.
    if (archived && session.worktreePath) {
      const isOrphaned = !workspace.sessions.some(
        (s) => s.id !== session.id && s.worktreePath === session.worktreePath && !s.archived
      )
      if (isOrphaned) {
        const displayPath = session.worktreePath.split('/').pop() ?? session.worktreePath
        // eslint-disable-next-line no-restricted-globals
        const shouldDelete = confirm(
          `This session has a worktree at "${displayPath}".\n\nDelete the worktree too?`
        )
        if (shouldDelete) {
          try {

            await window.git.removeWorktree(session.repoPath, session.worktreePath, true)
          } catch (err) {
            console.error('Failed to remove worktree:', err)
          }
        }
      }
    }

    const updatedSession = await updateSession(session.id, { archived })
    if (!updatedSession) return

    if (archived && activeSession?.id === session.id) {
      await navigate({ to: '/' })
    }

    await router.invalidate()
  }

  // --- Global keyboard shortcuts ---
  const activeProject = workspace.projects.find((p) => p.repoPath === activeSession?.repoPath)
  const firstProject = workspace.projects[0]

  useHotkey(
    SHORTCUTS['new-session'].keys,
    useCallback(() => {
      const project = activeProject ?? firstProject
      if (project) void handleCreateSession(project)
    }, [activeProject, firstProject]) // eslint-disable-line react-hooks/exhaustive-deps
  )

  useHotkey(
    SHORTCUTS['open-settings'].keys,
    useCallback(() => {
      void navigate({ to: '/settings' })
    }, [navigate])
  )

  return (
    <AppShell
      projects={workspace.projects}
      sessions={workspace.sessions}
      activeSession={activeSession}
      unreadSessionIds={unreadSessionIds}
      questionSessionIds={questionSessionIds}
      title={isSettings ? 'Settings' : (activeSession?.title ?? 'Sessions')}
      showPanelToggle={Boolean(activeSession) && !isSettings}
      onAddProject={handleAddProject}
      onRemoveProject={handleRemoveProject}
      onCreateSession={handleCreateSession}
      onToggleArchiveSession={handleToggleArchiveSession}
    >
      <Outlet />
    </AppShell>
  )
}

export const Route = createRootRoute({
  loader: loadWorkspace,
  component: RootComponent
})
