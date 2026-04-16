// ---------------------------------------------------------------------------
// Worktree session helpers
// ---------------------------------------------------------------------------
// Shared logic for creating a new session backed by a fresh git worktree.
// Used by the sidebar "New worktree session" menu and the Mod+Shift+N hotkey.
// ---------------------------------------------------------------------------

import { createGitWorktree, listGitBranches } from './git'
import type { Project } from './sessions'

export type WorktreeSessionCreator = (
  project: Project,
  options: { branch: string; worktreePath: string }
) => Promise<void>

/** 5-char random suffix used to disambiguate auto-generated worktree branches. */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7)
}

/**
 * Create a new worktree off `baseBranch` and hand off to `onCreateSession`.
 *
 * Always creates a fresh derived branch (`${baseBranch}-wt-${suffix}`) so the
 * base branch stays checkout-able. Mirrors the behaviour of the existing
 * right-click flow in `NewSessionButton`.
 *
 * Throws if the underlying `createGitWorktree` call fails; callers decide how
 * to surface the error (alert, toast, inline message, etc.).
 */
export async function createWorktreeSession(
  project: Project,
  baseBranch: string,
  onCreateSession: WorktreeSessionCreator
): Promise<void> {
  const newBranch = `${baseBranch}-wt-${randomSuffix()}`
  const result = await createGitWorktree(project.repoPath, baseBranch, newBranch)
  await onCreateSession(project, {
    branch: newBranch,
    worktreePath: result.path
  })
}

/**
 * Resolve the current local branch in `repoPath`, falling back to `HEAD`
 * when the repo is in detached-HEAD state.
 */
export async function resolveCurrentLocalBranch(repoPath: string): Promise<string> {
  try {
    const branches = await listGitBranches(repoPath)
    const current = branches.find((branch) => branch.isCurrent && !branch.isRemote)
    return current?.name ?? 'HEAD'
  } catch {
    return 'HEAD'
  }
}
