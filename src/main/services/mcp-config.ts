import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type {
  McpConfigState,
  McpLifecycle,
  McpReloadResult,
  McpServerConfig,
  McpTransport,
  SaveMcpServerInput
} from '@pi-code/shared/mcp'
import { getBundledMcpExtensionStatus } from './extensions/external'
import { reloadAgentResources } from './pi-runner'

type McpConfigFile = {
  imports?: unknown
  settings?: unknown
  mcpServers?: Record<string, Record<string, unknown>>
}

function getDefaultLifecycle(value: unknown): McpLifecycle {
  return value === 'eager' || value === 'keep-alive' ? value : 'lazy'
}

function inferTransport(entry: Record<string, unknown>): McpTransport {
  return typeof entry.url === 'string' && entry.url.trim().length > 0 ? 'http' : 'stdio'
}

function normalizeArgs(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function normalizeEnv(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const entries = Object.entries(value).filter((entry): entry is [string, string] => {
    return typeof entry[0] === 'string' && typeof entry[1] === 'string'
  })

  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

function toServerConfig(name: string, entry: Record<string, unknown>): McpServerConfig {
  return {
    name,
    transport: inferTransport(entry),
    lifecycle: getDefaultLifecycle(entry.lifecycle),
    command: typeof entry.command === 'string' ? entry.command : undefined,
    args: normalizeArgs(entry.args),
    env: normalizeEnv(entry.env),
    url: typeof entry.url === 'string' ? entry.url : undefined
  }
}

function toFileEntry(server: SaveMcpServerInput): Record<string, unknown> {
  const base: Record<string, unknown> = {
    lifecycle: server.lifecycle
  }

  if (server.transport === 'http') {
    base.url = server.url?.trim() ?? ''
    return base
  }

  base.command = server.command?.trim() ?? ''
  if (server.args && server.args.length > 0) {
    base.args = server.args.filter((entry) => entry.trim().length > 0)
  }
  if (server.env && Object.keys(server.env).length > 0) {
    base.env = server.env
  }
  return base
}

export function getMcpConfigPath(): string {
  return join(homedir(), '.pi', 'agent', 'mcp.json')
}

async function readRawConfig(): Promise<{
  path: string
  config: McpConfigFile
  parseError: string | null
}> {
  const path = getMcpConfigPath()

  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        path,
        config: { mcpServers: {} },
        parseError: 'Expected the MCP config file to contain a JSON object.'
      }
    }
    return {
      path,
      config: parsed as McpConfigFile,
      parseError: null
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        path,
        config: { mcpServers: {} },
        parseError: null
      }
    }

    if (error instanceof Error) {
      return {
        path,
        config: { mcpServers: {} },
        parseError: error.message
      }
    }

    return {
      path,
      config: { mcpServers: {} },
      parseError: 'Failed to read the MCP config file.'
    }
  }
}

async function writeRawConfig(path: string, config: McpConfigFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

export async function getMcpConfigState(): Promise<McpConfigState> {
  const { path, config, parseError } = await readRawConfig()
  const servers = Object.entries(config.mcpServers ?? {})
    .filter((entry): entry is [string, Record<string, unknown>] => {
      return !!entry[1] && typeof entry[1] === 'object' && !Array.isArray(entry[1])
    })
    .map(([name, entry]) => toServerConfig(name, entry))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    configPath: path,
    parseError,
    servers,
    bundledExtension: getBundledMcpExtensionStatus()
  }
}

function validateServer(server: SaveMcpServerInput): string | null {
  if (!server.name.trim()) return 'Server name is required.'
  if (server.transport === 'http') {
    if (!server.url?.trim()) return 'URL is required for HTTP MCP servers.'
    return null
  }
  if (!server.command?.trim()) return 'Command is required for stdio MCP servers.'
  return null
}

export async function saveMcpServer(server: SaveMcpServerInput): Promise<McpConfigState> {
  const validationError = validateServer(server)
  if (validationError) {
    throw new Error(validationError)
  }

  const { path, config, parseError } = await readRawConfig()
  if (parseError) {
    throw new Error(`Fix ${path} before saving: ${parseError}`)
  }

  const nextConfig: McpConfigFile = {
    ...config,
    mcpServers: {
      ...(config.mcpServers ?? {}),
      [server.name]: toFileEntry(server)
    }
  }

  await writeRawConfig(path, nextConfig)
  return getMcpConfigState()
}

export async function deleteMcpServer(name: string): Promise<McpConfigState> {
  const { path, config, parseError } = await readRawConfig()
  if (parseError) {
    throw new Error(`Fix ${path} before deleting servers: ${parseError}`)
  }

  const nextServers = { ...(config.mcpServers ?? {}) }
  delete nextServers[name]

  await writeRawConfig(path, {
    ...config,
    mcpServers: nextServers
  })

  return getMcpConfigState()
}

export async function reloadMcpResources(): Promise<McpReloadResult> {
  const result = await reloadAgentResources()
  return result
}
