# Contributing to pi-code

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/pi-code.git
   cd pi-code
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Run in development**:
   ```bash
   npm run dev
   ```

## Development Workflow

### Project Structure

- **`src/main/`** — Electron main process (Node.js). Manages agent sessions, git, terminal PTYs, and IPC.
- **`src/renderer/`** — React SPA bundled with Vite. Communicates with main via the preload bridge.
- **`src/preload/`** — Electron preload scripts (context bridge between main and renderer).
- **`src/shared/`** — Types and utilities shared by both processes.

### Hot Reload

- **Renderer** changes hot-reload automatically.
- **Main process** changes require restarting the dev server (`npm run dev`).

### Code Quality

Before submitting a PR, make sure your changes pass all checks:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Formatting
npm run format
```

### Coding Conventions

- **TypeScript** — All code is written in TypeScript with strict settings.
- **Explicit return types** — Function declarations should include return types.
- **Prettier** — Code is formatted with Prettier (run `npm run format`).
- **Single quotes, no semicolons** — Enforced by the Prettier config.
- **React** — Functional components with hooks. No class components.
- **Tailwind CSS** — Utility-first styling. Use `cn()` for conditional classes.

## Making Changes

### Branching

- Create a feature branch from `main`: `git checkout -b feat/my-feature`
- Use conventional prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`

### Commit Messages

Write clear, descriptive commit messages. We recommend [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add model temperature control
fix: prevent duplicate sessions on rapid navigation
docs: update README with new build instructions
```

### Pull Requests

1. Keep PRs focused — one feature or fix per PR.
2. Include a clear description of what changed and why.
3. Reference any related issues.
4. Make sure all checks pass before requesting review.

## Reporting Issues

- Use the [GitHub Issues](https://github.com/nicholasgriffintn/pi-code/issues) tab.
- Include steps to reproduce, expected behavior, and actual behavior.
- Include your OS, Node.js version, and Electron version if relevant.

## Code of Conduct

This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold respectful, inclusive behavior.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
