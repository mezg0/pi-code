import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HotkeysProvider } from '@tanstack/react-hotkeys'

import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/query-client'

const hotkeyDefaults = {
  hotkey: {
    conflictBehavior: (import.meta.env.DEV ? 'warn' : 'allow') as 'warn' | 'allow'
  }
}

export function AppProviders({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <HotkeysProvider defaultOptions={hotkeyDefaults}>
        <TooltipProvider>{children}</TooltipProvider>
      </HotkeysProvider>
    </QueryClientProvider>
  )
}
