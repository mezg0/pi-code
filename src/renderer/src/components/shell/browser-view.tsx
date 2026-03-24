import { useEffect, useRef, useState } from 'react'
import { ExternalLinkIcon, RefreshCwIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const BROWSER_URL_PREFIX = 'pi.browser-url:'

function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `http://${trimmed}`
}

function getStoredUrl(id: string): string {
  try {
    return localStorage.getItem(`${BROWSER_URL_PREFIX}${id}`) ?? ''
  } catch {
    return ''
  }
}

function setStoredUrl(id: string, url: string): void {
  try {
    localStorage.setItem(`${BROWSER_URL_PREFIX}${id}`, url)
  } catch {
    // Ignore storage errors.
  }
}

type WebviewElement = HTMLElement & {
  src: string
  reload(): void
  loadURL(url: string): Promise<void>
  getURL(): string
  addEventListener(event: string, listener: (...args: unknown[]) => void): void
  removeEventListener(event: string, listener: (...args: unknown[]) => void): void
}

export function BrowserView({ id }: { id: string }): React.JSX.Element {
  const webviewRef = useRef<WebviewElement>(null)
  const [input, setInput] = useState(() => getStoredUrl(id))
  const [url, setUrl] = useState(() => getStoredUrl(id))
  const hasUrl = !!url

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleNavigate = (): void => {
      const currentUrl = webview.getURL()
      if (currentUrl) {
        setStoredUrl(id, currentUrl)
        setInput(currentUrl)
        setUrl(currentUrl)
      }
    }

    webview.addEventListener('did-navigate', handleNavigate)
    webview.addEventListener('did-navigate-in-page', handleNavigate)

    return () => {
      webview.removeEventListener('did-navigate', handleNavigate)
      webview.removeEventListener('did-navigate-in-page', handleNavigate)
    }
  }, [id, hasUrl])

  function handleNavigate(): void {
    const nextUrl = normalizeUrl(input)
    setInput(nextUrl)
    setStoredUrl(id, nextUrl)
    setUrl(nextUrl)
  }

  function handleReload(): void {
    webviewRef.current?.reload()
  }

  function handleOpenExternal(): void {
    if (!url) return
    window.open(url, '_blank')
  }

  return (
    <div className="flex size-full min-w-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
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
          className="h-8"
        />
        <Button variant="ghost" size="icon-sm" onClick={handleReload} disabled={!url}>
          <RefreshCwIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={handleOpenExternal} disabled={!url}>
          <ExternalLinkIcon />
        </Button>
      </div>

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
