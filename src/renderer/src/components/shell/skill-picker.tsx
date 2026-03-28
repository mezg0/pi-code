import { useEffect, useMemo, useRef } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { SparklesIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SkillInfo } from '@/lib/sessions'

export type SkillPickerProps = {
  open: boolean
  skills: SkillInfo[]
  query: string
  onSelect: (skill: SkillInfo) => void
  onClose: () => void
}

export function SkillPicker({
  open,
  skills,
  query,
  onSelect,
  onClose,
}: SkillPickerProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const filteredSkills = useMemo(() => {
    if (!query) return skills
    const lowerQuery = query.toLowerCase()
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery)
    )
  }, [skills, query])

  // Close on Escape
  useEffect(() => {
    if (!open) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="absolute inset-x-0 bottom-full z-50 mb-1.5 px-0">
      <div
        ref={listRef}
        className={cn(
          'w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg',
          'animate-in fade-in-0 slide-in-from-bottom-2 duration-150'
        )}
      >
        <Command className="w-full" shouldFilter={false}>
          <CommandList className="max-h-60 overflow-y-auto">
            {filteredSkills.length === 0 ? (
              <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                No skills found.
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredSkills.map((skill) => (
                  <CommandItem
                    key={skill.name}
                    value={skill.name}
                    onSelect={() => onSelect(skill)}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                  >
                    <SparklesIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="text-sm font-medium">{skill.name}</span>
                      {skill.description && (
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {skill.description}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-[10px] capitalize tracking-wide text-muted-foreground'
                      )}
                    >
                      {skill.source === 'personal' ? 'Personal' : 'Project'}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </div>
    </div>
  )
}
