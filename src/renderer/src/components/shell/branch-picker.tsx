import { useCallback, useEffect, useState } from 'react'
import { GitBranchIcon, ChevronsUpDownIcon, PlusIcon, LoaderIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { GitBranch } from '../../../../shared/session'

export function BranchPicker({
  cwd,
  currentBranch,
  disabled,
  onBranchChanged
}: {
  cwd: string
  currentBranch: string
  disabled: boolean
  onBranchChanged: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchBranches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.git.listBranches(cwd)
      setBranches(result.filter((b) => !b.isRemote))
    } catch (err) {
      console.error('Failed to list branches:', err)
    } finally {
      setLoading(false)
    }
  }, [cwd])

  // Fetch branches when popover opens
  useEffect(() => {
    if (open) {
      setSearch('')
      setError(null)
      fetchBranches()
    }
  }, [open, fetchBranches])

  async function handleSelect(branchName: string): Promise<void> {
    if (branchName === currentBranch) {
      setOpen(false)
      return
    }
    setSwitching(true)
    setError(null)
    try {
      const result = await window.git.checkoutBranch(cwd, branchName)
      if (result.success) {
        setOpen(false)
        onBranchChanged()
      } else {
        setError(result.error || 'Failed to switch branch')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch branch')
    } finally {
      setSwitching(false)
    }
  }

  async function handleCreate(branchName: string): Promise<void> {
    setSwitching(true)
    setError(null)
    try {
      const result = await window.git.createBranch(cwd, branchName)
      if (result.success) {
        setOpen(false)
        onBranchChanged()
      } else {
        setError(result.error || 'Failed to create branch')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch')
    } finally {
      setSwitching(false)
    }
  }

  // Show "create branch" option when search doesn't match any existing branch exactly
  const trimmedSearch = search.trim()
  const exactMatch = branches.some((b) => b.name === trimmedSearch)
  const showCreate =
    trimmedSearch.length > 0 && !exactMatch && /^[^\s~^:?*[\]\\]+$/.test(trimmedSearch)

  const trigger = (
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className="no-drag shrink-0 max-w-[180px]"
        disabled={disabled}
      >
        <GitBranchIcon data-icon="inline-start" />
        <span className="truncate">{currentBranch || '...'}</span>
        <ChevronsUpDownIcon className="ml-0.5 size-3 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {disabled ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{trigger}</span>
          </TooltipTrigger>
          <TooltipContent>Commit or stash changes before switching branches</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}

      <PopoverContent className="w-72 p-0" align="end">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Search or create branch…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>No branches found.</CommandEmpty>

                {showCreate && (
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => handleCreate(trimmedSearch)}
                      disabled={switching}
                    >
                      <PlusIcon className="size-3.5 text-muted-foreground" />
                      <span className="truncate">
                        Create <span className="font-medium">{trimmedSearch}</span>
                      </span>
                    </CommandItem>
                  </CommandGroup>
                )}

                {showCreate && branches.length > 0 && <CommandSeparator />}

                {branches.length > 0 && (
                  <CommandGroup>
                    {branches.map((branch) => (
                      <CommandItem
                        key={branch.name}
                        value={branch.name}
                        onSelect={() => handleSelect(branch.name)}
                        disabled={switching}
                        data-checked={branch.isCurrent}
                      >
                        <GitBranchIcon
                          className={cn(
                            'size-3.5',
                            branch.isCurrent ? 'text-emerald-500' : 'text-muted-foreground'
                          )}
                        />
                        <span className="flex-1 truncate">{branch.name}</span>
                        {branch.lastCommitDate && (
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {branch.lastCommitDate}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>

          {/* Error display */}
          {error && (
            <div className="border-t border-border px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Loading overlay during switch */}
          {switching && (
            <div className="absolute inset-0 flex items-center justify-center bg-popover/80">
              <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
