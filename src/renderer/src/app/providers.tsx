import type { ReactNode } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'

export function AppProviders({ children }: { children: ReactNode }): React.JSX.Element {
  return <TooltipProvider>{children}</TooltipProvider>
}
