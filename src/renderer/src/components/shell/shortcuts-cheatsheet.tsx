import { KeyboardIcon, SparklesIcon } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { getShortcutsByCategory, type GroupedShortcut } from '@/lib/shortcuts'

type CheatsheetMode = 'shortcuts' | 'palette-placeholder'

function CategoryBlock({
  category,
  items
}: {
  category: string
  items: GroupedShortcut[]
}): React.JSX.Element {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {category}
      </h3>
      <ul className="divide-y divide-border/60 rounded-lg border border-border bg-card">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{item.def.label}</div>
              {item.def.description ? (
                <div className="truncate text-[11px] text-muted-foreground">
                  {item.def.description}
                </div>
              ) : null}
            </div>
            <kbd className="inline-flex shrink-0 items-center rounded-sm border border-border/60 bg-muted/80 px-1.5 py-0.5 font-sans text-[11px] leading-none text-muted-foreground shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
              {item.display}
            </kbd>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Renders all registered shortcuts grouped by category. The component has two
 * variants:
 *
 * - The default inline variant (no dialog) is used inside the Settings page.
 * - The dialog variant is mounted at the root and opened by `Mod+/`, `?`, and
 *   (for now) `Mod+K`, which passes `mode="palette-placeholder"` to show the
 *   "Command palette coming soon" banner.
 */
export function ShortcutsCheatsheetContent({
  mode = 'shortcuts',
  className
}: {
  mode?: CheatsheetMode
  className?: string
}): React.JSX.Element {
  const groups = getShortcutsByCategory()

  return (
    <div className={cn('space-y-5', className)}>
      {mode === 'palette-placeholder' ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
          <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <div className="space-y-0.5">
            <div className="font-medium text-foreground">Command palette coming soon</div>
            <p className="text-muted-foreground">
              Here are the keyboard shortcuts available in the meantime.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((group) => (
          <CategoryBlock key={group.category} category={group.category} items={group.items} />
        ))}
      </div>
    </div>
  )
}

export function ShortcutsCheatsheetDialog({
  open,
  onOpenChange,
  mode
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: CheatsheetMode
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        // DialogContent defaults to `grid gap-4 p-4`; we override to a column flex.
      >
        <DialogHeader className="flex shrink-0 flex-row items-center gap-2 border-b border-border px-4 py-3">
          <KeyboardIcon className="size-4 text-muted-foreground" />
          <div className="flex flex-col">
            <DialogTitle className="text-sm font-semibold">Keyboard shortcuts</DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground">
              Everything you can do without reaching for the mouse.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ShortcutsCheatsheetContent mode={mode} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
