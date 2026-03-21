import type { Project, Session } from './sessions'
import { listProjects, listSessions } from './sessions'

export type WorkspaceData = {
  projects: Project[]
  sessions: Session[]
}

export type SessionGroup = {
  project: Project
  sessions: Session[]
}

function sortSessionsByUpdatedAt(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadWorkspace(): Promise<WorkspaceData> {
  const [projects, sessions] = await Promise.all([listProjects(), listSessions()])
  return { projects, sessions: sortSessionsByUpdatedAt(sessions) }
}

export function groupSessions(projects: Project[], sessions: Session[]): SessionGroup[] {
  return projects.map((project) => ({
    project,
    sessions: sessions.filter((session) => session.repoPath === project.repoPath)
  }))
}

export function upsertSession(sessions: Session[], nextSession: Session): Session[] {
  const existingIndex = sessions.findIndex((session) => session.id === nextSession.id)

  if (existingIndex === -1) {
    return sortSessionsByUpdatedAt([...sessions, nextSession])
  }

  return sortSessionsByUpdatedAt(
    sessions.map((session) => (session.id === nextSession.id ? nextSession : session))
  )
}
