import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export type FileEntry = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileEntry[]
}

// Directories/files to always skip
const IGNORED = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.turbo',
  '.vercel',
  '.output',
  'dist',
  'build',
  'out',
  '.DS_Store',
  'Thumbs.db',
  '.env',
  '.env.local',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache'
])

export async function listDirectory(cwd: string, dirPath: string = ''): Promise<FileEntry[]> {
  const fullPath = dirPath ? join(cwd, dirPath) : cwd
  const entries = await readdir(fullPath, { withFileTypes: true })

  const result: FileEntry[] = []

  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue

    const entryRelPath = dirPath ? join(dirPath, entry.name) : entry.name

    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: entryRelPath,
        type: 'directory'
      })
    } else if (entry.isFile()) {
      result.push({
        name: entry.name,
        path: entryRelPath,
        type: 'file'
      })
    }
  }

  // Sort: directories first, then alphabetical
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return result
}

export async function getFileContent(cwd: string, filePath: string): Promise<string> {
  const fullPath = join(cwd, filePath)
  return readFile(fullPath, 'utf-8')
}

export async function saveFileContent(
  cwd: string,
  filePath: string,
  content: string
): Promise<void> {
  const fullPath = join(cwd, filePath)
  await writeFile(fullPath, content, 'utf-8')
}
