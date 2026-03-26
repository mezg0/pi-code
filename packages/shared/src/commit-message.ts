/**
 * Pure logic for generating commit messages from porcelain status lines.
 * Extracted from git.ts for testability without requiring a git repository.
 */

export type ParsedFileChange = {
  status: string
  fileName: string
  filePath: string
}

/**
 * Parse a `git status --porcelain -uall` line into its two-char status code
 * and file name/path.
 */
export function parseStatusLine(line: string): ParsedFileChange {
  const status = line.substring(0, 2)
  const rawPath = line.substring(3)
  const filePath = rawPath.split(' -> ').pop()!
  const fileName = filePath.split('/').pop()!
  return { status, fileName, filePath }
}

/**
 * Generate a human-readable commit message from porcelain status lines.
 * This is the pure logic extracted from `generateCommitMessage` in git.ts.
 */
export function buildCommitMessage(porcelainLines: string[]): string {
  const lines = porcelainLines.filter(Boolean)

  if (lines.length === 0) return 'No changes'

  const added: string[] = []
  const modified: string[] = []
  const deleted: string[] = []
  const renamed: string[] = []

  for (const line of lines) {
    const { status, fileName } = parseStatusLine(line)

    if (status.includes('A') || status.startsWith('??')) {
      added.push(fileName)
    } else if (status.includes('D')) {
      deleted.push(fileName)
    } else if (status.includes('R')) {
      renamed.push(fileName)
    } else {
      modified.push(fileName)
    }
  }

  // Special cases for single-type, single-file changes
  if (added.length === 1 && modified.length === 0 && deleted.length === 0) {
    return `Add ${added[0]}`
  }
  if (deleted.length === 1 && modified.length === 0 && added.length === 0) {
    return `Remove ${deleted[0]}`
  }
  if (modified.length === 1 && added.length === 0 && deleted.length === 0) {
    return `Update ${modified[0]}`
  }

  // Build multi-file summary
  const parts: string[] = []
  if (added.length > 0) parts.push(`add ${added.length} file${added.length > 1 ? 's' : ''}`)
  if (modified.length > 0)
    parts.push(`update ${modified.length} file${modified.length > 1 ? 's' : ''}`)
  if (deleted.length > 0)
    parts.push(`remove ${deleted.length} file${deleted.length > 1 ? 's' : ''}`)
  if (renamed.length > 0)
    parts.push(`rename ${renamed.length} file${renamed.length > 1 ? 's' : ''}`)

  // Check if all changes are in one directory
  const allPaths = lines.map((l) => l.substring(3))
  const dirs = allPaths.map((p) => p.split('/').slice(0, -1).join('/'))
  const uniqueDirs = [...new Set(dirs.filter(Boolean))]

  if (uniqueDirs.length === 1) {
    const prefix = uniqueDirs[0]
    const action = parts.join(', ')
    return `${action} in ${prefix}`
  }

  const msg = parts.join(', ')
  return msg.charAt(0).toUpperCase() + msg.slice(1)
}
