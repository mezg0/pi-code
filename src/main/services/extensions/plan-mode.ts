import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { Type } from '@sinclair/typebox'

import { extractLatestPlan, normalizePlanTitle, type SavedPlan } from '../../../shared/plan'

type PlanModeStateEntry = {
  type?: string
  customType?: string
  data?: {
    enabled?: boolean
  }
}

type MessageEntry = {
  type?: string
  message?: {
    role?: unknown
    toolName?: unknown
    details?: unknown
    timestamp?: unknown
  }
}

const NORMAL_TOOLS = [
  'read',
  'bash',
  'edit',
  'write',
  'webfetch',
  'load_skill',
  'get_plan',
  'update_plan',
  'create_plan'
]
const PLAN_MODE_TOOLS = [
  'read',
  'bash',
  'grep',
  'find',
  'ls',
  'webfetch',
  'load_skill',
  'get_plan',
  'create_plan',
  'update_plan'
]

const PLAN_SCHEMA = Type.Object({
  title: Type.Optional(
    Type.String({ description: 'Optional short title for the plan shown in the right panel.' })
  ),
  summary: Type.Optional(
    Type.String({ description: 'Optional short summary shown above the markdown plan.' })
  ),
  markdown: Type.String({
    description:
      'The full markdown plan to publish to the app right panel. This can be freeform markdown with headings, lists, checklists, code fences, and notes.'
  })
})

const BLOCKED_BASH_PATTERNS = [
  /\brm\b/i,
  /\brmdir\b/i,
  /\bmv\b/i,
  /\bcp\b/i,
  /\bmkdir\b/i,
  /\btouch\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bln\b/i,
  /(^|[^<])>(?!>)/,
  />>/,
  /\bnpm\s+(install|uninstall|update|ci|publish)/i,
  /\byarn\s+(add|remove|install|publish)/i,
  /\bpnpm\s+(add|remove|install|publish)/i,
  /\bpip\s+(install|uninstall)/i,
  /\bapt(-get)?\s+(install|remove|purge|update|upgrade)/i,
  /\bbrew\s+(install|uninstall|upgrade)/i,
  /\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone)/i,
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bkill\b/i,
  /\bpkill\b/i,
  /\bkillall\b/i,
  /\breboot\b/i,
  /\bshutdown\b/i,
  /\bsystemctl\s+(start|stop|restart|enable|disable)/i,
  /\bservice\s+\S+\s+(start|stop|restart)/i,
  /\b(vim?|nano|emacs|code|subl)\b/i
]

function isSafePlanModeCommand(command: string): boolean {
  return !BLOCKED_BASH_PATTERNS.some((pattern) => pattern.test(command))
}

function getPublishedPlan(entries: readonly MessageEntry[]): SavedPlan | null {
  const messages = entries
    .filter((entry) => entry.type === 'message' && entry.message)
    .map((entry) => entry.message ?? {})

  return extractLatestPlan(messages)
}

function buildPlanModeContext(plan: SavedPlan | null): string {
  const existingPlanSection = plan
    ? `## Existing published plan\n- There is already a published plan in the Plan panel titled "${plan.title}".\n- If you refine or revise it, use update_plan with the full revised markdown.\n- Do not create a second plan unless the user clearly wants a separate alternative plan.\n`
    : `## Plan publishing\n- Use create_plan when you are publishing the first plan for this task.\n- If you later revise that published plan, use update_plan with the full revised markdown.\n`

  return `[PLAN MODE ACTIVE]\nYou are in plan mode. Your job is to investigate the codebase and produce a concrete implementation plan without making changes.\n\n## Constraints\n- Use read-only tools only.\n- Do not edit files, write files, install packages, commit changes, or run destructive shell commands.\n- Do not execute the implementation.\n\n## Workflow\n- Inspect relevant code before planning.\n- If the task is ambiguous or missing key decisions, ask concise clarifying questions first.\n- If the user only wants a small factual answer, answer directly without forcing a plan tool call.\n- If the task is clear enough and would benefit from a plan, publish one.\n\n${existingPlanSection}\n## Plan quality bar\nPlans should be specific, concrete, and grounded in the code you inspected. When useful, include:\n- goal\n- findings\n- proposed approach\n- implementation steps\n- likely files or systems affected\n- risks or tradeoffs\n- validation strategy\n- open questions\n\nAvoid generic or boilerplate plans. If something is uncertain, say so clearly.\n\n## Response style\n- Put the full detailed plan in the tool call's markdown field.\n- Do not dump the full plan into the chat response unless the user explicitly asks for it there.\n- After publishing a plan, respond briefly in chat with a short summary and mention that the detailed plan is available in the Plan panel.`
}

export type PlanModeController = {
  set(enabled: boolean): void
  get(): boolean
}

// Module-level registry so the runner can toggle plan mode for a session.
// Keyed by session file path (available in both the extension and runner).
const controllersBySessionFile = new Map<string, PlanModeController>()

export function getPlanModeController(sessionFile: string): PlanModeController | undefined {
  return controllersBySessionFile.get(sessionFile)
}

export default function planModeExtension(pi: ExtensionAPI): void {
  let planModeEnabled = false
  let registeredSessionFile: string | null = null

  function syncActiveTools(): void {
    pi.setActiveTools(planModeEnabled ? PLAN_MODE_TOOLS : NORMAL_TOOLS)
  }

  function persistState(): void {
    pi.appendEntry('plan-mode-state', { enabled: planModeEnabled })
  }

  function setPlanMode(enabled: boolean): void {
    planModeEnabled = enabled
    syncActiveTools()
    persistState()
  }

  pi.registerTool({
    name: 'get_plan',
    label: 'Get Plan',
    description: 'Read the latest markdown plan published to the app Plan panel.',
    promptSnippet: 'Read the currently published markdown plan from the app Plan panel.',
    promptGuidelines: [
      'Use this tool when the user refers to the current plan or asks you to implement the published plan.',
      'Use this tool before implementation if you need the latest plan details from the Plan panel.'
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const plan = getPublishedPlan(ctx.sessionManager.getEntries() as MessageEntry[])
      if (!plan) {
        return {
          content: [{ type: 'text', text: 'No published plan exists yet.' }],
          details: { plan: null }
        }
      }

      const summaryLine = plan.summary ? `Summary: ${plan.summary}\n\n` : ''
      return {
        content: [
          {
            type: 'text',
            text: `Title: ${plan.title}\nUpdated: ${new Date(plan.updatedAt).toISOString()}\n\n${summaryLine}${plan.markdown}`
          }
        ],
        details: { plan }
      }
    }
  })

  pi.registerTool({
    name: 'create_plan',
    label: 'Create Plan',
    description: 'Publish a markdown plan to the app right-side Plan panel.',
    promptSnippet: 'Publish a freeform markdown plan to the app Plan panel.',
    promptGuidelines: [
      'Use this tool in plan mode when you have a plan the user should review in the app Plan panel.',
      'Put the full plan in the markdown field instead of dumping the entire plan into the chat response.'
    ],
    parameters: PLAN_SCHEMA,
    async execute(_toolCallId, params) {
      const markdown = params.markdown.trim()
      if (!markdown) throw new Error('Plan markdown cannot be empty.')

      return {
        content: [{ type: 'text', text: 'Plan created in the app Plan panel.' }],
        details: {
          plan: {
            title: normalizePlanTitle(params.title, markdown),
            markdown,
            summary: params.summary?.trim() || null,
            updatedAt: Date.now()
          }
        }
      }
    }
  })

  pi.registerTool({
    name: 'update_plan',
    label: 'Update Plan',
    description: 'Replace the markdown plan shown in the app right-side Plan panel.',
    promptSnippet: 'Update the existing freeform markdown plan shown in the app Plan panel.',
    promptGuidelines: [
      'Use this tool to revise a previously published plan in the app Plan panel.',
      'Send the full revised markdown, not a patch.'
    ],
    parameters: PLAN_SCHEMA,
    async execute(_toolCallId, params) {
      const markdown = params.markdown.trim()
      if (!markdown) throw new Error('Plan markdown cannot be empty.')

      return {
        content: [{ type: 'text', text: 'Plan updated in the app Plan panel.' }],
        details: {
          plan: {
            title: normalizePlanTitle(params.title, markdown),
            markdown,
            summary: params.summary?.trim() || null,
            updatedAt: Date.now()
          }
        }
      }
    }
  })

  pi.on('before_agent_start', async (_event, ctx) => {
    if (!planModeEnabled) return

    const publishedPlan = getPublishedPlan(ctx.sessionManager.getEntries() as MessageEntry[])

    return {
      message: {
        customType: 'plan-mode-context',
        display: false,
        content: buildPlanModeContext(publishedPlan)
      }
    }
  })

  pi.on('tool_call', async (event) => {
    if (!planModeEnabled || event.toolName !== 'bash') return

    const command = (event.input as { command?: unknown }).command
    if (typeof command !== 'string' || isSafePlanModeCommand(command)) return

    return {
      block: true,
      reason:
        'Plan mode only allows read-only shell commands. Turn plan mode off with /plan off before making changes.'
    }
  })

  pi.on('session_start', async (_event, ctx) => {
    const sessionFile = ctx.sessionManager.getSessionFile?.() ?? null
    registeredSessionFile = sessionFile

    const lastState = ctx.sessionManager
      .getEntries()
      .filter(
        (entry) =>
          entry.type === 'custom' &&
          (entry as { customType?: string }).customType === 'plan-mode-state'
      )
      .pop() as PlanModeStateEntry | undefined

    planModeEnabled = lastState?.data?.enabled ?? false
    syncActiveTools()

    if (sessionFile) {
      controllersBySessionFile.set(sessionFile, {
        set: setPlanMode,
        get: () => planModeEnabled
      })
    }
  })

  pi.on('session_shutdown', async () => {
    if (registeredSessionFile) {
      controllersBySessionFile.delete(registeredSessionFile)
      registeredSessionFile = null
    }
  })
}
