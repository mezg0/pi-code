import type { ReactNode } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { ShortcutProvider } from './shortcut-provider'

export function AppProviders({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <ShortcutProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </ShortcutProvider>
  )
}
