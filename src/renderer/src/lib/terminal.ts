import type { TerminalDataPayload, TerminalExitPayload } from '@pi-code/shared/session'

const terminal = window.terminal

export type { TerminalDataPayload, TerminalExitPayload }

export const openTerminal = (id: string, cwd: string): Promise<string> => terminal.open(id, cwd)
export const writeTerminal = (id: string, data: string): Promise<void> => terminal.write(id, data)
export const resizeTerminal = (id: string, cols: number, rows: number): Promise<void> =>
  terminal.resize(id, cols, rows)
export const disposeTerminal = (id: string): Promise<void> => terminal.dispose(id)
export const onTerminalData = (listener: (payload: TerminalDataPayload) => void): (() => void) =>
  terminal.onData(listener)
export const onTerminalExit = (listener: (payload: TerminalExitPayload) => void): (() => void) =>
  terminal.onExit(listener)
