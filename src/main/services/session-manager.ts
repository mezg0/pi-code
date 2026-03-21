import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { app } from 'electron'
import type { CreateSessionInput, Project, Session, UpdateSessionInput } from '../types/session'
import {
  DEFAULT_AGENT,
  DEFAULT_MODEL,
  NEW_SESSION_TITLE,
  deriveSessionTitle
} from '../../shared/session-defaults'
import { listProjects } from './projects'
import { loadPiSdk } from './pi-sdk'

type StoredSessionMetadata = {
  archivedSessionIds: string[]
}

const SESSION_METADATA_FILE = 'session-metadata.json'

const sessions = new Map<string, Session>()
const sessionFiles = new Map<string, string>()

let archivedSessionIdsCache: Set<string> | null = null

function getSessionMetadataPath(): string {
  return join(app.getPath('userData'), SESSION_METADATA_FILE)
}

async function readStoredSessionMetadata(): Promise<StoredSessionMetadata> {
  try {
    const content = await readFile(getSessionMetadataPath(), 'utf8')
    const parsed = JSON.parse(content) as Partial<StoredSessionMetadata>
    return {
      archivedSessionIds: Array.isArray(parsed.archivedSessionIds)
        ? parsed.archivedSessionIds.filter((id): id is string => typeof id === 'string')
        : []
    }
  } catch {
    return { archivedSessionIds: [] }
  }
}

async function getArchivedSessionIds(): Promise<Set<string>> {
  if (archivedSessionIdsCache) {
    return archivedSessionIdsCache
  }

  const stored = await readStoredSessionMetadata()
  archivedSessionIdsCache = new Set(stored.archivedSessionIds)
  return archivedSessionIdsCache
}

async function writeArchivedSessionIds(ids: Set<string>): Promise<void> {
  archivedSessionIdsCache = new Set(ids)

  const filePath = getSessionMetadataPath()
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(
    filePath,
    JSON.stringify({ archivedSessionIds: Array.from(ids) }, null, 2),
    'utf8'
  )
}

async function setArchivedState(id: string, archived: boolean): Promise<void> {
  const archivedSessionIds = await getArchivedSessionIds()
  const nextArchivedSessionIds = new Set(archivedSessionIds)

  if (archived) {
    nextArchivedSessionIds.add(id)
  } else {
    nextArchivedSessionIds.delete(id)
  }

  await writeArchivedSessionIds(nextArchivedSessionIds)
}

function toSession(
  project: Project,
  info: {
    id: string
    name?: string
    firstMessage?: string
    cwd?: string
    created: Date
    modified: Date
    path: string
  },
  archivedSessionIds: Set<string>
): Session {
  sessionFiles.set(info.id, info.path)

  const base: Session = {
    id: info.id,
    title:
      info.name || (info.firstMessage ? deriveSessionTitle(info.firstMessage) : NEW_SESSION_TITLE),
    repoPath: info.cwd || project.repoPath,
    taskInstruction: info.firstMessage || '',
    agent: DEFAULT_AGENT,
    model: DEFAULT_MODEL,
    status: info.firstMessage ? 'awaiting_input' : 'draft',
    archived: archivedSessionIds.has(info.id),
    createdAt: info.created.toISOString(),
    updatedAt: info.modified.toISOString()
  }

  const override = sessions.get(info.id)
  return override ? { ...base, ...override } : base
}

export async function listSessions(): Promise<Session[]> {
  const { SessionManager } = await loadPiSdk()
  const projects = await listProjects()
  const archivedSessionIds = await getArchivedSessionIds()
  const sessionsByProject = await Promise.all(
    projects.map(async (project) => {
      const infos = await SessionManager.list(project.repoPath)
      return infos.map((info) => toSession(project, info, archivedSessionIds))
    })
  )

  // Deduplicate SDK sessions by id (a session file could theoretically appear
  // in multiple project scans). Keep the first occurrence.
  const seenIds = new Set<string>()
  const uniquePiSessions: Session[] = []
  for (const session of sessionsByProject.flat()) {
    if (!seenIds.has(session.id)) {
      seenIds.add(session.id)
      uniquePiSessions.push(session)
    }
  }

  const localOnly = Array.from(sessions.values()).filter((session) => !seenIds.has(session.id))

  return [...uniquePiSessions, ...localOnly].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getSession(id: string): Promise<Session | undefined> {
  return (await listSessions()).find((session) => session.id === id)
}

export function getSessionFile(id: string): string | undefined {
  return sessionFiles.get(id)
}

export function setSessionFile(id: string, sessionFile: string): void {
  sessionFiles.set(id, sessionFile)
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const now = new Date().toISOString()
  const session: Session = {
    id: randomUUID(),
    title: input.title,
    repoPath: input.repoPath,
    taskInstruction: input.taskInstruction,
    agent: input.agent,
    model: input.model,
    status: 'draft',
    archived: false,
    createdAt: now,
    updatedAt: now
  }

  sessions.set(session.id, session)
  return session
}

export async function updateSession(
  id: string,
  input: UpdateSessionInput
): Promise<Session | undefined> {
  const current = await getSession(id)
  if (!current) return undefined

  if (typeof input.archived === 'boolean') {
    await setArchivedState(id, input.archived)
  }

  const updatedAt = new Date().toISOString()
  const next: Session = { ...current, ...input, updatedAt }
  sessions.set(id, next)
  return next
}

export async function deleteSession(id: string): Promise<boolean> {
  sessions.delete(id)
  sessionFiles.delete(id)
  await setArchivedState(id, false)
  return true
}
