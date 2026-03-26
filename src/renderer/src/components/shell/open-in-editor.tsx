import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDownIcon, CheckIcon, FolderOpenIcon, CodeIcon } from 'lucide-react'
import { useHotkey } from '@tanstack/react-hotkeys'

import { Button } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuShortcut
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getShortcutDisplay, SHORTCUTS } from '@/lib/shortcuts'
import { getAvailableEditors, getNativeCapabilities, openInEditor } from '@/lib/native'
import type { EditorId } from '@pi-code/shared/editor'
import { EDITORS } from '@pi-code/shared/editor'

// ── localStorage preference ──────────────────────────────────────────

const PREFERRED_EDITOR_KEY = 'pi-code:preferred-editor'

function loadPreferredEditor(): EditorId | null {
  try {
    const stored = localStorage.getItem(PREFERRED_EDITOR_KEY)
    if (stored && EDITORS.some((e) => e.id === stored)) return stored as EditorId
  } catch {
    // ignore
  }
  return null
}

function savePreferredEditor(editorId: EditorId): void {
  try {
    localStorage.setItem(PREFERRED_EDITOR_KEY, editorId)
  } catch {
    // ignore
  }
}

// ── Editor icons ─────────────────────────────────────────────────────

function CursorIcon(props: React.SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 8h8v8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 8L8 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function VSCodeIcon(props: React.SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M17 3l4 1.5v15L17 21l-10-8 -3.5 2.75V8.25L7 11 17 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ZedIcon(props: React.SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M5 7h14L5 17h14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const EDITOR_ICONS: Record<EditorId, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  cursor: CursorIcon,
  vscode: VSCodeIcon,
  zed: ZedIcon,
  'file-manager': FolderOpenIcon
}

function fileManagerLabel(): string {
  if (typeof navigator !== 'undefined') {
    if (navigator.platform?.startsWith('Mac') || navigator.userAgent?.includes('Mac'))
      return 'Finder'
    if (navigator.platform?.startsWith('Win') || navigator.userAgent?.includes('Win'))
      return 'Explorer'
  }
  return 'Files'
}

// ── Component ────────────────────────────────────────────────────────

type EditorOption = {
  id: EditorId
  label: string
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

export function OpenInEditor({ cwd }: { cwd: string | undefined }): React.JSX.Element | null {
  const [availableEditors, setAvailableEditors] = useState<EditorId[]>([])
  const [preferredEditor, setPreferredEditorState] = useState<EditorId | null>(loadPreferredEditor)

  const native = getNativeCapabilities()

  // Fetch available editors once on mount
  useEffect(() => {
    if (!native.canOpenInEditor) return
    void getAvailableEditors().then((editors) => {
      setAvailableEditors(editors)
    })
  }, [native.canOpenInEditor])

  const setPreferredEditor = useCallback((editorId: EditorId) => {
    setPreferredEditorState(editorId)
    savePreferredEditor(editorId)
  }, [])

  // Resolve the effective preferred editor (fallback to first available)
  const effectiveEditor = useMemo(() => {
    if (preferredEditor && availableEditors.includes(preferredEditor)) return preferredEditor
    return availableEditors[0] ?? null
  }, [preferredEditor, availableEditors])

  const options: EditorOption[] = useMemo(() => {
    return availableEditors.map((id) => {
      const def = EDITORS.find((e) => e.id === id)!
      return {
        id,
        label: id === 'file-manager' ? fileManagerLabel() : def.label,
        Icon: EDITOR_ICONS[id]
      }
    })
  }, [availableEditors])

  const primaryOption = options.find((o) => o.id === effectiveEditor) ?? null

  const openEditor = useCallback(
    (editorId: EditorId | null) => {
      const editor = editorId ?? effectiveEditor
      if (!editor || !cwd) return
      void openInEditor(cwd, editor).catch((err) => {
        console.error('Failed to open in editor:', err)
      })
      setPreferredEditor(editor)
    },
    [effectiveEditor, cwd, setPreferredEditor]
  )

  // Keyboard shortcut
  useHotkey(
    SHORTCUTS['open-in-editor'].keys,
    useCallback(() => openEditor(null), [openEditor]),
    { enabled: Boolean(cwd && effectiveEditor) }
  )

  // Don't render if native editor access is unavailable, no editors are available, or no cwd
  if (!native.canOpenInEditor || !cwd || availableEditors.length === 0) return null

  return (
    <ButtonGroup>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="no-drag shrink-0"
            onClick={() => openEditor(null)}
          >
            {primaryOption ? (
              <primaryOption.Icon className="size-3.5" data-icon="inline-start" />
            ) : (
              <CodeIcon data-icon="inline-start" />
            )}
            Open
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Open in {primaryOption?.label ?? 'editor'}{' '}
          <kbd className="ml-1.5 inline-flex font-sans text-[11px] opacity-60">
            {getShortcutDisplay('open-in-editor')}
          </kbd>
        </TooltipContent>
      </Tooltip>
      {options.length > 1 && (
        <>
          <ButtonGroupSeparator />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="no-drag shrink-0"
                aria-label="Choose editor"
              >
                <ChevronDownIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {options.map(({ id, label, Icon }) => (
                <DropdownMenuItem key={id} onClick={() => openEditor(id)}>
                  <Icon className="size-4 text-muted-foreground" />
                  {label}
                  {id === effectiveEditor && (
                    <DropdownMenuShortcut>
                      <CheckIcon className="size-3.5" />
                    </DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </ButtonGroup>
  )
}
