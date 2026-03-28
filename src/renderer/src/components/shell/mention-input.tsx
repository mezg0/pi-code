import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export type SerializedInput = {
  text: string
  skills: string[]
}

export type MentionInputHandle = {
  insertSkill: (skillName: string) => void
  focus: () => void
}

export type MentionInputProps = {
  value: SerializedInput
  onChange: (value: SerializedInput) => void
  onTrigger: (trigger: { type: '/' | '$'; query: string; position: number }) => void
  onTriggerClose: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Serialize contentEditable to plain text (extracting skill chip data attributes).
 */
function serializeContent(element: HTMLElement): SerializedInput {
  const skills: string[] = []
  let text = ''

  function walk(node: Node, isFirst: boolean): void {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ''
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const skillName = el.dataset.skillChip

      if (skillName) {
        if (!skills.includes(skillName)) skills.push(skillName)
      } else if (el.tagName === 'BR') {
        text += '\n'
      } else if (el.tagName === 'DIV' || el.tagName === 'P') {
        if (!isFirst) text += '\n'
        for (let i = 0; i < el.childNodes.length; i++) {
          walk(el.childNodes[i]!, true)
        }
      } else {
        for (let i = 0; i < el.childNodes.length; i++) {
          walk(el.childNodes[i]!, isFirst && i === 0)
        }
      }
    }
  }

  for (let i = 0; i < element.childNodes.length; i++) {
    walk(element.childNodes[i]!, i === 0)
  }

  return { text: text.replace(/^\n+|\n+$/g, ''), skills }
}

/**
 * Get the plain text content before the cursor.
 */
function getTextBeforeCursor(element: HTMLElement): string {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return ''

  const range = sel.getRangeAt(0)
  const preRange = document.createRange()
  preRange.selectNodeContents(element)
  preRange.setEnd(range.startContainer, range.startOffset)

  const fragment = preRange.cloneContents()
  const tmp = document.createElement('div')
  tmp.appendChild(fragment)

  // Simple text extraction from the fragment
  let text = ''
  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ''
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el.dataset.skillChip) {
        // Skip skill chips for trigger detection purposes
        return
      }
      if ((el.tagName === 'DIV' || el.tagName === 'P') && text.length > 0) {
        text += '\n'
      }
      for (const child of el.childNodes) {
        walk(child)
      }
    }
  }
  for (const child of tmp.childNodes) {
    walk(child)
  }

  return text
}

/**
 * Detect a / or $ trigger in text before cursor.
 */
function findTrigger(textBeforeCursor: string): { type: '/' | '$'; query: string; position: number } | null {
  // "/" at the very start of content (possibly after newlines from contentEditable divs)
  const trimmedStart = textBeforeCursor.replace(/^\n+/, '')
  if (trimmedStart.startsWith('/')) {
    const query = trimmedStart.slice(1)
    if (!query.includes(' ') && !query.includes('\n')) {
      return { type: '/', query, position: 0 }
    }
  }

  // "$" anywhere: scan backwards from end looking for $<letters>
  for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
    const ch = textBeforeCursor[i]!
    if (ch === '$') {
      const query = textBeforeCursor.slice(i + 1)
      // Only trigger if immediately followed by at least one letter
      if (query.length > 0 && /^[a-zA-Z]/.test(query) && !/\s/.test(query)) {
        // Don't trigger if $ is preceded by an alphanumeric (e.g. mid-variable)
        const before = i > 0 ? textBeforeCursor[i - 1] : undefined
        if (!before || !/[a-zA-Z0-9]/.test(before)) {
          return { type: '$', query, position: i }
        }
      }
      break
    }
    if (!/[a-zA-Z0-9]/.test(ch)) break
  }

  return null
}

/**
 * Build the chip HTML string for a skill name.
 */
function chipHtml(name: string): string {
  return `<span data-skill-chip="${name}" contenteditable="false" class="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground select-none mx-0.5 px-1.5 py-0.5 text-sm font-medium align-baseline" style="user-select:none"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 opacity-70"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>${name}</span>`
}

export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  function MentionInput(
    { value, onChange, onTrigger, onTriggerClose, placeholder, disabled, className },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null)
    const [isComposing, setIsComposing] = useState(false)
    const lastTriggerRef = useRef<{ type: '/' | '$'; query: string; position: number } | null>(null)
    // Guard to prevent the sync effect from overwriting user-typed content
    const internalChangeRef = useRef(false)

    const isEmpty = !value.text && value.skills.length === 0

    // Sync external value → editor, but only when the change came from outside
    useEffect(() => {
      if (internalChangeRef.current) {
        internalChangeRef.current = false
        return
      }
      const editor = editorRef.current
      if (!editor) return

      // Only overwrite if the content actually diverged
      const current = serializeContent(editor)
      if (current.text === value.text && current.skills.length === value.skills.length) return

      if (!value.text && value.skills.length === 0) {
        editor.innerHTML = ''
      }
    }, [value])

    const emitChange = useCallback(() => {
      const editor = editorRef.current
      if (!editor) return

      const serialized = serializeContent(editor)
      internalChangeRef.current = true
      onChange(serialized)
    }, [onChange])

    const checkTrigger = useCallback(() => {
      const editor = editorRef.current
      if (!editor) return

      const before = getTextBeforeCursor(editor)
      const trigger = findTrigger(before)

      console.log('[mention-input] checkTrigger', { before, trigger })

      if (trigger) {
        lastTriggerRef.current = trigger
        onTrigger(trigger)
      } else {
        lastTriggerRef.current = null
        onTriggerClose()
      }
    }, [onTrigger, onTriggerClose])

    const handleInput = useCallback(() => {
      emitChange()
      checkTrigger()
    }, [emitChange, checkTrigger])

    const insertSkill = useCallback((skillName: string) => {
      const editor = editorRef.current
      if (!editor) return

      const trigger = lastTriggerRef.current

      // We need to remove the trigger text (e.g. "/poli" or "$poli") and replace with chip
      if (trigger) {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return

        // Strategy: get the full text, find the trigger range, then rebuild
        // Simpler approach: use document.execCommand to delete backwards then insert HTML
        const cursorRange = sel.getRangeAt(0)

        // Calculate how many chars to delete: trigger char + query length
        const deleteCount = trigger.query.length + 1 // +1 for / or $

        // Select the trigger text by moving backwards
        const preRange = document.createRange()
        preRange.setStart(cursorRange.startContainer, Math.max(0, cursorRange.startOffset - deleteCount))
        preRange.setEnd(cursorRange.startContainer, cursorRange.startOffset)

        // This works for simple cases where the trigger is in a single text node
        sel.removeAllRanges()
        sel.addRange(preRange)

        // Delete the selected trigger text and insert chip
        document.execCommand('delete', false)
        document.execCommand('insertHTML', false, chipHtml(skillName) + '\u00A0')
      } else {
        // No trigger, just insert at cursor
        document.execCommand('insertHTML', false, chipHtml(skillName) + '\u00A0')
      }

      lastTriggerRef.current = null
      onTriggerClose()
      emitChange()
      editor.focus()
    }, [emitChange, onTriggerClose])

    useImperativeHandle(ref, () => ({
      insertSkill,
      focus: () => editorRef.current?.focus(),
    }))

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (disabled || isComposing) return

        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          const form = editorRef.current?.closest('form')
          const submitBtn = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null
          if (submitBtn && !submitBtn.disabled) {
            form?.requestSubmit()
          }
          return
        }

        // Backspace: remove skill chip if cursor is right after one
        if (e.key === 'Backspace') {
          const sel = window.getSelection()
          if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return

          const range = sel.getRangeAt(0)
          const { startContainer, startOffset } = range

          // Case 1: cursor is at offset 0 of a text node, and previous sibling is a chip
          if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
            const prev = startContainer.previousSibling
            if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).dataset.skillChip) {
              e.preventDefault()
              prev.parentNode?.removeChild(prev)
              emitChange()
              return
            }
          }

          // Case 2: cursor is inside an element node (e.g. a <div>), offset points right after a chip
          if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
            const prev = startContainer.childNodes[startOffset - 1]
            if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).dataset.skillChip) {
              e.preventDefault()
              prev.parentNode?.removeChild(prev)
              emitChange()
              return
            }
          }
        }
      },
      [disabled, isComposing, emitChange]
    )

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      document.execCommand('insertText', false, text)
    }, [])

    return (
      <div className="relative w-full">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => {
            setIsComposing(false)
            handleInput()
          }}
          className={cn(
            'field-sizing-content min-h-14 max-h-48 w-full cursor-text overflow-y-auto px-3 py-2.5 text-sm',
            'focus:outline-none',
            disabled && 'cursor-not-allowed opacity-50',
            className
          )}
          role="textbox"
          aria-multiline="true"
          data-slot="input-group-control"
          suppressContentEditableWarning
        />
        {/* Hidden input so PromptInput's form can capture the value */}
        <input
          type="hidden"
          name="message"
          value={
            value.skills.map((s) => `<!--skill:${s}-->`).join('') + value.text
          }
        />
        {isEmpty && placeholder && (
          <div
            className="pointer-events-none absolute inset-0 flex items-start px-3 py-2.5 text-sm text-muted-foreground"
            aria-hidden
          >
            {placeholder}
          </div>
        )}
      </div>
    )
  }
)

export { serializeContent }
