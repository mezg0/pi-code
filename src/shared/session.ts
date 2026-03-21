import type { AgentMessage } from '@mariozechner/pi-agent-core'

export type { AgentMessage } from '@mariozechner/pi-agent-core'

export type SessionStatus =
  | 'draft'
  | 'queued'
  | 'starting'
  | 'running'
  | 'awaiting_input'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'completed'
  | 'failed'

export type Session = {
  id: string
  title: string
  repoPath: string
  taskInstruction: string
  agent: string
  model: string
  status: SessionStatus
  archived: boolean
  createdAt: string
  updatedAt: string
}

export type Project = {
  id: string
  name: string
  repoPath: string
}

export type CreateSessionInput = {
  title: string
  repoPath: string
  taskInstruction: string
  agent: string
  model: string
}

export type UpdateSessionInput = Partial<
  Pick<Session, 'title' | 'taskInstruction' | 'agent' | 'model' | 'status' | 'archived'>
>

export type SessionImageInput = {
  data: string
  mimeType: string
}

export type SessionMessagesPayload = {
  sessionId: string
  messages: AgentMessage[]
}

export type SessionStreamingEvent =
  | {
      type: 'message_update'
      message: AgentMessage | null
      pendingMessages: string[]
    }
  | {
      type: 'message_end'
      pendingMessages: string[]
    }
  | {
      type: 'agent_end'
      pendingMessages: string[]
    }

export type SessionStreamingPayload = {
  sessionId: string
  event: SessionStreamingEvent
}

export type SessionPlanModePayload = {
  sessionId: string
  enabled: boolean
}

export type RpcModel = {
  provider: string
  id: string
  reasoning?: boolean
}

export type RpcState = {
  model: RpcModel | null
  thinkingLevel: string
  availableThinkingLevels: string[]
  isStreaming: boolean
} | null

export type ModelInfo = {
  provider: string
  id: string
  contextWindow: number
  reasoning: boolean
}

export type TerminalDataPayload = {
  id: string
  data: string
}

export type TerminalExitPayload = {
  id: string
}

export type TerminalApi = {
  open(id: string, cwd: string): Promise<string>
  write(id: string, data: string): Promise<void>
  resize(id: string, cols: number, rows: number): Promise<void>
  dispose(id: string): Promise<void>
  onData(listener: (payload: TerminalDataPayload) => void): () => void
  onExit(listener: (payload: TerminalExitPayload) => void): () => void
}

export type GitStatus = {
  branch: string
  hasChanges: boolean
  filesChanged: number
  insertions: number
  deletions: number
  staged: number
  unstaged: number
}

export type GitCommitResult = {
  success: boolean
  message: string
  error?: string
}

export type GitFileStatus = 'added' | 'modified' | 'deleted' | 'renamed'

/** Whether a file is staged, unstaged, or has both staged and unstaged changes */
export type GitStagingState = 'staged' | 'unstaged' | 'partial'

export type GitChangedFile = {
  path: string
  oldPath?: string
  status: GitFileStatus
  staging: GitStagingState
  insertions: number
  deletions: number
}

export type GitFileContents = {
  oldValue: string
  newValue: string
  isBinary: boolean
}

export type GitApi = {
  isRepo(cwd: string): Promise<boolean>
  status(cwd: string): Promise<GitStatus>
  changedFiles(cwd: string): Promise<GitChangedFile[]>
  fileContents(cwd: string, filePath: string): Promise<GitFileContents>
  stageFile(cwd: string, filePath: string): Promise<GitCommitResult>
  unstageFile(cwd: string, filePath: string): Promise<GitCommitResult>
  revertFile(cwd: string, filePath: string): Promise<GitCommitResult>
  stageAll(cwd: string): Promise<GitCommitResult>
  unstageAll(cwd: string): Promise<GitCommitResult>
  revertAll(cwd: string): Promise<GitCommitResult>
  generateMessage(cwd: string): Promise<string>
  commit(cwd: string, message: string, includeUnstaged: boolean): Promise<GitCommitResult>
  push(cwd: string): Promise<GitCommitResult>
  createPR(cwd: string, title: string, draft: boolean): Promise<GitCommitResult>
}

export type FileEntry = {
  name: string
  path: string
  type: 'file' | 'directory'
}

export type FilesChangedPayload = {
  cwd: string
  paths: string[]
}

export type FilesApi = {
  list(cwd: string, dirPath?: string): Promise<FileEntry[]>
  read(cwd: string, filePath: string): Promise<string>
  write(cwd: string, filePath: string, content: string): Promise<void>
  watch(cwd: string): Promise<void>
  unwatch(cwd: string): Promise<void>
  onChanged(listener: (payload: FilesChangedPayload) => void): () => void
}

export type SessionApi = {
  projects: {
    list(): Promise<Project[]>
    add(): Promise<Project | null>
    remove(id: string): Promise<boolean>
  }
  sessions: {
    list(): Promise<Session[]>
    get(id: string): Promise<Session | null>
    create(input: CreateSessionInput): Promise<Session>
    update(id: string, input: UpdateSessionInput): Promise<Session | null>
    delete(id: string): Promise<boolean>
    getAgentMessages(id: string): Promise<AgentMessage[]>
    sendMessage(id: string, text: string, images?: SessionImageInput[]): Promise<boolean>
    abort(id: string): Promise<boolean>
    getAgentState(id: string): Promise<RpcState>
    getPlanMode(id: string): Promise<boolean>
    setPlanMode(id: string, enabled: boolean): Promise<boolean>
    getAvailableModels(id: string): Promise<ModelInfo[]>
    setModel(id: string, provider: string, modelId: string): Promise<boolean>
    setThinking(id: string, level: string): Promise<boolean>
    onUpdated(listener: (session: Session) => void): () => void
    onMessages(listener: (payload: SessionMessagesPayload) => void): () => void
    onStreaming(listener: (payload: SessionStreamingPayload) => void): () => void
    onPlanMode(listener: (payload: SessionPlanModePayload) => void): () => void
  }
}
