import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  CreateSessionInput,
  FileEntry,
  FilesApi,
  FilesChangedPayload,
  GitApi,
  GitChangedFile,
  GitCommitResult,
  GitFileContents,
  GitStatus,
  ModelInfo,
  Project,
  RpcState,
  Session,
  SessionApi,
  SessionImageInput,
  SessionMessagesPayload,
  SessionPlanModePayload,
  SessionStreamingPayload,
  TerminalApi,
  TerminalDataPayload,
  TerminalExitPayload,
  UpdateSessionInput
} from '../shared/session'

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
    ipcRenderer.invoke('git:createPR', cwd, title, draft) as Promise<GitCommitResult>
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
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
    terminal: TerminalApi
    files: FilesApi
    git: GitApi
  }

  unsafeWindow.electron = electronAPI
  unsafeWindow.api = api
  unsafeWindow.terminal = terminalApi
  unsafeWindow.files = filesApi
  unsafeWindow.git = gitApi
}
