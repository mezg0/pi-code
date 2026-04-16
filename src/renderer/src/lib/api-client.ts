let _baseUrl: string | null = null
let _pending: Promise<string> | null = null

async function resolveServerUrl(): Promise<string> {
  // In Electron, ask the main process for the sidecar URL via preload
  if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
    const url = (await window.electron.ipcRenderer.invoke('server:url')) as string
    _baseUrl = url
    return url
  }

  // In a browser, assume same-origin
  const url = window.location.origin
  _baseUrl = url
  return url
}

export function getServerUrl(): Promise<string> {
  if (_baseUrl) return Promise.resolve(_baseUrl)
  if (_pending) return _pending
  _pending = resolveServerUrl().finally(() => {
    _pending = null
  })
  return _pending
}

/** Eagerly kick off the server-url IPC so the first API call doesn't pay it. */
export function warmServerUrl(): void {
  if (_baseUrl || _pending) return
  void getServerUrl()
}

export function setServerUrl(url: string): void {
  _baseUrl = url.replace(/\/+$/, '')
}

function base(): string | Promise<string> {
  return _baseUrl ?? getServerUrl()
}

async function toUrl(path: string): Promise<string> {
  const b = base()
  const u = typeof b === 'string' ? b : await b
  return `${u}${path}`
}

async function checkOk(response: Response): Promise<void> {
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${body}`)
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(await toUrl(path))
  await checkOk(response)
  return response.json() as Promise<T>
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(await toUrl(path), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  await checkOk(response)
  return response.json() as Promise<T>
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(await toUrl(path), {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  await checkOk(response)
  return response.json() as Promise<T>
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(await toUrl(path), {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  await checkOk(response)
  return response.json() as Promise<T>
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(await toUrl(path), { method: 'DELETE' })
  await checkOk(response)
  return response.json() as Promise<T>
}
