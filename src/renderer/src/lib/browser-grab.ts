/**
 * Lightweight event bus for communicating react-grab element selections
 * from the BrowserView webview to the SessionPromptInput.
 */

export interface BrowserGrabEvent {
  /** The react-grab formatted context (HTML + component + file info) */
  content: string
}

const EVENT_NAME = 'pi:browser-grab'

export function emitBrowserGrab(detail: BrowserGrabEvent): void {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }))
}

export function onBrowserGrab(callback: (event: BrowserGrabEvent) => void): () => void {
  const handler = (e: Event): void => {
    callback((e as CustomEvent<BrowserGrabEvent>).detail)
  }
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}
