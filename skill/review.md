# Semantic PR Review

Analyze a git diff and output a structured review.

## Instructions

1. Determine the diff range (see Diff Range below)
2. Run the diff and analyze the changes
3. Write the PR explanation (see Explanation below)
4. Group changes by logical concern, ordered for review (see Grouping below)
5. Flag potential issues
6. Output JSON to `./human-review.json`

## Diff Range

Default: review the **last commit** plus any uncommitted changes (`git diff HEAD~1`).

If the user specifies a different range (e.g. "vs main", "last 3 commits", a specific SHA), use that instead.

## Explanation

Write an explanation of the changes for the human reviewer. This is the first thing they read — it opens automatically in the main editor pane. The explanation is rendered as markdown.

- Use plain, simple English — write like you're explaining to a colleague over chat
- Start with what the PR does, then cover the "why" and any non-obvious decisions
- Call out anything the reviewer should pay special attention to
- Don't repeat the group titles — the explanation gives the big picture, groups give the details
- Use markdown formatting: headings, bullet points, code spans (`likethis`) for readability
- **Be didactic when the PR is non-trivial** — help the reviewer understand the domain, the pattern, or the architectural decision. Explain *why* things work the way they do, not just *what* changed. For trivial PRs (typos, version bumps), keep it brief

## Grouping

### Principles

- Group by feature/behavior, not by file
- A single file can appear in multiple groups if it has unrelated changes
- Separate refactoring (renames, formatting) from behavioral changes

### Order

Order groups so the reviewer builds understanding as they go:

1. **Core logic changes** — the heart of the PR, what actually changes behavior
2. **Supporting changes** — types, helpers, config that enable the core change
3. **Tests** — verification of the above
4. **Cleanup / refactoring** — renames, formatting, removals with no behavior change

If a group is trivial (e.g. a single formatting fix), put it last so the reviewer can skip it.

### Titles

- Bad: "Changes to user.ts"
- Good: "Add rate limiting to user registration"

## Flags

Flag potential issues (security, complexity, bug risk, etc). Each flag should have a short title and a 1-2 sentence summary explaining the concern and why it matters.

## Output Schema

Write valid JSON to `./human-review.json`:

```json
{
  "meta": {
    "base": "<base-ref-sha>",
    "head": "<current-HEAD-sha>"
  },
  "explanation": "<PR explanation for the reviewer>",
  "groups": [
    {
      "title": "<short descriptive title>",
      "summary": "<1-2 sentence explanation, use `backticks` for code references>",
      "files": ["<relative file path>", "<another file path>"]
    }
  ],
  "flags": [
    {
      "severity": "warning|error|info",
      "title": "<short title>",
      "summary": "<1-2 sentence explanation, use `backticks` for code references>",
      "file": "<path>",
      "line": <number>
    }
  ]
}
```

## Steps

1. Resolve the base: `git rev-parse HEAD~1`
2. Get the current HEAD: `git rev-parse HEAD`
3. Get the diff: `git diff HEAD~1` (includes uncommitted changes)
4. Tell the user what you're reviewing: the commit subject and number of files changed
5. Parse the diff to understand what changed
6. Write the explanation
7. Group changes by logical concern, in review order
8. Flag any potential issues
9. Write the JSON to `./human-review.json`
