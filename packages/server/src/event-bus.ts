export type ServerEvent = {
  channel: string
  payload: unknown
  timestamp: string
}

type ServerEventListener = (event: ServerEvent) => void

const listeners = new Set<ServerEventListener>()

export function publishServerEvent(channel: string, payload: unknown): void {
  const event: ServerEvent = {
    channel,
    payload,
    timestamp: new Date().toISOString()
  }

  for (const listener of listeners) {
    listener(event)
  }
}

export function subscribeToServerEvents(listener: ServerEventListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
