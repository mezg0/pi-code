import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CrosshairIcon,
  ExternalLinkIcon,
  RefreshCwIcon
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { emitBrowserGrab } from '@/lib/browser-grab'
import { getReactGrabInjectionScript, REACT_GRAB_MESSAGE_PREFIX } from '@/lib/react-grab-inject'
import { cn } from '@/lib/utils'
import { loadBrowserUrl, saveBrowserUrl } from '@/lib/view-state'

function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `http://${trimmed}`
}

type WebviewElement = HTMLElement & {
  src: string
  reload(): void
  loadURL(url: string): Promise<void>
  getURL(): string
  goBack(): void
  goForward(): void
  canGoBack(): boolean
  canGoForward(): boolean
  executeJavaScript(code: string): Promise<unknown>
  addEventListener(event: string, listener: (...args: unknown[]) => void): void
  removeEventListener(event: string, listener: (...args: unknown[]) => void): void
}

function NavButton({
  tooltip,
  disabled,
  onClick,
  children
}: {
  tooltip: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function BrowserView({ id, projectPath }: { id: string; projectPath?: string }): React.JSX.Element {
  const webviewRef = useRef<WebviewElement>(null)
  const [input, setInput] = useState(() => loadBrowserUrl({ projectPath, legacyId: id }))
  const [url, setUrl] = useState(() => loadBrowserUrl({ projectPath, legacyId: id }))
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  // Tracks whether react-grab is in active selection mode (not just loaded)
  const [grabActive, setGrabActive] = useState(false)
  const hasUrl = !!url

  const updateNavState = useCallback(() => {
    const webview = webviewRef.current
    if (!webview) return
    try {
      setCanGoBack(webview.canGoBack())
      setCanGoForward(webview.canGoForward())
    } catch {
      // webview may not be ready yet
    }
  }, [])

  const persistUrl = useCallback(
    (nextUrl: string): void => {
      saveBrowserUrl({ projectPath }, nextUrl)
    },
    [projectPath]
  )

  // Inject react-grab into the webview (always inject on dom-ready)
  const injectReactGrab = useCallback(() => {
    const webview = webviewRef.current
    if (!webview) return

    const script = getReactGrabInjectionScript()
    webview.executeJavaScript(script).catch(() => {
      // Silently fail — page might not be ready yet
    })
  }, [])

  // Toggle react-grab's active selection mode in the webview
  const toggleGrabActive = useCallback(() => {
    const webview = webviewRef.current
    if (!webview) return

    webview
      .executeJavaScript(`if (window.__REACT_GRAB__) { window.__REACT_GRAB__.toggle(); }`)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleNavigate = (): void => {
      const currentUrl = webview.getURL()
      if (currentUrl) {
        persistUrl(currentUrl)
        setInput(currentUrl)
        setUrl(currentUrl)
      }
      updateNavState()
      // Reset active state on navigation since the page changed
      setGrabActive(false)
    }

    const handleDomReady = (): void => {
      // Always inject react-grab so it's ready when the user clicks the button
      injectReactGrab()
    }

    // Listen for console messages from the webview to capture react-grab events
    const handleConsoleMessage = (event: unknown): void => {
      const e = event as { message?: string }
      const msg = e.message
      if (!msg || !msg.startsWith(REACT_GRAB_MESSAGE_PREFIX)) return

      try {
        const data = JSON.parse(msg.slice(REACT_GRAB_MESSAGE_PREFIX.length)) as {
          type: string
          content?: string
          isActive?: boolean
        }
        if (data.type === 'element-grabbed' && data.content) {
          emitBrowserGrab({ content: data.content })
        } else if (data.type === 'state-change' && data.isActive !== undefined) {
          // Keep button state in sync with react-grab's active state
          setGrabActive(data.isActive)
        }
      } catch {
        // Ignore parse errors
      }
    }

    webview.addEventListener('did-navigate', handleNavigate)
    webview.addEventListener('did-navigate-in-page', handleNavigate)
    webview.addEventListener('dom-ready', handleDomReady)
    webview.addEventListener('console-message', handleConsoleMessage)

    return () => {
      webview.removeEventListener('did-navigate', handleNavigate)
      webview.removeEventListener('did-navigate-in-page', handleNavigate)
      webview.removeEventListener('dom-ready', handleDomReady)
      webview.removeEventListener('console-message', handleConsoleMessage)
    }
  }, [hasUrl, updateNavState, injectReactGrab, persistUrl])

  function handleNavigate(): void {
    const nextUrl = normalizeUrl(input)
    setInput(nextUrl)
    persistUrl(nextUrl)
    setUrl(nextUrl)
  }

  function handleReload(): void {
    webviewRef.current?.reload()
  }

  function handleGoBack(): void {
    webviewRef.current?.goBack()
  }

  function handleGoForward(): void {
    webviewRef.current?.goForward()
  }

  function handleOpenExternal(): void {
    if (!url) return
    window.open(url, '_blank')
  }

  function handleToggleGrab(): void {
    toggleGrabActive()
  }

  return (
    <div className="flex size-full min-w-0 flex-col bg-background">
      {/* Navigation bar — inspired by ai-elements WebPreview */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border p-2">
        <NavButton tooltip="Back" disabled={!canGoBack} onClick={handleGoBack}>
          <ArrowLeftIcon />
        </NavButton>
        <NavButton tooltip="Forward" disabled={!canGoForward} onClick={handleGoForward}>
          <ArrowRightIcon />
        </NavButton>
        <NavButton tooltip="Reload" disabled={!url} onClick={handleReload}>
          <RefreshCwIcon />
        </NavButton>

        <Input
          value={input}
          onChange={(event) => setInput(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleNavigate()
            }
          }}
          placeholder="Enter URL (e.g. localhost:3000)"
          className="h-7 flex-1 text-sm"
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={grabActive ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={handleToggleGrab}
              disabled={!url}
              className={cn(grabActive && 'text-primary')}
            >
              <CrosshairIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{grabActive ? 'Exit' : 'Enter'} element grab mode</TooltipContent>
        </Tooltip>

        <NavButton tooltip="Open in browser" disabled={!url} onClick={handleOpenExternal}>
          <ExternalLinkIcon />
        </NavButton>
      </div>

      {/* Preview body */}
      <div className="min-h-0 flex-1 overflow-hidden bg-background">
        {hasUrl ? (
          <webview
            ref={webviewRef as React.RefObject<HTMLElement>}
            src={url}
            partition="persist:browser"
            className="size-full"
            // @ts-expect-error -- webview is an Electron-specific element
            allowpopups=""
          />
        ) : (
          <div className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Enter a local preview URL to open it here.
          </div>
        )}
      </div>
    </div>
  )
}
