import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { app } from 'electron'
import { randomBytes } from 'crypto'

export type RemoteAccessConfig = {
  enabled: boolean
  port: number
  password: string | null
}

export type RemoteAccessStatus = {
  enabled: boolean
  port: number
  hasPassword: boolean
  urls: string[]
}

const CONFIG_FILE = 'remote-access.json'

function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE)
}

export async function loadRemoteAccessConfig(): Promise<RemoteAccessConfig> {
  try {
    const content = await readFile(getConfigPath(), 'utf8')
    const parsed = JSON.parse(content) as Partial<RemoteAccessConfig>
    return {
      enabled: parsed.enabled === true,
      port: typeof parsed.port === 'number' ? parsed.port : 4311,
      password: typeof parsed.password === 'string' ? parsed.password : null
    }
  } catch {
    return { enabled: false, port: 4311, password: null }
  }
}

export async function saveRemoteAccessConfig(config: RemoteAccessConfig): Promise<void> {
  const filePath = getConfigPath()
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(config, null, 2), 'utf8')
}

export function generatePassword(): string {
  return randomBytes(16).toString('base64url')
}

export function getLanAddresses(): string[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os')
  const interfaces = os.networkInterfaces() as Record<
    string,
    Array<{ address: string; family: string; internal: boolean }>
  >
  const addresses: string[] = []

  for (const iface of Object.values(interfaces)) {
    if (!iface) continue
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        addresses.push(info.address)
      }
    }
  }

  return addresses
}
