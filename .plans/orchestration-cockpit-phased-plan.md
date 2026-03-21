# Desktop Agent Orchestration Cockpit — Phased Implementation Plan

Codex/OpenCode-style desktop agent workspace built on Electron with Pi coding agent SDK, TanStack Router, shadcn/ui, and ai-elements.

---

## Phase 1 — App shell, styling, and routing ✅

### Goal
Replace the starter Electron screen with a real desktop workspace shell.

### Deliverables
- Tailwind CSS + shadcn/ui (preset `b21COPtsUK`) + TanStack Router
- Persistent left sidebar + center conversation + toggleable right tool panel
- ai-elements for conversation/message/prompt-input
- Route-driven session selection
- Dark mode

### Exit criteria
- App opens into a Codex-style shell
- Sidebar persists, conversation is centered, tool panel toggles

---

## Phase 2 — Session domain model and IPC ✅

### Goal
Make sessions real objects managed by the main process.

### Deliverables
- Simplified session types (no worktree/branch/collision — deferred)
- In-memory session manager in main process
- IPC handlers for CRUD
- Typed preload bridge
- Renderer loads sessions from main via IPC
- Dev seed data on startup
- Pi coding agent SDK installed

### Exit criteria
- Sessions come from main process, not hardcoded mock data
- Full typecheck passes

---

## Phase 3 — Session creation flow ✅

### Goal
Make session creation feel lightweight and native to the sidebar.

### Deliverables
- Add a `+` button to each project group in the sidebar
- Clicking `+` creates a new empty session for that project
- The new session opens immediately in the center pane
- No creation modal or upfront form
- The first user prompt becomes the session instruction
- The sidebar label is derived automatically from that first prompt
- Empty state when no sessions exist

### Exit criteria
- User can create a new empty session with one click from a project group
- The first prompt naturally initializes the session

---

## Phase 4 — Pi coding agent SDK integration ✅

### Goal
Connect sessions to the real execution engine.

### Deliverables
- PiRunner abstraction wrapping the Pi SDK's `createAgentSession`
- Use persistent Pi sessions (not in-memory) so desktop app sessions and TUI sessions are interchangeable
- Map session config → SDK inputs (cwd = repoPath, model, etc.)
- Stream events back: text deltas, tool calls, completion, errors
- Normalize SDK events into conversation messages
- Session status transitions: draft → running → completed/failed

### Exit criteria
- Starting a session runs a real Pi agent
- Conversation shows live streaming output
- Failures surface clearly

---

## Phase 5 — Project management

### Goal
Let the user add and manage multiple project directories in the sidebar.

### Deliverables
- Add “Add project” / “Open folder” action
- Use native directory picker to select a repo/folder
- Persist the list of project directories across app restarts
- List Pi sessions for each configured project directory
- Allow removing a project from the sidebar without deleting files
- Handle missing/moved directories gracefully

### Exit criteria
- User can add multiple directories as projects
- Sidebar persists those projects across restarts
- Sessions appear grouped by directory

---

## Phase 6 — Steering and session controls

### Goal
Let the user intervene while sessions run.

### Deliverables
- Send follow-up instruction (uses Pi SDK's `steer` / `followUp`)
- Pause/resume controls
- Stop with confirmation
- Session status updates in sidebar in real time

### Exit criteria
- User can steer a running session from the prompt input
- Stop/pause work reliably

---

## Phase 7 — Terminal panel

### Goal
Show live terminal output in the right tool panel.

### Deliverables
- xterm.js integration
- Terminal service in main process
- Stream shell output to renderer
- Handle resize/reconnect

### Exit criteria
- Selected session shows responsive terminal output in the right panel

---

## Phase 8 — Git and file inspection

### Goal
Expose working tree state and files in the tool panel.

### Deliverables
- Git status service (changed files, staged/unstaged, diffs)
- File explorer rooted to session repo path
- Editor integration (Monaco or CodeMirror)

### Exit criteria
- User can inspect files and git changes without leaving the app

---

## Phase 9 — Polish and desktop ergonomics

### Goal
Make the app stable and pleasant for daily use.

### Deliverables
- Command palette
- Keyboard shortcuts (create session, switch sessions, toggle panel)
- Error boundaries and recovery
- Loading/empty states
- Process cleanup on quit
- Performance under multiple concurrent sessions

### Exit criteria
- App is dependable for real parallel session usage

---

## Future phases (deferred)

### Worktree and branch management
- Worktree path and branch fields on sessions
- Collision detection (same worktree blocking, same branch warning)
- Branch mismatch and dirty state detection

### Persistence
- Additional app-specific persistence beyond Pi-native sessions if needed

### Browser panel
- Embedded or external browser workflow for previewing apps

### Multi-provider configuration
- Model picker with provider auth management

---

## Milestone grouping

### Milestone A — Foundation ✅
- Phase 1 + Phase 2

### Milestone B — Real execution ✅
- Phase 3 + Phase 4

### Milestone C — Multi-project workspace
- Phase 5 + Phase 6

### Milestone D — Deep workspace tools
- Phase 7 + Phase 8

### Milestone E — Desktop polish
- Phase 9
