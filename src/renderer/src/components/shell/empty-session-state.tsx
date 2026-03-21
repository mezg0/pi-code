import { WaypointsIcon } from 'lucide-react'

import { ConversationEmptyState } from '@/components/ai-elements/conversation'

export function EmptySessionState(): React.JSX.Element {
  return (
    <ConversationEmptyState
      icon={<WaypointsIcon className="size-8" />}
      title="No sessions yet"
      description="Create your first session from a project in the sidebar."
      className="h-full"
    />
  )
}
