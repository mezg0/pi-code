import { existsSync, readFileSync } from 'fs'
import { join, extname } from 'path'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { createAuthRoutes } from './routes/auth'
import { createFilesRoutes } from './routes/files'
import { createGitRoutes } from './routes/git'
import { createProjectRoutes } from './routes/project'
import { createSessionRoutes } from './routes/session'
import { createSettingsRoutes } from './routes/settings'
import { createRemoteRoutes } from './routes/remote'
import { createTerminalRoutes } from './routes/terminal'
import { createMcpRoutes } from './routes/mcp'
import { subscribeToServerEvents } from './event-bus'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm'
}

export function createApp(options?: { webRoot?: string; devProxy?: string }): Hono {
  const app = new Hono()

  app.use(
    cors({
      origin: (origin) => {
        if (!origin) return undefined
        // Allow localhost/127.0.0.1 on any port (dev + prod)
        if (origin.startsWith('http://localhost:')) return origin
        if (origin.startsWith('http://127.0.0.1:')) return origin
        return undefined
      }
    })
  )

  app.onError((error, c) => {
    console.error('[server] request failed:', error)
    return c.json(
      {
        error: error instanceof Error ? error.message : String(error)
      },
      500
    )
  })

  app.get('/health', (c) => {
    return c.json({ healthy: true, service: 'pi-code-server' })
  })

  app.get('/event', (c) => {
    c.header('X-Accel-Buffering', 'no')
    c.header('X-Content-Type-Options', 'nosniff')

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        data: JSON.stringify({
          channel: 'server:connected',
          payload: {},
          timestamp: new Date().toISOString()
        })
      })

      const unsubscribe = subscribeToServerEvents((event) => {
        void stream.writeSSE({ data: JSON.stringify(event) })
      })

      const heartbeat = setInterval(() => {
        void stream.writeSSE({
          data: JSON.stringify({
            channel: 'server:heartbeat',
            payload: {},
            timestamp: new Date().toISOString()
          })
        })
      }, 10000)

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(heartbeat)
          unsubscribe()
          resolve()
        })
      })
    })
  })

  app.route('/remote', createRemoteRoutes())
  app.route('/auth', createAuthRoutes())
  app.route('/files', createFilesRoutes())
  app.route('/git', createGitRoutes())
  app.route('/project', createProjectRoutes())
  app.route('/session', createSessionRoutes())
  app.route('/app-settings', createSettingsRoutes())
  app.route('/terminal', createTerminalRoutes())
  app.route('/mcp', createMcpRoutes())

  // Dev mode: proxy non-API requests to Vite dev server for hot reload
  const devProxy = options?.devProxy
  if (devProxy) {
    app.all('*', async (c) => {
      const target = `${devProxy}${c.req.path}${c.req.url.includes('?') ? '?' + c.req.url.split('?')[1] : ''}`
      try {
        const headers = new Headers(c.req.raw.headers)
        headers.delete('host')
        const response = await fetch(target, {
          method: c.req.method,
          headers,
          body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
          redirect: 'manual'
        })
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        })
      } catch {
        return c.text('Vite dev server not available', 502)
      }
    })
  }

  // Production: serve web UI static assets (SPA catchall)
  const webRoot = options?.webRoot
  if (!devProxy && webRoot && existsSync(webRoot)) {
    const indexHtml = readFileSync(join(webRoot, 'index.html'), 'utf-8')

    app.get('*', (c) => {
      const filePath = join(webRoot, c.req.path)
      const ext = extname(c.req.path)

      // Try serving a static file first
      if (ext && existsSync(filePath)) {
        const content = readFileSync(filePath)
        const mime = MIME_TYPES[ext] || 'application/octet-stream'
        return c.body(content, 200, { 'Content-Type': mime })
      }

      // Fall back to index.html for client-side routing
      return c.html(indexHtml)
    })
  }

  return app
}
