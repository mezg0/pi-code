import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Drawer } from 'vaul'
import {
  ExternalLinkIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  GitPullRequestIcon,
  MenuIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon
} from 'lucide-react'

import { BranchPicker } from './branch-picker'
import { OpenInEditor } from './open-in-editor'
import { usePRStatus } from '@/hooks/use-pr-status'

import type { GroupImperativeHandle } from 'react-resizable-panels'

import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { extractLatestPlan, getPlanMessageKey } from '@/lib/plan'
import { getGitStatus, isGitRepo } from '@/lib/git'
import { gitKeys, sessionKeys } from '@/lib/query-keys'
import {
  getAgentMessages,
  onAgentMessages,
  type AgentMessage,
  type Project,
  type Session
} from '@/lib/sessions'
import { useShortcutAction } from '@/lib/shortcut-actions'
import { getShortcutDisplay } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'
import {
  loadLeftSidebarOpen,
  loadProjectViewState,
  loadToolPanelOpen,
  loadToolPanelSize,
  saveLeftSidebarOpen,
  saveProjectViewState,
  saveToolPanelOpen,
  saveToolPanelSize
} from '@/lib/view-state'
import { splitSessionsForSidebar } from '@/lib/workspace'

import { CommitDialog } from './commit-dialog'
import { SidebarProjects } from './sidebar-projects'
import { ToolPanel, type ToolTab } from './tool-panel'

export function AppShell({
  projects,
  sessions,
  activeSession,
  unreadSessionIds,
  questionSessionIds,
  permissionSessionIds,
  title,
  children,
  showPanelToggle,
  onAddProject,
  onRemoveProject,
  onCreateSession,
  onToggleArchiveSession,
  onTogglePinnedSession
}: {
  projects: Project[]
  sessions: Session[]
  activeSession: Session | null
  unreadSessionIds: Set<string>
  questionSessionIds: Set<string>
  permissionSessionIds: Set<string>
  title: string
  children: ReactNode
  showPanelToggle: boolean
  onAddProject: () => Promise<void>
  onRemoveProject: (project: Project) => Promise<void>
  onCreateSession: (
    project: Project,
    options?: { branch?: string | null; worktreePath?: string | null }
  ) => Promise<void>
  onToggleArchiveSession: (session: Session, archived: boolean) => Promise<void>
  onTogglePinnedSession: (session: Session, pinned: boolean) => Promise<void>
}): React.JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(() => loadLeftSidebarOpen())
  const [toolPanelOpen, setToolPanelOpen] = useState(() => loadToolPanelOpen())
  const [toolTabByProjectPath, setToolTabByProjectPath] = useState<Record<string, ToolTab | null>>(
    () => {
      const initial: Record<string, ToolTab | null> = {}
      for (const p of projects) {
        const stored = loadProjectViewState(p.repoPath)
        initial[p.repoPath] = stored.toolTab
      }
      return initial
    }
  )
  const { pinnedSessions, projectGroups: sessionGroups } = useMemo(
    () => splitSessionsForSidebar(projects, sessions),
    [projects, sessions]
  )
  const prStatusMap = usePRStatus(sessions)
  const activePRStatus = activeSession ? prStatusMap.get(activeSession.id) : undefined
  // Use the worktree path when available so each workspace gets its own tool state
  const activeEffectivePath = activeSession?.worktreePath ?? activeSession?.repoPath
  const activeToolTab = activeEffectivePath
    ? (toolTabByProjectPath[activeEffectivePath] ?? null)
    : null

  const handleSidebarChange = useCallback((open: boolean): void => {
    setSidebarOpen(open)
    saveLeftSidebarOpen(open)
  }, [])

  const updateActiveToolTab = useCallback(
    (tab: ToolTab | null): void => {
      if (!activeEffectivePath) return
      setToolTabByProjectPath((prev) => {
        saveProjectViewState(activeEffectivePath, { toolTab: tab })
        return { ...prev, [activeEffectivePath]: tab }
      })
    },
    [activeEffectivePath]
  )

  const setActiveToolTab = useCallback(
    (next: ToolTab | null | ((current: ToolTab | null) => ToolTab | null)): void => {
      const visibleCurrent = toolPanelOpen ? activeToolTab : null
      const resolved = typeof next === 'function' ? next(visibleCurrent) : next

      if (resolved === null) {
        setToolPanelOpen(false)
        saveToolPanelOpen(false)
        return
      }

      updateActiveToolTab(resolved)
      if (!toolPanelOpen) {
        setToolPanelOpen(true)
        saveToolPanelOpen(true)
      }
    },
    [toolPanelOpen, activeToolTab, updateActiveToolTab]
  )

  const toggleToolPanel = useCallback((): void => {
    const nextOpen = !toolPanelOpen
    setToolPanelOpen(nextOpen)
    saveToolPanelOpen(nextOpen)
    // If opening and no tab is set, default to git
    if (nextOpen && !activeToolTab) {
      updateActiveToolTab('git')
    }
  }, [toolPanelOpen, activeToolTab, updateActiveToolTab])

  const rememberActiveToolTab = useCallback(
    (tab: ToolTab): void => {
      updateActiveToolTab(tab)
    },
    [updateActiveToolTab]
  )

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange} className="h-full">
      <SidebarProjects
        pinnedSessions={pinnedSessions}
        sessionGroups={sessionGroups}
        activeSession={activeSession}
        unreadSessionIds={unreadSessionIds}
        questionSessionIds={questionSessionIds}
        permissionSessionIds={permissionSessionIds}
        prStatusMap={prStatusMap}
        onAddProject={onAddProject}
        onRemoveProject={onRemoveProject}
        onCreateSession={onCreateSession}
        onToggleArchiveSession={onToggleArchiveSession}
        onTogglePinnedSession={onTogglePinnedSession}
      />

      <AppShellContent
        title={title}
        showPanelToggle={showPanelToggle}
        activeToolTab={activeToolTab}
        toolPanelOpen={toolPanelOpen}
        setActiveToolTab={setActiveToolTab}
        toggleToolPanel={toggleToolPanel}
        rememberActiveToolTab={rememberActiveToolTab}
        activeSession={activeSession}
        activePRUrl={activePRStatus?.url ?? null}
      >
        {children}
      </AppShellContent>
    </SidebarProvider>
  )
}

function AppShellContent({
  title,
  showPanelToggle,
  activeToolTab,
  toolPanelOpen,
  setActiveToolTab,
  toggleToolPanel,
  rememberActiveToolTab,
  activeSession,
  activePRUrl,
  children
}: {
  title: string
  showPanelToggle: boolean
  activeToolTab: ToolTab | null
  toolPanelOpen: boolean
  setActiveToolTab: (next: ToolTab | null | ((current: ToolTab | null) => ToolTab | null)) => void
  toggleToolPanel: () => void
  rememberActiveToolTab: (tab: ToolTab) => void
  activeSession: Session | null
  activePRUrl: string | null
  children: ReactNode
}): React.JSX.Element {
  const { state, toggleSidebar } = useSidebar()
  const isMobile = useIsMobile()
  const sidebarCollapsed = state === 'collapsed'
  const [commitOpen, setCommitOpen] = useState(false)
  const [hasPlan, setHasPlan] = useState(false)
  const [dismissedPlanKey, setDismissedPlanKey] = useState<string | null>(null)
  const [currentPlanKey, setCurrentPlanKey] = useState<string | null>(null)
  const isWorktreeSession = Boolean(activeSession?.worktreePath)
  const cwd = activeSession?.worktreePath ?? activeSession?.repoPath
  const toolPanelSize = loadToolPanelSize()

  const queryClient = useQueryClient()

  const gitRepoQuery = useQuery({
    queryKey: cwd ? gitKeys.isRepo(cwd) : ['git', 'isRepo', 'none'],
    queryFn: () => isGitRepo(cwd!),
    enabled: Boolean(cwd),
    staleTime: 5_000,
    gcTime: 15 * 60_000,
    refetchInterval: cwd ? 5_000 : false
  })

  const gitStatusQuery = useQuery({
    queryKey: cwd ? gitKeys.status(cwd) : ['git', 'status', 'none'],
    queryFn: () => getGitStatus(cwd!),
    enabled: Boolean(cwd) && gitRepoQuery.data === true,
    staleTime: 3_000,
    gcTime: 15 * 60_000,
    refetchInterval: cwd && gitRepoQuery.data === true ? 5_000 : false
  })

  const hasChanges = gitRepoQuery.data === true ? (gitStatusQuery.data?.hasChanges ?? false) : false
  const branchName = gitRepoQuery.data === true ? (gitStatusQuery.data?.branch ?? '') : ''

  const planVisible = hasPlan && currentPlanKey !== dismissedPlanKey
  const displayedToolTab = activeToolTab ?? 'git'

  // Keep the split layout structurally stable: always render both panels and
  // drive open/close by updating the group layout. This avoids remounting the
  // tool panel subtree (browser/terminal) and eliminates flaky defaultSize
  // behavior when switching sessions.
  const panelGroupRef = useRef<GroupImperativeHandle>(null)
  const syncingLayoutRef = useRef(false)

  useLayoutEffect(() => {
    const group = panelGroupRef.current
    if (!group) return

    const size = loadToolPanelSize()
    syncingLayoutRef.current = true
    group.setLayout(toolPanelOpen ? { main: 100 - size, tool: size } : { main: 100, tool: 0 })

    const frameId = window.requestAnimationFrame(() => {
      syncingLayoutRef.current = false
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      syncingLayoutRef.current = false
    }
  }, [toolPanelOpen])

  // Save tool panel size on user-initiated resize only.
  const handleToolPanelResize = useCallback(
    (size: { asPercentage: number }, _id: string | number | undefined, prev: unknown): void => {
      if (prev == null || syncingLayoutRef.current) return
      if (size.asPercentage <= 0) return
      saveToolPanelSize(size.asPercentage)
    },
    []
  )

  const handleDismissPlan = useCallback(() => {
    if (currentPlanKey) {
      setDismissedPlanKey(currentPlanKey)
    }
    // If the plan tab is active, switch to git instead of closing the panel
    setActiveToolTab((current) => (current === 'plan' ? 'git' : current))
  }, [currentPlanKey, setActiveToolTab])

  // Track tool panel state in refs so the plan effect can read them without re-running
  const activeToolTabRef = useRef(activeToolTab)
  const toolPanelOpenRef = useRef(toolPanelOpen)
  useEffect(() => {
    activeToolTabRef.current = activeToolTab
    toolPanelOpenRef.current = toolPanelOpen
  }, [activeToolTab, toolPanelOpen])

  useEffect(() => {
    if (!activeSession?.id) {
      /* eslint-disable react-hooks/set-state-in-effect -- resetting state when session changes is intentional */
      setHasPlan(false)
      setCurrentPlanKey(null)
      setDismissedPlanKey(null)
      /* eslint-enable react-hooks/set-state-in-effect */
      return
    }

    const sessionId = activeSession.id
    let disposed = false
    let lastPlanKey: string | null | undefined = undefined

    setDismissedPlanKey(null)

    const applyMessages = (messages: AgentMessage[]): void => {
      if (disposed) return
      lastPlanKey = getPlanMessageKey(extractLatestPlan(messages))
      setHasPlan(Boolean(lastPlanKey))
      setCurrentPlanKey(lastPlanKey)
      if (!lastPlanKey && activeToolTabRef.current === 'plan') {
        if (toolPanelOpenRef.current) {
          setActiveToolTab('git')
        } else {
          rememberActiveToolTab('git')
        }
      }
    }

    // Read from the React Query cache first (populated by the session
    // route loader) so switching sessions doesn't trigger a second
    // network round-trip for messages we already have.
    const cached = queryClient.getQueryData<AgentMessage[]>(sessionKeys.messages(sessionId))
    if (cached) {
      applyMessages(cached)
    } else {
      void queryClient
        .fetchQuery({
          queryKey: sessionKeys.messages(sessionId),
          queryFn: () => getAgentMessages(sessionId)
        })
        .then(applyMessages)
        .catch(() => {
          if (disposed) return
          lastPlanKey = null
          setHasPlan(false)
          setCurrentPlanKey(null)
          if (activeToolTabRef.current === 'plan') {
            if (toolPanelOpenRef.current) {
              setActiveToolTab('git')
            } else {
              rememberActiveToolTab('git')
            }
          }
        })
    }

    const unsubscribe = onAgentMessages((payload) => {
      if (payload.sessionId !== sessionId) return

      // Keep the shared cache in sync so any consumer (route loader,
      // plan view, this effect) sees the latest authoritative message list.
      queryClient.setQueryData(sessionKeys.messages(sessionId), payload.messages)

      const nextPlanKey = getPlanMessageKey(extractLatestPlan(payload.messages))
      setHasPlan(Boolean(nextPlanKey))
      setCurrentPlanKey(nextPlanKey)

      if (nextPlanKey && nextPlanKey !== lastPlanKey) {
        setActiveToolTab('plan')
      } else if (!nextPlanKey && activeToolTabRef.current === 'plan') {
        if (toolPanelOpenRef.current) {
          setActiveToolTab('git')
        } else {
          rememberActiveToolTab('git')
        }
      }

      lastPlanKey = nextPlanKey ?? null
    })

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [activeSession?.id, queryClient, rememberActiveToolTab, setActiveToolTab])

  function handleCommitOpenChange(open: boolean): void {
    setCommitOpen(open)
  }

  // --- Shell keyboard actions ---
  useShortcutAction('toggle-sidebar', toggleSidebar)

  const hasSession = Boolean(activeSession)

  useShortcutAction(
    'toggle-panel',
    useCallback(() => toggleToolPanel(), [toggleToolPanel]),
    {
      enabled: hasSession
    }
  )

  useShortcutAction(
    'open-commit',
    useCallback(() => {
      if (cwd && hasChanges) setCommitOpen(true)
    }, [cwd, hasChanges]),
    { enabled: hasSession }
  )

  useShortcutAction(
    'tab-plan',
    useCallback(() => setActiveToolTab('plan'), [setActiveToolTab]),
    { enabled: hasSession }
  )
  useShortcutAction(
    'tab-git',
    useCallback(() => setActiveToolTab('git'), [setActiveToolTab]),
    { enabled: hasSession }
  )
  useShortcutAction(
    'tab-terminal',
    useCallback(() => setActiveToolTab('terminal'), [setActiveToolTab]),
    { enabled: hasSession }
  )
  useShortcutAction(
    'tab-files',
    useCallback(() => setActiveToolTab('files'), [setActiveToolTab]),
    { enabled: hasSession }
  )
  useShortcutAction(
    'tab-browser',
    useCallback(() => setActiveToolTab('browser'), [setActiveToolTab]),
    { enabled: hasSession }
  )

  return (
    <SidebarInset className="flex min-w-0 flex-col overflow-hidden bg-background">
      <header
        className={cn(
          'drag-region flex h-11 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border px-4 transition-[padding] duration-200',
          sidebarCollapsed && 'pl-4 md:pl-20'
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          className="no-drag shrink-0 md:hidden"
          onClick={toggleSidebar}
        >
          <MenuIcon />
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        {/* Desktop header actions */}
        <div className="hidden items-center gap-1 md:flex">
          {cwd ? (
            <>
              {isWorktreeSession ? (
                <span className="flex shrink-0 items-center gap-1 rounded-md border border-border/50 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                  <GitBranchIcon className="size-3" />
                  Worktree
                </span>
              ) : null}
              <BranchPicker cwd={cwd} currentBranch={branchName} disabled={hasChanges} />

              {activePRUrl ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="outline" size="sm" className="no-drag shrink-0">
                      <a href={activePRUrl} target="_blank" rel="noreferrer">
                        <GitPullRequestIcon data-icon="inline-start" />
                        View PR
                        <ExternalLinkIcon
                          data-icon="inline-end"
                          className="size-3 text-muted-foreground"
                        />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open pull request</TooltipContent>
                </Tooltip>
              ) : null}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="no-drag shrink-0"
                    disabled={!hasChanges}
                    onClick={() => setCommitOpen(true)}
                  >
                    <GitCommitHorizontalIcon data-icon="inline-start" />
                    Commit
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Commit changes{' '}
                  <kbd className="ml-1.5 inline-flex font-sans text-[11px] opacity-60">
                    {getShortcutDisplay('open-commit')}
                  </kbd>
                </TooltipContent>
              </Tooltip>

              <OpenInEditor cwd={cwd} />
            </>
          ) : null}
          {showPanelToggle ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="no-drag shrink-0"
                  onClick={toggleToolPanel}
                >
                  {toolPanelOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {toolPanelOpen ? 'Close panel' : 'Open panel'}{' '}
                <kbd className="ml-1.5 inline-flex font-sans text-[11px] opacity-60">
                  {getShortcutDisplay('toggle-panel')}
                </kbd>
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        {/* Mobile header actions */}
        <div className="flex items-center gap-1 md:hidden">
          {activePRUrl ? (
            <Button asChild variant="ghost" size="icon-sm" className="no-drag shrink-0">
              <a href={activePRUrl} target="_blank" rel="noreferrer" aria-label="Open pull request">
                <GitPullRequestIcon />
              </a>
            </Button>
          ) : null}
          {cwd && showPanelToggle ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="no-drag shrink-0"
              onClick={toggleToolPanel}
            >
              {toolPanelOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
            </Button>
          ) : null}
        </div>
      </header>

      <CommitDialog
        open={commitOpen}
        onOpenChange={handleCommitOpenChange}
        cwd={cwd}
        sessionId={activeSession?.id}
      />

      <div className="min-w-0 flex-1 overflow-hidden">
        {showPanelToggle ? (
          <>
            {/* Desktop: resizable split */}
            <div className="hidden h-full md:block">
              <ResizablePanelGroup
                groupRef={panelGroupRef}
                orientation="horizontal"
                className="min-w-0 overflow-hidden"
              >
                <ResizablePanel
                  id="main"
                  defaultSize={toolPanelOpen ? 100 - toolPanelSize : 100}
                  minSize={30}
                  className="min-w-0 overflow-hidden"
                >
                  {children}
                </ResizablePanel>

                <ResizableHandle
                  className={cn(!toolPanelOpen && 'pointer-events-none opacity-0')}
                />
                <ResizablePanel
                  id="tool"
                  defaultSize={toolPanelSize}
                  minSize={20}
                  collapsible
                  collapsedSize={0}
                  onResize={handleToolPanelResize}
                  className="min-w-0 overflow-hidden"
                >
                  <ToolPanel
                    activeTab={displayedToolTab}
                    onSelect={setActiveToolTab}
                    onClose={() => setActiveToolTab(null)}
                    cwd={cwd}
                    sessionId={activeSession?.id}
                    hasPlan={planVisible}
                    onDismissPlan={handleDismissPlan}
                    open={toolPanelOpen}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>

            {/* Mobile: content always visible, tool panel opens as bottom sheet */}
            <div className="flex h-full flex-col md:hidden">
              {children}
              {isMobile && (
                <Drawer.Root
                  open={toolPanelOpen}
                  onOpenChange={(open) => {
                    if (!open) {
                      if (displayedToolTab === 'plan') handleDismissPlan()
                      setActiveToolTab(null)
                    }
                  }}
                >
                  <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
                    <Drawer.Content
                      className="fixed inset-x-0 bottom-0 z-50 flex h-[100dvh] flex-col rounded-t-xl bg-background"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <div className="mx-auto mt-3 mb-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/20" />
                      <Drawer.Title className="sr-only">Tools</Drawer.Title>
                      <div className="min-h-0 flex-1 overflow-hidden">
                        <ToolPanel
                          activeTab={displayedToolTab}
                          onSelect={setActiveToolTab}
                          onClose={() => setActiveToolTab(null)}
                          cwd={cwd}
                          sessionId={activeSession?.id}
                          hasPlan={planVisible}
                          onDismissPlan={() => {
                            handleDismissPlan()
                            setActiveToolTab(null)
                          }}
                          mobile
                          open={toolPanelOpen}
                          onCommit={() => setCommitOpen(true)}
                          hasChanges={hasChanges}
                        />
                      </div>
                    </Drawer.Content>
                  </Drawer.Portal>
                </Drawer.Root>
              )}
            </div>
          </>
        ) : (
          children
        )}
      </div>
    </SidebarInset>
  )
}
