import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { GitCommitHorizontalIcon, PanelRightCloseIcon, PanelRightOpenIcon } from 'lucide-react'

import { BranchPicker } from './branch-picker'

import type { GroupImperativeHandle } from 'react-resizable-panels'

import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useHotkey } from '@tanstack/react-hotkeys'
import { extractLatestPlan, getPlanMessageKey } from '@/lib/plan'
import { getAgentMessages, onAgentMessages, type Project, type Session } from '@/lib/sessions'
import { getShortcutDisplay, SHORTCUTS } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'
import {
  DEFAULT_TOOL_PANEL_SIZE,
  loadLeftSidebarOpen,
  loadProjectViewState,
  saveLeftSidebarOpen,
  saveProjectViewState
} from '@/lib/view-state'
import { groupSessions } from '@/lib/workspace'

import { CommitDialog } from './commit-dialog'
import { SidebarProjects } from './sidebar-projects'
import { ToolPanel, type ToolTab } from './tool-panel'

type ProjectToolPanelState = {
  tab: ToolTab | null
  open: boolean
}

export function AppShell({
  projects,
  sessions,
  activeSession,
  unreadSessionIds,
  title,
  children,
  showPanelToggle,
  onAddProject,
  onRemoveProject,
  onCreateSession,
  onToggleArchiveSession
}: {
  projects: Project[]
  sessions: Session[]
  activeSession: Session | null
  unreadSessionIds: Set<string>
  title: string
  children: ReactNode
  showPanelToggle: boolean
  onAddProject: () => Promise<void>
  onRemoveProject: (project: Project) => Promise<void>
  onCreateSession: (project: Project) => Promise<void>
  onToggleArchiveSession: (session: Session, archived: boolean) => Promise<void>
}): React.JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(() => loadLeftSidebarOpen())
  const [toolStateByProjectPath, setToolStateByProjectPath] = useState<
    Record<string, ProjectToolPanelState>
  >(() => {
    const initial: Record<string, ProjectToolPanelState> = {}
    for (const p of projects) {
      const stored = loadProjectViewState(p.repoPath)
      initial[p.repoPath] = {
        tab: stored.toolTab,
        open: stored.toolPanelOpen
      }
    }
    return initial
  })
  const sessionGroups = useMemo(() => groupSessions(projects, sessions), [projects, sessions])
  const activeProjectPath = activeSession?.repoPath
  const activeToolState = activeProjectPath
    ? (toolStateByProjectPath[activeProjectPath] ?? { tab: null, open: false })
    : { tab: null, open: false }
  const activeToolTab = activeToolState.tab
  const toolPanelOpen = activeToolState.open

  const handleSidebarChange = useCallback((open: boolean): void => {
    setSidebarOpen(open)
    saveLeftSidebarOpen(open)
  }, [])

  const updateActiveToolState = useCallback(
    (updater: (current: ProjectToolPanelState) => ProjectToolPanelState): void => {
      if (!activeProjectPath) return
      setToolStateByProjectPath((prev) => {
        const current = prev[activeProjectPath] ?? { tab: null, open: false }
        const next = updater(current)
        saveProjectViewState(activeProjectPath, {
          toolTab: next.tab,
          toolPanelOpen: next.open
        })
        return { ...prev, [activeProjectPath]: next }
      })
    },
    [activeProjectPath]
  )

  const setActiveToolTab = useCallback(
    (next: ToolTab | null | ((current: ToolTab | null) => ToolTab | null)): void => {
      updateActiveToolState((current) => {
        const visibleCurrent = current.open ? current.tab : null
        const resolved = typeof next === 'function' ? next(visibleCurrent) : next

        if (resolved === null) {
          return { ...current, open: false }
        }

        return { tab: resolved, open: true }
      })
    },
    [updateActiveToolState]
  )

  const toggleToolPanel = useCallback((): void => {
    updateActiveToolState((current) =>
      current.open
        ? { ...current, open: false }
        : { tab: current.tab ?? 'git', open: true }
    )
  }, [updateActiveToolState])

  const rememberActiveToolTab = useCallback(
    (tab: ToolTab): void => {
      updateActiveToolState((current) => ({ ...current, tab }))
    },
    [updateActiveToolState]
  )

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange} className="h-full">
      <SidebarProjects
        sessionGroups={sessionGroups}
        activeSession={activeSession}
        unreadSessionIds={unreadSessionIds}
        onAddProject={onAddProject}
        onRemoveProject={onRemoveProject}
        onCreateSession={onCreateSession}
        onToggleArchiveSession={onToggleArchiveSession}
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
  children: ReactNode
}): React.JSX.Element {
  const { state, toggleSidebar } = useSidebar()
  const sidebarCollapsed = state === 'collapsed'
  const [commitOpen, setCommitOpen] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [branchName, setBranchName] = useState('')
  const [hasPlan, setHasPlan] = useState(false)
  const [dismissedPlanKey, setDismissedPlanKey] = useState<string | null>(null)
  const [currentPlanKey, setCurrentPlanKey] = useState<string | null>(null)
  const cwd = activeSession?.repoPath
  const toolPanelSize = cwd
    ? loadProjectViewState(cwd).toolPanelSize
    : DEFAULT_TOOL_PANEL_SIZE

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

    const size = cwd ? loadProjectViewState(cwd).toolPanelSize : DEFAULT_TOOL_PANEL_SIZE
    syncingLayoutRef.current = true
    group.setLayout(
      toolPanelOpen
        ? { main: 100 - size, tool: size }
        : { main: 100, tool: 0 }
    )

    const frameId = window.requestAnimationFrame(() => {
      syncingLayoutRef.current = false
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      syncingLayoutRef.current = false
    }
  }, [cwd, toolPanelOpen])

  // Save tool panel size on user-initiated resize only.
  const handleToolPanelResize = useCallback(
    (size: { asPercentage: number }, _id: string | number | undefined, prev: unknown): void => {
      if (!cwd || prev == null || syncingLayoutRef.current) return
      if (size.asPercentage <= 0) return
      saveProjectViewState(cwd, { toolPanelSize: size.asPercentage })
    },
    [cwd]
  )

  const handleDismissPlan = useCallback(() => {
    if (currentPlanKey) {
      setDismissedPlanKey(currentPlanKey)
    }
    // If the plan tab is active, switch to git instead of closing the panel
    setActiveToolTab((current) => (current === 'plan' ? 'git' : current))
  }, [currentPlanKey, setActiveToolTab])

  const checkForChanges = useCallback(async () => {
    if (!cwd) {
      setHasChanges(false)
      setBranchName('')
      return
    }
    try {
      const isRepo = await window.git.isRepo(cwd)
      if (!isRepo) {
        setHasChanges(false)
        setBranchName('')
        return
      }
      const status = await window.git.status(cwd)
      setHasChanges(status.hasChanges)
      setBranchName(status.branch)
    } catch {
      setHasChanges(false)
    }
  }, [cwd])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount is intentional
    checkForChanges()
    // Poll for changes every 5 seconds
    const interval = setInterval(checkForChanges, 5000)
    return () => clearInterval(interval)
  }, [checkForChanges])

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

    let disposed = false
    let lastPlanKey: string | null | undefined = undefined

    setDismissedPlanKey(null)

    void getAgentMessages(activeSession.id)
      .then((messages) => {
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
      })
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

    const unsubscribe = onAgentMessages((payload) => {
      if (payload.sessionId !== activeSession.id) return

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
  }, [activeSession?.id, rememberActiveToolTab, setActiveToolTab])

  // Re-check after dialog closes (commit may have changed status)
  function handleCommitOpenChange(open: boolean): void {
    setCommitOpen(open)
    if (!open) checkForChanges()
  }

  // --- Shell keyboard shortcuts ---
  useHotkey(SHORTCUTS['toggle-sidebar'].keys, toggleSidebar)

  const hasSession = Boolean(activeSession)

  useHotkey(SHORTCUTS['toggle-panel'].keys, useCallback(() => toggleToolPanel(), [toggleToolPanel]), {
    enabled: hasSession
  })

  useHotkey(
    SHORTCUTS['open-commit'].keys,
    useCallback(() => {
      if (cwd && hasChanges) setCommitOpen(true)
    }, [cwd, hasChanges]),
    { enabled: hasSession }
  )

  useHotkey(SHORTCUTS['tab-plan'].keys, useCallback(() => setActiveToolTab('plan'), [setActiveToolTab]), { enabled: hasSession })
  useHotkey(SHORTCUTS['tab-git'].keys, useCallback(() => setActiveToolTab('git'), [setActiveToolTab]), { enabled: hasSession })
  useHotkey(SHORTCUTS['tab-terminal'].keys, useCallback(() => setActiveToolTab('terminal'), [setActiveToolTab]), { enabled: hasSession })
  useHotkey(SHORTCUTS['tab-files'].keys, useCallback(() => setActiveToolTab('files'), [setActiveToolTab]), { enabled: hasSession })
  useHotkey(SHORTCUTS['tab-browser'].keys, useCallback(() => setActiveToolTab('browser'), [setActiveToolTab]), { enabled: hasSession })

  return (
    <SidebarInset className="flex min-w-0 flex-col overflow-hidden bg-background">
      <header
        className={cn(
          'drag-region flex h-11 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border px-4 transition-[padding] duration-200',
          sidebarCollapsed && 'pl-20'
        )}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <div className="flex items-center gap-1">
          {cwd ? (
            <>
              <BranchPicker
                cwd={cwd}
                currentBranch={branchName}
                disabled={hasChanges}
                onBranchChanged={checkForChanges}
              />
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
                  Commit changes <kbd className="ml-1.5 inline-flex font-sans text-[11px] opacity-60">{getShortcutDisplay('open-commit')}</kbd>
                </TooltipContent>
              </Tooltip>
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
      </header>

      <CommitDialog open={commitOpen} onOpenChange={handleCommitOpenChange} cwd={cwd} />

      <div className="min-w-0 flex-1 overflow-hidden">
        {showPanelToggle ? (
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
                cwd={activeSession?.repoPath}
                sessionId={activeSession?.id}
                hasPlan={planVisible}
                onDismissPlan={handleDismissPlan}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          children
        )}
      </div>
    </SidebarInset>
  )
}
