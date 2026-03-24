import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  getShortcutDisplay,
} from '@/lib/shortcuts'
import {
  ArchiveIcon,
  ChevronRightIcon,
  CircleIcon,
  CircleXIcon,
  EllipsisIcon,
  FolderPlusIcon,
  LoaderCircleIcon,
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
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import type { Project, Session, SessionStatus } from '@/lib/sessions'
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
  onCreateSession: (project: Project) => Promise<void>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => void onCreateSession(group.project)}
                        >
                          <PlusIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">New session <kbd className="ml-1.5 inline-flex font-sans text-[11px] opacity-60">{getShortcutDisplay('new-session')}</kbd></TooltipContent>
                    </Tooltip>
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
          ) : null}
          <span>{session.title}</span>
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
