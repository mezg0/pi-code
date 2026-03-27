import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AuthApi,
  AuthProgressPayload,
  CreateSessionInput,
  FileEntry,
  FilesApi,
  FilesChangedPayload,
  GitApi,
  GitBranch,
  GitChangedFile,
  GitCommitResult,
  GitFileContents,
  GitPRStatus,
  GitStatus,
  GitWorktreeResult,
  ModelInfo,
  Project,
  PermissionMode,
  PermissionResponse,
  PermissionRequest,
  QuestionAnswer,
  QuestionRequest,
  RpcState,
  Session,
  SessionApi,
  SessionImageInput,
  SessionMessagesPayload,
  SessionPermissionModePayload,
  SessionPermissionPayload,
  SessionPlanModePayload,
  SessionQuestionPayload,
  SessionStreamingPayload,
  TerminalApi,
  TerminalDataPayload,
  TerminalExitPayload,
  UpdateSessionInput
} from '@pi-code/shared/session'
import type { EditorApi, EditorId } from '@pi-code/shared/editor'

const api: SessionApi = {
  projects: {
    list: () => ipcRenderer.invoke('projects:list') as Promise<Project[]>,
    add: () => ipcRenderer.invoke('projects:add') as Promise<Project | null>,
    remove: (id: string) => ipcRenderer.invoke('projects:remove', id) as Promise<boolean>
  },
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list') as Promise<Session[]>,
    get: (id: string) => ipcRenderer.invoke('sessions:get', id) as Promise<Session | null>,
    create: (input: CreateSessionInput) =>
      ipcRenderer.invoke('sessions:create', input) as Promise<Session>,
    update: (id: string, input: UpdateSessionInput) =>
      ipcRenderer.invoke('sessions:update', id, input) as Promise<Session | null>,
    delete: (id: string) => ipcRenderer.invoke('sessions:delete', id) as Promise<boolean>,
    getAgentMessages: (id: string) =>
      ipcRenderer.invoke('sessions:agentMessages', id) as ReturnType<
        SessionApi['sessions']['getAgentMessages']
      >,
    sendMessage: (id: string, text: string, images?: SessionImageInput[]) =>
      ipcRenderer.invoke('sessions:sendMessage', id, text, images) as Promise<boolean>,
    abort: (id: string) => ipcRenderer.invoke('sessions:abort', id) as Promise<boolean>,
    getAgentState: (id: string) =>
      ipcRenderer.invoke('sessions:agentState', id) as Promise<RpcState>,
    getPlanMode: (id: string) => ipcRenderer.invoke('sessions:getPlanMode', id) as Promise<boolean>,
    setPlanMode: (id: string, enabled: boolean) =>
      ipcRenderer.invoke('sessions:setPlanMode', id, enabled) as Promise<boolean>,
    getAvailableModels: (id: string) =>
      ipcRenderer.invoke('sessions:availableModels', id) as Promise<ModelInfo[]>,
    setModel: (id: string, provider: string, modelId: string) =>
      ipcRenderer.invoke('sessions:setModel', id, provider, modelId) as Promise<boolean>,
    setThinking: (id: string, level: string) =>
      ipcRenderer.invoke('sessions:setThinking', id, level) as Promise<boolean>,
    onUpdated: (listener): (() => void) => {
      const handler = (_event: unknown, session: Session): void => listener(session)
      ipcRenderer.on('sessions:updated', handler)
      return () => ipcRenderer.off('sessions:updated', handler)
    },
    onMessages: (listener): (() => void) => {
      const handler = (_event: unknown, payload: SessionMessagesPayload): void => listener(payload)
      ipcRenderer.on('sessions:messages', handler)
      return () => ipcRenderer.off('sessions:messages', handler)
    },
    onStreaming: (listener): (() => void) => {
      const handler = (_event: unknown, payload: SessionStreamingPayload): void => listener(payload)
      ipcRenderer.on('sessions:streaming', handler)
      return () => ipcRenderer.off('sessions:streaming', handler)
    },
    onPlanMode: (listener): (() => void) => {
      const handler = (_event: unknown, payload: SessionPlanModePayload): void => listener(payload)
      ipcRenderer.on('sessions:planMode', handler)
      return () => ipcRenderer.off('sessions:planMode', handler)
    },
    getPendingQuestion: (sessionId: string) =>
      ipcRenderer.invoke('sessions:pendingQuestion', sessionId) as Promise<QuestionRequest | null>,
    questionReply: (requestId: string, answers: QuestionAnswer[]) =>
      ipcRenderer.invoke('sessions:questionReply', requestId, answers) as Promise<boolean>,
    questionReject: (requestId: string) =>
      ipcRenderer.invoke('sessions:questionReject', requestId) as Promise<boolean>,
    onQuestion: (listener): (() => void) => {
      const handler = (_event: unknown, payload: SessionQuestionPayload): void => listener(payload)
      ipcRenderer.on('sessions:question', handler)
      return () => ipcRenderer.off('sessions:question', handler)
    },
    getPendingPermission: (sessionId: string) =>
      ipcRenderer.invoke(
        'sessions:pendingPermission',
        sessionId
      ) as Promise<PermissionRequest | null>,
    permissionReply: (requestId: string, response: PermissionResponse, message?: string) =>
      ipcRenderer.invoke(
        'sessions:permissionReply',
        requestId,
        response,
        message
      ) as Promise<boolean>,
    getPermissionMode: (sessionId: string) =>
      ipcRenderer.invoke('sessions:getPermissionMode', sessionId) as Promise<PermissionMode>,
    setPermissionMode: (sessionId: string, mode: PermissionMode) =>
      ipcRenderer.invoke('sessions:setPermissionMode', sessionId, mode) as Promise<boolean>,
    onPermission: (listener): (() => void) => {
      const handler = (_event: unknown, payload: SessionPermissionPayload): void =>
        listener(payload)
      ipcRenderer.on('sessions:permission', handler)
      return () => ipcRenderer.off('sessions:permission', handler)
    },
    onPermissionMode: (listener): (() => void) => {
      const handler = (_event: unknown, payload: SessionPermissionModePayload): void =>
        listener(payload)
      ipcRenderer.on('sessions:permissionMode', handler)
      return () => ipcRenderer.off('sessions:permissionMode', handler)
    }
  }
}

const terminalApi: TerminalApi = {
  open: (id: string, cwd: string) =>
    ipcRenderer.invoke('terminal:open', id, cwd) as Promise<string>,
  write: (id: string, data: string) =>
    ipcRenderer.invoke('terminal:write', id, data) as Promise<void>,
  resize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', id, cols, rows) as Promise<void>,
  dispose: (id: string) => ipcRenderer.invoke('terminal:dispose', id) as Promise<void>,
  onData: (listener): (() => void) => {
    const handler = (_event: unknown, payload: TerminalDataPayload): void => listener(payload)
    ipcRenderer.on('terminal:data', handler)
    return () => ipcRenderer.off('terminal:data', handler)
  },
  onExit: (listener): (() => void) => {
    const handler = (_event: unknown, payload: TerminalExitPayload): void => listener(payload)
    ipcRenderer.on('terminal:exit', handler)
    return () => ipcRenderer.off('terminal:exit', handler)
  }
}

const filesApi: FilesApi = {
  list: (cwd: string, dirPath?: string) =>
    ipcRenderer.invoke('files:list', cwd, dirPath) as Promise<FileEntry[]>,
  read: (cwd: string, filePath: string) =>
    ipcRenderer.invoke('files:read', cwd, filePath) as Promise<string>,
  write: (cwd: string, filePath: string, content: string) =>
    ipcRenderer.invoke('files:write', cwd, filePath, content) as Promise<void>,
  watch: (cwd: string) => ipcRenderer.invoke('files:watch', cwd) as Promise<void>,
  unwatch: (cwd: string) => ipcRenderer.invoke('files:unwatch', cwd) as Promise<void>,
  onChanged: (listener): (() => void) => {
    const handler = (_event: unknown, payload: FilesChangedPayload): void => listener(payload)
    ipcRenderer.on('files:changed', handler)
    return () => ipcRenderer.off('files:changed', handler)
  }
}

const authApi: AuthApi = {
  listProviders: () => ipcRenderer.invoke('auth:listProviders'),
  setApiKey: (providerId: string, key: string) =>
    ipcRenderer.invoke('auth:setApiKey', providerId, key),
  removeCredential: (providerId: string) => ipcRenderer.invoke('auth:removeCredential', providerId),
  login: (providerId: string) => ipcRenderer.invoke('auth:login', providerId),
  logout: (providerId: string) => ipcRenderer.invoke('auth:logout', providerId),
  onProgress: (listener): (() => void) => {
    const handler = (_event: unknown, payload: AuthProgressPayload): void => listener(payload)
    ipcRenderer.on('auth:progress', handler)
    return () => ipcRenderer.off('auth:progress', handler)
  }
}

const gitApi: GitApi = {
  isRepo: (cwd: string) => ipcRenderer.invoke('git:isRepo', cwd) as Promise<boolean>,
  status: (cwd: string) => ipcRenderer.invoke('git:status', cwd) as Promise<GitStatus>,
  changedFiles: (cwd: string) =>
    ipcRenderer.invoke('git:changedFiles', cwd) as Promise<GitChangedFile[]>,
  fileContents: (cwd: string, filePath: string) =>
    ipcRenderer.invoke('git:fileContents', cwd, filePath) as Promise<GitFileContents>,
  stageFile: (cwd: string, filePath: string) =>
    ipcRenderer.invoke('git:stageFile', cwd, filePath) as Promise<GitCommitResult>,
  unstageFile: (cwd: string, filePath: string) =>
    ipcRenderer.invoke('git:unstageFile', cwd, filePath) as Promise<GitCommitResult>,
  revertFile: (cwd: string, filePath: string) =>
    ipcRenderer.invoke('git:revertFile', cwd, filePath) as Promise<GitCommitResult>,
  stageAll: (cwd: string) => ipcRenderer.invoke('git:stageAll', cwd) as Promise<GitCommitResult>,
  unstageAll: (cwd: string) =>
    ipcRenderer.invoke('git:unstageAll', cwd) as Promise<GitCommitResult>,
  revertAll: (cwd: string) => ipcRenderer.invoke('git:revertAll', cwd) as Promise<GitCommitResult>,
  generateMessage: (cwd: string) =>
    ipcRenderer.invoke('git:generateMessage', cwd) as Promise<string>,
  commit: (cwd: string, message: string, includeUnstaged: boolean) =>
    ipcRenderer.invoke('git:commit', cwd, message, includeUnstaged) as Promise<GitCommitResult>,
  push: (cwd: string) => ipcRenderer.invoke('git:push', cwd) as Promise<GitCommitResult>,
  createPR: (cwd: string, title: string, draft: boolean) =>
    ipcRenderer.invoke('git:createPR', cwd, title, draft) as Promise<GitCommitResult>,
  listBranches: (cwd: string) =>
    ipcRenderer.invoke('git:listBranches', cwd) as Promise<GitBranch[]>,
  checkoutBranch: (cwd: string, branch: string) =>
    ipcRenderer.invoke('git:checkoutBranch', cwd, branch) as Promise<GitCommitResult>,
  createBranch: (cwd: string, branch: string) =>
    ipcRenderer.invoke('git:createBranch', cwd, branch) as Promise<GitCommitResult>,
  createWorktree: (cwd: string, branch: string, newBranch?: string, path?: string | null) =>
    ipcRenderer.invoke(
      'git:createWorktree',
      cwd,
      branch,
      newBranch,
      path
    ) as Promise<GitWorktreeResult>,
  removeWorktree: (cwd: string, worktreePath: string, force?: boolean) =>
    ipcRenderer.invoke('git:removeWorktree', cwd, worktreePath, force) as Promise<void>,
  getPRStatus: (cwd: string, branch: string) =>
    ipcRenderer.invoke('git:prStatus', cwd, branch) as Promise<GitPRStatus>
}

const editorApi: EditorApi = {
  getAvailableEditors: () => ipcRenderer.invoke('editor:available') as Promise<EditorId[]>,
  openInEditor: (cwd: string, editorId: EditorId) =>
    ipcRenderer.invoke('editor:open', cwd, editorId) as Promise<void>
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('auth', authApi)
    contextBridge.exposeInMainWorld('editor', editorApi)
    contextBridge.exposeInMainWorld('terminal', terminalApi)
    contextBridge.exposeInMainWorld('files', filesApi)
    contextBridge.exposeInMainWorld('git', gitApi)
  } catch (error) {
    console.error(error)
  }
} else {
  const unsafeWindow = window as typeof window & {
    electron: typeof electronAPI
    api: SessionApi
    auth: AuthApi
    editor: EditorApi
    terminal: TerminalApi
    files: FilesApi
    git: GitApi
  }

  unsafeWindow.electron = electronAPI
  unsafeWindow.api = api
  unsafeWindow.auth = authApi
  unsafeWindow.editor = editorApi
  unsafeWindow.terminal = terminalApi
  unsafeWindow.files = filesApi
  unsafeWindow.git = gitApi
}
