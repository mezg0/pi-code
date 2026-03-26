import type { QueryClient } from '@tanstack/react-query'

import { gitKeys } from './query-keys'

export async function invalidateGitCwd(queryClient: QueryClient, cwd: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: gitKeys.status(cwd) }),
    queryClient.invalidateQueries({ queryKey: gitKeys.changedFiles(cwd) }),
    queryClient.invalidateQueries({ queryKey: gitKeys.branches(cwd) })
  ])
}

export async function invalidateGitFile(
  queryClient: QueryClient,
  cwd: string,
  filePath: string
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: gitKeys.fileContentsPrefix(cwd, filePath) })
}
