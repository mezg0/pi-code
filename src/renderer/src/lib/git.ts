import type {
  GitBranch,
  GitChangedFile,
  GitCommitResult,
  GitFileContents,
  GitPRStatus,
  GitStatus,
  GitWorktreeResult
} from '@pi-code/shared/session'

const git = window.git

export type {
  GitBranch,
  GitChangedFile,
  GitCommitResult,
  GitFileContents,
  GitPRStatus,
  GitStatus,
  GitWorktreeResult
}

export const isGitRepo = (cwd: string): Promise<boolean> => git.isRepo(cwd)
export const getGitStatus = (cwd: string): Promise<GitStatus> => git.status(cwd)
export const getChangedFiles = (cwd: string): Promise<GitChangedFile[]> => git.changedFiles(cwd)
export const getGitFileContents = (cwd: string, filePath: string): Promise<GitFileContents> =>
  git.fileContents(cwd, filePath)
export const stageGitFile = (cwd: string, filePath: string): Promise<GitCommitResult> =>
  git.stageFile(cwd, filePath)
export const unstageGitFile = (cwd: string, filePath: string): Promise<GitCommitResult> =>
  git.unstageFile(cwd, filePath)
export const revertGitFile = (cwd: string, filePath: string): Promise<GitCommitResult> =>
  git.revertFile(cwd, filePath)
export const stageAllGitFiles = (cwd: string): Promise<GitCommitResult> => git.stageAll(cwd)
export const unstageAllGitFiles = (cwd: string): Promise<GitCommitResult> => git.unstageAll(cwd)
export const revertAllGitFiles = (cwd: string): Promise<GitCommitResult> => git.revertAll(cwd)
export const generateGitCommitMessage = (cwd: string): Promise<string> => git.generateMessage(cwd)
export const commitGitChanges = (
  cwd: string,
  message: string,
  includeUnstaged: boolean
): Promise<GitCommitResult> => git.commit(cwd, message, includeUnstaged)
export const pushGitChanges = (cwd: string): Promise<GitCommitResult> => git.push(cwd)
export const createGitPullRequest = (
  cwd: string,
  title: string,
  draft: boolean
): Promise<GitCommitResult> => git.createPR(cwd, title, draft)
export const listGitBranches = (cwd: string): Promise<GitBranch[]> => git.listBranches(cwd)
export const checkoutGitBranch = (cwd: string, branch: string): Promise<GitCommitResult> =>
  git.checkoutBranch(cwd, branch)
export const createGitBranch = (cwd: string, branch: string): Promise<GitCommitResult> =>
  git.createBranch(cwd, branch)
export const createGitWorktree = (
  cwd: string,
  branch: string,
  newBranch?: string,
  path?: string | null
): Promise<GitWorktreeResult> => git.createWorktree(cwd, branch, newBranch, path)
export const removeGitWorktree = (
  cwd: string,
  worktreePath: string,
  force?: boolean
): Promise<void> => git.removeWorktree(cwd, worktreePath, force)
export const getGitPRStatus = (cwd: string, branch: string): Promise<GitPRStatus> =>
  git.getPRStatus(cwd, branch)
