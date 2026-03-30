export type McpTransport = 'stdio' | 'http'

export type McpLifecycle = 'lazy' | 'eager' | 'keep-alive'

export type McpServerConfig = {
  name: string
  transport: McpTransport
  lifecycle: McpLifecycle
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
}

export type McpConfigState = {
  configPath: string
  parseError: string | null
  servers: McpServerConfig[]
  bundledExtension: {
    packageName: string
    version: string | null
    extensionPaths: string[]
    error: string | null
  }
}

export type SaveMcpServerInput = McpServerConfig

export type McpReloadResult = {
  ok: boolean
  message: string
  reloadedSessionCount: number
}
