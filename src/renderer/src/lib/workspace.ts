import { listProjects, listSessions } from './sessions'
import { sortSessionsByUpdatedAt } from '../../../shared/workspace'

export type { WorkspaceData, SessionGroup } from '../../../shared/workspace'
export { groupSessions, upsertSession } from '../../../shared/workspace'

export async function loadWorkspace() {
  const [projects, sessions] = await Promise.all([listProjects(), listSessions()])
  return { projects, sessions: sortSessionsByUpdatedAt(sessions) }
}
