# pi-code

<img width="1894" height="1306" alt="Screenshot 2026-03-24 at 09 38 25" src="https://github.com/user-attachments/assets/0d56fa5e-797a-4c5d-93a1-fd3e320da25f" />

> [!WARNING]
> This project is in a very early stage of development. Expect rough edges, breaking changes, and incomplete features. Use at your own risk and please report any issues you encounter — contributions and feedback are welcome!

A desktop coding assistant powered by [pi](https://github.com/badlogic/pi-mono). Built with Electron, React, and TypeScript.

pi-code wraps the pi coding agent in a native desktop app with a full-featured UI — chat conversations, file browsing, git integration, an embedded terminal, plan mode, and more. Think of it as a GUI shell for pi that lets you interact with AI coding agents without leaving your editor-like environment.

![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

## Features

- **AI Chat** — Conversational coding sessions powered by the pi coding agent SDK
- **Multi-session** — Run multiple independent conversations across different projects
- **File Browser** — Browse and view project files alongside your conversation
- **Git Integration** — View diffs, stage changes, and commit directly from the app
- **Embedded Terminal** — Full terminal access via xterm.js without leaving the app
- **Plan Mode** — Toggle between implementation and planning modes for more deliberate workflows
- **API Key & OAuth Management** — Configure API keys or sign in with OAuth (Anthropic, OpenAI Codex, GitHub Copilot, Google) directly from Settings
- **Model Selection** — Switch between available AI models and thinking levels on the fly
- **Web Fetch** — Fetch and reference live documentation from URLs during conversations
- **Skills** — Load specialized skills for domain-specific tasks (shadcn, animations, design, etc.)
- **Browser Preview** — Embedded browser view for previewing web apps
- **Cross-platform** — Runs on macOS, Windows, and Linux

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Shell | [Electron](https://www.electronjs.org/) · [electron-vite](https://electron-vite.org/) |
| Frontend | [React 19](https://react.dev/) · [TanStack Router](https://tanstack.com/router) · [Tailwind CSS 4](https://tailwindcss.com/) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) · [Radix UI](https://www.radix-ui.com/) · [cmdk](https://cmdk.paco.me/) |
| Code & Terminal | [Monaco Editor](https://microsoft.github.io/monaco-editor/) · [Shiki](https://shiki.style/) · [xterm.js](https://xtermjs.org/) |
| AI Agent | [@mariozechner/pi-coding-agent](https://github.com/badlogic/pi-mono) · [Vercel AI SDK](https://sdk.vercel.ai/) |
| Animations | [Motion](https://motion.dev/) |

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **API keys or OAuth login** for at least one supported AI provider — configure these in the app's **Settings** page, or set environment variables (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)

## Getting Started

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run dev
```

This starts the Electron app in dev mode with hot-reload for the renderer process.

### Build for production

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

Built artifacts are output to the `dist/` directory.

## Project Structure

```
src/
├── main/                  # Electron main process
│   ├── index.ts           # App entry point, window creation, IPC registration
│   ├── ipc/               # IPC handlers (auth, sessions, terminal, git, files, browser)
│   └── services/          # Core services
│       ├── auth.ts         # API key and OAuth credential management
│       ├── pi-runner.ts   # Agent session lifecycle and streaming
│       ├── session-manager.ts  # Session persistence
│       ├── git.ts         # Git operations
│       ├── terminal.ts    # PTY terminal management
│       ├── browser.ts     # Embedded browser management
│       ├── projects.ts    # Project discovery and management
│       ├── extensions/    # Pi extensions (plan-mode, load-skill)
│       └── tools/         # Custom tools (webfetch)
├── preload/               # Electron preload scripts (context bridge)
├── renderer/              # React frontend
│   └── src/
│       ├── components/
│       │   ├── ai-elements/   # Chat UI components (messages, prompt input, etc.)
│       │   ├── shell/         # App shell (sidebar, file browser, git, terminal, etc.)
│       │   └── ui/            # Base UI components (shadcn)
│       ├── lib/           # Client-side utilities and state
│       ├── hooks/         # React hooks
│       └── routes/        # TanStack Router file-based routes
├── shared/                # Types and utilities shared between main and renderer
└── components/            # Shared component source (shimmer, etc.)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the app in development mode |
| `npm run build` | Typecheck and build all processes |
| `npm run build:mac` | Build distributable for macOS |
| `npm run build:win` | Build distributable for Windows |
| `npm run build:linux` | Build distributable for Linux |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a branch** for your feature or fix: `git checkout -b my-feature`
3. **Install dependencies**: `npm install`
4. **Run the app**: `npm run dev`
5. **Make your changes** — the renderer hot-reloads, but main process changes require a restart
6. **Typecheck**: `npm run typecheck`
7. **Lint**: `npm run lint`
8. **Submit a pull request**

### Development Notes

- **Main process** (`src/main/`) runs in Node.js and manages agent sessions, git, terminal PTYs, and IPC communication with the renderer.
- **Renderer process** (`src/renderer/`) is a React SPA bundled with Vite. It communicates with the main process exclusively through the preload bridge.
- **Shared types** live in `src/shared/` and are imported by both processes.
- The app embeds the pi coding agent SDK — agent sessions, model selection, streaming, and tool execution all happen in the main process and are streamed to the renderer over IPC.
- Hot-reload works for the renderer. For main process changes, restart the dev server.

## License

[MIT](./LICENSE)
