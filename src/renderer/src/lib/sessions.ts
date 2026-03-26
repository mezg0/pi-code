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
} from '../../../shared/session'

export { DEFAULT_AGENT, DEFAULT_MODEL, NEW_SESSION_TITLE } from '../../../shared/session-defaults'
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

const api = window.api

export const listProjects = (): Promise<Project[]> => api.projects.list()
export const addProject = (): Promise<Project | null> => api.projects.add()
export const removeProject = (id: string): Promise<boolean> => api.projects.remove(id)
export const listSessions = (): Promise<Session[]> => api.sessions.list()
export const getSession = (id: string): Promise<Session | null> => api.sessions.get(id)
export const createSession = (input: CreateSessionInput): Promise<Session> =>
  api.sessions.create(input)
export const updateSession = (id: string, input: UpdateSessionInput): Promise<Session | null> =>
  api.sessions.update(id, input)
export const deleteSession = (id: string): Promise<boolean> => api.sessions.delete(id)
export const getAgentMessages = (id: string): Promise<AgentMessage[]> =>
  api.sessions.getAgentMessages(id)
export const sendSessionMessage = (
  id: string,
  text: string,
  images?: SessionImageInput[]
): Promise<boolean> => api.sessions.sendMessage(id, text, images)
export const abortSession = (id: string): Promise<boolean> => api.sessions.abort(id)
export const getAgentState = (id: string): Promise<RpcState> => api.sessions.getAgentState(id)
export const getSessionPlanMode = (id: string): Promise<boolean> => api.sessions.getPlanMode(id)
export const setSessionPlanMode = (id: string, enabled: boolean): Promise<boolean> =>
  api.sessions.setPlanMode(id, enabled)
export const getAvailableModels = (id: string): Promise<ModelInfo[]> =>
  api.sessions.getAvailableModels(id)
export const setSessionModel = (id: string, provider: string, modelId: string): Promise<boolean> =>
  api.sessions.setModel(id, provider, modelId)
export const setSessionThinking = (id: string, level: string): Promise<boolean> =>
  api.sessions.setThinking(id, level)

export const onSessionUpdated = (listener: (session: Session) => void): (() => void) =>
  api.sessions.onUpdated(listener)
export const onAgentMessages = (
  listener: (payload: SessionMessagesPayload) => void
): (() => void) => api.sessions.onMessages(listener)
export const onStreamingEvent = (
  listener: (payload: SessionStreamingPayload) => void
): (() => void) => api.sessions.onStreaming(listener)
export const onPlanModeEvent = (
  listener: (payload: SessionPlanModePayload) => void
): (() => void) => api.sessions.onPlanMode(listener)
export const getPendingQuestion = (sessionId: string): Promise<QuestionRequest | null> =>
  api.sessions.getPendingQuestion(sessionId)
export const questionReply = (requestId: string, answers: QuestionAnswer[]): Promise<boolean> =>
  api.sessions.questionReply(requestId, answers)
export const questionReject = (requestId: string): Promise<boolean> =>
  api.sessions.questionReject(requestId)
export const onQuestionEvent = (
  listener: (payload: SessionQuestionPayload) => void
): (() => void) => api.sessions.onQuestion(listener)

// ── Permission helpers ──────────────────────────────────────────────

export const getPendingPermission = (sessionId: string): Promise<PermissionRequest | null> =>
  api.sessions.getPendingPermission(sessionId)
export const permissionReply = (
  requestId: string,
  response: PermissionResponse,
  message?: string
): Promise<boolean> => api.sessions.permissionReply(requestId, response, message)
export const getPermissionMode = (sessionId: string): Promise<PermissionMode> =>
  api.sessions.getPermissionMode(sessionId)
export const setPermissionMode = (sessionId: string, mode: PermissionMode): Promise<boolean> =>
  api.sessions.setPermissionMode(sessionId, mode)
export const onPermissionEvent = (
  listener: (payload: SessionPermissionPayload) => void
): (() => void) => api.sessions.onPermission(listener)
export const onPermissionModeEvent = (
  listener: (payload: SessionPermissionModePayload) => void
): (() => void) => api.sessions.onPermissionMode(listener)
