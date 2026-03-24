import { shell, BrowserWindow } from 'electron'
import { loadPiSdk } from './pi-sdk'

import type { AuthStorage } from '@mariozechner/pi-coding-agent'

// Known providers that accept plain API keys (from pi-ai env-api-keys.ts)
const API_KEY_PROVIDERS: { id: string; name: string; envVar: string }[] = [
  { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY' },
  { id: 'anthropic', name: 'Anthropic', envVar: 'ANTHROPIC_API_KEY' },
  { id: 'google', name: 'Google (Gemini)', envVar: 'GEMINI_API_KEY' },
  { id: 'groq', name: 'Groq', envVar: 'GROQ_API_KEY' },
  { id: 'xai', name: 'xAI', envVar: 'XAI_API_KEY' },
  { id: 'openrouter', name: 'OpenRouter', envVar: 'OPENROUTER_API_KEY' },
  { id: 'mistral', name: 'Mistral', envVar: 'MISTRAL_API_KEY' },
  { id: 'cerebras', name: 'Cerebras', envVar: 'CEREBRAS_API_KEY' }
]

export type AuthProviderInfo = {
  id: string
  name: string
  isOAuth: boolean
  hasCredential: boolean
  credentialType?: 'api_key' | 'oauth' | 'env'
}

let authStorage: AuthStorage | null = null

export async function getAuthStorage(): Promise<AuthStorage> {
  if (authStorage) return authStorage

  const { AuthStorage: AuthStorageClass } = await loadPiSdk()
  authStorage = AuthStorageClass.create()
  return authStorage
}

export async function listAuthProviders(): Promise<AuthProviderInfo[]> {
  const storage = await getAuthStorage()
  const results: AuthProviderInfo[] = []

  // API key providers
  for (const provider of API_KEY_PROVIDERS) {
    const cred = storage.get(provider.id)
    const envValue = process.env[provider.envVar]

    let hasCredential = false
    let credentialType: AuthProviderInfo['credentialType'] = undefined

    if (cred?.type === 'api_key') {
      hasCredential = true
      credentialType = 'api_key'
    } else if (cred?.type === 'oauth') {
      hasCredential = true
      credentialType = 'oauth'
    } else if (envValue) {
      hasCredential = true
      credentialType = 'env'
    }

    results.push({
      id: provider.id,
      name: provider.name,
      isOAuth: false,
      hasCredential,
      credentialType
    })
  }

  // OAuth providers (that aren't already listed as API key providers)
  const oauthProviders = storage.getOAuthProviders()
  for (const oauthProvider of oauthProviders) {
    const existing = results.find((r) => r.id === oauthProvider.id)
    if (existing) {
      // Provider supports both API key and OAuth (e.g. anthropic)
      existing.isOAuth = true
      // If it has an OAuth credential, update the type
      const cred = storage.get(oauthProvider.id)
      if (cred?.type === 'oauth') {
        existing.hasCredential = true
        existing.credentialType = 'oauth'
      }
    } else {
      const cred = storage.get(oauthProvider.id)
      results.push({
        id: oauthProvider.id,
        name: oauthProvider.name,
        isOAuth: true,
        hasCredential: cred?.type === 'oauth',
        credentialType: cred?.type === 'oauth' ? 'oauth' : undefined
      })
    }
  }

  return results
}

export async function setApiKey(providerId: string, key: string): Promise<boolean> {
  try {
    const storage = await getAuthStorage()
    storage.set(providerId, { type: 'api_key', key })
    return true
  } catch (error) {
    console.error(`[auth] Failed to set API key for ${providerId}:`, error)
    return false
  }
}

export async function removeCredential(providerId: string): Promise<boolean> {
  try {
    const storage = await getAuthStorage()
    storage.remove(providerId)
    return true
  } catch (error) {
    console.error(`[auth] Failed to remove credential for ${providerId}:`, error)
    return false
  }
}

export async function oauthLogin(providerId: string): Promise<boolean> {
  try {
    const storage = await getAuthStorage()

    await storage.login(providerId, {
      onAuth: (info) => {
        // Open the auth URL in the user's default browser
        void shell.openExternal(info.url)

        // Notify renderer about auth status
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('auth:progress', {
            providerId,
            message: info.instructions ?? 'Complete sign-in in your browser...'
          })
        }
      },
      onPrompt: async (prompt) => {
        // For flows that require manual code input, we'd need a dialog.
        // Most OAuth flows complete via browser redirect, so this is rarely called.
        console.warn(`[auth] OAuth prompt requested for ${providerId}: ${prompt.message}`)
        return ''
      },
      onProgress: (message) => {
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('auth:progress', { providerId, message })
        }
      }
    })

    return true
  } catch (error) {
    console.error(`[auth] OAuth login failed for ${providerId}:`, error)
    return false
  }
}

export async function oauthLogout(providerId: string): Promise<boolean> {
  try {
    const storage = await getAuthStorage()
    storage.logout(providerId)
    return true
  } catch (error) {
    console.error(`[auth] OAuth logout failed for ${providerId}:`, error)
    return false
  }
}
