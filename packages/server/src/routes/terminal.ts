import { Hono } from 'hono'
import {
  openTerminal,
  writeTerminal,
  resizeTerminal,
  disposeTerminal
} from '../../../../src/main/services/terminal'

export function createTerminalRoutes(): Hono {
  const app = new Hono()

  app.post('/open', async (c) => {
    const body = (await c.req.json()) as { id: string; cwd: string }
    return c.json(await openTerminal(body.id, body.cwd))
  })

  app.post('/write', async (c) => {
    const body = (await c.req.json()) as { id: string; data: string }
    writeTerminal(body.id, body.data)
    return c.json(true)
  })

  app.post('/resize', async (c) => {
    const body = (await c.req.json()) as { id: string; cols: number; rows: number }
    resizeTerminal(body.id, body.cols, body.rows)
    return c.json(true)
  })

  app.post('/dispose', async (c) => {
    const body = (await c.req.json()) as { id: string }
    disposeTerminal(body.id)
    return c.json(true)
  })

  return app
}
