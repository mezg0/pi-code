import type {
  AgentMessage,
  CreateSessionInput,
  GitBranch,
  GitPRStatus,
  ModelInfo,
  PermissionMode,
  PermissionRequest,
  PermissionResponse,
  Project,
  QuestionAnswer,
  QuestionRequest,
  RpcState,
  Session,
  SessionImageInput,
  SessionMessagesPayload,
  SessionPermissionModePayload,
  SessionPermissionPayload,
  SessionPlanModePayload,
  SessionQuestionPayload,
  SessionStatus,
  SessionStreamingEvent,
  SessionStreamingPayload,
  UpdateSessionInput
} from '@pi-code/shared/session'

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './api-client'
import { onServerEvent } from './event-stream'

export { DEFAULT_AGENT, DEFAULT_MODEL, NEW_SESSION_TITLE } from '@pi-code/shared/session-defaults'
export type {
  AgentMessage,
  CreateSessionInput,
  GitBranch,
  GitPRStatus,
  ModelInfo,
  PermissionMode,
  PermissionRequest,
  PermissionResponse,
  Project,
  QuestionAnswer,
  QuestionRequest,
  RpcState,
  Session,
  SessionImageInput,
  SessionMessagesPayload,
  SessionPermissionModePayload,
  SessionPermissionPayload,
  SessionPlanModePayload,
  SessionQuestionPayload,
  SessionStatus,
  SessionStreamingEvent,
  SessionStreamingPayload,
  UpdateSessionInput
}

// ── Projects ────────────────────────────────────────────────────────────
export const listProjects = (): Promise<Project[]> => apiGet('/project')
export const removeProject = (id: string): Promise<boolean> =>
  apiDelete(`/project/${encodeURIComponent(id)}`)

// ── Sessions ────────────────────────────────────────────────────────────
export const listSessions = (): Promise<Session[]> => apiGet('/session')
export const getSession = (id: string): Promise<Session | null> => apiGet(`/session/${id}`)
export const createSession = (input: CreateSessionInput): Promise<Session> =>
  apiPost('/session', input)
export const updateSession = (id: string, input: UpdateSessionInput): Promise<Session | null> =>
  apiPatch(`/session/${id}`, input)
export const deleteSession = (id: string): Promise<boolean> => apiDelete(`/session/${id}`)
export const getAgentMessages = (id: string): Promise<AgentMessage[]> =>
  apiGet(`/session/${id}/messages`)
export const sendSessionMessage = (
  id: string,
  text: string,
  images?: SessionImageInput[]
): Promise<boolean> => apiPost(`/session/${id}/message`, { text, images })
export const abortSession = (id: string): Promise<boolean> => apiPost(`/session/${id}/abort`)
export const getAgentState = (id: string): Promise<RpcState> => apiGet(`/session/${id}/state`)
export const getPlanMode = (id: string): Promise<boolean> => apiGet(`/session/${id}/plan-mode`)
export const setPlanMode = (id: string, enabled: boolean): Promise<boolean> =>
  apiPut(`/session/${id}/plan-mode`, { enabled })
export const getAvailableModels = (id: string): Promise<ModelInfo[]> =>
  apiGet(`/session/${id}/models`)
export const setModel = (id: string, provider: string, modelId: string): Promise<boolean> =>
  apiPut(`/session/${id}/model`, { provider, modelId })
export const setThinking = (id: string, level: string): Promise<boolean> =>
  apiPut(`/session/${id}/thinking`, { level })
export const getPendingQuestion = (sessionId: string): Promise<QuestionRequest | null> =>
  apiGet(`/session/${sessionId}/question`)
export const questionReply = (requestId: string, answers: QuestionAnswer[]): Promise<boolean> =>
  apiPost(`/session/question/${requestId}/reply`, { answers })
export const questionReject = (requestId: string): Promise<boolean> =>
  apiPost(`/session/question/${requestId}/reject`)

// ── Permission helpers ──────────────────────────────────────────────
export const getPendingPermission = (sessionId: string): Promise<PermissionRequest | null> =>
  apiGet(`/session/${sessionId}/permission`)
export const permissionReply = (
  requestId: string,
  response: PermissionResponse,
  message?: string
): Promise<boolean> => apiPost(`/session/permission/${requestId}/reply`, { response, message })
export const getPermissionMode = (sessionId: string): Promise<PermissionMode> =>
  apiGet(`/session/${sessionId}/permission-mode`)
export const setPermissionMode = (sessionId: string, mode: PermissionMode): Promise<boolean> =>
  apiPut(`/session/${sessionId}/permission-mode`, { mode })

// ── Aliases used by components ───────────────────────────────────────────
export const setSessionModel = setModel
export const setSessionThinking = setThinking
export const getSessionPlanMode = getPlanMode
export const setSessionPlanMode = setPlanMode

// ── SSE event subscriptions ─────────────────────────────────────────────
export function onSessionUpdated(listener: (session: Session) => void): () => void {
  return onServerEvent('sessions:updated', listener as (payload: unknown) => void)
}

export function onAgentMessages(listener: (payload: SessionMessagesPayload) => void): () => void {
  return onServerEvent('sessions:messages', listener as (payload: unknown) => void)
}

export function onStreamingEvent(listener: (payload: SessionStreamingPayload) => void): () => void {
  return onServerEvent('sessions:streaming', listener as (payload: unknown) => void)
}

export function onPlanModeEvent(listener: (payload: SessionPlanModePayload) => void): () => void {
  return onServerEvent('sessions:planMode', listener as (payload: unknown) => void)
}

export function onQuestionEvent(listener: (payload: SessionQuestionPayload) => void): () => void {
  return onServerEvent('sessions:question', listener as (payload: unknown) => void)
}

export function onPermissionEvent(
  listener: (payload: SessionPermissionPayload) => void
): () => void {
  return onServerEvent('sessions:permission', listener as (payload: unknown) => void)
}

export function onPermissionModeEvent(
  listener: (payload: SessionPermissionModePayload) => void
): () => void {
  return onServerEvent('sessions:permissionMode', listener as (payload: unknown) => void)
}
