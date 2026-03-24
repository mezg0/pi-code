import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { GitCommitHorizontalIcon, PanelRightCloseIcon, PanelRightOpenIcon } from 'lucide-react'

import { BranchPicker } from './branch-picker'

import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useHotkey } from '@tanstack/react-hotkeys'
import { extractLatestPlan, getPlanMessageKey } from '@/lib/plan'
import { getAgentMessages, onAgentMessages, type Project, type Session } from '@/lib/sessions'
import { getShortcutDisplay, SHORTCUTS } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'
import { groupSessions } from '@/lib/workspace'

import { CommitDialog } from './commit-dialog'
import { SidebarProjects } from './sidebar-projects'
import { ToolPanel, type ToolTab } from './tool-panel'

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
  const [toolTabsByProjectPath, setToolTabsByProjectPath] = useState<
    Record<string, ToolTab | null>
  >({})
  const sessionGroups = useMemo(() => groupSessions(projects, sessions), [projects, sessions])
  const activeProjectPath = activeSession?.repoPath
  const activeToolTab = activeProjectPath
    ? (toolTabsByProjectPath[activeProjectPath] ?? null)
    : null

  const setActiveToolTab = useCallback(
    (next: ToolTab | null | ((current: ToolTab | null) => ToolTab | null)): void => {
      if (!activeProjectPath) return
      setToolTabsByProjectPath((prev) => {
        const current = prev[activeProjectPath] ?? null
        const resolved = typeof next === 'function' ? next(current) : next
        return { ...prev, [activeProjectPath]: resolved }
      })
    },
    [activeProjectPath]
  )

  return (
    <SidebarProvider defaultOpen className="h-full">
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
        setActiveToolTab={setActiveToolTab}
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
  setActiveToolTab,
  activeSession,
  children
}: {
  title: string
  showPanelToggle: boolean
  activeToolTab: ToolTab | null
  setActiveToolTab: (next: ToolTab | null | ((current: ToolTab | null) => ToolTab | null)) => void
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

  const planVisible = hasPlan && currentPlanKey !== dismissedPlanKey

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

  // Track activeToolTab in a ref so the effect can read it without re-running
  const activeToolTabRef = useRef(activeToolTab)
  useEffect(() => {
    activeToolTabRef.current = activeToolTab
  }, [activeToolTab])

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
          setActiveToolTab(null)
        }
      })
      .catch(() => {
        if (disposed) return
        lastPlanKey = null
        setHasPlan(false)
        setCurrentPlanKey(null)
        if (activeToolTabRef.current === 'plan') {
          setActiveToolTab(null)
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
        setActiveToolTab(null)
      }

      lastPlanKey = nextPlanKey ?? null
    })

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [activeSession?.id, setActiveToolTab])

  // Re-check after dialog closes (commit may have changed status)
  function handleCommitOpenChange(open: boolean): void {
    setCommitOpen(open)
    if (!open) checkForChanges()
  }

  // --- Shell keyboard shortcuts ---
  useHotkey(SHORTCUTS['toggle-sidebar'].keys, toggleSidebar)

  const hasSession = Boolean(activeSession)

  useHotkey(
    SHORTCUTS['toggle-panel'].keys,
    useCallback(
      () => setActiveToolTab((current) => (current ? null : 'git')),
      [setActiveToolTab]
    ),
    { enabled: hasSession }
  )

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
                  onClick={() => setActiveToolTab((current) => (current ? null : 'git'))}
                >
                  {activeToolTab ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {activeToolTab ? 'Close panel' : 'Open panel'}{' '}
                <kbd className="ml-1.5 inline-flex font-sans text-[11px] opacity-60">{getShortcutDisplay('toggle-panel')}</kbd>
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </header>

      <CommitDialog open={commitOpen} onOpenChange={handleCommitOpenChange} cwd={cwd} />

      <div className="min-w-0 flex-1 overflow-hidden">
        {showPanelToggle ? (
          <ResizablePanelGroup orientation="horizontal" className="min-w-0 overflow-hidden">
            <ResizablePanel
              defaultSize={activeToolTab ? 55 : 100}
              minSize={30}
              className="min-w-0 overflow-hidden"
            >
              {children}
            </ResizablePanel>

            {activeToolTab ? (
              <>
                <ResizableHandle />
                <ResizablePanel defaultSize={45} minSize={20} className="min-w-0 overflow-hidden">
                  <ToolPanel
                    activeTab={activeToolTab}
                    onSelect={setActiveToolTab}
                    onClose={() => setActiveToolTab(null)}
                    cwd={activeSession?.repoPath}
                    sessionId={activeSession?.id}
                    hasPlan={planVisible}
                    onDismissPlan={handleDismissPlan}
                  />
                </ResizablePanel>
              </>
            ) : (
              /* Keep ToolPanel mounted but invisible when panel is closed */
              <div className="sr-only">
                <ToolPanel
                  activeTab="git"
                  onSelect={setActiveToolTab}
                  onClose={() => setActiveToolTab(null)}
                  cwd={activeSession?.repoPath}
                  sessionId={activeSession?.id}
                  hasPlan={planVisible}
                  onDismissPlan={handleDismissPlan}
                />
              </div>
            )}
          </ResizablePanelGroup>
        ) : (
          children
        )}
      </div>
    </SidebarInset>
  )
}
