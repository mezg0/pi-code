import { dirname, resolve } from 'path'
import { app } from 'electron'
import type { AgentSession, ExtensionFactory } from '@mariozechner/pi-coding-agent'
import { loadPiSdk } from '../pi-sdk'
import loadSkillExtension from './load-skill'
import planModeExtension from './plan-mode'

// Inline extension factories (imported directly, bundled by Vite)
const inlineExtensionFactories: ExtensionFactory[] = [planModeExtension, loadSkillExtension]

// pi-cursor-agent is a TypeScript-only pi extension.
// Instead of importing it ourselves, resolve its file path and let
// pi's own extension loader (jiti) handle it — same as any .ts extension.
function getCursorAgentPath(): string | null {
  try {
    const pkgPath = require.resolve('pi-cursor-agent/package.json')
    return resolve(dirname(pkgPath), 'src', 'index.ts')
  } catch {
    return null
  }
}

export function getBuiltinExtensionFactories(): ExtensionFactory[] {
  return inlineExtensionFactories
}

export function getCursorAgentExtensionPaths(): string[] {
  const p = getCursorAgentPath()
  return p ? [p] : []
}

// --- OAuth provider bootstrap ---

let providerBootstrapSession: AgentSession | null = null
let providerBootstrapPromise: Promise<void> | null = null

export async function ensureBuiltinOAuthProvidersRegistered(): Promise<void> {
  if (providerBootstrapSession) return

  if (!providerBootstrapPromise) {
    providerBootstrapPromise = bootstrapBuiltinOAuthProviders().catch((error) => {
      providerBootstrapPromise = null
      throw error
    })
  }

  return providerBootstrapPromise
}

export function disposeBuiltinProviderBootstrap(): void {
  providerBootstrapSession?.dispose()
  providerBootstrapSession = null
  providerBootstrapPromise = null
}

async function bootstrapBuiltinOAuthProviders(): Promise<void> {
  const cursorPaths = getCursorAgentExtensionPaths()
  if (cursorPaths.length === 0) return

  const { DefaultResourceLoader, SessionManager, createAgentSession } = await loadPiSdk()
  const cwd = app.getPath('userData')
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    additionalExtensionPaths: cursorPaths
  })

  await resourceLoader.reload()

  const { session } = await createAgentSession({
    cwd,
    resourceLoader,
    sessionManager: SessionManager.inMemory()
  })

  await session.bindExtensions({})
  providerBootstrapSession = session
}
