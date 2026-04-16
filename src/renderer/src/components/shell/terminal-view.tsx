import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import {
  onTerminalData,
  onTerminalExit,
  openTerminal,
  resizeTerminal,
  writeTerminal
} from '@/lib/terminal'
import '@xterm/xterm/css/xterm.css'

export function TerminalView({ id, cwd }: { id: string; cwd: string }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      // Ayu palette — keeps terminal chrome consistent with the app surface
      theme: {
        background: '#0d1017',
        foreground: '#dcd7cb',
        cursor: '#e6b450',
        selectionBackground: '#1a1f29'
      },
      cursorBlink: true,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    fitAddon.fit()
    term.focus()
    termRef.current = term

    let disposed = false

    void openTerminal(id, cwd).then((buffer) => {
      if (disposed) return
      if (buffer) term.write(buffer)
      void resizeTerminal(id, term.cols, term.rows)
    })

    const unsubData = onTerminalData((payload) => {
      if (payload.id === id) {
        term.write(payload.data)
      }
    })

    const unsubExit = onTerminalExit((payload) => {
      if (payload.id === id) {
        term.write('\r\n[process exited]\r\n')
      }
    })

    const disposeInput = term.onData((data) => {
      void writeTerminal(id, data)
    })

    const observer = new ResizeObserver(() => {
      fitAddon.fit()
      void resizeTerminal(id, term.cols, term.rows)
    })
    observer.observe(container)

    return () => {
      disposed = true
      observer.disconnect()
      disposeInput.dispose()
      unsubData()
      unsubExit()
      term.dispose()
      termRef.current = null
    }
  }, [cwd, id])

  return (
    <div className="size-full min-w-0 overflow-hidden bg-background px-3 py-2">
      <div
        ref={containerRef}
        className="terminal-host size-full min-w-0 overflow-hidden bg-background"
        onClick={() => termRef.current?.focus()}
      />
    </div>
  )
}
