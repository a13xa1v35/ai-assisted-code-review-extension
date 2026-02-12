# AI-assisted Code Review

A VS Code extension that renders AI-generated semantic PR reviews. An AI coding agent analyzes your git diff, groups changes by logical concern, and the extension displays them in a sidebar with native diff viewing.

## How It Works

Two decoupled parts:

1. **Skill prompt** (`skill/code-review.md`) — a coding agent (Claude Code, Cursor, etc.) runs this to analyze a git diff and write structured JSON to `./code-review.json`
2. **VS Code extension** — watches for that JSON file, renders groups in a sidebar, and opens native diff editors when clicked

They communicate only via the JSON file. The extension is pure UI; the agent is pure analysis.

## Usage

1. Open a project in VS Code with this extension installed
2. Run the review skill from your coding agent (e.g. `/review` in Claude Code)
3. The agent writes `code-review.json` to your workspace root
4. The sidebar populates with grouped changes — click a group to open diffs

## Features

- **Semantic grouping** — changes grouped by feature/behavior, not by file
- **Flags** — potential issues (security, complexity, bug risk) surfaced with severity levels
- **Native diffs** — opens VS Code's built-in diff editor for each file in a group
- **Sidebar UI** — collapsible groups with summaries and file lists

## Build

```bash
pnpm install
pnpm run compile
```

Press F5 in VS Code to launch the Extension Development Host for testing.
