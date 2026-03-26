import type { Project, Session } from './session'

export type WorkspaceData = {
  projects: Project[]
  sessions: Session[]
}

export type SessionGroup = {
  project: Project
  sessions: Session[]
}

export function sortSessionsByUpdatedAt(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
