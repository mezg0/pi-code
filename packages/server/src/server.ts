import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { createAuthRoutes } from './routes/auth'
import { createFilesRoutes } from './routes/files'
import { createGitRoutes } from './routes/git'
import { createProjectRoutes } from './routes/project'
import { createSessionRoutes } from './routes/session'
import { createTerminalRoutes } from './routes/terminal'
import { subscribeToServerEvents } from './event-bus'

export function createApp(): Hono {
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

  app.route('/auth', createAuthRoutes())
  app.route('/files', createFilesRoutes())
  app.route('/git', createGitRoutes())
  app.route('/project', createProjectRoutes())
  app.route('/session', createSessionRoutes())
  app.route('/terminal', createTerminalRoutes())

  return app
}
