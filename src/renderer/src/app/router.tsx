import { createRouter } from '@tanstack/react-router'

import { queryClient } from '@/lib/query-client'
import { routeTree } from '../routeTree.gen'

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  // Hover-prefetch with no delay so sidebar sessions feel instant.
  defaultPreloadDelay: 0,
  // Give hover-prefetched loader data a short stale window so
  // navigating right after prefetch uses the warm result.
  defaultPreloadStaleTime: 10_000,
  context: { queryClient }
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
