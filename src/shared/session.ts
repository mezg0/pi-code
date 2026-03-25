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
  branch: string | null
  worktreePath: string | null
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
  branch?: string | null
  worktreePath?: string | null
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
  | {
      type: 'error'
      message: string
    }

export type SessionStreamingPayload = {
  sessionId: string
  event: SessionStreamingEvent
}

export type SessionPlanModePayload = {
  sessionId: string
  enabled: boolean
}

// ── Ask-user-question types ──────────────────────────────────────────

export type QuestionOption = {
  label: string
  description: string
}

export type QuestionInfo = {
  question: string
  header: string
  options: QuestionOption[]
  multiple?: boolean
  custom?: boolean
}

export type QuestionAnswer = string[]

export type QuestionRequest = {
  id: string
  sessionId: string
  questions: QuestionInfo[]
}

export type SessionQuestionPayload = {
  sessionId: string
  request: QuestionRequest | null
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

export type GitBranch = {
  name: string
  isCurrent: boolean
  isRemote: boolean
  lastCommitDate?: string
  worktreePath?: string | null
}

export type GitWorktreeResult = {
  path: string
  branch: string
}

export type GitPRStatus = {
  hasPR: boolean
  state: 'open' | 'merged' | 'closed' | null
  url: string | null
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
  listBranches(cwd: string): Promise<GitBranch[]>
  checkoutBranch(cwd: string, branch: string): Promise<GitCommitResult>
  createBranch(cwd: string, branch: string): Promise<GitCommitResult>
  createWorktree(
    cwd: string,
    branch: string,
    newBranch?: string,
    path?: string | null
  ): Promise<GitWorktreeResult>
  removeWorktree(cwd: string, worktreePath: string, force?: boolean): Promise<void>
  getPRStatus(cwd: string, branch: string): Promise<GitPRStatus>
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
    getPendingQuestion(sessionId: string): Promise<QuestionRequest | null>
    questionReply(requestId: string, answers: QuestionAnswer[]): Promise<boolean>
    questionReject(requestId: string): Promise<boolean>
    onQuestion(listener: (payload: SessionQuestionPayload) => void): () => void
  }
}

// Auth types

export type AuthProviderInfo = {
  id: string
  name: string
  isOAuth: boolean
  hasCredential: boolean
  credentialType?: 'api_key' | 'oauth' | 'env'
}

export type AuthProgressPayload = {
  providerId: string
  message: string
}

export type AuthApi = {
  listProviders(): Promise<AuthProviderInfo[]>
  setApiKey(providerId: string, key: string): Promise<boolean>
  removeCredential(providerId: string): Promise<boolean>
  login(providerId: string): Promise<boolean>
  logout(providerId: string): Promise<boolean>
  onProgress(listener: (payload: AuthProgressPayload) => void): () => void
}
