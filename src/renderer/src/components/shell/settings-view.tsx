import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  GitBranchIcon,
  GlobeIcon,
  KeyRoundIcon,
  KeyboardIcon,
  Loader2Icon,
  LogInIcon,
  LogOutIcon,
  RefreshCwIcon,
  Settings2Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldQuestionIcon,
  Trash2Icon,
  WifiIcon,
  XCircleIcon
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ShortcutsCheatsheetContent } from './shortcuts-cheatsheet'
import {
  getAppSettings,
  listSessions,
  updateAppSettings,
  updateSession,
  type AppSettings,
  type PermissionMode,
  type Session
} from '@/lib/sessions'
import {
  listAuthProviders,
  loginAuthProvider,
  logoutAuthProvider,
  onAuthProgress,
  removeAuthCredential,
  setAuthApiKey
} from '@/lib/auth'
import type { AuthProviderInfo } from '@pi-code/shared/session'

type SettingsSection =
  | 'permissions'
  | 'api-keys'
  | 'keyboard-shortcuts'
  | 'remote-access'
  | 'archived-chats'

const NAV_ITEMS: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
  { id: 'permissions', label: 'Permissions', icon: ShieldQuestionIcon },
  { id: 'api-keys', label: 'API Keys', icon: KeyRoundIcon },
  { id: 'keyboard-shortcuts', label: 'Keyboard Shortcuts', icon: KeyboardIcon },
  { id: 'remote-access', label: 'Remote Access', icon: WifiIcon },
  { id: 'archived-chats', label: 'Archived Chats', icon: ArchiveIcon }
]

export function SettingsView(): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<SettingsSection | null>('permissions')

  const sectionContent = (
    <>
      {activeSection === 'permissions' && <PermissionsSection />}
      {activeSection === 'api-keys' && <ApiKeysSection />}
      {activeSection === 'keyboard-shortcuts' && <KeyboardShortcutsSection />}
      {activeSection === 'remote-access' && <RemoteAccessSection />}
      {activeSection === 'archived-chats' && <ArchivedChatsSection />}
    </>
  )

  const navList = (
    <>
      <div className="mb-2 flex items-center gap-2 px-2 py-1">
        <Settings2Icon className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Settings</span>
      </div>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
              activeSection === item.id
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }`}
          >
            <Icon className="size-3.5 shrink-0" />
            {item.label}
            <ChevronRightIcon className="ml-auto size-3.5 text-muted-foreground/50 md:hidden" />
          </button>
        )
      })}
    </>
  )

  return (
    <>
      {/* Desktop: side-by-side */}
      <div className="hidden h-full overflow-hidden md:flex">
        <aside className="flex w-52 shrink-0 flex-col gap-1 border-r border-border p-3">
          {navList}
        </aside>
        <div className="min-w-0 flex-1 overflow-hidden">{sectionContent}</div>
      </div>

      {/* Mobile: stacked nav → content */}
      <div className="flex h-full flex-col overflow-hidden md:hidden">
        {activeSection === null ? (
          <div className="flex flex-col gap-1 p-3">{navList}</div>
        ) : (
          <>
            <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-2">
              <Button variant="ghost" size="icon-sm" onClick={() => setActiveSection(null)}>
                <ArrowLeftIcon />
              </Button>
              <span className="text-sm font-semibold">
                {NAV_ITEMS.find((i) => i.id === activeSection)?.label}
              </span>
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">{sectionContent}</div>
          </>
        )}
      </div>
    </>
  )
}

const PERMISSION_MODE_OPTIONS: Array<{
  mode: PermissionMode
  label: string
  description: string
  icon: React.ElementType
  accentClass: string
}> = [
  {
    mode: 'ask',
    label: 'Ask',
    description: 'Approve bash, edit, and write. Other tools run automatically.',
    icon: ShieldQuestionIcon,
    accentClass: 'border-border'
  },
  {
    mode: 'auto',
    label: 'Auto',
    description: 'Allow all tools and external directory access automatically.',
    icon: ShieldCheckIcon,
    accentClass: 'border-green-500/30 bg-green-500/5'
  },
  {
    mode: 'strict',
    label: 'Strict',
    description: 'Require approval for every tool call.',
    icon: ShieldAlertIcon,
    accentClass: 'border-orange-500/30 bg-orange-500/5'
  }
]

function PermissionsSection(): React.JSX.Element {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery<AppSettings>({
    queryKey: ['app-settings'],
    queryFn: () => getAppSettings(),
    staleTime: 30_000
  })

  const updateMutation = useMutation({
    mutationFn: async (mode: PermissionMode) =>
      updateAppSettings({
        defaultPermissionMode: mode
      }),
    onMutate: async (mode) => {
      queryClient.setQueryData<AppSettings>(['app-settings'], (previous) => ({
        ...previous,
        defaultPermissionMode: mode
      }))
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['app-settings'] })
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(['app-settings'], settings)
    }
  })

  const mode = settingsQuery.data?.defaultPermissionMode ?? 'ask'
  const pendingMode = updateMutation.isPending ? updateMutation.variables : null

  async function handleSetMode(nextMode: PermissionMode): Promise<void> {
    if (settingsQuery.isPending || updateMutation.isPending || nextMode === mode) return
    await updateMutation.mutateAsync(nextMode)
  }

  if (settingsQuery.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl space-y-8 p-6 md:p-8">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Choose the default permission mode for sessions.
          </p>
        </div>

        <div className="space-y-3">
          {PERMISSION_MODE_OPTIONS.map((option) => {
            const Icon = option.icon
            const isActive = option.mode === mode
            const isPending = option.mode === pendingMode

            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => void handleSetMode(option.mode)}
                disabled={settingsQuery.isPending || updateMutation.isPending}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  isActive ? option.accentClass : 'border-border bg-card hover:bg-accent/40'
                } ${updateMutation.isPending ? 'cursor-default' : ''}`}
              >
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-background/80 text-muted-foreground">
                  {isPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{option.label}</span>
                    {isActive && (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2Icon className="size-3 text-emerald-500" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
          Applies to new sessions only. You can still change a specific session from its permission
          control in the chat header.
        </div>

        {(settingsQuery.isError || updateMutation.isError) && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            <XCircleIcon className="size-4 shrink-0" />
            {settingsQuery.isError
              ? 'Failed to load permission settings.'
              : 'Failed to save the default permission mode.'}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

// ─── API Keys Section ────────────────────────────────────────────────────────

function ApiKeysSection(): React.JSX.Element {
  const [providers, setProviders] = useState<AuthProviderInfo[]>([])
  const [loading, setLoading] = useState(true)

  const loadProviders = useCallback(async () => {
    try {
      const list = await listAuthProviders()
      setProviders(list)
    } catch (error) {
      console.error('Failed to load providers:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProviders()
  }, [loadProviders])

  const apiKeyProviders = providers.filter(
    (provider) => provider.supportsApiKey && provider.credentialType !== 'oauth'
  )
  const oauthProviders = providers.filter((provider) => provider.isOAuth)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl space-y-8 p-6 md:p-8">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground">Manage authentication for AI providers.</p>
        </div>

        {/* OAuth Providers */}
        {oauthProviders.length > 0 && (
          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Sign In</h3>
              <p className="text-xs text-muted-foreground">
                Sign in with your existing subscription. Opens your browser to complete
                authentication.
              </p>
            </div>
            <div className="space-y-2">
              {oauthProviders.map((provider) => (
                <OAuthProviderRow
                  key={`oauth-${provider.id}`}
                  provider={provider}
                  onUpdate={loadProviders}
                />
              ))}
            </div>
          </section>
        )}

        <Separator />

        {/* API Key Providers */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">API Keys</h3>
            <p className="text-xs text-muted-foreground">
              Enter API keys for providers. Keys are stored locally in{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                ~/.pi/agent/auth.json
              </code>
              .
            </p>
          </div>
          <div className="space-y-3">
            {apiKeyProviders.map((provider) => (
              <ApiKeyProviderRow
                key={`apikey-${provider.id}`}
                provider={provider}
                onUpdate={loadProviders}
              />
            ))}
          </div>
        </section>
      </div>
    </ScrollArea>
  )
}

// ─── Keyboard Shortcuts Section ──────────────────────────────────────────────

function KeyboardShortcutsSection(): React.JSX.Element {
  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
          <p className="text-sm text-muted-foreground">
            Every shortcut available in the app. Defaults are hard-coded for v1; remapping will come
            in a future release.
          </p>
        </div>
        <ShortcutsCheatsheetContent />
      </div>
    </ScrollArea>
  )
}

// ─── Remote Access Section ───────────────────────────────────────────────────

function RemoteAccessSection(): React.JSX.Element {
  const [status, setStatus] = useState<{
    enabled: boolean
    port: number
    password: string | null
    urls: string[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [portInput, setPortInput] = useState('4311')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const { getRemoteStatus } = await import('@/lib/remote-access')
      const s = await getRemoteStatus()
      setStatus(s)
      setPortInput(String(s.port))
      if (s.password) setPassword(s.password)
    } catch {
      setError('Failed to load remote access status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function handleEnable(): Promise<void> {
    setToggling(true)
    setError(null)
    try {
      const { enableRemoteAccess } = await import('@/lib/remote-access')
      const port = parseInt(portInput, 10)
      if (isNaN(port) || port < 1024 || port > 65535) {
        setError('Port must be between 1024 and 65535')
        return
      }
      const s = await enableRemoteAccess({
        port,
        password: password.trim() || null
      })
      setStatus(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable remote access')
    } finally {
      setToggling(false)
    }
  }

  async function handleDisable(): Promise<void> {
    setToggling(true)
    setError(null)
    try {
      const { disableRemoteAccess } = await import('@/lib/remote-access')
      await disableRemoteAccess()
      setStatus((prev) => (prev ? { ...prev, enabled: false, urls: [] } : prev))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable')
    } finally {
      setToggling(false)
    }
  }

  async function handleGeneratePassword(): Promise<void> {
    try {
      const { generateRemotePassword } = await import('@/lib/remote-access')
      const { password: pw } = await generateRemotePassword()
      setPassword(pw)
      setShowPassword(true)
    } catch {
      setError('Failed to generate password')
    }
  }

  function copyToClipboard(text: string, label: string): void {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isEnabled = status?.enabled === true

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl space-y-8 p-6 md:p-8">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Remote Access</h2>
          <p className="text-sm text-muted-foreground">
            Access pi-code from your phone or other devices on your network.
          </p>
        </div>

        {/* Status */}
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex size-8 items-center justify-center rounded-md ${isEnabled ? 'bg-emerald-500/10' : 'bg-muted'}`}
              >
                {isEnabled ? (
                  <GlobeIcon className="size-4 text-emerald-500" />
                ) : (
                  <WifiIcon className="size-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isEnabled ? 'Remote access enabled' : 'Local only'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isEnabled
                    ? status?.password
                      ? 'Password protected'
                      : 'No password — anyone on your network can access'
                    : 'Only accessible on this device'}
                </p>
              </div>
            </div>
            {isEnabled ? (
              <Button
                variant="outline"
                size="sm"
                disabled={toggling}
                onClick={() => void handleDisable()}
              >
                {toggling ? <Loader2Icon className="size-3.5 animate-spin" /> : 'Disable'}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Warning for no password */}
        {isEnabled && !status?.password && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <ShieldAlertIcon className="size-4 shrink-0 text-amber-500 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-500">No password set</p>
              <p className="text-xs text-muted-foreground">
                Anyone on your network can access and control sessions, run commands, and read
                files. Consider setting a password.
              </p>
            </div>
          </div>
        )}

        {/* URLs when enabled */}
        {isEnabled && status?.urls && status.urls.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Access URLs</h3>
            <div className="space-y-2">
              {status.urls.map((url) => (
                <div
                  key={url}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5"
                >
                  <code className="text-sm font-mono">{url}</code>
                  <Button variant="ghost" size="icon-sm" onClick={() => copyToClipboard(url, url)}>
                    {copied === url ? (
                      <CheckCircle2Icon className="size-3.5 text-emerald-500" />
                    ) : (
                      <CopyIcon className="size-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Enable form */}
        {!isEnabled && (
          <section className="space-y-4">
            <Separator />
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Enable remote access</h3>
              <p className="text-xs text-muted-foreground">
                Start a network-accessible server so you can use pi-code from your phone or another
                device.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="remote-port">
                  Port
                </label>
                <Input
                  id="remote-port"
                  type="number"
                  value={portInput}
                  onChange={(e) => setPortInput(e.target.value)}
                  className="w-32"
                  min={1024}
                  max={65535}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium" htmlFor="remote-password">
                    Password
                  </label>
                  <span className="text-xs text-muted-foreground">(recommended)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="remote-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Set a password…"
                      className="pr-9"
                    />
                    {password && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword((v) => !v)}
                        type="button"
                      >
                        {showPassword ? (
                          <EyeOffIcon className="size-3.5" />
                        ) : (
                          <EyeIcon className="size-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void handleGeneratePassword()}>
                    <RefreshCwIcon data-icon="inline-start" />
                    Generate
                  </Button>
                </div>
              </div>
            </div>

            <Button
              onClick={() => void handleEnable()}
              disabled={toggling}
              className="w-full sm:w-auto"
            >
              {toggling ? (
                <Loader2Icon className="size-3.5 animate-spin" data-icon="inline-start" />
              ) : (
                <GlobeIcon data-icon="inline-start" />
              )}
              Enable remote access
            </Button>
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            <XCircleIcon className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Info */}
        <div className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
          <p>
            Designed for local network use. For access over the internet, use{' '}
            <a
              href="https://tailscale.com"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Tailscale
            </a>{' '}
            or a secure tunnel.
          </p>
        </div>
      </div>
    </ScrollArea>
  )
}

// ─── Archived Chats Section ──────────────────────────────────────────────────

function ArchivedChatsSection(): React.JSX.Element {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [unarchiving, setUnarchiving] = useState<Set<string>>(new Set())

  const loadArchivedSessions = useCallback(async () => {
    try {
      const all = await listSessions()
      setSessions(all.filter((s) => s.archived))
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadArchivedSessions()
  }, [loadArchivedSessions])

  async function handleUnarchive(session: Session): Promise<void> {
    setUnarchiving((prev) => new Set(prev).add(session.id))
    try {
      await updateSession(session.id, { archived: false })
      await router.invalidate()
      await loadArchivedSessions()
    } finally {
      setUnarchiving((prev) => {
        const next = new Set(prev)
        next.delete(session.id)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl space-y-8 p-6 md:p-8">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Archived Chats</h2>
          <p className="text-sm text-muted-foreground">
            {sessions.length === 0
              ? 'No archived chats.'
              : `${sessions.length} archived ${sessions.length === 1 ? 'chat' : 'chats'}. Unarchive to restore them to the sidebar.`}
          </p>
        </div>

        {sessions.length > 0 && (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {session.worktreePath && (
                      <GitBranchIcon className="size-3 shrink-0 text-muted-foreground" />
                    )}
                    <p className="truncate text-sm font-medium">{session.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(session.updatedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                {session.worktreePath ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-4 shrink-0">
                        <Button variant="outline" size="sm" disabled>
                          <ArchiveRestoreIcon data-icon="inline-start" />
                          Unarchive
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Worktree sessions cannot be restored</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-4 shrink-0"
                    disabled={unarchiving.has(session.id)}
                    onClick={() => void handleUnarchive(session)}
                  >
                    {unarchiving.has(session.id) ? (
                      <Loader2Icon className="size-3.5 animate-spin" data-icon="inline-start" />
                    ) : (
                      <ArchiveRestoreIcon data-icon="inline-start" />
                    )}
                    Unarchive
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {sessions.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
            <ArchiveIcon className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No archived chats yet</p>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

// ─── Auth Provider Rows ──────────────────────────────────────────────────────

function OAuthProviderRow({
  provider,
  onUpdate
}: {
  provider: AuthProviderInfo
  onUpdate: () => Promise<void>
}): React.JSX.Element {
  const [loggingIn, setLoggingIn] = useState(false)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isConnected = provider.hasCredential && provider.credentialType === 'oauth'

  useEffect(() => {
    if (!loggingIn) return
    const unsub = onAuthProgress((payload) => {
      if (payload.providerId === provider.id) {
        setProgressMessage(payload.message)
      }
    })
    return unsub
  }, [loggingIn, provider.id])

  async function handleLogin(): Promise<void> {
    setLoggingIn(true)
    setError(null)
    setProgressMessage('Opening browser...')
    try {
      const success = await loginAuthProvider(provider.id)
      if (!success) {
        setError('Login failed')
      }
      await onUpdate()
    } catch {
      setError('Login failed')
    } finally {
      setLoggingIn(false)
      setProgressMessage(null)
    }
  }

  async function handleLogout(): Promise<void> {
    await logoutAuthProvider(provider.id)
    await onUpdate()
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <LogInIcon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{provider.name}</span>
            {isConnected && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2Icon className="size-3 text-emerald-500" />
                Connected
              </Badge>
            )}
          </div>
          {loggingIn && progressMessage && (
            <p className="text-xs text-muted-foreground">{progressMessage}</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isConnected ? (
          <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
            <LogOutIcon data-icon="inline-start" />
            Logout
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            disabled={loggingIn}
            onClick={() => void handleLogin()}
          >
            {loggingIn ? (
              <Loader2Icon className="size-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <LogInIcon data-icon="inline-start" />
            )}
            {loggingIn ? 'Signing in...' : 'Sign in'}
          </Button>
        )}
      </div>
    </div>
  )
}

function ApiKeyProviderRow({
  provider,
  onUpdate
}: {
  provider: AuthProviderInfo
  onUpdate: () => Promise<void>
}): React.JSX.Element {
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasStoredKey = provider.hasCredential && provider.credentialType === 'api_key'
  const hasEnvKey = provider.hasCredential && provider.credentialType === 'env'

  async function handleSave(): Promise<void> {
    if (!keyInput.trim()) return
    setSaving(true)
    setError(null)
    try {
      const success = await setAuthApiKey(provider.id, keyInput.trim())
      if (success) {
        setKeyInput('')
        await onUpdate()
      } else {
        setError('Failed to save')
      }
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(): Promise<void> {
    await removeAuthCredential(provider.id)
    await onUpdate()
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRoundIcon className="size-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{provider.name}</span>
          {hasStoredKey && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2Icon className="size-3 text-emerald-500" />
              Saved
            </Badge>
          )}
          {hasEnvKey && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              ENV
            </Badge>
          )}
        </div>
        {hasStoredKey && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => void handleRemove()}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="password"
          placeholder={
            hasStoredKey
              ? '••••••••••••'
              : hasEnvKey
                ? 'Using environment variable'
                : 'Enter API key'
          }
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave()
          }}
          className="flex-1"
        />
        <Button
          variant="default"
          size="sm"
          disabled={!keyInput.trim() || saving}
          onClick={() => void handleSave()}
        >
          {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : 'Save'}
        </Button>
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <XCircleIcon className="size-3" />
          {error}
        </p>
      )}
    </div>
  )
}
