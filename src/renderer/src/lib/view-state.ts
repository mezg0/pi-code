import type { ToolTab } from '@/components/shell/tool-panel'

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const PROJECT_VIEW_STATE_KEY = 'pi.project-view-state'
const LEFT_SIDEBAR_KEY = 'pi.left-sidebar-open'
const TOOL_PANEL_SIZE_KEY = 'pi.tool-panel-size'
const TOOL_PANEL_OPEN_KEY = 'pi.tool-panel-open'
const BROWSER_URL_PREFIX = 'pi.browser-url:'
const BROWSER_PROJECT_SCOPE_PREFIX = 'browser:'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const DEFAULT_TOOL_PANEL_SIZE = 45

export type ProjectViewState = {
  toolTab: ToolTab | null
  toolPanelOpen: boolean
}

type ProjectViewStateMap = Record<string, ProjectViewState>

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_PROJECT_VIEW_STATE: ProjectViewState = {
  toolTab: null,
  toolPanelOpen: false
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadMap(): ProjectViewStateMap {
  try {
    const raw = localStorage.getItem(PROJECT_VIEW_STATE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as ProjectViewStateMap
  } catch {
    return {}
  }
}

function saveMap(map: ProjectViewStateMap): void {
  try {
    localStorage.setItem(PROJECT_VIEW_STATE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage errors to avoid breaking the UI.
  }
}

function readStorageValue(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorageValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore storage errors to avoid breaking the UI.
  }
}

function removeStorageValue(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore storage errors to avoid breaking the UI.
  }
}

// ---------------------------------------------------------------------------
// Per-project view state
// ---------------------------------------------------------------------------

export function loadProjectViewState(repoPath: string): ProjectViewState {
  const map = loadMap()
  const stored = map[repoPath]
  if (!stored) return { ...DEFAULT_PROJECT_VIEW_STATE }
  return {
    toolTab: stored.toolTab ?? DEFAULT_PROJECT_VIEW_STATE.toolTab,
    toolPanelOpen:
      typeof stored.toolPanelOpen === 'boolean' ? stored.toolPanelOpen : Boolean(stored.toolTab)
  }
}

export function saveProjectViewState(repoPath: string, patch: Partial<ProjectViewState>): void {
  const map = loadMap()
  const current = map[repoPath] ?? { ...DEFAULT_PROJECT_VIEW_STATE }
  map[repoPath] = { ...current, ...patch }
  saveMap(map)
}

/**
 * Remove all persisted view state for a project.
 * Called when a project is removed.
 */
export function clearProjectViewState(repoPath: string): void {
  // 1. Remove from the project view state map
  const map = loadMap()
  if (repoPath in map) {
    delete map[repoPath]
    saveMap(map)
  }

  // 2. Remove browser URL state stored for this project path.
  removeStorageValue(`${BROWSER_URL_PREFIX}${BROWSER_PROJECT_SCOPE_PREFIX}${repoPath}`)
}

export function loadBrowserUrl(options: { projectPath?: string; legacyId?: string }): string {
  const { projectPath, legacyId } = options

  if (projectPath) {
    const projectUrl = readStorageValue(
      `${BROWSER_URL_PREFIX}${BROWSER_PROJECT_SCOPE_PREFIX}${projectPath}`
    )
    if (projectUrl) {
      return projectUrl
    }
  }

  if (legacyId) {
    return readStorageValue(`${BROWSER_URL_PREFIX}${legacyId}`) ?? ''
  }

  return ''
}

export function saveBrowserUrl(options: { projectPath?: string }, url: string): void {
  const { projectPath } = options

  if (projectPath) {
    writeStorageValue(`${BROWSER_URL_PREFIX}${BROWSER_PROJECT_SCOPE_PREFIX}${projectPath}`, url)
  }
}

// ---------------------------------------------------------------------------
// Tool panel size (global, not per-project)
// ---------------------------------------------------------------------------

export function loadToolPanelSize(): number {
  try {
    const raw = localStorage.getItem(TOOL_PANEL_SIZE_KEY)
    if (!raw) return DEFAULT_TOOL_PANEL_SIZE
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TOOL_PANEL_SIZE
  } catch {
    return DEFAULT_TOOL_PANEL_SIZE
  }
}

export function saveToolPanelSize(size: number): void {
  try {
    localStorage.setItem(TOOL_PANEL_SIZE_KEY, String(size))
  } catch {
    // Ignore storage errors.
  }
}

// ---------------------------------------------------------------------------
// Tool panel open/closed (global, not per-project)
// ---------------------------------------------------------------------------

export function loadToolPanelOpen(): boolean {
  try {
    const raw = localStorage.getItem(TOOL_PANEL_OPEN_KEY)
    if (raw === 'true') return true
    return false // default closed
  } catch {
    return false
  }
}

export function saveToolPanelOpen(open: boolean): void {
  try {
    localStorage.setItem(TOOL_PANEL_OPEN_KEY, String(open))
  } catch {
    // Ignore storage errors.
  }
}

// ---------------------------------------------------------------------------
// Left sidebar (global, not per-project)
// ---------------------------------------------------------------------------

export function loadLeftSidebarOpen(): boolean {
  try {
    const raw = localStorage.getItem(LEFT_SIDEBAR_KEY)
    if (raw === 'false') return false
    return true // default open
  } catch {
    return true
  }
}

export function saveLeftSidebarOpen(open: boolean): void {
  try {
    localStorage.setItem(LEFT_SIDEBAR_KEY, String(open))
  } catch {
    // Ignore storage errors.
  }
}
