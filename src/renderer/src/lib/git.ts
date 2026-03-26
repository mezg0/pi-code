import type {
  GitBranch,
  GitChangedFile,
  GitCommitResult,
  GitFileContents,
  GitPRStatus,
  GitStatus,
  GitWorktreeResult
} from '@pi-code/shared/session'
import { apiGet, apiPost } from './api-client'

export type {
  GitBranch,
  GitChangedFile,
  GitCommitResult,
  GitFileContents,
  GitPRStatus,
  GitStatus,
  GitWorktreeResult
}

const qs = (params: Record<string, string>) =>
  '?' + new URLSearchParams(params).toString()

export const isGitRepo = (cwd: string): Promise<boolean> =>
  apiGet(`/git/is-repo${qs({ cwd })}`)
export const getGitStatus = (cwd: string): Promise<GitStatus> =>
  apiGet(`/git/status${qs({ cwd })}`)
export const getChangedFiles = (cwd: string): Promise<GitChangedFile[]> =>
  apiGet(`/git/changed-files${qs({ cwd })}`)
export const getGitFileContents = (cwd: string, filePath: string): Promise<GitFileContents> =>
  apiGet(`/git/file-contents${qs({ cwd, filePath })}`)
export const stageGitFile = (cwd: string, filePath: string): Promise<GitCommitResult> =>
  apiPost('/git/stage-file', { cwd, filePath })
export const unstageGitFile = (cwd: string, filePath: string): Promise<GitCommitResult> =>
  apiPost('/git/unstage-file', { cwd, filePath })
export const revertGitFile = (cwd: string, filePath: string): Promise<GitCommitResult> =>
  apiPost('/git/revert-file', { cwd, filePath })
export const stageAllGitFiles = (cwd: string): Promise<GitCommitResult> =>
  apiPost('/git/stage-all', { cwd })
export const unstageAllGitFiles = (cwd: string): Promise<GitCommitResult> =>
  apiPost('/git/unstage-all', { cwd })
export const revertAllGitFiles = (cwd: string): Promise<GitCommitResult> =>
  apiPost('/git/revert-all', { cwd })
export const generateGitCommitMessage = (cwd: string): Promise<string> =>
  apiPost('/git/generate-message', { cwd })
export const commitGitChanges = (
  cwd: string,
  message: string,
  includeUnstaged: boolean
): Promise<GitCommitResult> => apiPost('/git/commit', { cwd, message, includeUnstaged })
export const pushGitChanges = (cwd: string): Promise<GitCommitResult> =>
  apiPost('/git/push', { cwd })
export const createGitPullRequest = (
  cwd: string,
  title: string,
  draft: boolean
): Promise<GitCommitResult> => apiPost('/git/create-pr', { cwd, title, draft })
export const listGitBranches = (cwd: string): Promise<GitBranch[]> =>
  apiGet(`/git/branches${qs({ cwd })}`)
export const checkoutGitBranch = (cwd: string, branch: string): Promise<GitCommitResult> =>
  apiPost('/git/checkout', { cwd, branch })
export const createGitBranch = (cwd: string, branch: string): Promise<GitCommitResult> =>
  apiPost('/git/create-branch', { cwd, branch })
export const createGitWorktree = (
  cwd: string,
  branch: string,
  newBranch?: string,
  path?: string | null
): Promise<GitWorktreeResult> =>
  apiPost('/git/create-worktree', { cwd, branch, newBranch, path })
export const removeGitWorktree = (
  cwd: string,
  worktreePath: string,
  force?: boolean
): Promise<void> => apiPost('/git/remove-worktree', { cwd, worktreePath, force })
export const getGitPRStatus = (cwd: string, branch: string): Promise<GitPRStatus> =>
  apiGet(`/git/pr-status${qs({ cwd, branch })}`)
