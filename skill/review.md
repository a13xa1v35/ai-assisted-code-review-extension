# Semantic PR Review

Analyze a git diff and output a structured review.

## Instructions

1. Determine the diff range (see Diff Range below)
2. Run the diff and analyze the changes, grouping by logical concern, not by file
3. Output JSON to `./human-review.json`

## Diff Range

Default: review the **last commit** plus any uncommitted changes (`git diff HEAD~1`).

If the user specifies a different range (e.g. "vs main", "last 3 commits", a specific SHA), use that instead.

## Grouping Principles

- Group by feature/behavior, not alphabetically by file
- A single file can appear in multiple groups if it has unrelated changes
- Separate refactoring (renames, formatting) from behavioral changes
- Order groups by importance: core logic first, tests/types after, noise last

## Titles

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
  "groups": [
    {
      "title": "<short descriptive title>",
      "summary": "<1-2 sentence explanation>",
      "files": ["<relative file path>", "<another file path>"]
    }
  ],
  "flags": [
    {
      "severity": "warning|error|info",
      "title": "<short title>",
      "summary": "<1-2 sentence explanation>",
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
6. Group changes by logical concern
7. Flag any potential issues
8. Write the JSON to `./human-review.json`
