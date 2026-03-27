import { motion } from 'motion/react'
import { GithubIcon, GitBranchIcon, ArrowRightIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type ActionType = 'commit-pr'

export type CommitPrMetadata = {
  title: string
  branch: string
  draft?: boolean
}

type ActionCardProps = {
  type: ActionType
  metadata: Record<string, unknown>
  className?: string
}

function CommitPrCard({
  metadata,
  className
}: {
  metadata: CommitPrMetadata
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-2 px-4 py-3', className)}>
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <GithubIcon className="size-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium text-foreground">Commit & Create PR</span>
        {metadata.draft && (
          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
            Draft
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1.5 pl-[38px]">
        <span className="font-mono text-[13px] leading-snug text-muted-foreground">
          {metadata.title}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
          <GitBranchIcon className="size-3" />
          <span className="font-mono">{metadata.branch}</span>
          <ArrowRightIcon className="size-3" />
          <span className="font-mono">main</span>
        </div>
      </div>
    </div>
  )
}

export function ActionCard({ type, metadata, className }: ActionCardProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      className={cn(
        'w-full overflow-hidden rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm',
        className
      )}
    >
      {type === 'commit-pr' && <CommitPrCard metadata={metadata as unknown as CommitPrMetadata} />}
    </motion.div>
  )
}
