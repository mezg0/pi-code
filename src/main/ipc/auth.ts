import { ipcMain } from 'electron'
import {
  listAuthProviders,
  setApiKey,
  removeCredential,
  oauthLogin,
  oauthLogout
} from '../services/auth'

export function registerAuthIpc(): void {
  ipcMain.handle('auth:listProviders', () => listAuthProviders())
  ipcMain.handle('auth:setApiKey', (_event, providerId: string, key: string) =>
    setApiKey(providerId, key)
  )
  ipcMain.handle('auth:removeCredential', (_event, providerId: string) =>
    removeCredential(providerId)
  )
  ipcMain.handle('auth:login', (_event, providerId: string) => oauthLogin(providerId))
  ipcMain.handle('auth:logout', (_event, providerId: string) => oauthLogout(providerId))
}
