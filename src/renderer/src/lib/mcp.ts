import type { McpConfigState, McpReloadResult, SaveMcpServerInput } from '@pi-code/shared/mcp'
import { apiDelete, apiGet, apiPost, apiPut } from './api-client'

export type { McpConfigState, McpReloadResult, SaveMcpServerInput }

export const getMcpConfig = (): Promise<McpConfigState> => apiGet('/mcp')

export const saveMcpServer = (name: string, input: SaveMcpServerInput): Promise<McpConfigState> =>
  apiPut(`/mcp/server/${encodeURIComponent(name)}`, input)

export const deleteMcpServer = (name: string): Promise<McpConfigState> =>
  apiDelete(`/mcp/server/${encodeURIComponent(name)}`)

export const reloadMcpResources = (): Promise<McpReloadResult> => apiPost('/mcp/reload')
