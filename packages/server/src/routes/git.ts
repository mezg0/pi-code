import { Hono } from 'hono'
import {
  checkoutBranch,
  commitChanges,
  createBranch,
  createPullRequest,
  createWorktree,
  generateCommitMessage,
  getChangedFiles,
  getFileContents,
  getGitStatus,
  getPRStatus,
  isGitRepo,
  listBranches,
  pushChanges,
  removeWorktree,
  revertAll,
  revertFile,
  stageAll,
  stageFile,
  unstageAll,
  unstageFile
} from '../../../../src/main/services/git'

export function createGitRoutes(): Hono {
  const app = new Hono()

  app.get('/is-repo', async (c) => {
    const cwd = c.req.query('cwd') ?? ''
    return c.json(await isGitRepo(cwd))
  })

  app.get('/status', async (c) => {
    const cwd = c.req.query('cwd') ?? ''
    return c.json(await getGitStatus(cwd))
  })

  app.get('/changed-files', async (c) => {
    const cwd = c.req.query('cwd') ?? ''
    return c.json(await getChangedFiles(cwd))
  })

  app.get('/file-contents', async (c) => {
    const cwd = c.req.query('cwd') ?? ''
    const filePath = c.req.query('filePath') ?? ''
    return c.json(await getFileContents(cwd, filePath))
  })

  app.post('/stage-file', async (c) => {
    const body = (await c.req.json()) as { cwd: string; filePath: string }
    return c.json(await stageFile(body.cwd, body.filePath))
  })

  app.post('/unstage-file', async (c) => {
    const body = (await c.req.json()) as { cwd: string; filePath: string }
    return c.json(await unstageFile(body.cwd, body.filePath))
  })

  app.post('/revert-file', async (c) => {
    const body = (await c.req.json()) as { cwd: string; filePath: string }
    return c.json(await revertFile(body.cwd, body.filePath))
  })

  app.post('/stage-all', async (c) => {
    const body = (await c.req.json()) as { cwd: string }
    return c.json(await stageAll(body.cwd))
  })

  app.post('/unstage-all', async (c) => {
    const body = (await c.req.json()) as { cwd: string }
    return c.json(await unstageAll(body.cwd))
  })

  app.post('/revert-all', async (c) => {
    const body = (await c.req.json()) as { cwd: string }
    return c.json(await revertAll(body.cwd))
  })

  app.post('/generate-message', async (c) => {
    const body = (await c.req.json()) as { cwd: string }
    return c.json(await generateCommitMessage(body.cwd))
  })

  app.post('/commit', async (c) => {
    const body = (await c.req.json()) as {
      cwd: string
      message: string
      includeUnstaged: boolean
    }
    return c.json(await commitChanges(body.cwd, body.message, body.includeUnstaged))
  })

  app.post('/push', async (c) => {
    const body = (await c.req.json()) as { cwd: string }
    return c.json(await pushChanges(body.cwd))
  })

  app.post('/create-pr', async (c) => {
    const body = (await c.req.json()) as { cwd: string; title: string; draft: boolean }
    return c.json(await createPullRequest(body.cwd, body.title, body.draft))
  })

  app.get('/branches', async (c) => {
    const cwd = c.req.query('cwd') ?? ''
    return c.json(await listBranches(cwd))
  })

  app.post('/checkout', async (c) => {
    const body = (await c.req.json()) as { cwd: string; branch: string }
    return c.json(await checkoutBranch(body.cwd, body.branch))
  })

  app.post('/create-branch', async (c) => {
    const body = (await c.req.json()) as { cwd: string; branch: string }
    return c.json(await createBranch(body.cwd, body.branch))
  })

  app.post('/create-worktree', async (c) => {
    const body = (await c.req.json()) as {
      cwd: string
      branch: string
      newBranch?: string
      path?: string | null
    }
    return c.json(
      await createWorktree(body.cwd, body.branch, body.newBranch, body.path ?? undefined)
    )
  })

  app.post('/remove-worktree', async (c) => {
    const body = (await c.req.json()) as {
      cwd: string
      worktreePath: string
      force?: boolean
    }
    await removeWorktree(body.cwd, body.worktreePath, body.force)
    return c.json(true)
  })

  app.get('/pr-status', async (c) => {
    const cwd = c.req.query('cwd') ?? ''
    const branch = c.req.query('branch') ?? ''
    return c.json(await getPRStatus(cwd, branch))
  })

  return app
}
