import type { AddressInfo } from 'node:net'
import { serve } from '@hono/node-server'
import type { ServerType } from '@hono/node-server'
import { Hono } from 'hono'
import { setCookie, getCookie } from 'hono/cookie'
import { createHash, randomBytes } from 'crypto'
import { createApp } from './server'

export type PiListener = {
  hostname: string
  port: number
  url: string
  server: ServerType
  stop(): Promise<void>
}

export type PiServer = {
  local: PiListener
  remote: PiListener | null
  app: Hono
  startRemote(opts: { port?: number; hostname?: string; password?: string }): Promise<PiListener>
  stopRemote(): Promise<void>
}

function startListener(app: Hono, hostname: string, port: number): Promise<PiListener> {
  return new Promise((resolve, reject) => {
    try {
      const server = serve({ fetch: app.fetch, port, hostname })

      const onListening = (): void => {
        const address = server.address() as AddressInfo | null
        const resolvedPort = address?.port ?? port
        const resolvedHost = typeof address?.address === 'string' ? address.address : hostname
        const urlHost = resolvedHost.includes(':') ? `[${resolvedHost}]` : resolvedHost

        resolve({
          hostname: resolvedHost,
          port: resolvedPort,
          url: `http://${urlHost}:${resolvedPort}`,
          server,
          stop() {
            return new Promise<void>((res, rej) => {
              server.close((error) => (error ? rej(error) : res()))
            })
          }
        })
      }

      if ('listening' in server && server.listening) {
        onListening()
      } else {
        server.once('listening', onListening)
        server.once('error', reject)
      }
    } catch (error) {
      reject(error)
    }
  })
}

export async function createServer({
  port = 4310,
  hostname = '127.0.0.1',
  webRoot,
  devProxy
}: {
  port?: number
  hostname?: string
  webRoot?: string
  devProxy?: string
} = {}): Promise<PiServer> {
  const app = createApp({ webRoot, devProxy })

  const local = await startListener(app, hostname, port)

  let remote: PiListener | null = null

  return {
    local,
    get remote() {
      return remote
    },
    app,

    async startRemote(opts) {
      // Stop existing remote listener if any
      if (remote) {
        await remote.stop().catch(() => {})
        remote = null
      }

      const remotePort = opts.port ?? local.port
      const remoteHost = opts.hostname ?? '0.0.0.0'

      // Create a wrapper app that adds cookie session auth for remote access
      const remoteApp = new Hono()
      const sessionSecret = randomBytes(32).toString('hex')

      if (opts.password) {
        const expectedHash = createHash('sha256').update(opts.password).digest('hex')

        // Login page
        remoteApp.get('/login', (c) => {
          const error = c.req.query('error')
          return c.html(`<!DOCTYPE html>
<html class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>pi-code — Sign in</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #09090b; color: #fafafa; min-height: 100dvh;
      display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .card { width: 100%; max-width: 320px; }
    h1 { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.25rem; }
    .sub { font-size: 0.8125rem; color: #a1a1aa; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.8125rem; font-weight: 500; margin-bottom: 0.375rem; }
    input { width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem;
      border: 1px solid #27272a; background: #18181b; color: #fafafa;
      font-size: 0.875rem; outline: none; }
    input:focus { border-color: #3b82f6; }
    button { width: 100%; padding: 0.5rem; border-radius: 0.5rem; border: none;
      background: #fafafa; color: #09090b; font-size: 0.875rem; font-weight: 500;
      cursor: pointer; margin-top: 1rem; }
    button:active { opacity: 0.9; }
    .error { color: #ef4444; font-size: 0.75rem; margin-top: 0.75rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>pi-code</h1>
    <p class="sub">Enter the password to access this session.</p>
    <form method="POST" action="/login">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autofocus required placeholder="Enter password…">
      <button type="submit">Sign in</button>
      ${error ? '<p class="error">Incorrect password</p>' : ''}
    </form>
  </div>
</body>
</html>`)
        })

        // Login POST handler
        remoteApp.post('/login', async (c) => {
          const body = await c.req.parseBody()
          const pw = typeof body.password === 'string' ? body.password : ''
          const hash = createHash('sha256').update(pw).digest('hex')

          if (hash !== expectedHash) {
            return c.redirect('/login?error=1')
          }

          // Create session token
          const token = createHash('sha256')
            .update(sessionSecret + hash + Date.now().toString())
            .digest('hex')

          setCookie(c, 'pi_session', token, {
            httpOnly: true,
            sameSite: 'Lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30 // 30 days
          })

          // Store valid token
          validTokens.add(token)

          return c.redirect('/')
        })

        // Auth middleware — check cookie on all other routes
        const validTokens = new Set<string>()

        remoteApp.use(async (c, next) => {
          const path = c.req.path
          if (path === '/login') return next()

          const token = getCookie(c, 'pi_session')
          if (!token || !validTokens.has(token)) {
            return c.redirect('/login')
          }

          return next()
        })
      }

      // Forward all requests to the main app
      remoteApp.all('*', (c) => app.fetch(c.req.raw))

      remote = await startListener(remoteApp, remoteHost, remotePort)
      return remote
    },

    async stopRemote() {
      if (remote) {
        await remote.stop()
        remote = null
      }
    }
  }
}
