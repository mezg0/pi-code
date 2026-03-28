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

export type SidebarSessionSplit = {
  pinnedSessions: Session[]
  projectGroups: SessionGroup[]
}

export function splitSessionsForSidebar(
  projects: Project[],
  sessions: Session[]
): SidebarSessionSplit {
  // Get non-archived pinned sessions, sorted by updatedAt
  const pinnedSessions = sortSessionsByUpdatedAt(
    sessions.filter((session) => session.pinned && !session.archived)
  )

  // Get unpinned sessions grouped by project
  const unpinnedSessions = sessions.filter((session) => !session.pinned)
  const projectGroups = projects.map((project) => ({
    project,
    sessions: sortSessionsByUpdatedAt(
      unpinnedSessions.filter((session) => session.repoPath === project.repoPath)
    )
  }))

  return { pinnedSessions, projectGroups }
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
