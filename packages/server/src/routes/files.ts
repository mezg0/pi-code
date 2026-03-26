import { Hono } from 'hono'
import { listDirectory, getFileContent, saveFileContent } from '../../../../src/main/services/files'
import { startWatching, stopWatching } from '../../../../src/main/services/file-watcher'

export function createFilesRoutes(): Hono {
  const app = new Hono()

  app.get('/list', async (c) => {
    const cwd = c.req.query('cwd') ?? ''
    const dirPath = c.req.query('dirPath')
    return c.json(await listDirectory(cwd, dirPath))
  })

  app.get('/read', async (c) => {
    const cwd = c.req.query('cwd') ?? ''
    const filePath = c.req.query('filePath') ?? ''
    return c.json(await getFileContent(cwd, filePath))
  })

  app.post('/write', async (c) => {
    const body = (await c.req.json()) as {
      cwd: string
      filePath: string
      content: string
    }
    await saveFileContent(body.cwd, body.filePath, body.content)
    return c.json(true)
  })

  app.post('/watch', async (c) => {
    const body = (await c.req.json()) as { cwd: string }
    startWatching(body.cwd)
    return c.json(true)
  })

  app.post('/unwatch', async (c) => {
    const body = (await c.req.json()) as { cwd: string }
    stopWatching(body.cwd)
    return c.json(true)
  })

  return app
}
