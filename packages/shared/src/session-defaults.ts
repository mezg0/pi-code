export const DEFAULT_AGENT = 'Pi'
export const DEFAULT_MODEL = 'gpt-5'
export const NEW_SESSION_TITLE = 'New session'

export function deriveSessionTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) return NEW_SESSION_TITLE
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed
}
