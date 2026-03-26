import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { createProjectRoutes } from './routes/project'
import { createSessionRoutes } from './routes/session'
import { subscribeToServerEvents } from './event-bus'

export function createApp(): Hono {
  const app = new Hono()

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

  app.route('/project', createProjectRoutes())
  app.route('/session', createSessionRoutes())

  return app
}
