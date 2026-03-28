import { SparklesIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SkillChipProps = {
  name: string
  className?: string
  variant?: 'input' | 'message'
  onRemove?: () => void
}

export function SkillChip({ name, className, variant = 'input', onRemove }: SkillChipProps) {
  const isMessage = variant === 'message'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-medium',
        'bg-secondary text-secondary-foreground select-none',
        isMessage ? 'bg-muted text-muted-foreground' : '',
        className
      )}
      contentEditable={false}
      data-skill-chip={name}
    >
      <SparklesIcon className="size-3.5 shrink-0 opacity-70" />
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded p-0.5 hover:bg-secondary-foreground/10 focus:outline-none"
          tabIndex={-1}
        >
          <span className="sr-only">Remove {name}</span>
          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  )
}
