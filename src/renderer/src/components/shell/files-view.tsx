import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  SaveIcon,
  XIcon
} from 'lucide-react'
import Editor, { loader, type Monaco } from '@monaco-editor/react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { SHORTCUTS } from '@/lib/shortcuts'
import * as monaco from 'monaco-editor'

// Use the local bundled Monaco instead of loading from CDN
loader.config({ monaco })

function defineAppTheme(m: Monaco): void {
  m.editor.defineTheme('pi-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {}
  })
}

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { FileEntry } from '@pi-code/shared/session'

// ─── Language detection ─────────────────────────────────────────────────────

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    jsonc: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    mdx: 'markdown',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'ini',
    xml: 'xml',
    svg: 'xml',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    vue: 'html',
    svelte: 'html',
    astro: 'html',
    env: 'ini',
    gitignore: 'ini',
    lock: 'json'
  }
  return map[ext] || 'plaintext'
}

// ─── File tree node ─────────────────────────────────────────────────────────

function FileTreeNode({
  entry,
  cwd,
  depth,
  selectedPath,
  onSelect,
  refreshKey
}: {
  entry: FileEntry
  cwd: string
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
  refreshKey: number
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[] | null>(null)
  const [, setLoading] = useState(false)

  // Re-fetch children when the directory is expanded and refreshKey changes
  useEffect(() => {
    if (expanded && entry.type === 'directory') {
      window.files.list(cwd, entry.path).then(setChildren).catch(console.error)
    }
  }, [refreshKey, expanded, cwd, entry.path, entry.type])

  async function handleToggle(): Promise<void> {
    if (entry.type === 'file') {
      onSelect(entry.path)
      return
    }

    const next = !expanded
    setExpanded(next)
    if (next && children === null) {
      setLoading(true)
      try {
        const result = await window.files.list(cwd, entry.path)
        setChildren(result)
      } catch (err) {
        console.error('Failed to list directory:', err)
      } finally {
        setLoading(false)
      }
    }
  }

  const isSelected = entry.type === 'file' && entry.path === selectedPath
  const isDir = entry.type === 'directory'

  return (
    <div>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-1 py-0.5 pr-2 text-left text-xs transition-colors hover:bg-muted/50',
          isSelected && 'bg-muted text-foreground'
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        onClick={handleToggle}
      >
        {isDir ? (
          <ChevronRightIcon
            className={cn(
              'size-3 shrink-0 text-muted-foreground transition-transform',
              expanded && 'rotate-90'
            )}
          />
        ) : (
          <span className="size-3 shrink-0" />
        )}
        {isDir ? (
          expanded ? (
            <FolderOpenIcon className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 truncate">{entry.name}</span>
      </button>
      {expanded && children && (
        <div>
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              cwd={cwd}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              refreshKey={refreshKey}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Open file tab ──────────────────────────────────────────────────────────

type OpenFile = {
  path: string
  content: string
  originalContent: string
  language: string
}

// ─── Main files view ────────────────────────────────────────────────────────

export function FilesView({ cwd }: { cwd: string }): React.JSX.Element {
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([])
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const activeFile = openFiles.find((f) => f.path === activeFilePath) ?? null

  // Load root directory
  useEffect(() => {
    window.files.list(cwd).then(setRootEntries).catch(console.error)
  }, [cwd, refreshKey])

  // Watch for external file changes
  useEffect(() => {
    window.files.watch(cwd).catch(console.error)

    const unsubscribe = window.files.onChanged((payload) => {
      if (payload.cwd !== cwd) return

      // Bump refreshKey to re-fetch root + expanded directories
      setRefreshKey((k) => k + 1)

      // Refresh any open files that were modified externally
      const changedSet = new Set(payload.paths)
      setOpenFiles((prev) =>
        prev.map((file) => {
          if (changedSet.has(file.path)) {
            // Re-read the file content in background
            window.files
              .read(cwd, file.path)
              .then((newContent) => {
                setOpenFiles((current) =>
                  current.map((f) =>
                    f.path === file.path && f.content === f.originalContent
                      ? { ...f, content: newContent, originalContent: newContent }
                      : f.path === file.path
                        ? { ...f, originalContent: newContent }
                        : f
                  )
                )
              })
              .catch(() => {
                // File may have been deleted — remove from open files
                setOpenFiles((current) => current.filter((f) => f.path !== file.path))
              })
          }
          return file
        })
      )
    })

    return () => {
      unsubscribe()
      window.files.unwatch(cwd).catch(console.error)
    }
  }, [cwd])

  const handleSelectFile = useCallback(
    async (path: string) => {
      // Already open — just switch to it
      const existing = openFiles.find((f) => f.path === path)
      if (existing) {
        setActiveFilePath(path)
        return
      }

      // Open new file
      try {
        const content = await window.files.read(cwd, path)
        const language = getLanguage(path.split('/').pop() ?? '')
        setOpenFiles((prev) => [...prev, { path, content, originalContent: content, language }])
        setActiveFilePath(path)
      } catch (err) {
        console.error('Failed to read file:', err)
      }
    },
    [cwd, openFiles]
  )

  function handleCloseFile(path: string): void {
    setOpenFiles((prev) => prev.filter((f) => f.path !== path))
    if (activeFilePath === path) {
      setActiveFilePath(() => {
        const remaining = openFiles.filter((f) => f.path !== path)
        return remaining.length > 0 ? remaining[remaining.length - 1].path : null
      })
    }
  }

  function handleContentChange(value: string | undefined): void {
    if (!activeFilePath || value === undefined) return
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === activeFilePath ? { ...f, content: value } : f))
    )
  }

  async function handleSave(): Promise<void> {
    if (!activeFile) return
    try {
      await window.files.write(cwd, activeFile.path, activeFile.content)
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === activeFile.path ? { ...f, originalContent: f.content } : f))
      )
    } catch (err) {
      console.error('Failed to save file:', err)
    }
  }

  // Cmd/Ctrl+S to save (managed by centralized shortcut system)
  useHotkey(SHORTCUTS['save-file'].keys, handleSave)

  const isDirty = activeFile ? activeFile.content !== activeFile.originalContent : false

  return (
    <div className="flex h-full min-w-0 overflow-hidden">
      {/* File tree */}
      <div className="flex w-48 shrink-0 flex-col border-r border-border">
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
          {rootEntries.map((entry) => (
            <FileTreeNode
              key={entry.path}
              entry={entry}
              cwd={cwd}
              depth={0}
              selectedPath={activeFilePath}
              onSelect={handleSelectFile}
              refreshKey={refreshKey}
            />
          ))}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Tab bar */}
        {openFiles.length > 0 && (
          <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-b border-border bg-background">
            {openFiles.map((file) => {
              const fileName = file.path.split('/').pop()!
              const isActive = file.path === activeFilePath
              const isModified = file.content !== file.originalContent

              return (
                <div
                  key={file.path}
                  className={cn(
                    'group flex shrink-0 items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs transition-colors',
                    isActive
                      ? 'bg-background text-foreground'
                      : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 truncate"
                    onClick={() => setActiveFilePath(file.path)}
                  >
                    {fileName}
                    {isModified && <span className="ml-0.5 text-primary">●</span>}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    onClick={() => handleCloseFile(file.path)}
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>
              )
            })}

            {/* Save button */}
            {isDirty && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="ml-auto mr-1 shrink-0"
                    onClick={handleSave}
                  >
                    <SaveIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save (⌘S)</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {/* Monaco editor */}
        {activeFile ? (
          <div className="min-w-0 flex-1">
            <Editor
              key={activeFile.path}
              defaultValue={activeFile.content}
              language={activeFile.language}
              theme="pi-dark"
              onChange={handleContentChange}
              beforeMount={defineAppTheme}
              onMount={(editor) => {
                editorRef.current = editor
              }}
              options={{
                fontSize: 13,
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                renderLineHighlight: 'line',
                padding: { top: 8 },
                wordWrap: 'off',
                tabSize: 2,
                automaticLayout: true,
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
                scrollbar: {
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8
                }
              }}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  )
}
