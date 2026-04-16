import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Outlet,
  createRootRouteWithContext,
  useMatchRoute,
  useNavigate,
  useRouter
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { useHotkeys, type UseHotkeyDefinition } from '@tanstack/react-hotkeys'

import { useWorkspaceState } from '@/hooks/use-workspace-state'
import { SHORTCUTS, type ShortcutId } from '@/lib/shortcuts'
import { emitAction, type ShortcutActionId } from '@/lib/shortcut-actions'
import { loadWorkspace, splitSessionsForSidebar } from '@/lib/workspace'
import { AppShell } from '@/components/shell/app-shell'
import { ShortcutsCheatsheetDialog } from '@/components/shell/shortcuts-cheatsheet'
import { getGitStatus, removeGitWorktree } from '@/lib/git'
import { createWorktreeSession, resolveCurrentLocalBranch } from '@/lib/worktree'
import { pickAndAddProject } from '@/lib/native'
import {
  createSession,
  DEFAULT_AGENT,
  DEFAULT_MODEL,
  getPendingPermission,
  getPendingQuestion,
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

type PendingSessionPayload<Request> = {
  sessionId: string
  request: Request | null
}

function setsEqual<T>(left: Set<T>, right: Set<T>): boolean {
  if (left.size !== right.size) {
    return false
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false
    }
  }

  return true
}

function usePendingSessionIds<Request>(
  sessionIds: string[],
  subscribe: (listener: (payload: PendingSessionPayload<Request>) => void) => () => void,
  getPending: (sessionId: string) => Promise<Request | null>
): Set<string> {
  const [pendingSessionIds, setPendingSessionIds] = useState<Set<string>>(new Set())
  const versionBySessionIdRef = useRef(new Map<string, number>())

  useEffect(() => {
    return subscribe((payload) => {
      const nextVersion = (versionBySessionIdRef.current.get(payload.sessionId) ?? 0) + 1
      versionBySessionIdRef.current.set(payload.sessionId, nextVersion)

      setPendingSessionIds((prev) => {
        const hasSessionId = prev.has(payload.sessionId)

        if (payload.request) {
          if (hasSessionId) {
            return prev
          }

          const next = new Set(prev)
          next.add(payload.sessionId)
          return next
        }

        if (!hasSessionId) {
          return prev
        }

        const next = new Set(prev)
        next.delete(payload.sessionId)
        return next
      })
    })
  }, [subscribe])

  useEffect(() => {
    const activeSessionIds = new Set(sessionIds)

    if (sessionIds.length === 0) {
      return
    }

    let cancelled = false

    void Promise.all(
      sessionIds.map(async (sessionId) => {
        const version = versionBySessionIdRef.current.get(sessionId) ?? 0
        return {
          sessionId,
          request: await getPending(sessionId),
          version
        }
      })
    )
      .then((results) => {
        if (cancelled) return

        setPendingSessionIds((prev) => {
          const next = new Set<string>()
          for (const sessionId of prev) {
            if (activeSessionIds.has(sessionId)) {
              next.add(sessionId)
            }
          }

          for (const result of results) {
            const currentVersion = versionBySessionIdRef.current.get(result.sessionId) ?? 0
            if (currentVersion !== result.version) {
              continue
            }

            if (result.request) {
              next.add(result.sessionId)
            } else {
              next.delete(result.sessionId)
            }
          }

          return setsEqual(prev, next) ? prev : next
        })
      })
      .catch(() => {
        // Ignore hydration failures and keep listening to live events.
      })

    return () => {
      cancelled = true
    }
  }, [getPending, sessionIds])

  return useMemo(() => {
    const activeSessionIds = new Set(sessionIds)
    const filtered = new Set<string>()

    for (const sessionId of pendingSessionIds) {
      if (activeSessionIds.has(sessionId)) {
        filtered.add(sessionId)
      }
    }

    return setsEqual(pendingSessionIds, filtered) ? pendingSessionIds : filtered
  }, [pendingSessionIds, sessionIds])
}

function RootComponent(): React.JSX.Element {
  const router = useRouter()
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const initialWorkspace = Route.useLoaderData()
  const workspace = useWorkspaceState(initialWorkspace)
  const sessionMatch = matchRoute({ to: '/sessions/$sessionId/overview', fuzzy: true })
  const activeSessionId =
    sessionMatch && 'sessionId' in sessionMatch ? sessionMatch.sessionId : undefined
  const activeSession =
    workspace.sessions.find((session) => session.id === activeSessionId && !session.archived) ??
    null
  const isSettings = Boolean(matchRoute({ to: '/settings' }))
  const visitedAtBySessionId = loadSessionVisitedAt()

  useEffect(() => {
    if (!activeSessionId) {
      return
    }

    markSessionVisited(loadSessionVisitedAt(), activeSessionId)
  }, [activeSessionId, activeSession?.updatedAt])

  const sidebarSessionIds = useMemo(
    () => workspace.sessions.filter((session) => !session.archived).map((session) => session.id),
    [workspace.sessions]
  )

  // Track sessions with pending questions/permissions globally for sidebar indicators,
  // including requests that were already pending before the renderer subscribed.
  const questionSessionIds = usePendingSessionIds(
    sidebarSessionIds,
    onQuestionEvent,
    getPendingQuestion
  )
  const permissionSessionIds = usePendingSessionIds(
    sidebarSessionIds,
    onPermissionEvent,
    getPendingPermission
  )

  const unreadSessionIds = useMemo(() => {
    return new Set<string>(
      workspace.sessions
        .filter((session) => !session.archived)
        .filter((session) => session.id !== activeSessionId)
        .filter((session) => hasUnseenSessionCompletion(session, visitedAtBySessionId[session.id]))
        .map((session) => session.id)
    )
  }, [activeSessionId, visitedAtBySessionId, workspace.sessions])

  async function handleAddProject(): Promise<void> {
    const project = await pickAndAddProject()
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

  const handleCreateSession = useCallback(
    async (
      project: Project,
      options?: { branch?: string | null; worktreePath?: string | null }
    ): Promise<void> => {
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
    },
    [navigate, router]
  )

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
          const gitStatus = await getGitStatus(session.worktreePath)
          if (gitStatus.hasChanges) {
            const displayPath = session.worktreePath.split('/').pop() ?? session.worktreePath
            const confirmed = await promptWorktreeDelete(session, displayPath)
            if (!confirmed) return // Cancel the archive entirely
          }
        } catch {
          // If we can't check status, proceed with deletion anyway
        }

        try {
          await removeGitWorktree(session.repoPath, session.worktreePath, true)
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

  async function handleTogglePinnedSession(session: Session, pinned: boolean): Promise<void> {
    await updateSession(session.id, { pinned })
    await router.invalidate()
  }

  // --- Global keyboard shortcuts ---
  const activeProject = workspace.projects.find((p) => p.repoPath === activeSession?.repoPath)
  const firstProject = workspace.projects[0]

  // Cheatsheet dialog state. `Mod+K` opens it in "palette placeholder" mode
  // so the binding is taught now; `Mod+/` / `?` open the plain cheatsheet.
  const [cheatsheetState, setCheatsheetState] = useState<
    { open: false } | { open: true; mode: 'shortcuts' | 'palette-placeholder' }
  >({ open: false })

  const openCheatsheet = useCallback((mode: 'shortcuts' | 'palette-placeholder') => {
    setCheatsheetState({ open: true, mode })
  }, [])

  const handleCheatsheetOpenChange = useCallback((open: boolean) => {
    setCheatsheetState((prev) =>
      open ? (prev.open ? prev : { open: true, mode: 'shortcuts' }) : { open: false }
    )
  }, [])

  // Ordered list of visible sessions for keyboard navigation. Mirrors
  // `SidebarProjects` ordering: pinned first, then each project group's
  // non-archived sessions.
  const orderedSessions = useMemo<Session[]>(() => {
    const { pinnedSessions, projectGroups } = splitSessionsForSidebar(
      workspace.projects,
      workspace.sessions
    )
    const flat: Session[] = [...pinnedSessions]
    for (const group of projectGroups) {
      for (const session of group.sessions) {
        if (!session.archived) flat.push(session)
      }
    }
    return flat
  }, [workspace.projects, workspace.sessions])

  const navigateToSession = useCallback(
    (session: Session | undefined) => {
      if (!session) return
      void navigate({
        to: '/sessions/$sessionId/overview',
        params: { sessionId: session.id }
      })
    },
    [navigate]
  )

  const goToRelativeSession = useCallback(
    (delta: 1 | -1) => {
      if (orderedSessions.length === 0) return
      const currentIndex = orderedSessions.findIndex((s) => s.id === activeSessionId)
      const base = currentIndex === -1 ? (delta === 1 ? -1 : 0) : currentIndex
      const nextIndex = (base + delta + orderedSessions.length) % orderedSessions.length
      navigateToSession(orderedSessions[nextIndex])
    },
    [activeSessionId, navigateToSession, orderedSessions]
  )

  const jumpToSessionSlot = useCallback(
    (slot: number) => {
      const session = orderedSessions[slot - 1]
      navigateToSession(session)
    },
    [navigateToSession, orderedSessions]
  )

  // Worktree creation must not fire twice in parallel from a key repeat.
  const worktreeCreationInFlightRef = useRef(false)
  const handleNewWorktreeSession = useCallback(async (): Promise<void> => {
    if (worktreeCreationInFlightRef.current) return
    const project = activeProject ?? firstProject
    if (!project) return

    worktreeCreationInFlightRef.current = true
    try {
      const baseBranch = await resolveCurrentLocalBranch(project.repoPath)
      await createWorktreeSession(project, baseBranch, async (proj, options) => {
        await handleCreateSession(proj, options)
      })
    } catch (err) {
      alert(`Failed to create worktree: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      worktreeCreationInFlightRef.current = false
    }
  }, [activeProject, firstProject, handleCreateSession])

  // Wire every shortcut in the registry to a callback. Anything session-scoped
  // dispatches through the action bus so the active component (session view,
  // plan-mode toggle, etc.) can own the actual behaviour.
  const sessionDispatch = useCallback(
    (id: ShortcutActionId) => () => {
      emitAction(id)
    },
    []
  )

  const hotkeyBindings = useMemo<UseHotkeyDefinition[]>(() => {
    const hasSession = Boolean(activeSessionId)
    const bind = (
      id: ShortcutId,
      callback: () => void,
      extraOptions?: { enabled?: boolean }
    ): UseHotkeyDefinition => ({
      hotkey: SHORTCUTS[id].keys,
      callback,
      options: extraOptions
    })

    return [
      // Global
      bind('command-palette', () => openCheatsheet('palette-placeholder')),
      bind('show-shortcuts', () => openCheatsheet('shortcuts')),
      bind('toggle-sidebar', sessionDispatch('toggle-sidebar')),
      bind('new-session', () => {
        const project = activeProject ?? firstProject
        if (project) void handleCreateSession(project)
      }),
      bind('new-worktree-session', () => {
        void handleNewWorktreeSession()
      }),
      bind('open-settings', () => {
        void navigate({ to: '/settings' })
      }),

      // Navigation
      bind('next-session', () => goToRelativeSession(1)),
      bind('prev-session', () => goToRelativeSession(-1)),
      bind('jump-session-1', () => jumpToSessionSlot(1)),
      bind('jump-session-2', () => jumpToSessionSlot(2)),
      bind('jump-session-3', () => jumpToSessionSlot(3)),
      bind('jump-session-4', () => jumpToSessionSlot(4)),
      bind('jump-session-5', () => jumpToSessionSlot(5)),
      bind('jump-session-6', () => jumpToSessionSlot(6)),
      bind('jump-session-7', () => jumpToSessionSlot(7)),
      bind('jump-session-8', () => jumpToSessionSlot(8)),
      bind('jump-session-9', () => jumpToSessionSlot(9)),

      // Session (bus-dispatched; handler owned by the conversation / shell)
      bind('stop-response', sessionDispatch('stop-response'), { enabled: hasSession }),
      bind('open-in-editor', sessionDispatch('open-in-editor'), { enabled: hasSession }),
      bind('toggle-panel', sessionDispatch('toggle-panel'), { enabled: hasSession }),
      bind('focus-input', sessionDispatch('focus-input'), { enabled: hasSession }),
      bind('branch-picker', sessionDispatch('branch-picker'), { enabled: hasSession }),
      bind('open-commit', sessionDispatch('open-commit'), { enabled: hasSession }),
      bind('scroll-to-bottom', sessionDispatch('scroll-to-bottom'), { enabled: hasSession }),

      // Modes
      bind('toggle-plan-mode', sessionDispatch('toggle-plan-mode'), { enabled: hasSession }),
      bind('cycle-permission-mode', sessionDispatch('cycle-permission-mode'), {
        enabled: hasSession
      }),
      bind('cycle-thinking-level', sessionDispatch('cycle-thinking-level'), {
        enabled: hasSession
      }),
      bind('open-model-picker', sessionDispatch('open-model-picker'), { enabled: hasSession }),

      // Tool tabs
      bind('tab-plan', sessionDispatch('tab-plan'), { enabled: hasSession }),
      bind('tab-git', sessionDispatch('tab-git'), { enabled: hasSession }),
      bind('tab-terminal', sessionDispatch('tab-terminal'), { enabled: hasSession }),
      bind('tab-files', sessionDispatch('tab-files'), { enabled: hasSession }),
      bind('tab-browser', sessionDispatch('tab-browser'), { enabled: hasSession })
    ]
  }, [
    activeProject,
    activeSessionId,
    firstProject,
    goToRelativeSession,
    handleCreateSession,
    handleNewWorktreeSession,
    jumpToSessionSlot,
    navigate,
    openCheatsheet,
    sessionDispatch
  ])

  useHotkeys(hotkeyBindings)

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
        onTogglePinnedSession={handleTogglePinnedSession}
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
              changes that will be lost. Are you sure you want to archive this session and delete
              the worktree?
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

      <ShortcutsCheatsheetDialog
        open={cheatsheetState.open}
        mode={cheatsheetState.open ? cheatsheetState.mode : 'shortcuts'}
        onOpenChange={handleCheatsheetOpenChange}
      />
    </>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: loadWorkspace,
  component: RootComponent
})
