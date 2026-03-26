import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { basename, dirname, join } from 'path'
import { app, dialog, BrowserWindow } from 'electron'
import type { Project } from '../types/session'

type StoredProjects = {
  repoPaths: string[]
}

const STORE_FILE = 'projects.json'

function getStorePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

async function readStoredProjects(): Promise<StoredProjects> {
  try {
    const content = await readFile(getStorePath(), 'utf8')
    const parsed = JSON.parse(content) as Partial<StoredProjects>
    return { repoPaths: Array.isArray(parsed.repoPaths) ? parsed.repoPaths : [] }
  } catch {
    return { repoPaths: [] }
  }
}

async function writeStoredProjects(store: StoredProjects): Promise<void> {
  const filePath = getStorePath()
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(store, null, 2), 'utf8')
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function toProject(repoPath: string): Project {
  return {
    id: repoPath,
    name: basename(repoPath),
    repoPath
  }
}

async function getStoredProjectPaths(): Promise<string[]> {
  const stored = await readStoredProjects()
  return stored.repoPaths
}

export async function listProjects(): Promise<Project[]> {
  const repoPaths = await getStoredProjectPaths()
  const existingRepoPaths = (
    await Promise.all(
      repoPaths.map(async (repoPath) => ((await pathExists(repoPath)) ? repoPath : null))
    )
  ).filter((repoPath): repoPath is string => Boolean(repoPath))

  return existingRepoPaths.map(toProject)
}

export async function addProjectByPath(repoPath: string): Promise<Project> {
  const trimmedRepoPath = repoPath.trim()
  const stored = await readStoredProjects()
  await writeStoredProjects({
    repoPaths: Array.from(new Set([...stored.repoPaths, trimmedRepoPath]))
  })

  return toProject(trimmedRepoPath)
}

export async function addProject(): Promise<Project | null> {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const result = await dialog.showOpenDialog(window, {
    properties: ['openDirectory'],
    defaultPath: app.getPath('home'),
    title: 'Add project',
    buttonLabel: 'Add project'
  })

  const repoPath = result.canceled ? undefined : result.filePaths[0]
  if (!repoPath) return null

  return addProjectByPath(repoPath)
}

export async function removeProject(projectId: string): Promise<boolean> {
  const stored = await readStoredProjects()
  const nextRepoPaths = stored.repoPaths.filter((repoPath) => repoPath !== projectId)
  if (nextRepoPaths.length === stored.repoPaths.length) {
    return false
  }

  await writeStoredProjects({ repoPaths: nextRepoPaths })
  return true
}
