import { Settings2Icon } from 'lucide-react'

export function SettingsView(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Settings2Icon />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <div className="text-sm font-medium">Settings</div>
        <p className="text-sm text-muted-foreground">
          Global preferences, default models, execution policies, and app behavior.
        </p>
      </div>
    </div>
  )
}
