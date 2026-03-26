/**
 * Extract a clean, user-facing message from an agent error.
 * Strips file paths and stack traces, keeping only the actionable part.
 */
export function formatUserFacingError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)

  // "No API key found for <provider>.\n\nUse /login or set an API key..."
  // Keep the first sentence and rewrite the action for the desktop app.
  const apiKeyMatch = raw.match(/No API key found for (\w+)/)
  if (apiKeyMatch) {
    return `No API key found for ${apiKeyMatch[1]}. Open Settings to add your API key.`
  }

  // Generic: return the first line, capped at a reasonable length.
  const firstLine = raw.split('\n')[0].trim()
  return firstLine.length > 200 ? firstLine.slice(0, 200) + '…' : firstLine
}
