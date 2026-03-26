import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  GitBranchIcon,
  GitCommitHorizontalIcon,
  ArrowUpIcon,
  CircleDotIcon,
  CheckIcon,
  LoaderIcon,
  GithubIcon
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  commitGitChanges,
  createGitPullRequest,
  generateGitCommitMessage,
  getGitStatus,
  pushGitChanges
} from '@/lib/git'
import { invalidateGitCwd } from '@/lib/git-query'
import { gitKeys } from '@/lib/query-keys'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { sendSessionMessage } from '@/lib/sessions'

type CommitAction = 'commit' | 'commit-push' | 'commit-pr'

export function CommitDialog({
  open,
  onOpenChange,
  cwd,
  sessionId
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cwd: string | undefined
  sessionId?: string
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const [commitMessage, setCommitMessage] = useState('')
  const [includeUnstaged, setIncludeUnstaged] = useState(true)
  const [selectedAction, setSelectedAction] = useState<CommitAction>('commit')
  const [isDraft, setIsDraft] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const statusQuery = useQuery({
    queryKey: cwd ? gitKeys.status(cwd) : ['git', 'status', 'none'],
    queryFn: () => getGitStatus(cwd!),
    enabled: open && Boolean(cwd),
    staleTime: 0,
    gcTime: 15 * 60_000
  })

  const status = statusQuery.data ?? null
  const loading = statusQuery.isPending || (statusQuery.isFetching && !statusQuery.data)

  useEffect(() => {
    if (!open) return
    setCommitMessage('')
    setResult(null)
    setExecuting(false)
  }, [open])

  async function refreshGitQueries(): Promise<void> {
    if (!cwd) return
    await invalidateGitCwd(queryClient, cwd)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['git', 'fileContents', cwd] }),
      queryClient.invalidateQueries({ queryKey: gitKeys.status(cwd) }),
      queryClient.invalidateQueries({ queryKey: ['git', 'prStatus'] })
    ])
  }

  async function handleContinue(): Promise<void> {
    if (!cwd || !status?.hasChanges) return
    setExecuting(true)
    setResult(null)

    try {
      let message = commitMessage.trim()
      if (!message) {
        message = await generateGitCommitMessage(cwd)
      }

      if (selectedAction === 'commit-pr' && sessionId) {
        const branch = status.branch || 'HEAD'
        const title = message.split('\n')[0]
        const metadata = JSON.stringify({ title, branch, draft: isDraft })
        const stageCmd = includeUnstaged ? 'git add -A && ' : ''
        const draftFlag = isDraft ? ' --draft' : ''

        const agentMessage = [
          `<!--action:commit-pr:${metadata}-->`,
          '',
          'Perform the following git workflow:',
          `1. Stage and commit: \`${stageCmd}git commit -m "${message.replace(/"/g, '\\"')}"\``,
          '2. Detect the default branch: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`',
          '3. Fetch and rebase on the default branch: `git fetch origin && git rebase origin/<default-branch>`',
          `4. Push: \`git push --force-with-lease origin ${branch}\``,
          `5. Create a pull request: \`gh pr create --title "<title>" --body "<description>"${draftFlag}\``,
          '   - Write a proper, human-readable PR title that clearly describes the user-visible impact of the change. Do NOT just copy the commit message as the title.',
          '   - Write a concise, helpful PR description summarizing the changes and their purpose.',
          '',
          'Execute each step without asking for confirmation. If any step fails, report the error clearly.'
        ].join('\n')

        onOpenChange(false)
        sendSessionMessage(sessionId, agentMessage)
        return
      }

      const commitResult = await commitGitChanges(cwd, message, includeUnstaged)
      if (!commitResult.success) {
        setResult({ success: false, message: commitResult.error || 'Commit failed' })
        return
      }

      if (selectedAction === 'commit-push' || selectedAction === 'commit-pr') {
        const pushResult = await pushGitChanges(cwd)
        if (!pushResult.success) {
          setResult({
            success: false,
            message: `Committed but push failed: ${pushResult.error}`
          })
          await refreshGitQueries()
          return
        }
      }

      if (selectedAction === 'commit-pr') {
        const prResult = await createGitPullRequest(cwd, message.split('\n')[0], isDraft)
        if (!prResult.success) {
          setResult({
            success: false,
            message: `Committed and pushed but PR creation failed: ${prResult.error}`
          })
          await refreshGitQueries()
          return
        }
        setResult({ success: true, message: prResult.message || 'PR created successfully' })
      } else if (selectedAction === 'commit-push') {
        setResult({ success: true, message: 'Committed and pushed successfully' })
      } else {
        setResult({ success: true, message: 'Committed successfully' })
      }

      await refreshGitQueries()
      await statusQuery.refetch()
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error'
      })
    } finally {
      setExecuting(false)
    }
  }

  const actionItems: { id: CommitAction; label: string; icon: React.ReactNode }[] = [
    {
      id: 'commit',
      label: 'Commit',
      icon: <GitCommitHorizontalIcon className="size-4" />
    },
    {
      id: 'commit-push',
      label: 'Commit and push',
      icon: <ArrowUpIcon className="size-4" />
    },
    {
      id: 'commit-pr',
      label: 'Commit and create PR',
      icon: <GithubIcon className="size-4" />
    }
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
            <GitCommitHorizontalIcon className="size-4" />
          </div>
          <DialogTitle className="text-lg">Commit your changes</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : status ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground">Branch</span>
                <span className="flex items-center gap-1.5 font-mono text-xs">
                  <GitBranchIcon className="size-3.5 text-muted-foreground" />
                  {status.branch}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground">Changes</span>
                <span className="flex items-center gap-2 font-mono text-xs">
                  <span>
                    {status.filesChanged} file{status.filesChanged !== 1 ? 's' : ''}
                  </span>
                  {status.insertions > 0 && (
                    <span className="text-emerald-500">+{status.insertions}</span>
                  )}
                  {status.deletions > 0 && (
                    <span className="text-red-400">-{status.deletions}</span>
                  )}
                </span>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm">
              <Switch checked={includeUnstaged} onCheckedChange={setIncludeUnstaged} />
              <span>Include unstaged</span>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Commit message</span>
              <Textarea
                placeholder="Leave blank to autogenerate a commit message"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="min-h-[60px] resize-none text-sm"
                rows={2}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Next steps</span>
              <div className="flex flex-col">
                {actionItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted"
                    onClick={() => setSelectedAction(item.id)}
                  >
                    <span className="flex size-5 items-center justify-center text-muted-foreground">
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {selectedAction === item.id && <CheckIcon className="size-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            {selectedAction === 'commit-pr' && (
              <label className="flex items-center gap-2.5 text-sm">
                <CircleDotIcon className="size-4 text-muted-foreground" />
                <span className="flex-1">Draft</span>
                <Switch checked={isDraft} onCheckedChange={setIsDraft} />
              </label>
            )}

            {result && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  result.success
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {result.message}
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-muted-foreground">Not a git repository</div>
        )}

        <DialogFooter>
          <Button
            onClick={() => void handleContinue()}
            disabled={executing || !status?.hasChanges}
            className="w-full sm:w-auto"
          >
            {executing ? (
              <>
                <LoaderIcon className="size-3.5 animate-spin" />
                Working…
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
