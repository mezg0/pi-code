import { Hono } from 'hono'
import { getAppSettings, updateAppSettings } from '../../../../src/main/services/settings'
import type { AppSettings, PermissionMode } from '@pi-code/shared/session'

function isPermissionMode(value: unknown): value is PermissionMode {
  return value === 'ask' || value === 'auto' || value === 'strict'
}

export function createSettingsRoutes(): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    return c.json(await getAppSettings())
  })

  app.patch('/', async (c) => {
    const body = (await c.req.json().catch(() => null)) as Partial<AppSettings> | null

    if (body && 'defaultPermissionMode' in body && !isPermissionMode(body.defaultPermissionMode)) {
      return c.json({ error: 'defaultPermissionMode must be one of: ask, auto, strict' }, 400)
    }

    const settings = await updateAppSettings(body ?? {})
    return c.json(settings)
  })

  return app
}
