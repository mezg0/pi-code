import { execFile } from 'child_process'
import { promisify } from 'util'
import { access, readFile, unlink } from 'fs/promises'
import { basename, join } from 'path'
import { homedir } from 'os'
import { buildCommitMessage } from '@pi-code/shared/commit-message'
import type {
  GitStatus,
  GitCommitResult,
  GitChangedFile,
  GitBranch,
  GitFileContents,
  GitFileStatus,
  GitPRStatus,
  GitStagingState,
  GitWorktreeResult
} from '@pi-code/shared/session'

export type {
  GitStatus,
  GitCommitResult,
  GitChangedFile,
  GitBranch,
  GitPRStatus,
  GitWorktreeResult
}

const exec = promisify(execFile)

class MissingGitCwdError extends Error {
  constructor(cwd: string) {
    super(`Git working directory does not exist: ${cwd}`)
    this.name = 'MissingGitCwdError'
  }
}

async function ensureGitCwd(cwd: string): Promise<void> {
  try {
    await access(cwd)
  } catch {
    throw new MissingGitCwdError(cwd)
  }
}

function isMissingGitCwdError(error: unknown): error is MissingGitCwdError {
  return error instanceof MissingGitCwdError
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  await ensureGitCwd(cwd)
  const { stdout } = await exec('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 })
  // Use trimEnd() — not trim() — to preserve leading characters.
  // git status --porcelain uses leading spaces as part of the status code
  // (e.g. " M file.txt" means unstaged modification) and trim() would
  // strip that, corrupting the first line's status and filename.
  return stdout.trimEnd()
}

/** Raw git output without trimEnd — for file content where trailing whitespace matters */
async function gitRaw(cwd: string, ...args: string[]): Promise<string> {
  await ensureGitCwd(cwd)
  const { stdout } = await exec('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 })
  return stdout
}

async function getRepoRoot(cwd: string): Promise<string> {
  return git(cwd, 'rev-parse', '--show-toplevel')
}

/** Normalize line endings to LF so diffs aren't polluted by CRLF mismatches */
function normalizeLF(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await git(cwd, 'rev-parse', '--is-inside-work-tree')
    return true
  } catch {
    return false
  }
}

export async function getGitStatus(cwd: string): Promise<GitStatus> {
  try {
    const branch = await git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD')

    const statusOutput = await git(cwd, 'status', '--porcelain', '-uall')
    const lines = statusOutput.split('\n').filter(Boolean)

    let staged = 0
    let unstaged = 0

    for (const line of lines) {
      const index = line[0]
      const worktree = line[1]
      if (index !== ' ' && index !== '?') staged++
      if (worktree !== ' ' || line.startsWith('??')) unstaged++
    }

    let insertions = 0
    let deletions = 0

    try {
      const stagedStat = await git(cwd, 'diff', '--cached', '--shortstat')
      const stagedInsert = stagedStat.match(/(\d+) insertion/)
      const stagedDelete = stagedStat.match(/(\d+) deletion/)
      if (stagedInsert) insertions += parseInt(stagedInsert[1])
      if (stagedDelete) deletions += parseInt(stagedDelete[1])
    } catch {
      /* no staged changes */
    }

    try {
      const unstagedStat = await git(cwd, 'diff', '--shortstat')
      const unstagedInsert = unstagedStat.match(/(\d+) insertion/)
      const unstagedDelete = unstagedStat.match(/(\d+) deletion/)
      if (unstagedInsert) insertions += parseInt(unstagedInsert[1])
      if (unstagedDelete) deletions += parseInt(unstagedDelete[1])
    } catch {
      /* no unstaged changes */
    }

    return {
      branch,
      hasChanges: lines.length > 0,
      filesChanged: lines.length,
      insertions,
      deletions,
      staged,
      unstaged
    }
  } catch (error) {
    if (isMissingGitCwdError(error)) {
      return {
        branch: '',
        hasChanges: false,
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
        staged: 0,
        unstaged: 0
      }
    }
    throw error
  }
}

export async function getChangedFiles(cwd: string): Promise<GitChangedFile[]> {
  let statusOutput = ''
  try {
    statusOutput = await git(cwd, 'status', '--porcelain', '-uall')
  } catch (error) {
    if (isMissingGitCwdError(error)) {
      return []
    }
    throw error
  }
  const lines = statusOutput.split('\n').filter(Boolean)
  const files: GitChangedFile[] = []

  const statsMap = new Map<string, { ins: number; del: number }>()

  try {
    const stagedNumstat = await git(cwd, 'diff', '--cached', '--numstat')
    for (const line of stagedNumstat.split('\n').filter(Boolean)) {
      const [ins, del, file] = line.split('\t')
      const current = statsMap.get(file) ?? { ins: 0, del: 0 }
      current.ins += ins === '-' ? 0 : parseInt(ins)
      current.del += del === '-' ? 0 : parseInt(del)
      statsMap.set(file, current)
    }
  } catch {
    /* empty */
  }

  try {
    const unstagedNumstat = await git(cwd, 'diff', '--numstat')
    for (const line of unstagedNumstat.split('\n').filter(Boolean)) {
      const [ins, del, file] = line.split('\t')
      const current = statsMap.get(file) ?? { ins: 0, del: 0 }
      current.ins += ins === '-' ? 0 : parseInt(ins)
      current.del += del === '-' ? 0 : parseInt(del)
      statsMap.set(file, current)
    }
  } catch {
    /* empty */
  }

  for (const line of lines) {
    const indexStatus = line[0]
    const worktreeStatus = line[1]
    const rawPath = line.substring(3)

    let status: GitFileStatus = 'modified'
    let filePath = rawPath
    let oldPath: string | undefined

    if (rawPath.includes(' -> ')) {
      const parts = rawPath.split(' -> ')
      oldPath = parts[0]
      filePath = parts[1]
      status = 'renamed'
    } else if (indexStatus === 'A' || indexStatus === '?' || line.startsWith('??')) {
      status = 'added'
    } else if (indexStatus === 'D' || worktreeStatus === 'D') {
      status = 'deleted'
    }

    // Determine staging state from the two-character porcelain status
    // First char = index (staged), second char = working tree (unstaged)
    // '?' or ' ' in index means nothing staged; '?' or ' ' in worktree means nothing unstaged
    const hasIndexChange = indexStatus !== ' ' && indexStatus !== '?'
    const hasWorktreeChange = worktreeStatus !== ' ' && worktreeStatus !== '?'
    const isUntracked = line.startsWith('??')

    let staging: GitStagingState
    if (isUntracked) {
      staging = 'unstaged'
    } else if (hasIndexChange && hasWorktreeChange) {
      staging = 'partial'
    } else if (hasIndexChange) {
      staging = 'staged'
    } else {
      staging = 'unstaged'
    }

    let stats = statsMap.get(filePath)
    if (!stats && status === 'added') {
      try {
        const root = await getRepoRoot(cwd)
        const content = await readFile(join(root, filePath), 'utf-8')
        const lineCount = content.split('\n').length
        stats = { ins: lineCount, del: 0 }
      } catch {
        stats = { ins: 0, del: 0 }
      }
    }

    files.push({
      path: filePath,
      ...(oldPath ? { oldPath } : {}),
      status,
      staging,
      insertions: stats?.ins ?? 0,
      deletions: stats?.del ?? 0
    })
  }

  return files
}

/**
 * Returns the old (HEAD) and new (working tree) content of a file
 * for use with react-diff-viewer.
 *
 * File paths from `git status --porcelain` are relative to the repo root,
 * so we resolve the repo root for filesystem reads instead of using cwd
 * (which may be a subdirectory).
 */
export async function getFileContents(cwd: string, filePath: string): Promise<GitFileContents> {
  const root = await getRepoRoot(cwd)

  // Get the current working tree version
  let newValue = ''
  let isBinary = false
  try {
    const content = await readFile(join(root, filePath), 'utf-8')
    if (content.includes('\0')) {
      isBinary = true
    } else {
      newValue = normalizeLF(content)
    }
  } catch {
    // File deleted in working tree
    newValue = ''
  }

  if (isBinary) {
    return { oldValue: '', newValue: '', isBinary: true }
  }

  // Get the HEAD version (use gitRaw to preserve trailing newlines)
  let oldValue = ''
  try {
    oldValue = normalizeLF(await gitRaw(cwd, 'show', `HEAD:${filePath}`))
  } catch {
    // New file — no HEAD version
    oldValue = ''
  }

  return { oldValue, newValue, isBinary: false }
}

export async function revertFile(cwd: string, filePath: string): Promise<GitCommitResult> {
  try {
    const statusOutput = await git(cwd, 'status', '--porcelain', '--', filePath)
    if (!statusOutput) {
      return { success: false, message: '', error: 'File has no changes' }
    }

    const firstLine = statusOutput.split('\n')[0]

    if (firstLine.startsWith('??')) {
      const root = await getRepoRoot(cwd)
      await unlink(join(root, filePath))
      return { success: true, message: `Removed untracked file ${filePath}` }
    }

    const indexStatus = firstLine[0]
    if (indexStatus !== ' ' && indexStatus !== '?') {
      await git(cwd, 'reset', 'HEAD', '--', filePath)
    }

    await git(cwd, 'checkout', 'HEAD', '--', filePath)
    return { success: true, message: `Reverted ${filePath}` }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function stageFile(cwd: string, filePath: string): Promise<GitCommitResult> {
  try {
    await git(cwd, 'add', '--', filePath)
    return { success: true, message: `Staged ${filePath}` }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function unstageFile(cwd: string, filePath: string): Promise<GitCommitResult> {
  try {
    await git(cwd, 'reset', 'HEAD', '--', filePath)
    return { success: true, message: `Unstaged ${filePath}` }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function stageAll(cwd: string): Promise<GitCommitResult> {
  try {
    await git(cwd, 'add', '-A')
    return { success: true, message: 'Staged all files' }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function unstageAll(cwd: string): Promise<GitCommitResult> {
  try {
    await git(cwd, 'reset', 'HEAD')
    return { success: true, message: 'Unstaged all files' }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function revertAll(cwd: string): Promise<GitCommitResult> {
  try {
    // Reset staged changes
    await git(cwd, 'reset', 'HEAD')
    // Checkout all tracked files
    await git(cwd, 'checkout', '--', '.')
    // Remove untracked files
    await git(cwd, 'clean', '-fd')
    return { success: true, message: 'Reverted all changes' }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function generateCommitMessage(cwd: string): Promise<string> {
  const statusOutput = await git(cwd, 'status', '--porcelain', '-uall')
  return buildCommitMessage(statusOutput.split('\n'))
}

export async function commitChanges(
  cwd: string,
  message: string,
  includeUnstaged: boolean
): Promise<GitCommitResult> {
  try {
    if (includeUnstaged) {
      await git(cwd, 'add', '-A')
    }
    const result = await git(cwd, 'commit', '-m', message)
    return { success: true, message: result }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function pushChanges(cwd: string): Promise<GitCommitResult> {
  try {
    const branch = await git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD')
    try {
      await git(cwd, 'rev-parse', '--abbrev-ref', `${branch}@{upstream}`)
      const result = await git(cwd, 'push')
      return { success: true, message: result || 'Pushed successfully' }
    } catch {
      const result = await git(cwd, 'push', '-u', 'origin', branch)
      return { success: true, message: result || 'Pushed successfully' }
    }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function createPullRequest(
  cwd: string,
  title: string,
  draft: boolean
): Promise<GitCommitResult> {
  try {
    const args = ['pr', 'create', '--title', title, '--fill']
    if (draft) args.push('--draft')
    const result = await exec('gh', args, { cwd })
    return { success: true, message: result.stdout.trim() }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/** Parse `git worktree list --porcelain` and return a map of branch name → worktree path */
async function getWorktreeMap(cwd: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const output = await git(cwd, 'worktree', 'list', '--porcelain')
    let currentPath = ''
    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        currentPath = line.slice('worktree '.length)
      } else if (line.startsWith('branch refs/heads/') && currentPath) {
        map.set(line.slice('branch refs/heads/'.length), currentPath)
      }
    }
  } catch {
    /* worktree list not available or not a repo */
  }
  return map
}

export async function listBranches(cwd: string): Promise<GitBranch[]> {
  const branches: GitBranch[] = []

  // Get worktree map so we can annotate branches
  const worktreeMap = await getWorktreeMap(cwd)

  // Local branches sorted by most recent commit
  try {
    const localOutput = await git(
      cwd,
      'branch',
      '--sort=-committerdate',
      '--format=%(refname:short)|%(HEAD)|%(committerdate:relative)'
    )
    for (const line of localOutput.split('\n').filter(Boolean)) {
      const [name, head, lastCommitDate] = line.split('|')
      if (name) {
        branches.push({
          name,
          isCurrent: head === '*',
          isRemote: false,
          lastCommitDate,
          worktreePath: worktreeMap.get(name) ?? null
        })
      }
    }
  } catch {
    /* no local branches */
  }

  // Remote branches
  try {
    const remoteOutput = await git(
      cwd,
      'branch',
      '-r',
      '--sort=-committerdate',
      '--format=%(refname:short)|%(committerdate:relative)'
    )
    const localNames = new Set(branches.map((b) => b.name))
    for (const line of remoteOutput.split('\n').filter(Boolean)) {
      const [fullName, lastCommitDate] = line.split('|')
      if (!fullName || fullName.includes('/HEAD')) continue
      // Strip the remote prefix (e.g. "origin/feature" → "feature")
      const shortName = fullName.replace(/^[^/]+\//, '')
      // Skip if there's already a local branch with the same name
      if (localNames.has(shortName)) continue
      branches.push({
        name: shortName,
        isCurrent: false,
        isRemote: true,
        lastCommitDate
      })
    }
  } catch {
    /* no remote branches */
  }

  return branches
}

export async function checkoutBranch(cwd: string, branch: string): Promise<GitCommitResult> {
  try {
    await git(cwd, 'checkout', branch)
    return { success: true, message: `Switched to branch '${branch}'` }
  } catch (error) {
    // If checkout fails, it might be a remote-only branch — try creating a tracking branch
    try {
      await git(cwd, 'checkout', '-b', branch, `origin/${branch}`)
      return {
        success: true,
        message: `Created and switched to branch '${branch}' tracking origin/${branch}`
      }
    } catch {
      return {
        success: false,
        message: '',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

export async function createBranch(cwd: string, branch: string): Promise<GitCommitResult> {
  try {
    await git(cwd, 'checkout', '-b', branch)
    return { success: true, message: `Created and switched to branch '${branch}'` }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Create a git worktree for an existing branch.
 * Defaults the worktree path to `~/.pi-code/worktrees/{repo-name}/{sanitized-branch}`.
 */
export async function createWorktree(
  cwd: string,
  branch: string,
  newBranch?: string,
  worktreePath?: string | null
): Promise<GitWorktreeResult> {
  const targetBranch = newBranch ?? branch
  const sanitizedBranch = targetBranch.replace(/\//g, '-')
  const repoName = basename(cwd)
  const resolvedPath =
    worktreePath ?? join(homedir(), '.pi-code', 'worktrees', repoName, sanitizedBranch)

  const args = newBranch
    ? ['worktree', 'add', '-b', newBranch, resolvedPath, branch]
    : ['worktree', 'add', resolvedPath, branch]

  await git(cwd, ...args)

  return {
    path: resolvedPath,
    branch: targetBranch
  }
}

/**
 * Remove a git worktree.
 */
export async function removeWorktree(
  cwd: string,
  worktreePath: string,
  force?: boolean
): Promise<void> {
  const args = ['worktree', 'remove']
  if (force) args.push('--force')
  args.push(worktreePath)
  await git(cwd, ...args)
}

/**
 * Check the PR status for a branch using the GitHub CLI.
 * Returns whether a PR exists, its state (open/merged/closed), and URL.
 */
export async function getPRStatus(cwd: string, branch: string): Promise<GitPRStatus> {
  try {
    const result = await exec('gh', ['pr', 'view', branch, '--json', 'state,url'], {
      cwd,
      maxBuffer: 10 * 1024 * 1024
    })
    const data = JSON.parse(result.stdout.trim()) as { state: string; url: string }
    const state =
      data.state === 'MERGED'
        ? 'merged'
        : data.state === 'CLOSED'
          ? 'closed'
          : data.state === 'OPEN'
            ? 'open'
            : null
    return { hasPR: true, state, url: data.url ?? null }
  } catch {
    // No PR found for this branch, or gh CLI not available
    return { hasPR: false, state: null, url: null }
  }
}
