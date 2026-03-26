import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  onPermissionEvent,
  onQuestionEvent,
  removeProject,
  updateSession,
  type Project,
  type Session
} from '@/lib/sessions'
import { clearProjectViewState } from '@/lib/view-state'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'

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

  // Track sessions with pending permission requests for sidebar indicators
  const [permissionSessionIds, setPermissionSessionIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    return onPermissionEvent((payload) => {
      setPermissionSessionIds((prev) => {
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

  // --- Worktree archive alert dialog state ---
  const [worktreeArchiveDialog, setWorktreeArchiveDialog] = useState<{
    session: Session
    displayPath: string
  } | null>(null)
  const worktreeArchiveResolveRef = useRef<((shouldDelete: boolean) => void) | null>(null)

  function promptWorktreeDelete(session: Session, displayPath: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      worktreeArchiveResolveRef.current = resolve
      setWorktreeArchiveDialog({ session, displayPath })
    })
  }

  function handleWorktreeDialogChoice(shouldDelete: boolean): void {
    worktreeArchiveResolveRef.current?.(shouldDelete)
    worktreeArchiveResolveRef.current = null
    setWorktreeArchiveDialog(null)
  }

  async function handleToggleArchiveSession(session: Session, archived: boolean): Promise<void> {
    // Worktree cleanup: if archiving a session that has a worktree, always
    // delete the worktree. If there are uncommitted changes, warn first.
    if (archived && session.worktreePath) {
      const isOrphaned = !workspace.sessions.some(
        (s) => s.id !== session.id && s.worktreePath === session.worktreePath && !s.archived
      )
      if (isOrphaned) {
        // Check for uncommitted changes in the worktree
        try {
          const gitStatus = await window.git.status(session.worktreePath)
          if (gitStatus.hasChanges) {
            const displayPath = session.worktreePath.split('/').pop() ?? session.worktreePath
            const confirmed = await promptWorktreeDelete(session, displayPath)
            if (!confirmed) return // Cancel the archive entirely
          }
        } catch {
          // If we can't check status, proceed with deletion anyway
        }

        try {
          await window.git.removeWorktree(session.repoPath, session.worktreePath, true)
        } catch (err) {
          console.error('Failed to remove worktree:', err)
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
    <>
      <AppShell
        projects={workspace.projects}
        sessions={workspace.sessions}
        activeSession={activeSession}
        unreadSessionIds={unreadSessionIds}
        questionSessionIds={questionSessionIds}
        permissionSessionIds={permissionSessionIds}
        title={isSettings ? 'Settings' : (activeSession?.title ?? 'Sessions')}
        showPanelToggle={Boolean(activeSession) && !isSettings}
        onAddProject={handleAddProject}
        onRemoveProject={handleRemoveProject}
        onCreateSession={handleCreateSession}
        onToggleArchiveSession={handleToggleArchiveSession}
      >
        <Outlet />
      </AppShell>

      <AlertDialog
        open={worktreeArchiveDialog !== null}
        onOpenChange={(open) => {
          if (!open) handleWorktreeDialogChoice(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uncommitted changes</AlertDialogTitle>
            <AlertDialogDescription>
              The worktree at &ldquo;{worktreeArchiveDialog?.displayPath}&rdquo; has uncommitted
              changes that will be lost. Are you sure you want to archive this session and delete the
              worktree?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleWorktreeDialogChoice(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => handleWorktreeDialogChoice(true)}
            >
              Archive &amp; delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export const Route = createRootRoute({
  loader: loadWorkspace,
  component: RootComponent
})
