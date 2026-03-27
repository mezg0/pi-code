import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { app } from 'electron'
import type { AppSettings, PermissionMode } from '@pi-code/shared/session'

const SETTINGS_FILE = 'settings.json'

const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultPermissionMode: 'ask'
}

let settingsCache: AppSettings | null = null

function getSettingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

function normalizePermissionMode(value: unknown): PermissionMode {
  return value === 'auto' || value === 'strict' || value === 'ask' ? value : 'ask'
}

function normalizeAppSettings(value: unknown): AppSettings {
  const parsed = value && typeof value === 'object' ? (value as Partial<AppSettings>) : {}

  return {
    defaultPermissionMode: normalizePermissionMode(parsed.defaultPermissionMode)
  }
}

export function getDefaultAppSettings(): AppSettings {
  return { ...DEFAULT_APP_SETTINGS }
}

export function getCachedAppSettings(): AppSettings {
  return settingsCache ?? getDefaultAppSettings()
}

export function getCachedDefaultPermissionMode(): PermissionMode {
  return getCachedAppSettings().defaultPermissionMode
}

export async function getAppSettings(): Promise<AppSettings> {
  if (settingsCache) return settingsCache

  try {
    const content = await readFile(getSettingsPath(), 'utf8')
    settingsCache = normalizeAppSettings(JSON.parse(content))
  } catch {
    settingsCache = getDefaultAppSettings()
  }

  return settingsCache
}

async function saveAppSettings(settings: AppSettings): Promise<void> {
  const filePath = getSettingsPath()
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8')
}

export async function updateAppSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings()
  const next = normalizeAppSettings({ ...current, ...input })
  settingsCache = next
  await saveAppSettings(next)
  return next
}
