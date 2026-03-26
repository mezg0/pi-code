import { Hono } from 'hono'
import type {
  CreateSessionInput,
  QuestionAnswer,
  SessionImageInput,
  UpdateSessionInput
} from '@pi-code/shared/session'
import { createSession, getSession, listSessions, updateSession } from '../../../../src/main/services/session-manager'
import {
  abortSession,
  disposeSession,
  getAgentMessages,
  getAgentState,
  getAvailableModels,
  getPendingQuestion,
  getPlanMode,
  sendSessionMessage,
  setModel,
  setPlanMode,
  setThinkingLevel,
  steerSession
} from '../../../../src/main/services/pi-runner'
import { rejectQuestion, replyToQuestion } from '../../../../src/main/services/tools/question'

export function createSessionRoutes(): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    return c.json(await listSessions())
  })

  app.post('/', async (c) => {
    const body = (await c.req.json().catch(() => null)) as CreateSessionInput | null
    if (!body?.repoPath || !body.title || !body.agent || !body.model) {
      return c.json({ error: 'Invalid session payload' }, 400)
    }
    return c.json(await createSession(body), 201)
  })

  app.get('/:id', async (c) => {
    const session = await getSession(c.req.param('id'))
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }
    return c.json(session)
  })

  app.patch('/:id', async (c) => {
    const body = (await c.req.json().catch(() => null)) as UpdateSessionInput | null
    if (!body) {
      return c.json({ error: 'Invalid update payload' }, 400)
    }

    const session = await updateSession(c.req.param('id'), body)
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }

    return c.json(session)
  })

  app.delete('/:id', async (c) => {
    const deleted = await disposeSession(c.req.param('id'))
    if (!deleted) {
      return c.json({ error: 'Session not found' }, 404)
    }
    return c.json(true)
  })

  app.get('/:id/messages', async (c) => {
    return c.json(await getAgentMessages(c.req.param('id')))
  })

  app.post('/:id/message', async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      text?: string
      images?: SessionImageInput[]
    } | null
    const text = typeof body?.text === 'string' ? body.text : ''

    if (!text) {
      return c.json({ error: 'text is required' }, 400)
    }

    return c.json(await sendSessionMessage(c.req.param('id'), text, body?.images))
  })

  app.post('/:id/steer', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { text?: string } | null
    const text = typeof body?.text === 'string' ? body.text : ''

    if (!text) {
      return c.json({ error: 'text is required' }, 400)
    }

    return c.json(await steerSession(c.req.param('id'), text))
  })

  app.post('/:id/abort', async (c) => {
    return c.json(await abortSession(c.req.param('id')))
  })

  app.get('/:id/state', async (c) => {
    return c.json(await getAgentState(c.req.param('id')))
  })

  app.get('/:id/plan-mode', async (c) => {
    return c.json(await getPlanMode(c.req.param('id')))
  })

  app.put('/:id/plan-mode', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { enabled?: boolean } | null
    if (typeof body?.enabled !== 'boolean') {
      return c.json({ error: 'enabled must be a boolean' }, 400)
    }

    return c.json(await setPlanMode(c.req.param('id'), body.enabled))
  })

  app.get('/:id/models', async (c) => {
    return c.json(await getAvailableModels(c.req.param('id')))
  })

  app.put('/:id/model', async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      provider?: string
      modelId?: string
    } | null

    if (!body?.provider || !body?.modelId) {
      return c.json({ error: 'provider and modelId are required' }, 400)
    }

    return c.json(await setModel(c.req.param('id'), body.provider, body.modelId))
  })

  app.put('/:id/thinking', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { level?: string } | null
    if (!body?.level) {
      return c.json({ error: 'level is required' }, 400)
    }

    return c.json(await setThinkingLevel(c.req.param('id'), body.level))
  })

  app.get('/:id/question', async (c) => {
    return c.json(getPendingQuestion(c.req.param('id')))
  })

  app.post('/question/:requestId/reply', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { answers?: QuestionAnswer[] } | null
    if (!Array.isArray(body?.answers)) {
      return c.json({ error: 'answers must be an array' }, 400)
    }

    return c.json(replyToQuestion(c.req.param('requestId'), body.answers))
  })

  app.post('/question/:requestId/reject', (c) => {
    return c.json(rejectQuestion(c.req.param('requestId')))
  })

  return app
}
