import { apiGet, apiPost } from './api-client'

export type RemoteAccessStatus = {
  enabled: boolean
  port: number
  password: string | null
  urls: string[]
}

export const getRemoteStatus = (): Promise<RemoteAccessStatus> => apiGet('/remote/status')

export const enableRemoteAccess = (opts: {
  port?: number
  password?: string | null
}): Promise<RemoteAccessStatus> => apiPost('/remote/enable', opts)

export const disableRemoteAccess = (): Promise<{ enabled: boolean }> => apiPost('/remote/disable')

export const generateRemotePassword = (): Promise<{ password: string }> =>
  apiPost('/remote/generate-password')
