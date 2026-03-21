import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
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
      theme: {
        background: '#09090b',
        foreground: '#fafafa',
        cursor: '#fafafa',
        selectionBackground: '#27272a'
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

    void window.terminal.open(id, cwd).then((buffer) => {
      if (disposed) return
      if (buffer) term.write(buffer)
      void window.terminal.resize(id, term.cols, term.rows)
    })

    const unsubData = window.terminal.onData((payload) => {
      if (payload.id === id) {
        term.write(payload.data)
      }
    })

    const unsubExit = window.terminal.onExit((payload) => {
      if (payload.id === id) {
        term.write('\r\n[process exited]\r\n')
      }
    })

    const disposeInput = term.onData((data) => {
      void window.terminal.write(id, data)
    })

    const observer = new ResizeObserver(() => {
      fitAddon.fit()
      void window.terminal.resize(id, term.cols, term.rows)
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
    <div className="size-full min-w-0 overflow-hidden bg-black px-3 py-2">
      <div
        ref={containerRef}
        className="terminal-host size-full min-w-0 overflow-hidden bg-black"
        onClick={() => termRef.current?.focus()}
      />
    </div>
  )
}
