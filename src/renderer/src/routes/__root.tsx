import { useCallback, useEffect, useMemo } from 'react'
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

  async function handleCreateSession(project: Project): Promise<void> {
    const session = await createSession({
      title: NEW_SESSION_TITLE,
      repoPath: project.repoPath,
      taskInstruction: '',
      agent: DEFAULT_AGENT,
      model: DEFAULT_MODEL
    })

    await router.invalidate()
    await navigate({ to: '/sessions/$sessionId/overview', params: { sessionId: session.id } })
  }

  async function handleToggleArchiveSession(session: Session, archived: boolean): Promise<void> {
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
