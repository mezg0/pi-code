import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckSquare2Icon,
  FileIcon,
  FilePlusIcon,
  FileMinusIcon,
  LoaderIcon,
  MinusSquareIcon,
  SquareIcon,
  Undo2Icon
} from 'lucide-react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  getChangedFiles,
  getGitFileContents,
  revertAllGitFiles,
  revertGitFile,
  stageAllGitFiles,
  stageGitFile,
  unstageAllGitFiles,
  unstageGitFile
} from '@/lib/git'
import { invalidateGitCwd, invalidateGitFile } from '@/lib/git-query'
import { gitKeys } from '@/lib/query-keys'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { GitChangedFile } from '@pi-code/shared/session'

function statusIcon(status: GitChangedFile['status']): React.JSX.Element {
  switch (status) {
    case 'added':
      return <FilePlusIcon className="size-3.5" />
    case 'deleted':
      return <FileMinusIcon className="size-3.5" />
    default:
      return <FileIcon className="size-3.5" />
  }
}

function statusColor(status: GitChangedFile['status']): string {
  switch (status) {
    case 'added':
      return 'text-emerald-500'
    case 'deleted':
      return 'text-red-400'
    case 'renamed':
      return 'text-blue-400'
    default:
      return 'text-yellow-400'
  }
}

function statusLabel(status: GitChangedFile['status']): string | null {
  switch (status) {
    case 'added':
      return 'New'
    case 'deleted':
      return 'Deleted'
    case 'renamed':
      return 'Renamed'
    default:
      return null
  }
}

function stagingIcon(staging: GitChangedFile['staging']): React.JSX.Element {
  switch (staging) {
    case 'staged':
      return <CheckSquare2Icon className="size-3.5 text-emerald-500" />
    case 'partial':
      return <MinusSquareIcon className="size-3.5 text-yellow-400" />
    default:
      return <SquareIcon className="size-3.5" />
  }
}

function stagingTooltip(staging: GitChangedFile['staging']): string {
  switch (staging) {
    case 'staged':
      return 'Staged — click to unstage'
    case 'partial':
      return 'Partially staged — click to stage all'
    default:
      return 'Unstaged — click to stage'
  }
}

const MONO_FONT = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'

const diffStyles = {
  variables: {
    dark: {
      diffViewerBackground: 'transparent',
      diffViewerColor: 'oklch(0.82 0.01 230)',
      addedBackground: 'oklch(0.45 0.1 155 / 15%)',
      addedColor: 'oklch(0.85 0.04 155)',
      removedBackground: 'oklch(0.35 0.08 20 / 20%)',
      removedColor: 'oklch(0.85 0.04 15)',
      wordAddedBackground: 'oklch(0.55 0.14 155 / 35%)',
      wordRemovedBackground: 'oklch(0.45 0.12 20 / 45%)',
      addedGutterBackground: 'oklch(0.45 0.1 155 / 25%)',
      removedGutterBackground: 'oklch(0.35 0.08 20 / 30%)',
      gutterBackground: 'oklch(0.19 0.01 230)',
      gutterBackgroundDark: 'oklch(0.17 0.01 230)',
      highlightBackground: 'oklch(0.3 0.02 230)',
      highlightGutterBackground: 'oklch(0.25 0.015 230)',
      codeFoldGutterBackground: 'oklch(0.22 0.015 230)',
      codeFoldBackground: 'oklch(0.22 0.015 230)',
      emptyLineBackground: 'oklch(0.17 0.01 230)',
      gutterColor: 'oklch(0.5 0.01 230)',
      addedGutterColor: 'oklch(0.6 0.06 155)',
      removedGutterColor: 'oklch(0.6 0.04 20)',
      codeFoldContentColor: 'oklch(0.6 0.02 230)',
      diffViewerTitleBackground: 'oklch(0.22 0.015 230)',
      diffViewerTitleColor: 'oklch(0.7 0.015 224)',
      diffViewerTitleBorderColor: 'oklch(1 0 0 / 8%)'
    }
  },
  diffContainer: {
    minWidth: '100%',
    width: 'max-content',
    tableLayout: 'auto' as const,
    fontSize: '12px'
  },
  line: {
    fontSize: '12px',
    fontFamily: MONO_FONT
  },
  gutter: {
    minWidth: '2em',
    width: '2em',
    fontSize: '12px',
    padding: '0 0.5em'
  },
  contentText: {
    fontSize: '12px',
    lineHeight: '18px',
    fontFamily: MONO_FONT,
    whiteSpace: 'pre' as const,
    wordBreak: 'normal' as const,
    overflowWrap: 'normal' as const
  },
  content: {
    width: 'auto',
    overflow: 'visible'
  },
  codeFold: {
    fontSize: '11px',
    fontFamily: MONO_FONT
  }
}

function buildFileVersion(file: GitChangedFile): string {
  return [file.status, file.staging, file.insertions, file.deletions, file.oldPath ?? ''].join(':')
}

function FileRow({
  file,
  cwd,
  open,
  onToggle
}: {
  file: GitChangedFile
  cwd: string
  open: boolean
  onToggle: () => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const fileVersion = buildFileVersion(file)

  const contentsQuery = useQuery({
    queryKey: gitKeys.fileContents(cwd, file.path, fileVersion),
    queryFn: () => getGitFileContents(cwd, file.path),
    enabled: open,
    gcTime: 5 * 60_000
  })

  const toggleStagingMutation = useMutation({
    mutationFn: () =>
      file.staging === 'staged' ? unstageGitFile(cwd, file.path) : stageGitFile(cwd, file.path),
    onSuccess: async () => {
      await invalidateGitCwd(queryClient, cwd)
      await invalidateGitFile(queryClient, cwd, file.path)
    }
  })

  const revertMutation = useMutation({
    mutationFn: () => revertGitFile(cwd, file.path),
    onSuccess: async (result) => {
      if (!result.success) return
      await invalidateGitCwd(queryClient, cwd)
      await invalidateGitFile(queryClient, cwd, file.path)
    }
  })

  async function handleToggleStaging(e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    e.preventDefault()
    await toggleStagingMutation.mutateAsync()
  }

  async function handleRevert(e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    e.preventDefault()
    await revertMutation.mutateAsync()
  }

  const fileName = file.path.split('/').pop()!
  const dirPath = file.path.split('/').slice(0, -1).join('/')
  const label = statusLabel(file.status)
  const isLoading = contentsQuery.isPending || (contentsQuery.isFetching && !contentsQuery.data)
  const contents = contentsQuery.data
  const controlsDisabled = toggleStagingMutation.isPending || revertMutation.isPending

  return (
    <Collapsible open={open} onOpenChange={onToggle} className="border-b border-border">
      <CollapsibleTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className="group flex w-full cursor-default items-center gap-1.5 px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
        >
          <span className={cn('shrink-0', statusColor(file.status))}>
            {statusIcon(file.status)}
          </span>
          <span className="block min-w-0 flex-1 truncate text-xs">
            {dirPath ? (
              <>
                <span className="text-muted-foreground">{dirPath}/</span>
                <span className="font-medium">{fileName}</span>
              </>
            ) : (
              <span className="font-medium">{fileName}</span>
            )}
          </span>
          {file.oldPath && file.path !== file.oldPath && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              ← {file.oldPath.split('/').pop()}
            </span>
          )}

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">
              {file.insertions > 0 && <span className="text-emerald-500">+{file.insertions}</span>}
              {file.insertions > 0 && file.deletions > 0 && ' '}
              {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
            </span>

            {label && (
              <span
                className={cn(
                  'rounded px-1 py-0.5 text-[10px] font-medium',
                  file.status === 'added' && 'bg-emerald-500/15 text-emerald-500',
                  file.status === 'deleted' && 'bg-red-500/15 text-red-400',
                  file.status === 'renamed' && 'bg-blue-500/15 text-blue-400'
                )}
              >
                {label}
              </span>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="no-drag shrink-0"
                  onClick={(event) => void handleRevert(event)}
                  disabled={controlsDisabled}
                >
                  <Undo2Icon className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Revert file</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={(event) => void handleToggleStaging(event)}
                  disabled={controlsDisabled}
                >
                  {stagingIcon(file.staging)}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{stagingTooltip(file.staging)}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-border">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <LoaderIcon className="size-3.5 animate-spin text-muted-foreground" />
          </div>
        ) : contents?.isBinary ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            Binary file — diff not available
          </div>
        ) : contents ? (
          <div className="diff-viewer-scroll overflow-x-auto">
            <ReactDiffViewer
              oldValue={contents.oldValue}
              newValue={contents.newValue}
              splitView={false}
              useDarkTheme
              hideLineNumbers={false}
              showDiffOnly
              hideSummary
              extraLinesSurroundingDiff={3}
              compareMethod={DiffMethod.WORDS_WITH_SPACE}
              styles={diffStyles}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            No diff available
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

const expandedPathsByCwd = new Map<string, Set<string>>()

export function GitChangesView({
  cwd,
  active
}: {
  cwd: string
  active: boolean
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const [expandedCwd, setExpandedCwd] = useState(cwd)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => expandedPathsByCwd.get(cwd) ?? new Set()
  )

  useEffect(() => {
    expandedPathsByCwd.set(expandedCwd, expandedPaths)
  }, [expandedCwd, expandedPaths])

  if (expandedCwd !== cwd) {
    setExpandedCwd(cwd)
    setExpandedPaths(expandedPathsByCwd.get(cwd) ?? new Set())
  }

  const filesQuery = useQuery({
    queryKey: gitKeys.changedFiles(cwd),
    queryFn: () => getChangedFiles(cwd),
    select: (result) => [...result].sort((a, b) => a.path.localeCompare(b.path)),
    enabled: Boolean(cwd) && active,
    staleTime: 3_000,
    gcTime: 15 * 60_000,
    refetchInterval: active ? 5_000 : false
  })

  const revertAllMutation = useMutation({
    mutationFn: () => revertAllGitFiles(cwd),
    onSuccess: async () => {
      await invalidateGitCwd(queryClient, cwd)
      await queryClient.invalidateQueries({ queryKey: ['git', 'fileContents', cwd] })
    }
  })

  const toggleAllStagingMutation = useMutation({
    mutationFn: async (allStaged: boolean) => {
      if (allStaged) {
        return unstageAllGitFiles(cwd)
      }
      return stageAllGitFiles(cwd)
    },
    onSuccess: async () => {
      await invalidateGitCwd(queryClient, cwd)
      await queryClient.invalidateQueries({ queryKey: ['git', 'fileContents', cwd] })
    }
  })

  function toggleExpanded(path: string): void {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const files = filesQuery.data ?? []
  const totalCount = files.length
  const stagedCount = files.filter((f) => f.staging === 'staged' || f.staging === 'partial').length
  const allStaged = totalCount > 0 && stagedCount === totalCount
  const headerBusy = revertAllMutation.isPending || toggleAllStagingMutation.isPending

  if ((filesQuery.isPending || filesQuery.isFetching) && !filesQuery.data) {
    return (
      <div className="flex size-full items-center justify-center py-6">
        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        No uncommitted changes on your local branch.
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-xs text-muted-foreground">
          {totalCount} changed file{totalCount !== 1 ? 's' : ''}
          {stagedCount > 0 && (
            <span className="ml-1.5 text-emerald-500">· {stagedCount} staged</span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon-xs" disabled={headerBusy}>
                    <Undo2Icon className="size-3.5" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Revert all changes</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revert all changes?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will discard all uncommitted changes, including staged, unstaged, and
                  untracked files. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => void revertAllMutation.mutateAsync()}
                >
                  Revert all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void toggleAllStagingMutation.mutateAsync(allStaged)}
                disabled={headerBusy}
              >
                {allStaged ? (
                  <CheckSquare2Icon className="size-3.5 text-emerald-500" />
                ) : stagedCount > 0 ? (
                  <MinusSquareIcon className="size-3.5 text-yellow-400" />
                ) : (
                  <SquareIcon className="size-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{allStaged ? 'Unstage all' : 'Stage all'}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        {files.map((file) => (
          <FileRow
            key={`${file.path}:${buildFileVersion(file)}`}
            file={file}
            cwd={cwd}
            open={expandedPaths.has(file.path)}
            onToggle={() => toggleExpanded(file.path)}
          />
        ))}
      </div>
    </div>
  )
}
