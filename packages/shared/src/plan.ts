export type PlanToolName = 'create_plan' | 'update_plan'

export type SavedPlan = {
  title: string
  markdown: string
  summary: string | null
  updatedAt: number
  toolName: PlanToolName
}

type ToolResultLike = {
  role?: unknown
  toolName?: unknown
  details?: unknown
  timestamp?: unknown
}

export function isPlanToolName(value: unknown): value is PlanToolName {
  return value === 'create_plan' || value === 'update_plan'
}

export function normalizePlanTitle(title: unknown, markdown: string): string {
  if (typeof title === 'string' && title.trim()) return title.trim()

  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()
  if (heading) return heading

  const firstLine = markdown
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  if (firstLine) {
    return firstLine.slice(0, 80)
  }

  return 'Untitled plan'
}

export function getPlanFromToolMessage(message: ToolResultLike): SavedPlan | null {
  if (message.role !== 'toolResult' || !isPlanToolName(message.toolName)) return null

  const details = message.details
  if (!details || typeof details !== 'object' || !('plan' in details)) return null

  const plan = (details as { plan?: unknown }).plan
  if (!plan || typeof plan !== 'object') return null

  const markdown = (plan as { markdown?: unknown }).markdown
  if (typeof markdown !== 'string' || markdown.trim().length === 0) return null

  const summary = (plan as { summary?: unknown }).summary
  const updatedAt = (plan as { updatedAt?: unknown }).updatedAt

  return {
    title: normalizePlanTitle((plan as { title?: unknown }).title, markdown),
    markdown,
    summary: typeof summary === 'string' && summary.trim() ? summary.trim() : null,
    updatedAt:
      typeof updatedAt === 'number' && Number.isFinite(updatedAt)
        ? updatedAt
        : typeof message.timestamp === 'number' && Number.isFinite(message.timestamp)
          ? message.timestamp
          : Date.now(),
    toolName: message.toolName
  }
}

export function extractLatestPlan(messages: readonly ToolResultLike[]): SavedPlan | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const plan = getPlanFromToolMessage(messages[i] ?? {})
    if (plan) return plan
  }
  return null
}

export function getPlanMessageKey(plan: SavedPlan | null): string | null {
  if (!plan) return null
  return `${plan.toolName}:${plan.updatedAt}:${plan.title}`
}
