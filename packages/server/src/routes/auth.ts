import { Hono } from 'hono'
import {
  listAuthProviders,
  oauthLogin,
  oauthLogout,
  removeCredential,
  setApiKey
} from '../../../../src/main/services/auth'

export function createAuthRoutes(): Hono {
  const app = new Hono()

  app.get('/provider', async (c) => {
    return c.json(await listAuthProviders())
  })

  app.put('/:providerId/key', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { key?: string } | null
    if (!body?.key) return c.json({ error: 'key is required' }, 400)
    return c.json(await setApiKey(c.req.param('providerId'), body.key))
  })

  app.delete('/:providerId', async (c) => {
    return c.json(await removeCredential(c.req.param('providerId')))
  })

  app.post('/:providerId/login', async (c) => {
    return c.json(await oauthLogin(c.req.param('providerId')))
  })

  app.post('/:providerId/logout', async (c) => {
    return c.json(await oauthLogout(c.req.param('providerId')))
  })

  return app
}
