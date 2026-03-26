import type { AuthProgressPayload, AuthProviderInfo } from '@pi-code/shared/session'
import { apiDelete, apiGet, apiPost, apiPut } from './api-client'
import { onServerEvent } from './event-stream'

export type { AuthProgressPayload, AuthProviderInfo }

export const listAuthProviders = (): Promise<AuthProviderInfo[]> => apiGet('/auth/provider')
export const setAuthApiKey = (providerId: string, key: string): Promise<boolean> =>
  apiPut(`/auth/${encodeURIComponent(providerId)}/key`, { key })
export const removeAuthCredential = (providerId: string): Promise<boolean> =>
  apiDelete(`/auth/${encodeURIComponent(providerId)}`)
export const loginAuthProvider = (providerId: string): Promise<boolean> =>
  apiPost(`/auth/${encodeURIComponent(providerId)}/login`)
export const logoutAuthProvider = (providerId: string): Promise<boolean> =>
  apiPost(`/auth/${encodeURIComponent(providerId)}/logout`)
export function onAuthProgress(listener: (payload: AuthProgressPayload) => void): () => void {
  return onServerEvent('auth:progress', listener as (payload: unknown) => void)
}
