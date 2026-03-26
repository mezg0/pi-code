import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { detectPlatform } from '@tanstack/hotkeys'
import {
  ArrowUpIcon,
  ArchiveRestoreIcon,
  CheckCircle2Icon,
  CommandIcon,
  GitBranchIcon,
  KeyIcon,
  Loader2Icon,
  LogInIcon,
  LogOutIcon,
  Settings2Icon,
  ArchiveIcon,
  Trash2Icon,
  XCircleIcon,
  ZapIcon
} from 'lucide-react'

import {
  ModelSelector as ModelSelectorRoot,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger
} from '@/components/ai-elements/model-selector'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  buildShortcutLabel,
  loadModelShortcuts,
  removeModelShortcut,
  setModelShortcut,
  SHORTCUT_SLOTS,
  type ModelShortcut,
  type ModelShortcutMap
} from '@/lib/model-shortcuts'
import {
  getAgentState,
  getAvailableModels,
  listSessions,
  updateSession,
  type ModelInfo,
  type Session
} from '@/lib/sessions'
import type { AuthProviderInfo } from '@pi-code/shared/session'

type SettingsSection = 'api-keys' | 'model-shortcuts' | 'archived-chats'

const NAV_ITEMS: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
  { id: 'api-keys', label: 'API Keys', icon: KeyIcon },
  { id: 'model-shortcuts', label: 'Model Shortcuts', icon: ZapIcon },
  { id: 'archived-chats', label: 'Archived Chats', icon: ArchiveIcon }
]

export function SettingsView(): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<SettingsSection>('api-keys')

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left nav */}
      <aside className="flex w-52 shrink-0 flex-col gap-1 border-r border-border p-3">
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
            </button>
          )
        })}
      </aside>

      {/* Right content */}
      <div className="min-w-0 flex-1 overflow-hidden">
        {activeSection === 'api-keys' && <ApiKeysSection />}
        {activeSection === 'model-shortcuts' && <ModelShortcutsSection />}
        {activeSection === 'archived-chats' && <ArchivedChatsSection />}
      </div>
    </div>
  )
}

// ─── API Keys Section ────────────────────────────────────────────────────────

function ApiKeysSection(): React.JSX.Element {
  const [providers, setProviders] = useState<AuthProviderInfo[]>([])
  const [loading, setLoading] = useState(true)

  const loadProviders = useCallback(async () => {
    try {
      const list = await window.auth.listProviders()
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
      <div className="mx-auto max-w-2xl space-y-8 p-8">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Manage API keys and authentication for AI providers.
          </p>
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
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">~/.pi/agent/auth.json</code>.
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

// ─── Model Shortcut Kbd ──────────────────────────────────────────────────────

const isMac = detectPlatform() === 'mac'

/**
 * Renders a model shortcut key combo (e.g. ⌘⇧1) with proper icons for
 * modifier keys instead of Unicode text characters.
 */
function ModelShortcutKbd({
  slot,
  size = 'md'
}: {
  slot: string
  size?: 'sm' | 'md'
}): React.JSX.Element {
  const isSmall = size === 'sm'
  const iconSize = isSmall ? 'size-2.5' : 'size-3'
  const textSize = isSmall ? 'text-[10px]' : 'text-[11px]'
  const gap = isSmall ? 'gap-0.5' : 'gap-[3px]'
  const padding = isSmall ? 'px-1 py-px' : 'px-1.5 py-0.5'

  return (
    <kbd
      className={`inline-flex shrink-0 items-center ${gap} rounded-sm border border-border/60 bg-muted/80 ${padding} ${textSize} leading-none text-muted-foreground shadow-[0_1px_0_0_rgba(0,0,0,0.08)]`}
    >
      {isMac ? (
        <CommandIcon className={iconSize} />
      ) : (
        <span className="font-sans font-medium">Ctrl</span>
      )}
      {isMac ? (
        <ArrowUpIcon className={iconSize} strokeWidth={2.5} />
      ) : (
        <span className="font-sans font-medium">Shift</span>
      )}
      <span className="font-sans font-semibold">{slot}</span>
    </kbd>
  )
}

// ─── Model Shortcuts Section ─────────────────────────────────────────────────

function ModelShortcutsSection(): React.JSX.Element {
  const [shortcuts, setShortcuts] = useState<ModelShortcutMap>(() => loadModelShortcuts())
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  // The slot currently being assigned (null = none)
  const [assigningSlot, setAssigningSlot] = useState<string | null>(null)
  // For the thinking level picker after model selection
  const [pendingAssignment, setPendingAssignment] = useState<{
    slot: string
    model: ModelInfo
  } | null>(null)
  // Available thinking levels from the active session
  const [thinkingLevels, setThinkingLevels] = useState<string[]>([])

  // Fetch available models from the first active (non-archived) session
  useEffect(() => {
    let disposed = false
    void (async () => {
      setLoadingModels(true)
      try {
        const allSessions = await listSessions()
        const active = allSessions.find((s) => !s.archived)
        if (!active || disposed) {
          setHasSession(false)
          setLoadingModels(false)
          return
        }
        setHasSession(true)
        const [available, state] = await Promise.all([
          getAvailableModels(active.id),
          getAgentState(active.id)
        ])
        if (disposed) return
        setModels(available)
        setThinkingLevels(state?.availableThinkingLevels ?? [])
      } catch {
        // Ignore
      } finally {
        if (!disposed) setLoadingModels(false)
      }
    })()
    return () => {
      disposed = true
    }
  }, [])

  function handleModelSelect(slot: string, model: ModelInfo): void {
    if (model.reasoning && thinkingLevels.length > 1) {
      // Show thinking level picker
      setPendingAssignment({ slot, model })
      setAssigningSlot(null)
    } else {
      // No thinking level needed — save immediately
      const shortcut: ModelShortcut = {
        provider: model.provider,
        modelId: model.id,
        thinkingLevel: null,
        label: buildShortcutLabel(model.id, null)
      }
      setModelShortcut(slot, shortcut)
      setShortcuts(loadModelShortcuts())
      setAssigningSlot(null)
    }
  }

  function handleThinkingSelect(level: string | null): void {
    if (!pendingAssignment) return
    const { slot, model } = pendingAssignment
    const shortcut: ModelShortcut = {
      provider: model.provider,
      modelId: model.id,
      thinkingLevel: level,
      label: buildShortcutLabel(model.id, level)
    }
    setModelShortcut(slot, shortcut)
    setShortcuts(loadModelShortcuts())
    setPendingAssignment(null)
  }

  function handleRemove(slot: string): void {
    removeModelShortcut(slot)
    setShortcuts(loadModelShortcuts())
  }

  const providers = [...new Set(models.map((m) => m.provider))]
  const assignedSlots = SHORTCUT_SLOTS.filter((slot) => shortcuts[slot])
  const nextAvailableSlot = SHORTCUT_SLOTS.find((slot) => !shortcuts[slot])

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Model Shortcuts</h2>
          <p className="text-sm text-muted-foreground">
            Assign keyboard shortcuts to quickly switch models and thinking levels.
          </p>
        </div>

        {!hasSession && !loadingModels && (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Open a session to assign models to shortcuts. Previously configured shortcuts will
              still work.
            </p>
          </div>
        )}

        {loadingModels && (
          <div className="flex items-center gap-2 py-4">
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading models…</span>
          </div>
        )}

        {/* Thinking level picker — shown inline after model selection */}
        {pendingAssignment && (
          <div className="rounded-lg border border-border bg-card px-4 py-4">
            <div className="mb-3 flex items-center gap-2">
              <ModelShortcutKbd slot={pendingAssignment.slot} />
              <span className="text-sm text-muted-foreground">→</span>
              <span className="text-sm font-medium">{pendingAssignment.model.id}</span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">Choose a thinking level</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {thinkingLevels.map((level) => (
                <Button
                  key={level}
                  variant="outline"
                  size="xs"
                  className="capitalize"
                  onClick={() => handleThinkingSelect(level)}
                >
                  {level}
                </Button>
              ))}
              <Separator orientation="vertical" className="mx-1 !h-4" />
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={() => handleThinkingSelect(null)}
              >
                No preference
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={() => setPendingAssignment(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Assigned shortcuts */}
        {assignedSlots.length > 0 && (
          <div className="space-y-1.5">
            {assignedSlots.map((slot) => {
              const shortcut = shortcuts[slot]!
              const isAssigning = assigningSlot === slot

              return (
                <div
                  key={slot}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <ModelShortcutKbd slot={slot} />

                  <span className="min-w-0 flex-1 truncate text-sm">{shortcut.label}</span>

                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {hasSession && !pendingAssignment && (
                      <ModelSelectorRoot
                        open={isAssigning}
                        onOpenChange={(open) => setAssigningSlot(open ? slot : null)}
                      >
                        <ModelSelectorTrigger asChild>
                          <Button variant="ghost" size="xs" className="text-muted-foreground">
                            Change
                          </Button>
                        </ModelSelectorTrigger>
                        <ModelSelectorContent title={`Reassign shortcut ${slot}`}>
                          <ModelSelectorInput placeholder="Search models…" />
                          <ModelSelectorList>
                            <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                            {providers.map((provider) => (
                              <ModelSelectorGroup heading={provider} key={provider}>
                                {models
                                  .filter((m) => m.provider === provider)
                                  .map((model) => (
                                    <ModelSelectorItem
                                      key={`${model.provider}:${model.id}`}
                                      value={`${model.provider} ${model.id}`}
                                      onSelect={() => handleModelSelect(slot, model)}
                                    >
                                      <ModelSelectorName>{model.id}</ModelSelectorName>
                                      {model.reasoning ? (
                                        <span className="text-[10px] text-muted-foreground">
                                          reasoning
                                        </span>
                                      ) : null}
                                    </ModelSelectorItem>
                                  ))}
                              </ModelSelectorGroup>
                            ))}
                          </ModelSelectorList>
                        </ModelSelectorContent>
                      </ModelSelectorRoot>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(slot)}
                        >
                          <Trash2Icon className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove shortcut</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {assignedSlots.length === 0 && !loadingModels && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center">
            <ZapIcon className="size-7 text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">No shortcuts configured</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                Use <ModelShortcutKbd slot="1" size="sm" /> –{' '}
                <ModelShortcutKbd slot="9" size="sm" /> to switch models instantly
              </p>
            </div>
          </div>
        )}

        {/* Add shortcut button */}
        {hasSession && nextAvailableSlot && !pendingAssignment && (
          <ModelSelectorRoot
            open={assigningSlot === nextAvailableSlot}
            onOpenChange={(open) => setAssigningSlot(open ? nextAvailableSlot : null)}
          >
            <ModelSelectorTrigger asChild>
              <Button variant="outline" size="sm" className="w-full gap-2 text-muted-foreground">
                Add shortcut
                <ModelShortcutKbd slot={nextAvailableSlot} size="sm" />
              </Button>
            </ModelSelectorTrigger>
            <ModelSelectorContent title={`Assign model to shortcut ${nextAvailableSlot}`}>
              <ModelSelectorInput placeholder="Search models…" />
              <ModelSelectorList>
                <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                {providers.map((provider) => (
                  <ModelSelectorGroup heading={provider} key={provider}>
                    {models
                      .filter((m) => m.provider === provider)
                      .map((model) => (
                        <ModelSelectorItem
                          key={`${model.provider}:${model.id}`}
                          value={`${model.provider} ${model.id}`}
                          onSelect={() => handleModelSelect(nextAvailableSlot, model)}
                        >
                          <ModelSelectorName>{model.id}</ModelSelectorName>
                          {model.reasoning ? (
                            <span className="text-[10px] text-muted-foreground">reasoning</span>
                          ) : null}
                        </ModelSelectorItem>
                      ))}
                  </ModelSelectorGroup>
                ))}
              </ModelSelectorList>
            </ModelSelectorContent>
          </ModelSelectorRoot>
        )}
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
      <div className="mx-auto max-w-2xl space-y-6 p-8">
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
                    <TooltipContent>
                      Worktree sessions cannot be restored
                    </TooltipContent>
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
    const unsub = window.auth.onProgress((payload) => {
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
      const success = await window.auth.login(provider.id)
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
    await window.auth.logout(provider.id)
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
      const success = await window.auth.setApiKey(provider.id, keyInput.trim())
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
    await window.auth.removeCredential(provider.id)
    await onUpdate()
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyIcon className="size-3.5 text-muted-foreground" />
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
          placeholder={hasStoredKey ? '••••••••••••' : hasEnvKey ? 'Using environment variable' : 'Enter API key'}
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
