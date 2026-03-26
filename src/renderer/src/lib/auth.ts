import type { AuthProgressPayload, AuthProviderInfo } from '@pi-code/shared/session'

const auth = window.auth

export type { AuthProgressPayload, AuthProviderInfo }

export const listAuthProviders = (): Promise<AuthProviderInfo[]> => auth.listProviders()
export const setAuthApiKey = (providerId: string, key: string): Promise<boolean> =>
  auth.setApiKey(providerId, key)
export const removeAuthCredential = (providerId: string): Promise<boolean> =>
  auth.removeCredential(providerId)
export const loginAuthProvider = (providerId: string): Promise<boolean> => auth.login(providerId)
export const logoutAuthProvider = (providerId: string): Promise<boolean> => auth.logout(providerId)
export const onAuthProgress = (listener: (payload: AuthProgressPayload) => void): (() => void) =>
  auth.onProgress(listener)
