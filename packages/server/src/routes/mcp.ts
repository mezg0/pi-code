import { Hono } from 'hono'
import type { SaveMcpServerInput } from '@pi-code/shared/mcp'
import {
  deleteMcpServer,
  getMcpConfigState,
  reloadMcpResources,
  saveMcpServer
} from '../../../../src/main/services/mcp-config'

export function createMcpRoutes(): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    return c.json(await getMcpConfigState())
  })

  app.put('/server/:name', async (c) => {
    const body = (await c.req.json().catch(() => null)) as Partial<SaveMcpServerInput> | null
    const name = c.req.param('name')

    if (!body) {
      return c.json({ error: 'Invalid MCP server payload' }, 400)
    }

    return c.json(
      await saveMcpServer({
        name,
        transport: body.transport === 'http' ? 'http' : 'stdio',
        lifecycle:
          body.lifecycle === 'eager' || body.lifecycle === 'keep-alive' ? body.lifecycle : 'lazy',
        command: body.command,
        args: Array.isArray(body.args)
          ? body.args.filter((entry): entry is string => typeof entry === 'string')
          : [],
        env:
          body.env && typeof body.env === 'object' && !Array.isArray(body.env)
            ? Object.fromEntries(
                Object.entries(body.env).filter((entry): entry is [string, string] => {
                  return typeof entry[0] === 'string' && typeof entry[1] === 'string'
                })
              )
            : undefined,
        url: body.url
      })
    )
  })

  app.delete('/server/:name', async (c) => {
    return c.json(await deleteMcpServer(c.req.param('name')))
  })

  app.post('/reload', async (c) => {
    return c.json(await reloadMcpResources())
  })

  return app
}
