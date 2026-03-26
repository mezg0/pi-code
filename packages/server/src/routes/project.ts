import { Hono } from 'hono'
import { addProjectByPath, listProjects, removeProject } from '../../../../src/main/services/projects'

export function createProjectRoutes(): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    return c.json(await listProjects())
  })

  app.post('/', async (c) => {
    const body = await c.req.json().catch(() => null)
    const repoPath = typeof body?.repoPath === 'string' ? body.repoPath.trim() : ''

    if (!repoPath) {
      return c.json({ error: 'repoPath is required' }, 400)
    }

    return c.json(await addProjectByPath(repoPath), 201)
  })

  app.delete('/:id', async (c) => {
    const deleted = await removeProject(c.req.param('id'))
    if (!deleted) {
      return c.json({ error: 'Project not found' }, 404)
    }
    return c.json(true)
  })

  return app
}
