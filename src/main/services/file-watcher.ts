import { watch, type FSWatcher } from 'fs'
import { publishServerEvent } from '@pi-code/server/event-bus'
import { sep } from 'path'

// Directories to ignore (same as files.ts IGNORED set)
const IGNORED_DIRS = new Set([
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
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  'coverage'
])

type WatcherEntry = {
  watcher: FSWatcher
  refCount: number
  debounceTimer: ReturnType<typeof setTimeout> | null
  pendingPaths: Set<string>
}

const watchers = new Map<string, WatcherEntry>()

function isIgnored(filePath: string): boolean {
  const parts = filePath.split(sep)
  return parts.some((part) => IGNORED_DIRS.has(part) || part.startsWith('.'))
}

function flush(cwd: string, entry: WatcherEntry): void {
  entry.debounceTimer = null
  const changedPaths = Array.from(entry.pendingPaths)
  entry.pendingPaths.clear()

  if (changedPaths.length > 0) {
    publishServerEvent('files:changed', { cwd, paths: changedPaths })
  }
}

export function startWatching(cwd: string): void {
  const existing = watchers.get(cwd)
  if (existing) {
    existing.refCount++
    return
  }

  try {
    const fsWatcher = watch(cwd, { recursive: true }, (_eventType, filename) => {
      if (!filename) return
      if (isIgnored(filename)) return

      const entry = watchers.get(cwd)
      if (!entry) return

      // Normalize to forward slashes for consistency
      const normalized = filename.replace(/\\/g, '/')
      entry.pendingPaths.add(normalized)

      // Debounce: batch events within 300ms
      if (entry.debounceTimer) {
        clearTimeout(entry.debounceTimer)
      }
      entry.debounceTimer = setTimeout(() => flush(cwd, entry), 300)
    })

    fsWatcher.on('error', (err) => {
      console.error(`File watcher error for ${cwd}:`, err)
    })

    watchers.set(cwd, {
      watcher: fsWatcher,
      refCount: 1,
      debounceTimer: null,
      pendingPaths: new Set()
    })
  } catch (err) {
    console.error(`Failed to start file watcher for ${cwd}:`, err)
  }
}

export function stopWatching(cwd: string): void {
  const entry = watchers.get(cwd)
  if (!entry) return

  entry.refCount--
  if (entry.refCount <= 0) {
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer)
    }
    entry.watcher.close()
    watchers.delete(cwd)
  }
}

export function disposeAllWatchers(): void {
  for (const [, entry] of watchers) {
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer)
    }
    entry.watcher.close()
  }
  watchers.clear()
}
