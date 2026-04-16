export const gitKeys = {
  all: ['git'] as const,
  isRepo: (cwd: string) => ['git', 'isRepo', cwd] as const,
  status: (cwd: string) => ['git', 'status', cwd] as const,
  changedFiles: (cwd: string) => ['git', 'changedFiles', cwd] as const,
  fileContents: (cwd: string, filePath: string, version: string) =>
    ['git', 'fileContents', cwd, filePath, version] as const,
  fileContentsPrefix: (cwd: string, filePath: string) =>
    ['git', 'fileContents', cwd, filePath] as const,
  branches: (cwd: string) => ['git', 'branches', cwd] as const,
  prStatus: (repoPath: string, branch: string) => ['git', 'prStatus', repoPath, branch] as const
}

export const sessionKeys = {
  all: ['session'] as const,
  runtimeState: (sessionId: string) => ['session', 'runtimeState', sessionId] as const,
  availableModels: (sessionId: string) => ['session', 'availableModels', sessionId] as const,
  planMode: (sessionId: string) => ['session', 'planMode', sessionId] as const,
  permissionMode: (sessionId: string) => ['session', 'permissionMode', sessionId] as const,
  messages: (sessionId: string) => ['session', 'messages', sessionId] as const,
  list: () => ['session', 'list'] as const
}
