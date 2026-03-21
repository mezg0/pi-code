# Desktop Agent Orchestration Cockpit — Revised Build Plan

## Product framing

This app is a **Codex/OpenCode desktop-style** session-first control plane for running multiple coding-agent sessions in parallel.

The user is the operator.
The system does not autonomously claim work.
The UI is optimized for launching sessions, monitoring active runs, jumping into a selected session, steering/pausing/stopping, and inspecting output.

## What it is

A personal Electron app where you explicitly create and control multiple agent sessions in parallel across multiple project directories.

## What it is not

- Not autonomous task claiming
- Not a generic AI chat UI
- Not a team PM product

---

## Core product goals

- Run multiple agent sessions concurrently
- Support multiple project directories in one cockpit
- Give tight operator control: create, start, stop, pause, steer, inspect
- Surface logs, state, progress, and terminal output clearly
- Use the **Pi coding agent SDK** as the execution engine
- Reuse **Pi-native persistent sessions** so desktop and TUI sessions are interchangeable
- Use **TanStack Router** for routing
- Use **shadcn/ui** as the component foundation
- Use **ai-elements** for conversation/message UI

### Deferred for now

- Worktree/branch management and collision safety
- All sessions work from the project directory's current local branch for simplicity

---

## UX direction

### Core metaphor

A **session-centric IDE shell** — like the Codex desktop app.

### Layout

- **Left sidebar:** projects (directories) with sessions grouped underneath
- **Center:** session conversation (always visible when a session is selected)
- **Right panel:** toggleable tool panel (terminal, files, git, browser) via resizable split
- **Bottom of center:** prompt input for steering

### Principles

- Session-first navigation
- Desktop-dense, not mobile-responsive
- Fast switching between sessions
- Operational clarity for status
- Keyboard-friendly

---

## Technical architecture

### Electron main process

- Window lifecycle
- Project directory management and persistence
- Session orchestration on top of Pi-native sessions
- Pi SDK integration
- IPC API for projects and sessions
- Terminal/git/file access (later phases)

### Preload layer

- Typed bridge between renderer and main
- Project commands via `window.api.projects.*`
- Session commands via `window.api.sessions.*`

### Renderer

- Shell and layout
- TanStack Router
- Project list, session list, and conversation view
- shadcn/ui + ai-elements components

---

## Frontend stack

### Required

- React, TanStack Router, shadcn/ui, Tailwind CSS, ai-elements

### Recommended

- Zustand for ephemeral UI state
- xterm.js for terminal (Phase 7)
- Monaco/CodeMirror for file editing (Phase 8)

---

## Domain model

### Project

```ts
type Project = {
  id: string
  name: string
  repoPath: string
}
```

### Session

```ts
type Session = {
  id: string
  title: string
  repoPath: string
  taskInstruction: string
  agent: string
  model: string
  status: SessionStatus
  createdAt: string
  updatedAt: string
}
```

### Session creation

```ts
type CreateSessionInput = {
  title: string
  repoPath: string
  taskInstruction: string
  agent: string
  model: string
}
```

### Status lifecycle

`draft → queued → starting → running → awaiting_input → paused → stopping → stopped → completed → failed`

---

## IPC contract

### Renderer → main

- `projects:list`
- `projects:add`
- `projects:remove`
- `sessions:list`
- `sessions:get`
- `sessions:create`
- `sessions:update`
- `sessions:delete`

### Main → renderer

- Session status change events
- Streaming conversation updates
- Streaming log/terminal data
- Project list updates

---

## Key features by phase

### Phase 1 — Shell ✅
TanStack Router + shadcn/ui + Tailwind + desktop layout

### Phase 2 — Session model ✅
Domain types + main-process session manager + IPC + renderer wiring

### Phase 3 — Session creation UI ✅
Sidebar-first empty session creation from a project group; first prompt initializes title/instruction

### Phase 4 — Pi SDK integration ✅
PiRunner abstraction, persistent Pi-native sessions, real agent execution, streaming events

### Phase 5 — Project management
Add/open directories, persist project list, load Pi sessions per directory, remove from sidebar

### Phase 6 — Steering controls
Send instruction, pause/resume, stop

### Phase 7 — Observability
Terminal panel (xterm.js)

### Phase 8 — Workspace inspection
Git inspection, file explorer, editor

### Phase 9 — Polish
Keyboard shortcuts, command palette, error states, performance

---

## Deferred features

These will be added when the basic flow is solid:

- Worktree management and branch selection
- Collision detection (same worktree/branch overlap)
- Additional app-specific persistence beyond Pi-native session storage
- Browser panel integration
- Multiple model provider configuration

---

## Definition of done for v1

- User can add multiple project directories
- User can create multiple sessions per directory
- Sessions run concurrently via Pi SDK
- Desktop sessions map to persistent Pi-native sessions
- Selected session shows conversation with streaming output
- User can steer, pause, and stop sessions
- Tool panel shows terminal/files/git alongside conversation
- App feels like a desktop agent workspace, not a chat UI
