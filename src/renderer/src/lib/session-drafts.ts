const STORAGE_KEY = 'pi.session-drafts'

type DraftMap = Record<string, string>

let draftsCache: DraftMap | null = null

function loadDrafts(): DraftMap {
  if (draftsCache) return draftsCache
  if (typeof window === 'undefined') {
    draftsCache = {}
    return draftsCache
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    draftsCache = raw ? (JSON.parse(raw) as DraftMap) : {}
  } catch {
    draftsCache = {}
  }

  return draftsCache
}

function persistDrafts(drafts: DraftMap): void {
  draftsCache = drafts
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
  } catch {
    // Ignore localStorage failures.
  }
}

export function getSessionDraft(sessionId: string): string {
  return loadDrafts()[sessionId] ?? ''
}

export function setSessionDraft(sessionId: string, text: string): void {
  const drafts = { ...loadDrafts() }
  if (text.trim().length === 0) {
    delete drafts[sessionId]
  } else {
    drafts[sessionId] = text
  }
  persistDrafts(drafts)
}

export function clearSessionDraft(sessionId: string): void {
  const drafts = { ...loadDrafts() }
  delete drafts[sessionId]
  persistDrafts(drafts)
}
