import { createFileRoute, redirect } from '@tanstack/react-router'

import { EmptySessionState } from '@/components/shell/empty-session-state'
import { loadWorkspace } from '@/lib/workspace'

export const Route = createFileRoute('/')({
  loader: async () => {
    const { sessions } = await loadWorkspace()
    const firstSession = sessions[0]

    if (firstSession) {
      throw redirect({
        to: '/sessions/$sessionId/overview',
        params: { sessionId: firstSession.id }
      })
    }

    return null
  },
  component: EmptySessionState
})
