import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { QuestionAnswer, QuestionRequest } from '@/lib/sessions'
import { questionReply, questionReject } from '@/lib/sessions'
import { cn } from '@/lib/utils'

// ── QuestionDock ────────────────────────────────────────────────────

export const QuestionDock = memo(function QuestionDock({
  request,
  onDone
}: {
  request: QuestionRequest
  onDone: () => void
}): React.JSX.Element {
  const { questions } = request
  const total = questions.length
  const isSingle = total === 1 && !questions[0]?.multiple

  const [tab, setTab] = useState(0)
  const [answers, setAnswers] = useState<QuestionAnswer[]>(() => questions.map(() => []))
  const [customTexts, setCustomTexts] = useState<string[]>(() => questions.map(() => ''))
  const [editing, setEditing] = useState(false)
  const [sending, setSending] = useState(false)

  const question = questions[tab]
  const options = question?.options ?? []
  const isMulti = question?.multiple === true
  const showCustom = question?.custom !== false
  const isLast = tab >= total - 1

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleReply = useCallback(
    async (overrideAnswers?: QuestionAnswer[]): Promise<void> => {
      if (sending) return
      setSending(true)
      try {
        await questionReply(request.id, overrideAnswers ?? answers)
        onDone()
      } catch {
        setSending(false)
      }
    },
    [answers, onDone, request.id, sending]
  )

  const handleReject = useCallback(async (): Promise<void> => {
    if (sending) return
    setSending(true)
    try {
      await questionReject(request.id)
      onDone()
    } catch {
      setSending(false)
    }
  }, [onDone, request.id, sending])

  // Focus textarea when editing starts
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [editing])

  // Keyboard handling
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (sending) return

      if (e.key === 'Escape') {
        e.preventDefault()
        if (editing) {
          setEditing(false)
        } else {
          void handleReject()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editing, handleReject, sending])

  const currentAnswers = answers[tab] ?? []
  const customText = customTexts[tab] ?? ''
  const customPicked = customText.trim() !== '' && currentAnswers.includes(customText.trim())

  const setAnswerForTab = useCallback((tabIndex: number, newAnswer: QuestionAnswer) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[tabIndex] = newAnswer
      return next
    })
  }, [])

  const setCustomForTab = useCallback((tabIndex: number, text: string) => {
    setCustomTexts((prev) => {
      const next = [...prev]
      next[tabIndex] = text
      return next
    })
  }, [])

  // ── Actions ─────────────────────────────────────────────────────

  function pickSingle(label: string): void {
    const nextAnswers = [...answers]
    nextAnswers[tab] = [label]

    if (isSingle || isLast) {
      // Submit immediately with the locally-built answers array
      // (React state won't have flushed yet, so we can't read `answers`)
      setAnswers(nextAnswers)
      setSending(true)
      void questionReply(request.id, nextAnswers)
        .then(onDone)
        .catch(() => setSending(false))
      return
    }

    setAnswerForTab(tab, [label])
    setEditing(false)
    // Auto-advance to next question
    setTab((prev) => prev + 1)
  }

  function toggleMulti(label: string): void {
    const current = [...currentAnswers]
    const idx = current.indexOf(label)
    if (idx === -1) {
      current.push(label)
    } else {
      current.splice(idx, 1)
    }
    setAnswerForTab(tab, current)
  }

  function selectOption(index: number): void {
    if (sending) return

    // Custom option
    if (index === options.length) {
      setEditing(true)
      return
    }

    const opt = options[index]
    if (!opt) return

    if (isMulti) {
      toggleMulti(opt.label)
    } else {
      pickSingle(opt.label)
    }
  }

  function commitCustom(): void {
    const text = customText.trim()
    setEditing(false)

    if (!text) return

    if (isMulti) {
      if (!currentAnswers.includes(text)) {
        setAnswerForTab(tab, [...currentAnswers, text])
      }
    } else {
      pickSingle(text)
    }
  }

  function handleNext(): void {
    if (sending) return

    if (editing) {
      // Commit custom text into answers before submitting
      const text = customText.trim()
      setEditing(false)
      if (text) {
        if (isMulti) {
          if (!currentAnswers.includes(text)) {
            const updated = [...answers]
            updated[tab] = [...currentAnswers, text]
            if (isLast) {
              void handleReply(updated)
              return
            }
            setAnswers(updated)
            setTab((prev) => prev + 1)
            return
          }
        } else {
          // Single-select custom — pickSingle handles submit
          pickSingle(text)
          return
        }
      }
    }

    if (isLast) {
      void handleReply()
    } else {
      setTab((prev) => prev + 1)
      setEditing(false)
    }
  }

  function handleBack(): void {
    if (sending || tab <= 0) return
    setTab((prev) => prev - 1)
    setEditing(false)
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header with progress */}
      {total > 1 && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            {tab + 1} of {total}
          </span>
          <div className="flex flex-1 gap-1">
            {questions.map((_, i) => (
              <button
                key={i}
                type="button"
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  i === tab
                    ? 'bg-primary'
                    : (answers[i]?.length ?? 0) > 0
                      ? 'bg-primary/40'
                      : 'bg-muted-foreground/20'
                )}
                onClick={() => {
                  if (!sending) {
                    setTab(i)
                    setEditing(false)
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Question content */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-[13.5px] font-medium text-foreground">{question?.question}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isMulti ? 'Select all that apply' : 'Select one'}
        </p>
      </div>

      {/* Options */}
      <div className="px-2 pb-2">
        {options.map((opt, i) => {
          const picked = currentAnswers.includes(opt.label)
          return (
            <OptionRow
              key={`${tab}-${i}`}
              label={opt.label}
              description={opt.description}
              picked={picked}
              multi={isMulti}
              disabled={sending}
              onClick={() => selectOption(i)}
            />
          )
        })}

        {/* Custom answer option */}
        {showCustom && !editing && (
          <OptionRow
            label="Type your own answer"
            description={customText || 'Enter a custom response'}
            picked={customPicked}
            multi={isMulti}
            disabled={sending}
            onClick={() => selectOption(options.length)}
            muted
          />
        )}

        {/* Custom answer editor */}
        {showCustom && editing && (
          <div className="mx-1 mb-1 rounded-lg border border-primary/30 bg-muted/30 p-2">
            <textarea
              ref={textareaRef}
              className="w-full resize-none bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              rows={2}
              placeholder="Type your answer..."
              value={customText}
              disabled={sending}
              onChange={(e) => {
                setCustomForTab(tab, e.target.value)
                // Auto-resize
                e.target.style.height = '0px'
                e.target.style.height = `${e.target.scrollHeight}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  commitCustom()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setEditing(false)
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={sending}
          onClick={() => void handleReject()}
          className="text-muted-foreground"
        >
          <XIcon className="size-3.5" />
          Dismiss
        </Button>

        <div className="flex items-center gap-1.5">
          {total > 1 && tab > 0 && (
            <Button variant="outline" size="sm" disabled={sending} onClick={handleBack}>
              <ChevronLeftIcon className="size-3.5" />
              Back
            </Button>
          )}
          {/* Don't show Next/Submit for single-question single-select (auto-submits on pick) */}
          {!isSingle && (
            <Button
              variant={isLast ? 'default' : 'outline'}
              size="sm"
              disabled={sending}
              onClick={handleNext}
            >
              {isLast ? 'Submit' : 'Next'}
              {!isLast && <ChevronRightIcon className="size-3.5" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})

// ── OptionRow ────────────────────────────────────────────────────────

const OptionRow = memo(function OptionRow({
  label,
  description,
  picked,
  multi,
  disabled,
  onClick,
  muted
}: {
  label: string
  description: string
  picked: boolean
  multi: boolean
  disabled: boolean
  onClick: () => void
  muted?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
        'hover:bg-muted/60',
        picked && 'bg-primary/5',
        disabled && 'pointer-events-none opacity-50'
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {/* Check indicator */}
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
        {multi ? (
          <span
            className={cn(
              'flex size-3.5 items-center justify-center rounded-[3px] border transition-colors',
              picked
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground/40'
            )}
          >
            {picked && <CheckIcon className="size-2.5" />}
          </span>
        ) : (
          <span
            className={cn(
              'flex size-3.5 items-center justify-center rounded-full border transition-colors',
              picked ? 'border-primary bg-primary' : 'border-muted-foreground/40'
            )}
          >
            {picked && <span className="size-1.5 rounded-full bg-primary-foreground" />}
          </span>
        )}
      </span>

      {/* Content */}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-[13px] font-medium leading-tight',
            muted ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {label}
        </span>
        <span className="block text-xs leading-snug text-muted-foreground/70">{description}</span>
      </span>
    </button>
  )
})
