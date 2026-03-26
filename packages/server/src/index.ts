import type { AddressInfo } from 'node:net'
import { serve } from '@hono/node-server'
import type { ServerType } from '@hono/node-server'
import { createApp } from './server'

export type PiServer = {
  hostname: string
  port: number
  url: string
  server: ServerType
  stop(): Promise<void>
}

export async function createServer({
  port = 0,
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

  const server = serve({
    fetch: app.fetch,
    port,
    hostname
  })

  await new Promise<void>((resolve) => {
    if ('listening' in server && server.listening) {
      resolve()
      return
    }
    server.once('listening', () => resolve())
  })

  const address = server.address() as AddressInfo | null
  const resolvedPort = address?.port ?? port
  const resolvedHost = typeof address?.address === 'string' ? address.address : hostname
  const urlHost = resolvedHost.includes(':') ? `[${resolvedHost}]` : resolvedHost

  return {
    hostname: resolvedHost,
    port: resolvedPort,
    url: `http://${urlHost}:${resolvedPort}`,
    server,
    stop() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    }
  }
}
