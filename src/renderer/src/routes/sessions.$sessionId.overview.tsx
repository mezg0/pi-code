import { createFileRoute, notFound } from '@tanstack/react-router'

import { SessionConversation } from '@/components/shell/session-conversation'
import { useSessionState } from '@/hooks/use-session-state'
import {
  abortSession,
  getAgentMessages,
  getSession,
  sendSessionMessage,
  type AgentMessage,
  type Session,
  type SessionImageInput
} from '@/lib/sessions'

function SessionOverviewRouteComponent(): React.JSX.Element {
  const { session, messages } = Route.useLoaderData()

  return (
    <SessionOverviewContent key={session.id} initialSession={session} initialMessages={messages} />
  )
}

function SessionOverviewContent({
  initialSession,
  initialMessages
}: {
  initialSession: Session
  initialMessages: AgentMessage[]
}): React.JSX.Element {
  const {
    session,
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
    pendingMessages,
    errorMessage,
    questionRequest,
    setLoading,
    clearError,
    clearQuestion
  } = useSessionState(initialSession.id, initialSession, initialMessages)

  async function handleSend(text: string, images?: SessionImageInput[]): Promise<void> {
    setLoading()
    await sendSessionMessage(session.id, text, images)
  }

  async function handleStop(): Promise<void> {
    await abortSession(session.id)
  }

  return (
    <SessionConversation
      session={session}
      messages={messages}
      isLoading={isLoading}
      isStreaming={isStreaming}
      streamingMessage={streamingMessage}
      pendingMessages={pendingMessages}
      errorMessage={errorMessage}
      questionRequest={questionRequest}
      onSend={handleSend}
      onStop={handleStop}
      onDismissError={clearError}
      onQuestionDone={clearQuestion}
    />
  )
}

export const Route = createFileRoute('/sessions/$sessionId/overview')({
  loader: async ({ params }) => {
    const session = await getSession(params.sessionId)
    if (!session) {
      throw notFound()
    }

    const messages = await getAgentMessages(params.sessionId)
    return { session, messages }
  },
  component: SessionOverviewRouteComponent
})
