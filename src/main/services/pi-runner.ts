import { existsSync } from 'fs'
import { BrowserWindow } from 'electron'
import type {
  AgentSession,
  AgentSessionEvent,
  SessionManager as PiSessionManager,
  ToolDefinition
} from '@mariozechner/pi-coding-agent'
import APPEND_SYSTEM_PROMPT from './app-system-prompt.md?raw'
import { cloneStreamingSnapshot } from '../../shared/streaming-contract'
import { formatUserFacingError } from '../../shared/format-error'
import { deriveSessionTitle, NEW_SESSION_TITLE } from '../../shared/session-defaults'
import type {
  AgentMessage,
  ModelInfo,
  RpcState,
  SessionImageInput,
  SessionStreamingEvent
} from '../../shared/session'
import {
  deleteSession as removeSession,
  getSession,
  getSessionFile,
  setSessionFile,
  updateSession
} from './session-manager'
import { getAuthStorage } from './auth'
import { loadPiSdk } from './pi-sdk'
import {
  getBuiltinExtensionFactories,
  getCursorAgentExtensionPaths
} from './extensions/builtin'
import { getPlanModeController } from './extensions/plan-mode'
import { webFetchTool } from './tools/webfetch'
import {
  askUserQuestionTool,
  getPendingQuestion,
  rejectAllQuestionsForSession,
  setCurrentSessionId
} from './tools/question'

type PlanModeStateEntry = {
  type?: string
  customType?: string
  data?: {
    enabled?: boolean
  }
}

const agentSessions = new Map<string, AgentSession>()
const pendingAgentSessions = new Map<string, Promise<AgentSession>>()
const abortingSessions = new Set<string>()

type ThinkingLevel = Parameters<AgentSession['setThinkingLevel']>[0]

function emitToRenderers(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

function emitSessionUpdate(session: { id: string; [key: string]: unknown }): void {
  emitToRenderers('sessions:updated', session)
}

function emitMessages(sessionId: string, messages: AgentMessage[]): void {
  emitToRenderers('sessions:messages', { sessionId, messages })
}

function emitPlanMode(sessionId: string, enabled: boolean): void {
  emitToRenderers('sessions:planMode', { sessionId, enabled })
}

// Coalesce streaming updates so the renderer receives at most one in-flight
// assistant snapshot per event-loop tick instead of one IPC payload per token.
const pendingStreamingEvents = new Map<
  string,
  { sessionId: string; event: SessionStreamingEvent }
>()
let streamingFlushScheduled = false

function flushStreamingEvents(): void {
  streamingFlushScheduled = false
  for (const [, payload] of pendingStreamingEvents) {
    emitToRenderers('sessions:streaming', cloneStreamingSnapshot(payload))
  }
  pendingStreamingEvents.clear()
}

function emitStreamingEvent(sessionId: string, event: SessionStreamingEvent): void {
  if (event.type === 'message_update') {
    // Coalesce: only keep the latest message_update per session
    pendingStreamingEvents.set(sessionId, { sessionId, event })
    if (!streamingFlushScheduled) {
      streamingFlushScheduled = true
      // Use setImmediate to flush at the end of the current event loop tick,
      // giving multiple rapid message_update events a chance to coalesce.
      setImmediate(flushStreamingEvents)
    }
  } else {
    // Non-update events (message_end, agent_end) are sent immediately and
    // flush any pending update first so ordering remains stable.
    if (pendingStreamingEvents.has(sessionId)) {
      const pending = pendingStreamingEvents.get(sessionId)!
      pendingStreamingEvents.delete(sessionId)
      emitToRenderers('sessions:streaming', cloneStreamingSnapshot(pending))
    }
    emitToRenderers('sessions:streaming', { sessionId, event })
  }
}

async function createSessionManagerForSession(sessionId: string): Promise<PiSessionManager> {
  const session = await getSession(sessionId)
  if (!session) {
    throw new Error('Session not found')
  }

  const sessionFile = getSessionFile(sessionId)
  const { SessionManager } = await loadPiSdk()

  // Only open the file if it actually exists on disk. A file path can be
  // stored (via setSessionFile) before the SDK flushes the first assistant
  // message, leaving a phantom path.  Opening a non-existent path causes
  // the SDK to create a session with a random ID instead of the intended
  // one, which leads to duplicate sessions in listSessions().
  if (sessionFile && existsSync(sessionFile)) {
    return SessionManager.open(sessionFile)
  }

  if (session.status !== 'draft') {
    throw new Error(`Session ${sessionId} has no persisted file`)
  }

  // Always store session files in the project root so they're found on reload.
  // The agent itself runs in the worktree via agentCwd below.
  const sessionManager = SessionManager.create(session.repoPath)
  sessionManager.newSession({ id: sessionId })

  const nextSessionFile = sessionManager.getSessionFile()
  if (!nextSessionFile) {
    throw new Error(`Failed to create session file for draft session ${sessionId}`)
  }

  setSessionFile(sessionId, nextSessionFile)
  return sessionManager
}

async function createTrackedAgentSession(sessionId: string): Promise<AgentSession> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')

  const sessionManager = await createSessionManagerForSession(sessionId)
  const { createAgentSession, DefaultResourceLoader } = await loadPiSdk()

  const agentCwd = session.worktreePath ?? session.repoPath
  const resourceLoader = new DefaultResourceLoader({
    cwd: agentCwd,
    systemPromptOverride: () => undefined,
    appendSystemPromptOverride: () => [APPEND_SYSTEM_PROMPT],
    extensionFactories: getBuiltinExtensionFactories(),
    additionalExtensionPaths: getCursorAgentExtensionPaths()
  })
  await resourceLoader.reload()

  const authStorage = await getAuthStorage()
  const { session: agentSession } = await createAgentSession({
    cwd: agentCwd,
    sessionManager,
    resourceLoader,
    authStorage,
    customTools: [
      webFetchTool as unknown as ToolDefinition,
      askUserQuestionTool as unknown as ToolDefinition
    ]
  })

  // Bind extensions to emit session_start, which lets extensions (e.g. plan-mode)
  // register runtime controllers. The interactive CLI does this in initExtensions();
  // here we call it with minimal bindings since pi-code manages UI separately.
  await agentSession.bindExtensions({})

  agentSession.subscribe((event: AgentSessionEvent) => {
    handleAgentEvent(sessionId, agentSession, event)
  })

  agentSessions.set(sessionId, agentSession)
  return agentSession
}

async function ensureAgentSession(sessionId: string): Promise<AgentSession> {
  const existing = agentSessions.get(sessionId)
  if (existing) return existing

  const pending = pendingAgentSessions.get(sessionId)
  if (pending) return pending

  const next = createTrackedAgentSession(sessionId)
  pendingAgentSessions.set(sessionId, next)

  try {
    return await next
  } finally {
    pendingAgentSessions.delete(sessionId)
  }
}

function handleAgentEvent(
  sessionId: string,
  agentSession: AgentSession,
  event: AgentSessionEvent
): void {
  switch (event.type) {
    case 'message_start':
    case 'turn_start':
    case 'turn_end':
      emitMessages(sessionId, agentSession.messages)
      return

    case 'message_end':
      emitStreamingEvent(sessionId, {
        type: 'message_end',
        pendingMessages: [
          ...agentSession.getSteeringMessages(),
          ...agentSession.getFollowUpMessages()
        ]
      })
      emitMessages(sessionId, agentSession.messages)
      return

    case 'agent_end':
      emitStreamingEvent(sessionId, {
        type: 'agent_end',
        pendingMessages: []
      })
      emitMessages(sessionId, agentSession.messages)
      return

    case 'message_update':
      emitStreamingEvent(sessionId, {
        type: 'message_update',
        message: event.message,
        pendingMessages: [
          ...agentSession.getSteeringMessages(),
          ...agentSession.getFollowUpMessages()
        ]
      })
      return
  }
}

export async function getAgentMessages(sessionId: string): Promise<AgentMessage[]> {
  const existing = agentSessions.get(sessionId)
  if (existing) return existing.messages

  try {
    const sessionFile = getSessionFile(sessionId)
    if (!sessionFile) {
      return []
    }

    const { SessionManager } = await loadPiSdk()
    const sessionManager = SessionManager.open(sessionFile)
    return sessionManager.buildSessionContext().messages
  } catch (error) {
    console.error(`[pi-runner] getAgentMessages failed for ${sessionId}:`, error)
    return []
  }
}

export async function getAgentState(sessionId: string): Promise<RpcState> {
  try {
    const agentSession = await ensureAgentSession(sessionId)
    const state = agentSession.state
    return {
      model: state.model
        ? { provider: state.model.provider, id: state.model.id, reasoning: state.model.reasoning }
        : null,
      thinkingLevel: state.thinkingLevel,
      availableThinkingLevels: agentSession.getAvailableThinkingLevels(),
      isStreaming: state.isStreaming
    }
  } catch {
    return null
  }
}

function readPlanModeStateFromEntries(
  entries: Array<{ type?: string; customType?: string; data?: { enabled?: boolean } }>
): boolean {
  const lastState = entries
    .filter((entry) => entry.type === 'custom' && entry.customType === 'plan-mode-state')
    .pop() as PlanModeStateEntry | undefined

  return lastState?.data?.enabled ?? false
}

export async function getPlanMode(sessionId: string): Promise<boolean> {
  const sessionFile = getSessionFile(sessionId)
  if (!sessionFile) {
    // Draft session with no file yet — plan mode defaults to off.
    // Avoid calling createSessionManagerForSession here because it would
    // store a planned file path (via setSessionFile) before the file is
    // actually written to disk.  If ensureAgentSession later tries to
    // SessionManager.open that non-existent path, the SDK falls back to a
    // random session ID, which causes duplicate sessions in the sidebar.
    return false
  }

  const controller = getPlanModeController(sessionFile)
  if (controller) return controller.get()

  try {
    const sessionManager = await createSessionManagerForSession(sessionId)
    return readPlanModeStateFromEntries(sessionManager.getEntries() as PlanModeStateEntry[])
  } catch {
    return false
  }
}

export async function setPlanMode(sessionId: string, enabled: boolean): Promise<boolean> {
  try {
    await ensureAgentSession(sessionId)
    const sessionFile = getSessionFile(sessionId)
    if (!sessionFile) return false

    const controller = getPlanModeController(sessionFile)
    if (!controller) return false

    controller.set(enabled)
    emitPlanMode(sessionId, enabled)
    return true
  } catch (error) {
    console.error(`[pi-runner] setPlanMode failed for ${sessionId}:`, error)
    return false
  }
}

export async function getAvailableModels(sessionId: string): Promise<ModelInfo[]> {
  try {
    const agentSession = await ensureAgentSession(sessionId)
    return agentSession.modelRegistry.getAvailable().map((model) => ({
      provider: model.provider,
      id: model.id,
      contextWindow: model.contextWindow ?? 0,
      reasoning: model.reasoning ?? false
    }))
  } catch (error) {
    console.error(`[pi-runner] getAvailableModels failed for ${sessionId}:`, error)
    return []
  }
}

export async function setModel(
  sessionId: string,
  provider: string,
  modelId: string
): Promise<boolean> {
  try {
    const agentSession = await ensureAgentSession(sessionId)
    const model = agentSession.modelRegistry.find(provider, modelId)
    if (!model) return false
    await agentSession.setModel(model)
    return true
  } catch (error) {
    console.error('[pi-runner] setModel failed:', error)
    return false
  }
}

export async function setThinkingLevel(sessionId: string, level: string): Promise<boolean> {
  try {
    const agentSession = await ensureAgentSession(sessionId)
    agentSession.setThinkingLevel(level as ThinkingLevel)
    return true
  } catch {
    return false
  }
}

export async function steerSession(sessionId: string, text: string): Promise<boolean> {
  try {
    const agentSession = await ensureAgentSession(sessionId)
    if (!agentSession.isStreaming) return false
    await agentSession.prompt(text, { streamingBehavior: 'steer' })
    return true
  } catch {
    return false
  }
}

export async function sendSessionMessage(
  sessionId: string,
  text: string,
  images?: SessionImageInput[]
): Promise<boolean> {
  const session = await getSession(sessionId)
  if (!session) return false

  const runningSession = await updateSession(sessionId, {
    title: session.title === NEW_SESSION_TITLE ? deriveSessionTitle(text) : session.title,
    taskInstruction: session.taskInstruction || text,
    status: 'running'
  })
  if (runningSession) emitSessionUpdate(runningSession)

  try {
    const agentSession = await ensureAgentSession(sessionId)
    const piImages = images?.map((image) => ({
      type: 'image' as const,
      data: image.data,
      mimeType: image.mimeType
    }))

    // Set the current session ID so the question tool knows which session it's in
    setCurrentSessionId(sessionId)

    if (agentSession.isStreaming) {
      await agentSession.prompt(text, { streamingBehavior: 'steer', images: piImages })
      // Emit pending messages immediately so the UI shows the queued pill right away
      emitStreamingEvent(sessionId, {
        type: 'message_update',
        message: null,
        pendingMessages: [
          ...agentSession.getSteeringMessages(),
          ...agentSession.getFollowUpMessages()
        ]
      })
      return true
    }

    await agentSession.prompt(text, { images: piImages })
    const completedSession = await updateSession(sessionId, { status: 'awaiting_input' })
    if (completedSession) emitSessionUpdate(completedSession)
    return true
  } catch (error) {
    if (abortingSessions.has(sessionId)) {
      return false
    }

    console.error(`[pi-runner] sendSessionMessage failed for ${sessionId}:`, error)

    // Emit error to renderer so it can show the message in the chat UI
    const errorMessage = formatUserFacingError(error)
    emitStreamingEvent(sessionId, { type: 'error', message: errorMessage })

    const failedSession = await updateSession(sessionId, { status: 'failed' })
    if (failedSession) emitSessionUpdate(failedSession)
    return false
  }
}

export async function abortSession(sessionId: string): Promise<boolean> {
  const agentSession = agentSessions.get(sessionId)
  if (!agentSession) return false

  try {
    abortingSessions.add(sessionId)
    rejectAllQuestionsForSession(sessionId)
    await agentSession.abort()

    emitStreamingEvent(sessionId, { type: 'agent_end', pendingMessages: [] })
    emitMessages(sessionId, agentSession.messages)

    const stoppedSession = await updateSession(sessionId, { status: 'awaiting_input' })
    if (stoppedSession) emitSessionUpdate(stoppedSession)
    return true
  } catch (error) {
    console.error(`[pi-runner] abortSession failed for ${sessionId}:`, error)
    return false
  } finally {
    abortingSessions.delete(sessionId)
  }
}

export async function disposeSession(sessionId: string): Promise<boolean> {
  pendingAgentSessions.delete(sessionId)
  rejectAllQuestionsForSession(sessionId)

  const agentSession = agentSessions.get(sessionId)
  if (agentSession) {
    agentSession.dispose()
    agentSessions.delete(sessionId)
  }

  return removeSession(sessionId)
}

export { getPendingQuestion } from './tools/question'

export function disposeAllSessions(): void {
  pendingAgentSessions.clear()

  for (const session of agentSessions.values()) {
    session.dispose()
  }

  agentSessions.clear()
}
