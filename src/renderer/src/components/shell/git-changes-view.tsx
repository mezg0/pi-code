import { useCallback, useEffect, useRef, useState } from 'react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { GitChangedFile, GitFileContents } from '@pi-code/shared/session'

// ─── File status helpers ────────────────────────────────────────────────────

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

// ─── Diff viewer styles ─────────────────────────────────────────────────────

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

// ─── File row with expandable diff ──────────────────────────────────────────

function FileRow({
  file,
  cwd,
  open,
  onToggle,
  onRefresh
}: {
  file: GitChangedFile
  cwd: string
  open: boolean
  onToggle: () => void
  onRefresh: () => void
}): React.JSX.Element {
  const [contents, setContents] = useState<GitFileContents | null>(null)
  const [loading, setLoading] = useState(false)
  const openRef = useRef(open)

  const loadContents = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getGitFileContents(cwd, file.path)
      setContents(result)
    } catch (err) {
      console.error('Failed to load file contents:', err)
    } finally {
      setLoading(false)
    }
  }, [cwd, file.path])

  // Keep ref in sync with prop
  useEffect(() => {
    openRef.current = open
  }, [open])

  // Reload diff contents when the file's staging state changes (from polling)
  useEffect(() => {
    if (openRef.current) {
      loadContents()
    }
  }, [file.staging, loadContents])

  // Load contents when opened
  useEffect(() => {
    if (open && contents === null) {
      loadContents()
    }
  }, [open, contents, loadContents])

  function handleOpenChange(next: boolean): void {
    onToggle()
    if (next && contents === null) {
      loadContents()
    }
  }

  async function handleToggleStaging(e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    e.preventDefault()
    if (file.staging === 'staged') {
      await unstageGitFile(cwd, file.path)
    } else {
      await stageGitFile(cwd, file.path)
    }
    onRefresh()
  }

  async function handleRevert(e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    e.preventDefault()
    const result = await revertGitFile(cwd, file.path)
    if (result.success) onRefresh()
  }

  const fileName = file.path.split('/').pop()!
  const dirPath = file.path.split('/').slice(0, -1).join('/')
  const label = statusLabel(file.status)

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="border-b border-border">
      <CollapsibleTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className="group flex w-full cursor-default items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
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

          {/* Stats + actions */}
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
                  onClick={handleRevert}
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
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleToggleStaging}
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
        {loading ? (
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

// ─── Main git changes panel ─────────────────────────────────────────────────

// Store expanded paths per cwd so they survive session switches
const expandedPathsByCwd = new Map<string, Set<string>>()

export function GitChangesView({ cwd }: { cwd: string }): React.JSX.Element {
  const [files, setFiles] = useState<GitChangedFile[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => expandedPathsByCwd.get(cwd) ?? new Set()
  )

  // Sync with module-level cache
  useEffect(() => {
    expandedPathsByCwd.set(cwd, expandedPaths)
  }, [cwd, expandedPaths])

  // Restore expanded paths when switching sessions
  useEffect(() => {
    setExpandedPaths(expandedPathsByCwd.get(cwd) ?? new Set())
  }, [cwd])

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

  const fetchFiles = useCallback(async () => {
    try {
      const result = await getChangedFiles(cwd)
      result.sort((a, b) => a.path.localeCompare(b.path))
      setFiles(result)
    } catch (err) {
      console.error('Failed to fetch changed files:', err)
    } finally {
      setHasLoaded(true)
    }
  }, [cwd])

  useEffect(() => {
    fetchFiles()
    const interval = setInterval(fetchFiles, 5000)
    return () => clearInterval(interval)
  }, [fetchFiles])

  if (hasLoaded && files.length === 0) {
    return (
      <div className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        No uncommitted changes on your local branch.
      </div>
    )
  }

  const totalCount = files.length
  const stagedCount = files.filter((f) => f.staging === 'staged' || f.staging === 'partial').length
  const allStaged = stagedCount === totalCount

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      {/* Summary header */}
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
                  <Button variant="ghost" size="icon-xs">
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
                  onClick={async () => {
                    await revertAllGitFiles(cwd)
                    fetchFiles()
                  }}
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
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={async () => {
                  if (allStaged) {
                    await unstageAllGitFiles(cwd)
                  } else {
                    await stageAllGitFiles(cwd)
                  }
                  fetchFiles()
                }}
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

      {/* File list — vertical scroll, horizontal clipped */}
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        {files.map((file) => (
          <FileRow
            key={file.path}
            file={file}
            cwd={cwd}
            open={expandedPaths.has(file.path)}
            onToggle={() => toggleExpanded(file.path)}
            onRefresh={fetchFiles}
          />
        ))}
      </div>
    </div>
  )
}
