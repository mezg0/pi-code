let _baseUrl: string | null = null

export async function getServerUrl(): Promise<string> {
  if (_baseUrl) return _baseUrl

  // In Electron, ask the main process for the sidecar URL via preload
  if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
    _baseUrl = (await window.electron.ipcRenderer.invoke('server:url')) as string
    return _baseUrl
  }

  // In a browser, assume same-origin
  _baseUrl = window.location.origin
  return _baseUrl
}

export function setServerUrl(url: string): void {
  _baseUrl = url.replace(/\/+$/, '')
}

async function base(): Promise<string> {
  return getServerUrl()
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = await base()
  const response = await fetch(`${url}${path}`)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${body}`)
  }
  return response.json() as Promise<T>
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const url = await base()
  const response = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${text}`)
  }
  return response.json() as Promise<T>
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const url = await base()
  const response = await fetch(`${url}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${text}`)
  }
  return response.json() as Promise<T>
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const url = await base()
  const response = await fetch(`${url}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${text}`)
  }
  return response.json() as Promise<T>
}

export async function apiDelete<T>(path: string): Promise<T> {
  const url = await base()
  const response = await fetch(`${url}${path}`, { method: 'DELETE' })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${text}`)
  }
  return response.json() as Promise<T>
}
