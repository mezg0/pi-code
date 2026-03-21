import { useCallback, useEffect, useState } from 'react'
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
  ModelSelectorTrigger
} from '@/components/ai-elements/model-selector'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  getAgentState,
  getAvailableModels,
  setSessionModel,
  setSessionThinking,
  type ModelInfo,
  type RpcState
} from '@/lib/sessions'

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
  const [state, setState] = useState<RpcState>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    void Promise.all([getAgentState(sessionId), getAvailableModels(sessionId)]).then(
      ([rpcState, availableModels]) => {
        setState(rpcState)
        setModels(availableModels)
      }
    )
  }, [sessionId])

  const handleModelSelect = useCallback(
    async (model: ModelInfo): Promise<void> => {
      setOpen(false)
      await setSessionModel(sessionId, model.provider, model.id)
      const nextState = await getAgentState(sessionId)
      setState(nextState)
    },
    [sessionId]
  )

  async function handleThinkingChange(level: string): Promise<void> {
    await setSessionThinking(sessionId, level)
    const nextState = await getAgentState(sessionId)
    setState(nextState)
  }

  const currentModelId = state?.model?.id ?? '…'
  const currentProvider = state?.model?.provider ?? ''
  const currentThinking = state?.thinkingLevel ?? 'off'
  const thinkingLevels = state?.availableThinkingLevels ?? []
  const supportsReasoning = thinkingLevels.length > 1
  const providers = [...new Set(models.map((model) => model.provider))]

  return (
    <>
      <ModelSelectorRoot open={open} onOpenChange={setOpen}>
        <ModelSelectorTrigger asChild>
          <FooterButton className="uppercase">
            {currentModelId}
            <ChevronDownIcon className="size-3 opacity-50" />
          </FooterButton>
        </ModelSelectorTrigger>
        <ModelSelectorContent title="Select model">
          <ModelSelectorInput placeholder="Search models…" />
          <ModelSelectorList>
            <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
            {providers.map((provider) => (
              <ModelSelectorGroup heading={provider} key={provider}>
                {models
                  .filter((model) => model.provider === provider)
                  .map((model) => (
                    <ModelSelectorItem
                      key={`${model.provider}:${model.id}`}
                      value={`${model.provider} ${model.id}`}
                      onSelect={() => void handleModelSelect(model)}
                    >
                      <ModelSelectorName>{model.id}</ModelSelectorName>
                      {model.reasoning ? (
                        <span className="text-[10px] text-muted-foreground">reasoning</span>
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
            <FooterButton className="capitalize">
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
