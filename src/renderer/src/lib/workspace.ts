import { listProjects, listSessions } from './sessions'
import { sortSessionsByUpdatedAt, type WorkspaceData } from '@pi-code/shared/workspace'

export type { WorkspaceData, SessionGroup } from '@pi-code/shared/workspace'
export { groupSessions, upsertSession } from '@pi-code/shared/workspace'

export async function loadWorkspace(): Promise<WorkspaceData> {
  const [projects, sessions] = await Promise.all([listProjects(), listSessions()])
  return { projects, sessions: sortSessionsByUpdatedAt(sessions) }
}
