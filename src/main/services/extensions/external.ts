import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import type { LoadExtensionsResult } from '@mariozechner/pi-coding-agent'

type PiPackageManifest = {
  pi?: {
    extensions?: string[]
  }
  version?: string
}

export type BundledExtensionStatus = {
  packageName: string
  version: string | null
  extensionPaths: string[]
  error: string | null
}

const MCP_ADAPTER_PACKAGE = 'pi-mcp-adapter'

let cachedStatus: BundledExtensionStatus | null = null

function resolvePackageJsonPath(packageName: string): string {
  return require.resolve(`${packageName}/package.json`)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

export function getBundledMcpExtensionStatus(): BundledExtensionStatus {
  if (cachedStatus) return cachedStatus

  try {
    const packageJsonPath = resolvePackageJsonPath(MCP_ADAPTER_PACKAGE)
    const packageDir = dirname(packageJsonPath)
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PiPackageManifest
    const extensionEntries = isStringArray(packageJson.pi?.extensions)
      ? packageJson.pi.extensions
      : []

    if (extensionEntries.length === 0) {
      cachedStatus = {
        packageName: MCP_ADAPTER_PACKAGE,
        version: packageJson.version ?? null,
        extensionPaths: [],
        error: 'No pi.extensions entries were found in the bundled MCP adapter package.'
      }
      return cachedStatus
    }

    cachedStatus = {
      packageName: MCP_ADAPTER_PACKAGE,
      version: packageJson.version ?? null,
      extensionPaths: extensionEntries.map((entry) => resolve(packageDir, entry)),
      error: null
    }
    return cachedStatus
  } catch (error) {
    cachedStatus = {
      packageName: MCP_ADAPTER_PACKAGE,
      version: null,
      extensionPaths: [],
      error: error instanceof Error ? error.message : String(error)
    }
    return cachedStatus
  }
}

export function getBundledExtensionPaths(): string[] {
  return getBundledMcpExtensionStatus().extensionPaths
}

export function getBundledMcpExtensionLoadErrors(result: LoadExtensionsResult): string[] {
  return result.errors
    .filter((entry) => entry.path.includes(MCP_ADAPTER_PACKAGE))
    .map((entry) => `${entry.path}: ${entry.error}`)
}
