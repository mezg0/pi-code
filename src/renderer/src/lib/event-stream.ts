import { getServerUrl } from './api-client'

type ServerEvent = {
  channel: string
  payload: unknown
  timestamp: string
}

type EventListener = (payload: unknown) => void

const channelListeners = new Map<string, Set<EventListener>>()
let eventSource: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let started = false

function dispatch(event: ServerEvent): void {
  const listeners = channelListeners.get(event.channel)
  if (!listeners) return
  for (const listener of listeners) {
    listener(event.payload)
  }
}

async function connect(): Promise<void> {
  if (eventSource) return

  const url = await getServerUrl()
  const es = new EventSource(`${url}/event`)
  eventSource = es

  es.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as ServerEvent
      dispatch(event)
    } catch {
      // ignore malformed events
    }
  }

  es.onerror = () => {
    es.close()
    eventSource = null

    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (started) void connect()
    }, 1000)
  }
}

export function startEventStream(): void {
  if (started) return
  started = true
  void connect()
}

export function stopEventStream(): void {
  started = false
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

export function onServerEvent(channel: string, listener: EventListener): () => void {
  let set = channelListeners.get(channel)
  if (!set) {
    set = new Set()
    channelListeners.set(channel, set)
  }
  set.add(listener)

  // Auto-start on first subscription
  if (!started) startEventStream()

  return () => {
    set!.delete(listener)
    if (set!.size === 0) {
      channelListeners.delete(channel)
    }
  }
}
