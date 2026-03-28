import { useMemo, useState } from 'react'
import { BrainIcon, CheckIcon, ChevronDownIcon } from 'lucide-react'

import {
  ModelSelector as ModelSelectorRoot,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorShortcut,
  ModelSelectorTrigger
} from '@/components/ai-elements/model-selector'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { loadModelShortcuts } from '@/lib/model-shortcuts'
import {
  useSessionAvailableModels,
  useSessionRuntimeMutations,
  useSessionRuntimeState
} from '@/lib/session-runtime-query'
import { cn } from '@/lib/utils'
import type { ModelInfo } from '@/lib/sessions'
import { getModelShortcutDisplay } from '@/lib/shortcuts'

function formatProviderLabel(provider: string): string {
  switch (provider) {
    case 'fireworks-ai':
      return 'Fireworks'
    default:
      return provider
  }
}

function FooterButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>): React.JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function ModelSelector({ sessionId }: { sessionId: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const runtimeStateQuery = useSessionRuntimeState(sessionId)
  const availableModelsQuery = useSessionAvailableModels(sessionId)
  const { setModel, setThinking } = useSessionRuntimeMutations(sessionId)

  const state = runtimeStateQuery.data ?? null
  const models = availableModelsQuery.data ?? []
  const currentModelId = state?.model?.id ?? '…'
  const currentProvider = state?.model?.provider ?? ''
  const currentThinking = state?.thinkingLevel ?? 'off'
  const thinkingLevels = state?.availableThinkingLevels ?? []
  const supportsReasoning = thinkingLevels.length > 1
  const providers = [...new Set(models.map((model) => model.provider))]
  const pending = setModel.isPending || setThinking.isPending

  async function handleModelSelect(model: ModelInfo): Promise<void> {
    setOpen(false)
    const success = await setModel.mutateAsync({ provider: model.provider, modelId: model.id })
    if (!success) {
      setOpen(true)
    }
  }

  async function handleThinkingChange(level: string): Promise<void> {
    await setThinking.mutateAsync(level)
  }

  const shortcutHints = useMemo(() => {
    if (!open) return {}
    const map: Record<string, string> = {}
    const shortcuts = loadModelShortcuts()
    for (const [slot, shortcut] of Object.entries(shortcuts)) {
      if (shortcut) {
        map[`${shortcut.provider}:${shortcut.modelId}`] = getModelShortcutDisplay(slot)
      }
    }
    return map
  }, [open])

  return (
    <>
      <ModelSelectorRoot open={open} onOpenChange={setOpen}>
        <ModelSelectorTrigger asChild>
          <FooterButton className="uppercase" disabled={pending}>
            {currentModelId}
            <ChevronDownIcon className="size-3 opacity-50" />
          </FooterButton>
        </ModelSelectorTrigger>
        <ModelSelectorContent title="Select model">
          <ModelSelectorInput placeholder="Search models…" />
          <ModelSelectorList>
            <ModelSelectorEmpty>
              {availableModelsQuery.isPending ? 'Loading models…' : 'No models found.'}
            </ModelSelectorEmpty>
            {providers.map((provider) => (
              <ModelSelectorGroup heading={formatProviderLabel(provider)} key={provider}>
                {models
                  .filter((model) => model.provider === provider)
                  .map((model) => (
                    <ModelSelectorItem
                      key={`${model.provider}:${model.id}`}
                      value={`${model.provider} ${model.id}`}
                      onSelect={() => void handleModelSelect(model)}
                      disabled={pending}
                    >
                      <ModelSelectorName>{model.id}</ModelSelectorName>
                      {model.reasoning ? (
                        <span className="text-[10px] text-muted-foreground">reasoning</span>
                      ) : null}
                      {shortcutHints[`${model.provider}:${model.id}`] ? (
                        <ModelSelectorShortcut>
                          {shortcutHints[`${model.provider}:${model.id}`]}
                        </ModelSelectorShortcut>
                      ) : null}
                      {model.id === currentModelId && model.provider === currentProvider ? (
                        <CheckIcon className="ml-auto size-3.5" />
                      ) : (
                        <div className="ml-auto size-3.5" />
                      )}
                    </ModelSelectorItem>
                  ))}
              </ModelSelectorGroup>
            ))}
          </ModelSelectorList>
        </ModelSelectorContent>
      </ModelSelectorRoot>

      {supportsReasoning ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FooterButton className="capitalize" disabled={pending}>
              <BrainIcon className="size-3" />
              {currentThinking}
              <ChevronDownIcon className="size-3 opacity-50" />
            </FooterButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {thinkingLevels.map((level) => (
              <DropdownMenuItem
                key={level}
                onClick={() => void handleThinkingChange(level)}
                className="capitalize"
                disabled={pending}
              >
                <span className={level === currentThinking ? 'font-medium' : ''}>{level}</span>
                {level === currentThinking ? <CheckIcon className="ml-auto size-3.5" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  )
}
