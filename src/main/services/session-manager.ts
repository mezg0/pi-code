import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { app } from 'electron'
import type { CreateSessionInput, Project, Session, UpdateSessionInput } from '../types/session'
import type { PermissionMode } from '@pi-code/shared/session'
import {
  DEFAULT_AGENT,
  DEFAULT_MODEL,
  NEW_SESSION_TITLE,
  deriveSessionTitle
} from '@pi-code/shared/session-defaults'
import { getAppSettings } from './settings'
import { listProjects } from './projects'
import { loadPiSdk } from './pi-sdk'

type StoredSessionWorktreeInfo = {
  branch: string | null
  worktreePath: string | null
}

type StoredSessionMetadata = {
  archivedSessionIds: string[]
  /** Per-session worktree metadata, keyed by session id */
  worktreeInfo?: Record<string, StoredSessionWorktreeInfo>
  /** Per-session permission mode snapshot, keyed by session id */
  permissionModes?: Record<string, PermissionMode>
  /** Pinned session ids for quick access in sidebar */
  pinnedSessionIds?: string[]
}

const SESSION_METADATA_FILE = 'session-metadata.json'

const sessions = new Map<string, Session>()
const sessionFiles = new Map<string, string>()

let archivedSessionIdsCache: Set<string> | null = null
let worktreeInfoCache: Record<string, StoredSessionWorktreeInfo> | null = null
let permissionModesCache: Record<string, PermissionMode> | null = null
let pinnedSessionIdsCache: Set<string> | null = null

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
        : [],
      worktreeInfo:
        parsed.worktreeInfo && typeof parsed.worktreeInfo === 'object'
          ? (parsed.worktreeInfo as Record<string, StoredSessionWorktreeInfo>)
          : {},
      permissionModes:
        parsed.permissionModes && typeof parsed.permissionModes === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.permissionModes).filter(
                (entry): entry is [string, PermissionMode] => {
                  const mode = entry[1]
                  return mode === 'ask' || mode === 'auto' || mode === 'strict'
                }
              )
            )
          : {},
      pinnedSessionIds: Array.isArray(parsed.pinnedSessionIds)
        ? parsed.pinnedSessionIds.filter((id): id is string => typeof id === 'string')
        : []
    }
  } catch {
    return { archivedSessionIds: [], worktreeInfo: {}, permissionModes: {}, pinnedSessionIds: [] }
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

/** Write the full metadata file atomically */
async function writeSessionMetadata(): Promise<void> {
  const archivedIds = archivedSessionIdsCache ?? new Set<string>()
  const wtInfo = worktreeInfoCache ?? {}
  const permissionModes = permissionModesCache ?? {}
  const pinnedIds = pinnedSessionIdsCache ?? new Set<string>()

  const filePath = getSessionMetadataPath()
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(
    filePath,
    JSON.stringify(
      {
        archivedSessionIds: Array.from(archivedIds),
        worktreeInfo: wtInfo,
        permissionModes,
        pinnedSessionIds: Array.from(pinnedIds)
      },
      null,
      2
    ),
    'utf8'
  )
}

async function setArchivedState(id: string, archived: boolean): Promise<void> {
  const archivedSessionIds = await getArchivedSessionIds()
  const next = new Set(archivedSessionIds)

  if (archived) {
    next.add(id)
  } else {
    next.delete(id)
  }

  archivedSessionIdsCache = next
  await writeSessionMetadata()
}

async function getPinnedSessionIds(): Promise<Set<string>> {
  if (pinnedSessionIdsCache) {
    return pinnedSessionIdsCache
  }

  const stored = await readStoredSessionMetadata()
  pinnedSessionIdsCache = new Set(stored.pinnedSessionIds)
  return pinnedSessionIdsCache
}

async function setPinnedState(id: string, pinned: boolean): Promise<void> {
  const pinnedSessionIds = await getPinnedSessionIds()
  const next = new Set(pinnedSessionIds)

  if (pinned) {
    next.add(id)
  } else {
    next.delete(id)
  }

  pinnedSessionIdsCache = next
  await writeSessionMetadata()
}

async function getWorktreeInfoMap(): Promise<Record<string, StoredSessionWorktreeInfo>> {
  if (worktreeInfoCache) return worktreeInfoCache
  const stored = await readStoredSessionMetadata()
  worktreeInfoCache = stored.worktreeInfo ?? {}
  return worktreeInfoCache
}

async function setWorktreeInfo(
  id: string,
  branch: string | null,
  worktreePath: string | null
): Promise<void> {
  const map = await getWorktreeInfoMap()
  if (branch || worktreePath) {
    map[id] = { branch, worktreePath }
  } else {
    delete map[id]
  }
  worktreeInfoCache = map
  await writeSessionMetadata()
}

async function getPermissionModes(): Promise<Record<string, PermissionMode>> {
  if (permissionModesCache) return permissionModesCache
  const stored = await readStoredSessionMetadata()
  permissionModesCache = stored.permissionModes ?? {}
  return permissionModesCache
}

export async function getStoredSessionPermissionMode(
  id: string
): Promise<PermissionMode | undefined> {
  const modes = await getPermissionModes()
  return modes[id]
}

export async function setStoredSessionPermissionMode(
  id: string,
  mode: PermissionMode | null
): Promise<void> {
  const modes = await getPermissionModes()
  if (mode) {
    modes[id] = mode
  } else {
    delete modes[id]
  }
  permissionModesCache = modes
  await writeSessionMetadata()
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
  archivedSessionIds: Set<string>,
  worktreeInfoMap: Record<string, StoredSessionWorktreeInfo>,
  pinnedSessionIds: Set<string>
): Session {
  sessionFiles.set(info.id, info.path)

  const wtInfo = worktreeInfoMap[info.id]
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
    pinned: pinnedSessionIds.has(info.id),
    createdAt: info.created.toISOString(),
    updatedAt: info.modified.toISOString(),
    branch: wtInfo?.branch ?? null,
    worktreePath: wtInfo?.worktreePath ?? null
  }

  const override = sessions.get(info.id)
  return override ? { ...base, ...override } : base
}

export async function listSessions(): Promise<Session[]> {
  const { SessionManager } = await loadPiSdk()
  const projects = await listProjects()
  const archivedSessionIds = await getArchivedSessionIds()
  const wtInfoMap = await getWorktreeInfoMap()
  const pinnedSessionIds = await getPinnedSessionIds()
  const sessionsByProject = await Promise.all(
    projects.map(async (project) => {
      const infos = await SessionManager.list(project.repoPath)
      return infos.map((info) =>
        toSession(project, info, archivedSessionIds, wtInfoMap, pinnedSessionIds)
      )
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

export function getSessionIdForFile(sessionFile: string): string | undefined {
  const resolvedSessionFile = resolve(sessionFile)

  for (const [id, file] of sessionFiles) {
    if (file === sessionFile || resolve(file) === resolvedSessionFile) {
      return id
    }
  }

  return undefined
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const now = new Date().toISOString()
  const branch = input.branch ?? null
  const worktreePath = input.worktreePath ?? null
  const defaultPermissionMode = (await getAppSettings()).defaultPermissionMode

  const session: Session = {
    id: randomUUID(),
    title: input.title,
    repoPath: input.repoPath,
    taskInstruction: input.taskInstruction,
    agent: input.agent,
    model: input.model,
    status: 'draft',
    archived: false,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    branch,
    worktreePath
  }

  sessions.set(session.id, session)
  await setStoredSessionPermissionMode(session.id, defaultPermissionMode)

  // Persist worktree info so it survives app restart
  if (branch || worktreePath) {
    await setWorktreeInfo(session.id, branch, worktreePath)
  }

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
    // Archiving clears pinned state
    if (input.archived) {
      await setPinnedState(id, false)
    }
  }

  if (typeof input.pinned === 'boolean' && !input.archived) {
    await setPinnedState(id, input.pinned)
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
  await setStoredSessionPermissionMode(id, null)
  await setWorktreeInfo(id, null, null)
  await setPinnedState(id, false)
  return true
}
