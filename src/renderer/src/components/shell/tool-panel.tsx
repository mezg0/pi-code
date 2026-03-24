import {
  CodeIcon,
  FileTextIcon,
  FolderGit2Icon,
  MonitorIcon,
  SquareTerminalIcon,
  XIcon
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getShortcutDisplay, type ShortcutId } from '@/lib/shortcuts'
import { BrowserView } from './browser-view'
import { FilesView } from './files-view'
import { GitChangesView } from './git-changes-view'
import { PlanView } from './plan-view'
import { TerminalView } from './terminal-view'

export type ToolTab = 'terminal' | 'files' | 'git' | 'browser' | 'plan'

type ToolTabConfig = {
  key: ToolTab
  label: string
  icon: typeof CodeIcon
  description: string
  shortcutId: ShortcutId
}

const TOOL_TABS: ToolTabConfig[] = [
  {
    key: 'plan',
    label: 'Plan',
    icon: FileTextIcon,
    description: 'Review the latest markdown plan published by the model.',
    shortcutId: 'tab-plan'
  },
  {
    key: 'git',
    label: 'Git',
    icon: FolderGit2Icon,
    description: 'View uncommitted changes and diffs.',
    shortcutId: 'tab-git'
  },
  {
    key: 'terminal',
    label: 'Terminal',
    icon: SquareTerminalIcon,
    description: 'Live shell output for this session. Will use xterm.js in Phase 7.',
    shortcutId: 'tab-terminal'
  },
  {
    key: 'files',
    label: 'Files',
    icon: CodeIcon,
    description: 'Project file explorer and editor. Coming in Phase 8.',
    shortcutId: 'tab-files'
  },
  {
    key: 'browser',
    label: 'Browser',
    icon: MonitorIcon,
    description: 'Open a local preview URL for this project.',
    shortcutId: 'tab-browser'
  }
]

export function ToolPanel({
  activeTab,
  onSelect,
  onClose,
  cwd,
  sessionId,
  hasPlan,
  onDismissPlan
}: {
  activeTab: ToolTab
  onSelect: (tab: ToolTab) => void
  onClose: () => void
  cwd?: string
  sessionId?: string
  hasPlan: boolean
  onDismissPlan?: () => void
}): React.JSX.Element {
  const visibleTabs = TOOL_TABS.filter((tab) => hasPlan || tab.key !== 'plan')
  const activeConfig = visibleTabs.find((tab) => tab.key === activeTab) ?? visibleTabs[0]!

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden border-l border-border">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-2">
        <div className="flex items-center gap-0.5">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            const shortcutHint = getShortcutDisplay(tab.shortcutId)
            return (
              <Tooltip key={tab.key}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === tab.key ? 'secondary' : 'ghost'}
                    size="xs"
                    onClick={() => onSelect(tab.key)}
                  >
                    <Icon data-icon="inline-start" />
                    {tab.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {tab.label} <kbd className="ml-1.5 inline-flex font-sans text-[11px] opacity-60">{shortcutHint}</kbd>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {/* All tabs stay mounted, hidden when not active */}
        {hasPlan && (
          <div className={activeTab === 'plan' ? 'size-full' : 'sr-only'}>
            <PlanView sessionId={sessionId} onDismiss={onDismissPlan} />
          </div>
        )}
        {cwd && (
          <div className={activeTab === 'git' ? 'size-full' : 'sr-only'}>
            <GitChangesView cwd={cwd} />
          </div>
        )}
        {cwd && (
          <div className={activeTab === 'files' ? 'size-full' : 'sr-only'}>
            <FilesView cwd={cwd} />
          </div>
        )}
        {cwd && (
          <div className={activeTab === 'terminal' ? 'size-full bg-black' : 'sr-only'}>
            <TerminalView id={`term:${cwd}`} cwd={cwd} />
          </div>
        )}
        {cwd && (
          <div className={activeTab === 'browser' ? 'size-full' : 'sr-only'}>
            <BrowserView id={`browser:${cwd}`} />
          </div>
        )}

        {!cwd && activeTab !== 'git' && activeTab !== 'files' && activeTab !== 'plan' && (
          <div className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {activeConfig.description}
          </div>
        )}
      </div>
    </div>
  )
}
