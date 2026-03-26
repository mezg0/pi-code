import { Hono } from 'hono'

// These will be injected by the main process since they depend on Electron
type RemoteAccessHandlers = {
  getStatus: () => Promise<{
    enabled: boolean
    port: number
    password: string | null
    urls: string[]
  }>
  enable: (opts: { port?: number; password?: string | null }) => Promise<{
    enabled: boolean
    port: number
    password: string | null
    urls: string[]
  }>
  disable: () => Promise<{ enabled: boolean }>
  generatePassword: () => string
}

let handlers: RemoteAccessHandlers | null = null

export function setRemoteAccessHandlers(h: RemoteAccessHandlers): void {
  handlers = h
}

export function createRemoteRoutes(): Hono {
  const app = new Hono()

  app.get('/status', async (c) => {
    if (!handlers) return c.json({ error: 'Not available' }, 503)
    return c.json(await handlers.getStatus())
  })

  app.post('/enable', async (c) => {
    if (!handlers) return c.json({ error: 'Not available' }, 503)
    const body = (await c.req.json().catch(() => null)) as {
      port?: number
      password?: string | null
    } | null
    return c.json(await handlers.enable({ port: body?.port, password: body?.password }))
  })

  app.post('/disable', (c) => {
    if (!handlers) return c.json({ error: 'Not available' }, 503)
    // Fire and forget — stop the remote listener after sending the response,
    // otherwise the response never arrives if this request came via the remote listener
    setTimeout(() => void handlers!.disable(), 100)
    return c.json({ enabled: false })
  })

  app.post('/generate-password', (c) => {
    if (!handlers) return c.json({ error: 'Not available' }, 503)
    return c.json({ password: handlers.generatePassword() })
  })

  return app
}
