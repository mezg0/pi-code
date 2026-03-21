# Desktop Agent Orchestration Cockpit — Build Checklist

## Phase 1 — App shell, styling, and routing ✅

- [x] Install Tailwind CSS
- [x] Initialize shadcn/ui with preset `b21COPtsUK`
- [x] Install TanStack Router
- [x] Install ai-elements (conversation, message, prompt-input, tool, task)
- [x] Add base app providers (TooltipProvider)
- [x] Replace starter renderer with routed shell
- [x] Build persistent left sidebar with session list grouped by repo
- [x] Build center conversation area with ai-elements
- [x] Build toggleable right tool panel with resizable split
- [x] Build prompt input at bottom of conversation
- [x] Route-driven session selection
- [x] Dark mode via html class

## Phase 2 — Session domain model and IPC ✅

- [x] Define simplified `Session` types (no worktree/branch — deferred)
- [x] Create in-memory session manager in main
- [x] Create IPC handlers for session CRUD
- [x] Create typed preload bridge
- [x] Create renderer-side session API (`lib/sessions.ts`)
- [x] Wire shell to load sessions from main process via IPC
- [x] Dev seed data on startup
- [x] Install Pi coding agent SDK as dependency

## Phase 3 — Session creation flow ✅

- [x] Add per-project `+` button in sidebar group header
- [x] Create empty session scoped to that project
- [x] Open the new empty session immediately
- [x] Use first prompt as the session instruction
- [x] Derive sidebar label from first prompt
- [x] Keep creation flow modal-free
- [x] Empty state when no sessions exist

## Phase 4 — Pi coding agent SDK integration ✅

- [x] Create PiRunner abstraction
- [x] Map session config to `createAgentSession` options
- [x] Stream text deltas to conversation
- [x] Stream tool call events
- [x] Handle completion/failure states
- [x] Session status transitions (draft → running → awaiting_input/failed)
- [x] Clean up resources on stop/delete and app quit
- [x] Use persistent Pi-native sessions so TUI and desktop sessions align

## Phase 5 — Project management

- [ ] Add “Add project” / “Open folder” action
- [ ] Open native directory picker from Electron main
- [ ] Persist project directories across app restarts
- [ ] Load Pi sessions for each configured project directory
- [ ] Remove a project from the sidebar without deleting files
- [ ] Gracefully handle missing or moved directories

## Phase 6 — Steering and session controls

- [ ] Send follow-up instruction via prompt input
- [ ] Pause/resume controls
- [ ] Stop with confirmation
- [ ] Real-time status updates in sidebar

## Phase 7 — Terminal panel

- [ ] Integrate xterm.js
- [ ] Create terminal service in main
- [ ] Stream terminal data to renderer
- [ ] Handle resize/reconnect

## Phase 8 — Git and file inspection

- [ ] Git status service
- [ ] Changed files list
- [ ] Diff preview
- [ ] File explorer rooted to repo path
- [ ] Editor integration

## Phase 9 — Polish and desktop ergonomics

- [ ] Command palette
- [ ] Keyboard shortcuts
- [ ] Error boundaries
- [ ] Loading/empty states
- [ ] Process cleanup on quit
- [ ] Multi-session performance

## Deferred

- [ ] Worktree/branch management
- [ ] Collision detection
- [ ] Additional app-specific persistence beyond Pi-native sessions
- [ ] Browser panel
- [ ] Multi-provider model configuration
