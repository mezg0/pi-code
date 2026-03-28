import { BrowserWindow } from 'electron'
import { publishServerEvent } from '@pi-code/server/event-bus'
import * as pty from 'node-pty'
import { platform } from 'os'

type TerminalSession = {
  pty: pty.IPty
  buffer: string
}

const terminals = new Map<string, TerminalSession>()
const MAX_BUFFER_CHARS = 200_000

function getShell(): string {
  if (platform() === 'win32') return 'powershell.exe'
  return process.env.SHELL || '/bin/zsh'
}

function getShellArgs(): string[] {
  if (platform() === 'win32') return []
  return ['-l']
}

export function openTerminal(id: string, cwd: string): string {
  const existing = terminals.get(id)
  if (existing) return existing.buffer

  const shell = getShell()
  const proc = pty.spawn(shell, getShellArgs(), {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: process.env as Record<string, string>
  })

  const session: TerminalSession = {
    pty: proc,
    buffer: ''
  }

  proc.onData((data) => {
    session.buffer += data
    if (session.buffer.length > MAX_BUFFER_CHARS) {
      session.buffer = session.buffer.slice(-MAX_BUFFER_CHARS)
    }

    publishServerEvent('terminal:data', { id, data })
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('terminal:data', { id, data })
    }
  })

  proc.onExit(() => {
    if (terminals.get(id)?.pty === proc) {
      terminals.delete(id)
      publishServerEvent('terminal:exit', { id })
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('terminal:exit', { id })
      }
    }
  })

  terminals.set(id, session)
  return session.buffer
}

export function writeTerminal(id: string, data: string): void {
  terminals.get(id)?.pty.write(data)
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  terminals.get(id)?.pty.resize(cols, rows)
}

export function disposeTerminal(id: string): void {
  const session = terminals.get(id)
  if (session) {
    session.pty.kill()
    terminals.delete(id)
  }
}

export function disposeAllTerminals(): void {
  for (const session of terminals.values()) {
    session.pty.kill()
  }
  terminals.clear()
}
