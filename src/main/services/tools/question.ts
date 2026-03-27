import { BrowserWindow } from 'electron'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'
import { publishServerEvent } from '@pi-code/server/event-bus'
import { Type } from '@sinclair/typebox'
import type { QuestionAnswer, QuestionRequest } from '@pi-code/shared/session'

// ── Tool description (matches opencode's question.txt style) ────────

const DESCRIPTION = `Use this tool when you need to ask the user questions during execution. This allows you to:
1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices as you work
4. Offer choices to the user about what direction to take.

Usage notes:
- When \`custom\` is enabled (default), a "Type your own answer" option is added automatically; don't include "Other" or catch-all options
- Answers are returned as arrays of labels; set \`multiple: true\` to allow selecting more than one
- If you recommend a specific option, make that the first option in the list and add "(Recommended)" at the end of the label`

// ── TypeBox schema ──────────────────────────────────────────────────

const QUESTION_OPTION = Type.Object({
  label: Type.String({ description: 'Display text (1-5 words, concise)' }),
  description: Type.String({ description: 'Explanation of choice' })
})

const QUESTION_INFO = Type.Object({
  question: Type.String({ description: 'Complete question' }),
  header: Type.String({ description: 'Very short label (max 30 chars)' }),
  options: Type.Array(QUESTION_OPTION, { description: 'Available choices' }),
  multiple: Type.Optional(Type.Boolean({ description: 'Allow selecting multiple choices' }))
})

const QUESTION_PARAMS = Type.Object({
  questions: Type.Array(QUESTION_INFO, { description: 'Questions to ask' })
})

// ── Pending question state ──────────────────────────────────────────

type PendingQuestion = {
  sessionId: string
  request: QuestionRequest
  resolve: (answers: QuestionAnswer[]) => void
  reject: (error: Error) => void
}

const pending = new Map<string, PendingQuestion>()
// Alias for getPendingQuestion to reference the same map
const pendingRequests = pending
let nextId = 1

function generateRequestId(): string {
  return `q_${Date.now()}_${nextId++}`
}

function emitToRenderers(channel: string, payload: unknown): void {
  publishServerEvent(channel, payload)

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

// ── Public API for IPC handlers ─────────────────────────────────────

export function replyToQuestion(requestId: string, answers: QuestionAnswer[]): boolean {
  const entry = pending.get(requestId)
  if (!entry) return false
  pending.delete(requestId)

  // Emit null to clear the question UI
  emitToRenderers('sessions:question', { sessionId: entry.sessionId, request: null })

  entry.resolve(answers)
  return true
}

export function rejectQuestion(requestId: string): boolean {
  const entry = pending.get(requestId)
  if (!entry) return false
  pending.delete(requestId)

  // Emit null to clear the question UI
  emitToRenderers('sessions:question', { sessionId: entry.sessionId, request: null })

  entry.reject(new Error('The user dismissed this question'))
  return true
}

/**
 * Get the pending question request for a given session, if any.
 * Used when the renderer navigates back to a session to recover question UI.
 */
export function getPendingQuestion(sessionId: string): QuestionRequest | null {
  for (const [, entry] of pendingRequests) {
    if (entry.sessionId === sessionId) {
      return entry.request
    }
  }
  return null
}

/**
 * Reject all pending questions for a given session.
 * Called when a session is aborted or disposed.
 */
export function rejectAllQuestionsForSession(sessionId: string): void {
  for (const [requestId, entry] of pending) {
    if (entry.sessionId === sessionId) {
      pending.delete(requestId)
      emitToRenderers('sessions:question', { sessionId, request: null })
      entry.reject(new Error('Session was aborted'))
    }
  }
}

// ── Tool definition ─────────────────────────────────────────────────

type QuestionDetails = {
  questions: Array<{ question: string; header: string }>
  answers: QuestionAnswer[]
}

export const askUserQuestionTool: ToolDefinition<typeof QUESTION_PARAMS, QuestionDetails> = {
  name: 'ask_user_question',
  label: 'Question',
  description: DESCRIPTION,
  promptSnippet: 'Ask the user questions during execution.',
  promptGuidelines: [
    'Use this tool when you need user input to make a decision or clarify requirements.',
    'Do not use this tool for simple yes/no confirmations that can be inferred from context.'
  ],
  parameters: QUESTION_PARAMS,
  async execute(toolCallId, params, signal) {
    if (!params.questions.length) {
      throw new Error('At least one question is required.')
    }

    const requestId = generateRequestId()
    const sessionId = takeQuestionToolCallSession(toolCallId)

    if (!sessionId) {
      throw new Error('Question tool lost its session context. Please retry.')
    }

    const request: QuestionRequest = {
      id: requestId,
      sessionId,
      questions: params.questions.map((q) => ({
        question: q.question,
        header: q.header,
        options: q.options.map((o) => ({ label: o.label, description: o.description })),
        multiple: q.multiple,
        custom: true // Always enable custom answers
      }))
    }

    const answers = await new Promise<QuestionAnswer[]>((resolve, reject) => {
      pending.set(requestId, { sessionId, request, resolve, reject })

      // Emit to renderer to show question UI
      emitToRenderers('sessions:question', { sessionId, request })

      // If the tool call is aborted, reject the pending question
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            if (pending.has(requestId)) {
              pending.delete(requestId)
              emitToRenderers('sessions:question', { sessionId, request: null })
              reject(new Error('Question was aborted'))
            }
          },
          { once: true }
        )
      }
    })

    function formatAnswer(answer: QuestionAnswer | undefined): string {
      if (!answer?.length) return 'Unanswered'
      return answer.join(', ')
    }

    const formatted = params.questions
      .map((q, i) => `"${q.question}"="${formatAnswer(answers[i])}"`)
      .join(', ')

    return {
      content: [
        {
          type: 'text',
          text: `User has answered your questions: ${formatted}. You can now continue with the user's answers in mind.`
        }
      ],
      details: {
        questions: params.questions.map((q) => ({
          question: q.question,
          header: q.header
        })),
        answers
      }
    }
  }
}

// ── Tool-call session context ───────────────────────────────────────

const toolCallSessions = new Map<string, string>()

export function registerQuestionToolCallSession(toolCallId: string, sessionId: string): void {
  toolCallSessions.set(toolCallId, sessionId)
}

function takeQuestionToolCallSession(toolCallId: string): string | null {
  const sessionId = toolCallSessions.get(toolCallId) ?? null
  toolCallSessions.delete(toolCallId)
  return sessionId
}
