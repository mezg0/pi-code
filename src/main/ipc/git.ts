import { ipcMain } from 'electron'
import {
  getGitStatus,
  getChangedFiles,
  getFileContents,
  stageFile,
  unstageFile,
  revertFile,
  stageAll,
  unstageAll,
  revertAll,
  generateCommitMessage,
  commitChanges,
  pushChanges,
  createPullRequest,
  isGitRepo,
  listBranches,
  checkoutBranch,
  createBranch,
  createWorktree,
  removeWorktree,
  getPRStatus
} from '../services/git'

export function registerGitIpc(): void {
  ipcMain.handle('git:isRepo', (_event, cwd: string) => isGitRepo(cwd))

  ipcMain.handle('git:status', (_event, cwd: string) => getGitStatus(cwd))

  ipcMain.handle('git:changedFiles', (_event, cwd: string) => getChangedFiles(cwd))

  ipcMain.handle('git:fileContents', (_event, cwd: string, filePath: string) =>
    getFileContents(cwd, filePath)
  )

  ipcMain.handle('git:stageFile', (_event, cwd: string, filePath: string) =>
    stageFile(cwd, filePath)
  )

  ipcMain.handle('git:unstageFile', (_event, cwd: string, filePath: string) =>
    unstageFile(cwd, filePath)
  )

  ipcMain.handle('git:revertFile', (_event, cwd: string, filePath: string) =>
    revertFile(cwd, filePath)
  )

  ipcMain.handle('git:stageAll', (_event, cwd: string) => stageAll(cwd))

  ipcMain.handle('git:unstageAll', (_event, cwd: string) => unstageAll(cwd))

  ipcMain.handle('git:revertAll', (_event, cwd: string) => revertAll(cwd))

  ipcMain.handle('git:generateMessage', (_event, cwd: string) => generateCommitMessage(cwd))

  ipcMain.handle('git:commit', (_event, cwd: string, message: string, includeUnstaged: boolean) =>
    commitChanges(cwd, message, includeUnstaged)
  )

  ipcMain.handle('git:push', (_event, cwd: string) => pushChanges(cwd))

  ipcMain.handle('git:createPR', (_event, cwd: string, title: string, draft: boolean) =>
    createPullRequest(cwd, title, draft)
  )

  ipcMain.handle('git:listBranches', (_event, cwd: string) => listBranches(cwd))

  ipcMain.handle('git:checkoutBranch', (_event, cwd: string, branch: string) =>
    checkoutBranch(cwd, branch)
  )

  ipcMain.handle('git:createBranch', (_event, cwd: string, branch: string) =>
    createBranch(cwd, branch)
  )

  ipcMain.handle(
    'git:createWorktree',
    (_event, cwd: string, branch: string, newBranch?: string, path?: string | null) =>
      createWorktree(cwd, branch, newBranch, path ?? undefined)
  )

  ipcMain.handle(
    'git:removeWorktree',
    (_event, cwd: string, worktreePath: string, force?: boolean) =>
      removeWorktree(cwd, worktreePath, force)
  )

  ipcMain.handle('git:prStatus', (_event, cwd: string, branch: string) =>
    getPRStatus(cwd, branch)
  )
}
