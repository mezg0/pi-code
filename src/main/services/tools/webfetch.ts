import type { ToolDefinition } from '@mariozechner/pi-coding-agent'
import { Type } from '@sinclair/typebox'

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024
const MAX_OUTPUT_CHARS = 100_000
const DEFAULT_TIMEOUT_SECONDS = 30
const MAX_TIMEOUT_SECONDS = 120

const WEBFETCH_PARAMS = Type.Object({
  url: Type.String({
    description: 'The URL to fetch content from. Must start with http:// or https://.'
  }),
  format: Type.Optional(
    Type.Unsafe<'markdown' | 'text' | 'html'>({
      type: 'string',
      enum: ['markdown', 'text', 'html'],
      description: 'The format to return: markdown (default), text, or html.'
    })
  ),
  timeout: Type.Optional(
    Type.Number({
      description: 'Optional timeout in seconds. Maximum 120 seconds.'
    })
  )
})

type WebFetchDetails = {
  url: string
  finalUrl: string
  format: 'markdown' | 'text' | 'html'
  mimeType: string
  bytes: number
  truncated: boolean
  status: number
}

export const webFetchTool: ToolDefinition<typeof WEBFETCH_PARAMS, WebFetchDetails> = {
  name: 'webfetch',
  label: 'Web Fetch',
  description:
    'Fetch content from a specific URL. Use this for retrieving live documentation or reading a known web page.',
  promptSnippet: 'Fetch content from a URL in markdown, text, or html format.',
  promptGuidelines: [
    'Use this tool when the user asks about a specific URL or when live documentation needs to be fetched.',
    'Prefer local file tools like read for repository files, and use webfetch only for network resources.'
  ],
  parameters: WEBFETCH_PARAMS,
  async execute(_toolCallId, params, signal) {
    const url = normalizeUrl(params.url)
    const format = (params.format ?? 'markdown') as 'markdown' | 'text' | 'html'
    const timeoutSeconds = clampTimeoutSeconds(params.timeout)
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutSeconds * 1000)
    const fetchSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal

    try {
      const headers = buildHeaders(format)
      const initialResponse = await fetch(url, { signal: fetchSignal, headers })
      const response =
        initialResponse.status === 403 &&
        initialResponse.headers.get('cf-mitigated') === 'challenge'
          ? await fetch(url, {
              signal: fetchSignal,
              headers: { ...headers, 'User-Agent': 'pi-code' }
            })
          : initialResponse

      if (!response.ok) {
        throw new Error(`Request failed with status code ${response.status}`)
      }

      const contentLengthHeader = response.headers.get('content-length')
      if (contentLengthHeader && Number.parseInt(contentLengthHeader, 10) > MAX_RESPONSE_SIZE) {
        throw new Error('Response too large (exceeds 5MB limit)')
      }

      const buffer = await response.arrayBuffer()
      if (buffer.byteLength > MAX_RESPONSE_SIZE) {
        throw new Error('Response too large (exceeds 5MB limit)')
      }

      const contentType = response.headers.get('content-type') ?? ''
      const mimeType = normalizeMimeType(contentType)
      const finalUrl = response.url || url

      if (isBinaryImageMime(mimeType)) {
        return {
          content: [
            { type: 'text', text: `Fetched image from ${finalUrl}` },
            {
              type: 'image',
              data: Buffer.from(buffer).toString('base64'),
              mimeType
            }
          ],
          details: {
            url,
            finalUrl,
            format,
            mimeType,
            bytes: buffer.byteLength,
            truncated: false,
            status: response.status
          }
        }
      }

      if (!isTextLikeMime(mimeType)) {
        throw new Error(`Unsupported content type: ${mimeType || 'unknown'}`)
      }

      const raw = new TextDecoder().decode(buffer)
      const transformed = transformContent(raw, mimeType, format)
      const { text, truncated } = truncateOutput(transformed)

      return {
        content: [{ type: 'text', text }],
        details: {
          url,
          finalUrl,
          format,
          mimeType,
          bytes: buffer.byteLength,
          truncated,
          status: response.status
        }
      }
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Web fetch aborted')
      }

      if (timeoutController.signal.aborted) {
        throw new Error(`Request timed out after ${timeoutSeconds} seconds`)
      }

      throw new Error(error instanceof Error ? error.message : 'Web fetch failed')
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

function clampTimeoutSeconds(timeout?: number): number {
  if (typeof timeout !== 'number' || Number.isNaN(timeout) || timeout <= 0) {
    return DEFAULT_TIMEOUT_SECONDS
  }
  return Math.min(Math.max(timeout, 1), MAX_TIMEOUT_SECONDS)
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    throw new Error('URL must start with http:// or https://')
  }

  try {
    return new URL(trimmed).toString()
  } catch {
    throw new Error('Invalid URL')
  }
}

function buildHeaders(format: 'markdown' | 'text' | 'html'): Record<string, string> {
  const accept =
    format === 'markdown'
      ? 'text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1'
      : format === 'text'
        ? 'text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, application/json;q=0.7, */*;q=0.1'
        : 'text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1'

  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    Accept: accept,
    'Accept-Language': 'en-US,en;q=0.9'
  }
}

function normalizeMimeType(contentType: string): string {
  return contentType.split(';')[0]?.trim().toLowerCase() ?? ''
}

function isBinaryImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/') && mimeType !== 'image/svg+xml'
}

function isTextLikeMime(mimeType: string): boolean {
  if (!mimeType) return true
  if (mimeType.startsWith('text/')) return true

  return new Set([
    'application/json',
    'application/ld+json',
    'application/xml',
    'application/xhtml+xml',
    'application/javascript',
    'application/x-javascript',
    'image/svg+xml'
  ]).has(mimeType)
}

function transformContent(
  raw: string,
  mimeType: string,
  format: 'markdown' | 'text' | 'html'
): string {
  if (!mimeType.includes('html') && mimeType !== 'application/xhtml+xml') {
    return raw
  }

  if (format === 'html') return raw
  if (format === 'text') return htmlToText(raw)
  return htmlToMarkdown(raw)
}

function truncateOutput(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_OUTPUT_CHARS) {
    return { text, truncated: false }
  }

  const suffix = `\n\n[truncated to ${MAX_OUTPUT_CHARS.toLocaleString()} characters]`
  return {
    text: `${text.slice(0, MAX_OUTPUT_CHARS)}${suffix}`,
    truncated: true
  }
}

function htmlToText(html: string): string {
  const sanitized = stripNonContentHtml(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|header|footer|aside|main|li|tr|h[1-6])>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')

  return normalizeWhitespace(decodeHtmlEntities(sanitized))
}

function htmlToMarkdown(html: string): string {
  let output = stripNonContentHtml(html)

  output = output.replace(/<pre\b[^>]*><code\b[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
    return `\n\n\`\`\`\n${decodeHtmlEntities(code).trim()}\n\`\`\`\n\n`
  })

  output = output.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, code) => {
    return `\`${decodeHtmlEntities(code).trim()}\``
  })

  for (let level = 6; level >= 1; level -= 1) {
    const pattern = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi')
    output = output.replace(pattern, (_, text) => {
      return `\n\n${'#'.repeat(level)} ${normalizeInlineText(text)}\n\n`
    })
  }

  output = output.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => {
      const label = normalizeInlineText(text) || href
      return `[${label}](${decodeHtmlEntities(href)})`
    }
  )

  output = output.replace(
    /<img\b[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi,
    (_, alt, src) => {
      return `![${decodeHtmlEntities(alt)}](${decodeHtmlEntities(src)})`
    }
  )

  output = output
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/(strong|b)>/gi, (_, _open, text) => {
      return `**${normalizeInlineText(text)}**`
    })
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/(em|i)>/gi, (_, _open, text) => {
      return `*${normalizeInlineText(text)}*`
    })
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, text) => {
      const lines = normalizeWhitespace(decodeHtmlEntities(text))
        .split('\n')
        .filter(Boolean)
        .map((line) => `> ${line}`)
      return `\n\n${lines.join('\n')}\n\n`
    })
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, text) => {
      return `- ${normalizeInlineText(text)}\n`
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|header|footer|aside|main|ul|ol|table|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')

  return normalizeMarkdown(decodeHtmlEntities(output))
}

function stripNonContentHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, ' ')
}

function normalizeInlineText(text: string): string {
  return decodeHtmlEntities(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n+ */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeMarkdown(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[\t\f\v ]+\n/g, '\n')
    .replace(/\n[\t\f\v ]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function decodeHtmlEntities(text: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
  }

  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase()

    if (lower in namedEntities) {
      return namedEntities[lower]
    }

    if (lower.startsWith('#x')) {
      const codePoint = Number.parseInt(lower.slice(2), 16)
      return codePointToString(codePoint, match)
    }

    if (lower.startsWith('#')) {
      const codePoint = Number.parseInt(lower.slice(1), 10)
      return codePointToString(codePoint, match)
    }

    return match
  })
}

function codePointToString(codePoint: number, fallback: string): string {
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return fallback
  }

  try {
    return String.fromCodePoint(codePoint)
  } catch {
    return fallback
  }
}
