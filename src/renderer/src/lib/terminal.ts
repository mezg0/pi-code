import type { TerminalDataPayload, TerminalExitPayload } from '@pi-code/shared/session'
import { apiPost } from './api-client'
import { onServerEvent } from './event-stream'

export type { TerminalDataPayload, TerminalExitPayload }

export const openTerminal = (id: string, cwd: string): Promise<string> =>
  apiPost('/terminal/open', { id, cwd })
export const writeTerminal = (id: string, data: string): Promise<void> =>
  apiPost('/terminal/write', { id, data }) as Promise<unknown> as Promise<void>
export const resizeTerminal = (id: string, cols: number, rows: number): Promise<void> =>
  apiPost('/terminal/resize', { id, cols, rows }) as Promise<unknown> as Promise<void>
export const disposeTerminal = (id: string): Promise<void> =>
  apiPost('/terminal/dispose', { id }) as Promise<unknown> as Promise<void>
export function onTerminalData(listener: (payload: TerminalDataPayload) => void): () => void {
  return onServerEvent('terminal:data', listener as (payload: unknown) => void)
}
export function onTerminalExit(listener: (payload: TerminalExitPayload) => void): () => void {
  return onServerEvent('terminal:exit', listener as (payload: unknown) => void)
}
