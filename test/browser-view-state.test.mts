import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clearProjectViewState,
  loadBrowserUrl,
  saveBrowserUrl,
  saveProjectViewState
} from '../src/renderer/src/lib/view-state.ts'

class MemoryStorage {
  #map = new Map<string, string>()

  get length(): number {
    return this.#map.size
  }

  clear(): void {
    this.#map.clear()
  }

  getItem(key: string): string | null {
    return this.#map.has(key) ? this.#map.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.#map.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.#map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.#map.set(key, String(value))
  }
}

const localStorage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorage,
  configurable: true,
  writable: true
})

test.beforeEach(() => {
  localStorage.clear()
})

test('loads the project browser URL when present', () => {
  saveBrowserUrl({ projectPath: '/repo/app' }, 'http://localhost:3000')

  const url = loadBrowserUrl({ projectPath: '/repo/app' })
  assert.equal(url, 'http://localhost:3000')
})

test('falls back to the legacy browser view id key for existing persisted URLs', () => {
  localStorage.setItem('pi.browser-url:browser:/repo/app', 'http://localhost:5173/legacy')

  const url = loadBrowserUrl({ projectPath: '/repo/app' })
  assert.equal(url, 'http://localhost:5173/legacy')
})

test('clearProjectViewState removes persisted project browser URLs', () => {
  saveProjectViewState('/repo/app', { toolTab: 'browser' })
  saveBrowserUrl({ projectPath: '/repo/app' }, 'http://localhost:3000')

  clearProjectViewState('/repo/app')

  assert.equal(loadBrowserUrl({ projectPath: '/repo/app' }), '')
  assert.equal(localStorage.getItem('pi.project-view-state'), '{}')
})
