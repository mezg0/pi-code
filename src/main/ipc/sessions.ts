import { ipcMain } from 'electron'
import type { CreateSessionInput, UpdateSessionInput } from '../types/session'
import { addProject, listProjects, removeProject } from '../services/projects'
import { createSession, getSession, listSessions, updateSession } from '../services/session-manager'
import {
  abortSession,
  disposeSession,
  getAgentMessages,
  getAgentState,
  getAvailableModels,
  getPendingQuestion,
  getPermissionMode,
  getPlanMode,
  getSessionSkills,
  sendSessionMessage,
  setModel,
  setPermissionMode,
  setPlanMode,
  setThinkingLevel,
  steerSession
} from '../services/pi-runner'
import { replyToQuestion, rejectQuestion } from '../services/tools/question'
import { getPendingPermission, replyToPermission } from '../services/tools/permission'
import type { QuestionAnswer, PermissionMode, PermissionResponse } from '@pi-code/shared/session'

export function registerSessionIpc(): void {
  ipcMain.handle('projects:list', () => listProjects())
  ipcMain.handle('projects:add', () => addProject())
  ipcMain.handle('projects:remove', (_event, id: string) => removeProject(id))
  ipcMain.handle('sessions:list', () => listSessions())
  ipcMain.handle('sessions:get', async (_event, id: string) => (await getSession(id)) ?? null)
  ipcMain.handle('sessions:create', (_event, input: CreateSessionInput) => createSession(input))
  ipcMain.handle(
    'sessions:update',
    async (_event, id: string, input: UpdateSessionInput) =>
      (await updateSession(id, input)) ?? null
  )
  ipcMain.handle('sessions:delete', (_event, id: string) => disposeSession(id))
  ipcMain.handle('sessions:agentMessages', (_event, id: string) => getAgentMessages(id))
  ipcMain.handle(
    'sessions:sendMessage',
    (_event, id: string, text: string, images?: { data: string; mimeType: string }[]) =>
      sendSessionMessage(id, text, images)
  )
  ipcMain.handle('sessions:abort', (_event, id: string) => abortSession(id))
  ipcMain.handle('sessions:steer', (_event, id: string, text: string) => steerSession(id, text))
  ipcMain.handle('sessions:agentState', (_event, id: string) => getAgentState(id))
  ipcMain.handle('sessions:getPlanMode', (_event, id: string) => getPlanMode(id))
  ipcMain.handle('sessions:setPlanMode', (_event, id: string, enabled: boolean) =>
    setPlanMode(id, enabled)
  )
  ipcMain.handle('sessions:availableModels', (_event, id: string) => getAvailableModels(id))
  ipcMain.handle('sessions:setModel', (_event, id: string, provider: string, modelId: string) =>
    setModel(id, provider, modelId)
  )
  ipcMain.handle('sessions:setThinking', (_event, id: string, level: string) =>
    setThinkingLevel(id, level)
  )
  ipcMain.handle('sessions:pendingQuestion', (_event, sessionId: string) =>
    getPendingQuestion(sessionId)
  )
  ipcMain.handle('sessions:questionReply', (_event, requestId: string, answers: QuestionAnswer[]) =>
    replyToQuestion(requestId, answers)
  )
  ipcMain.handle('sessions:questionReject', (_event, requestId: string) =>
    rejectQuestion(requestId)
  )
  ipcMain.handle('sessions:pendingPermission', (_event, sessionId: string) =>
    getPendingPermission(sessionId)
  )
  ipcMain.handle(
    'sessions:permissionReply',
    (_event, requestId: string, response: PermissionResponse, message?: string) =>
      replyToPermission(requestId, response, message)
  )
  ipcMain.handle('sessions:getPermissionMode', (_event, sessionId: string) =>
    getPermissionMode(sessionId)
  )
  ipcMain.handle('sessions:setPermissionMode', (_event, sessionId: string, mode: PermissionMode) =>
    setPermissionMode(sessionId, mode)
  )
  ipcMain.handle('sessions:skills', (_event, sessionId: string) => getSessionSkills(sessionId))
}
