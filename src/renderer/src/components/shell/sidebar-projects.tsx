import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { getShortcutDisplay } from '@/lib/shortcuts'
import {
  ArchiveIcon,
  ChevronRightIcon,
  CircleIcon,
  CircleXIcon,
  EllipsisIcon,
  FolderPlusIcon,
  GitBranchIcon,
  LoaderCircleIcon,
  LoaderIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon
} from 'lucide-react'

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { GitBranch, Project, Session, SessionStatus } from '@/lib/sessions'
import type { SessionGroup } from '@/lib/workspace'

const BUSY_STATUSES = new Set<SessionStatus>(['queued', 'starting', 'running', 'stopping'])
const FAILED_STATUSES = new Set<SessionStatus>(['failed'])

export function SidebarProjects({
  sessionGroups,
  activeSession,
  unreadSessionIds,
  onAddProject,
  onRemoveProject,
  onCreateSession,
  onToggleArchiveSession
}: {
  sessionGroups: SessionGroup[]
  activeSession: Session | null
  unreadSessionIds: Set<string>
  onAddProject: () => Promise<void>
  onRemoveProject: (project: Project) => Promise<void>
  onCreateSession: (
    project: Project,
    options?: { branch?: string | null; worktreePath?: string | null }
  ) => Promise<void>
  onToggleArchiveSession: (session: Session, archived: boolean) => Promise<void>
}): React.JSX.Element {
  const [projectToRemove, setProjectToRemove] = useState<Project | null>(null)

  return (
    <Sidebar>
      <div className="drag-region h-11 shrink-0" />

      <SidebarContent>
        {sessionGroups.map((group) => {
          const activeSessions = group.sessions.filter((session) => !session.archived)

          return (
            <Collapsible key={group.project.id} defaultOpen className="group/collapsible" asChild>
              <SidebarGroup>
                <div className="flex items-center justify-between gap-1">
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="cursor-pointer gap-1.5 truncate">
                      <ChevronRightIcon className="!size-3 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      {group.project.name}
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-0.5">
                    <NewSessionButton
                      project={group.project}
                      onCreateSession={onCreateSession}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs">
                          <EllipsisIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setProjectToRemove(group.project)}
                        >
                          <Trash2Icon />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    {activeSessions.length > 0 ? (
                      <SidebarMenu>
                        {activeSessions.map((session) => (
                          <SessionMenuEntry
                            key={session.id}
                            session={session}
                            isActive={session.id === activeSession?.id}
                            isUnread={unreadSessionIds.has(session.id)}
                            onToggleArchiveSession={onToggleArchiveSession}
                          />
                        ))}
                      </SidebarMenu>
                    ) : null}

                    {activeSessions.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground/50">No sessions</p>
                    ) : null}
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          )
        })}

        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="no-drag w-full justify-start gap-2 text-muted-foreground"
            onClick={() => void onAddProject()}
          >
            <FolderPlusIcon data-icon="inline-start" />
            Add project
          </Button>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2">
              <Link to="/settings">
                <Settings2Icon data-icon="inline-start" />
                Settings
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">App settings</TooltipContent>
        </Tooltip>
      </SidebarFooter>

      <AlertDialog
        open={!!projectToRemove}
        onOpenChange={(open) => !open && setProjectToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove project</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <span className="font-medium text-foreground">{projectToRemove?.name}</span>{' '}
              from the sidebar? This will not delete any files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (projectToRemove) {
                  void onRemoveProject(projectToRemove)
                }
                setProjectToRemove(null)
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}

// ---------------------------------------------------------------------------
// New Session Button with right-click context menu for branch/worktree
// ---------------------------------------------------------------------------

function NewSessionButton({
  project,
  onCreateSession
}: {
  project: Project
  onCreateSession: (
    project: Project,
    options?: { branch?: string | null; worktreePath?: string | null }
  ) => Promise<void>
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newBranchDialogOpen, setNewBranchDialogOpen] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [newBranchError, setNewBranchError] = useState<string | null>(null)

  const fetchBranches = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.git.listBranches(project.repoPath)
      // Only show local branches in the menu
      setBranches(result.filter((b) => !b.isRemote))
    } catch {
      setBranches([])
    } finally {
      setLoading(false)
    }
  }, [project.repoPath])

  // Fetch branches when the dropdown opens
  useEffect(() => {
    if (menuOpen) {
      fetchBranches()
    }
  }, [menuOpen, fetchBranches])

  /** Create a worktree from a branch. If the branch is already checked out,
   *  auto-create a new branch name based off it. */
  async function handleWorktreeFromBranch(branch: string, alreadyCheckedOut: boolean): Promise<void> {
    setCreating(true)
    try {
      let newBranch: string | undefined
      let sessionBranch = branch

      if (alreadyCheckedOut) {
        // Generate a short random suffix so the user can just click and go
        const suffix = Math.random().toString(36).slice(2, 7)
        newBranch = `${branch}-wt-${suffix}`
        sessionBranch = newBranch
      }

      const result = await window.git.createWorktree(project.repoPath, branch, newBranch)
      setMenuOpen(false)
      await onCreateSession(project, {
        branch: sessionBranch,
        worktreePath: result.path
      })
    } catch (err) {
      // eslint-disable-next-line no-restricted-globals
      alert(
        `Failed to create worktree: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setCreating(false)
    }
  }

  /** Open the new branch dialog */
  function openNewBranchDialog(): void {
    setMenuOpen(false)
    setNewBranchName('')
    setNewBranchError(null)
    setNewBranchDialogOpen(true)
  }

  /** Create a worktree with a new branch off the current HEAD */
  async function handleCreateNewBranchWorktree(): Promise<void> {
    const trimmed = newBranchName.trim()
    if (!trimmed) return

    if (!/^[^\s~^:?*[\]\\]+$/.test(trimmed)) {
      setNewBranchError('Invalid branch name')
      return
    }

    setCreating(true)
    setNewBranchError(null)
    try {
      const currentBranch = branches.find((b) => b.isCurrent)?.name ?? 'HEAD'
      const result = await window.git.createWorktree(
        project.repoPath,
        currentBranch,
        trimmed
      )
      setNewBranchDialogOpen(false)
      await onCreateSession(project, {
        branch: trimmed,
        worktreePath: result.path
      })
    } catch (err) {
      setNewBranchError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                // Left-click creates a session immediately (existing behavior)
                e.preventDefault()
                void onCreateSession(project)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenuOpen(true)
              }}
            >
              <PlusIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">
          New session{' '}
          <kbd className="ml-1.5 inline-flex font-sans text-[11px] opacity-60">
            {getShortcutDisplay('new-session')}
          </kbd>
          <br />
          <span className="text-[10px] opacity-60">Right-click for worktree options</span>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent side="right" align="start" className="w-56">
        <DropdownMenuItem onClick={() => void onCreateSession(project)}>
          <PlusIcon className="size-3.5" />
          New session
        </DropdownMenuItem>

        {loading ? (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-center py-3">
              <LoaderIcon className="size-3.5 animate-spin text-muted-foreground" />
            </div>
          </>
        ) : branches.length > 0 ? (
          <>
            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={creating}>
                <GitBranchIcon className="size-3.5" />
                New worktree session
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-y-auto w-60">
                <DropdownMenuItem
                  disabled={creating}
                  onClick={openNewBranchDialog}
                >
                  <PlusIcon className="size-3 text-muted-foreground" />
                  <span>Create new branch…</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {branches.map((branch) => {
                  const alreadyCheckedOut = branch.isCurrent || Boolean(branch.worktreePath)
                  return (
                    <DropdownMenuItem
                      key={branch.name}
                      disabled={creating}
                      onClick={() => void handleWorktreeFromBranch(branch.name, alreadyCheckedOut)}
                    >
                      <GitBranchIcon className="size-3 text-muted-foreground" />
                      <span className="truncate">{branch.name}</span>
                      {alreadyCheckedOut ? (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          → new branch
                        </span>
                      ) : null}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>

    <Dialog open={newBranchDialogOpen} onOpenChange={setNewBranchDialogOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New worktree branch</DialogTitle>
          <DialogDescription>
            Creates a new branch off the current branch and opens it in an isolated worktree.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleCreateNewBranchWorktree()
          }}
        >
          <Input
            autoFocus
            placeholder="feature/my-branch"
            value={newBranchName}
            onChange={(e) => {
              setNewBranchName(e.currentTarget.value)
              setNewBranchError(null)
            }}
            className="mb-3"
          />
          {newBranchError ? (
            <p className="mb-3 text-xs text-destructive">{newBranchError}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewBranchDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!newBranchName.trim() || creating}
            >
              {creating ? (
                <LoaderIcon className="size-3.5 animate-spin" />
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Session menu entry with worktree badge
// ---------------------------------------------------------------------------

function SessionMenuEntry({
  session,
  isActive,
  isUnread,
  onToggleArchiveSession
}: {
  session: Session
  isActive: boolean
  isUnread: boolean
  onToggleArchiveSession: (session: Session, archived: boolean) => Promise<void>
}): React.JSX.Element {
  const isBusy = BUSY_STATUSES.has(session.status)
  const isFailed = FAILED_STATUSES.has(session.status)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} tooltip={session.title} asChild>
        <Link to="/sessions/$sessionId/overview" params={{ sessionId: session.id }}>
          {isBusy ? (
            <LoaderCircleIcon className="size-3 animate-spin text-muted-foreground" />
          ) : isFailed ? (
            <CircleXIcon className="size-3 text-destructive" />
          ) : isUnread ? (
            <CircleIcon className="!size-1.5 fill-primary text-primary" />
          ) : session.worktreePath ? (
            <GitBranchIcon className="size-3 text-muted-foreground" />
          ) : null}
          <span className="truncate">{session.title}</span>
        </Link>
      </SidebarMenuButton>

      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuAction
            showOnHover
            aria-label="Archive session"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void onToggleArchiveSession(session, true)
            }}
          >
            <ArchiveIcon />
          </SidebarMenuAction>
        </TooltipTrigger>
        <TooltipContent side="right">Archive session</TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  )
}
