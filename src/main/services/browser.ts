// Browser is now handled via <webview> in the renderer.
// This file is kept for the disposeAllBrowsers export (no-op).

export function disposeAllBrowsers(): void {
  // No-op: webview lifecycle is managed by the renderer DOM
}
