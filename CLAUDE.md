# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A VS Code extension ("AI-assisted Code Review") that renders AI-generated semantic PR reviews. Two decoupled parts:

1. **Skill prompt** (`skill/code-review.md`) — a coding agent (Claude Code, Cursor, etc.) runs this to analyze a git diff and write structured JSON to `./code-review.json`
2. **VS Code extension** (`src/`) — watches for that JSON file, renders groups in a sidebar, and opens native diff editors when clicked

They communicate only via the JSON file. The extension is pure UI; the agent is pure analysis.

## Build Commands

```bash
pnpm run compile     # TypeScript → out/
pnpm run watch       # compile in watch mode
pnpm run lint        # ESLint
pnpm run test        # run tests (requires VS Code test electron)
```

To test the extension: press F5 in VS Code to launch the Extension Development Host.

## Architecture

### Extension entry (`src/extension.ts`)

- `GitContentProvider` — custom `TextDocumentContentProvider` for the `code-review-git:` URI scheme. Resolves file content at a git ref via `git show "<ref>:<path>"`.
- `activate()` — registers the git provider, sidebar webview, commands (`codeReview.open`, `codeReview.openGroup`), and a file watcher for `**/code-review.json`.

### Sidebar (`src/sidebar.ts`)

- `ReviewSidebarProvider` — webview that renders the review groups, flags, and moved code sections.
- Uses `vscode.setState()`/`vscode.getState()` in the webview JS to persist review data across view hide/show cycles.
- Sends a `"ready"` message on webview load so the provider can re-send data.
- `openGroup()` opens **all files** in a group as separate diff tabs via `vscode.diff`.

### Types (`src/types.ts`)

- `Review` — top-level: `meta`, `groups`, `moved?`, `flags?`
- `Group` — `title`, `summary?`, `files: string[]` (just paths, no hunks)
- Groups are identified by `title` (no separate id field).

### Review JSON contract

The agent writes `./code-review.json` at the workspace root. The extension watches for it via `FileSystemWatcher`. Schema is defined in `src/types.ts` and mirrored in `skill/code-review.md`.

## Key Patterns

- Diff viewing uses a custom URI scheme (`code-review-git:`) registered as a `TextDocumentContentProvider`, not temp files.
- The webview sidebar communicates with the extension via `postMessage`/`onDidReceiveMessage` with message types: `openGroup`, `openFlag`, `selectFile`, `ready`.
