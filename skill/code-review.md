# Semantic PR Review

Analyze a git diff and output a structured review.

<!--
  ============================================================
  THIS IS A STARTER TEMPLATE — CUSTOMISE IT FOR YOUR TEAM
  ============================================================

  This prompt works out of the box, but generic reviews miss the
  things that matter most to *your* codebase. The best code review
  prompts encode your team's hard-won knowledge — the patterns you
  always want, the mistakes you keep catching, the architecture
  decisions that are easy to violate.

  Below you'll find the core review logic (diff, explanation,
  grouping, flags, output schema) plus a "Review Guidelines"
  section with EXAMPLE checks you should replace with your own.

  HOW TO CUSTOMISE:

  1. Replace the example Review Guidelines section with checks
     that reflect your stack, conventions, and past pain points.

  2. Add domain-specific context: what does your app do? What
     are the layers? What are the common mistakes new contributors
     make?

  3. Encode your team's style preferences: naming conventions,
     error handling patterns, testing expectations, etc.

  IDEAS FOR WHAT TO ADD (pick what applies to your stack):

  Language / Framework
  - React: hooks rules, memo/callback misuse, key prop issues
  - Python: type hint conventions, async/await patterns
  - Go: error wrapping, goroutine leaks, interface pollution
  - Rust: unnecessary clones, lifetime issues, unsafe blocks
  - Java/Kotlin: null safety, stream misuse, DI patterns
  - TypeScript: `any` usage, nullish vs falsy, type narrowing

  Architecture
  - Layer violations (e.g. controllers with business logic)
  - Missing validation at API boundaries
  - Hardcoded values that should be config
  - Direct DB access from wrong layers
  - Shared types/contracts that drift between services

  Testing
  - Missing tests for new behavior
  - Tests that test implementation instead of behavior
  - Flaky test patterns (time-dependent, order-dependent)

  Security
  - Auth/authz bypass risks
  - Injection vectors (SQL, XSS, command)
  - Secrets in code or logs
  - Missing input sanitization

  Performance
  - N+1 queries
  - Missing indexes for new query patterns
  - Unbounded data fetching
  - Missing pagination

  Project-Specific
  - Your team's naming conventions
  - Required patterns (e.g. "all API errors must use ErrorX")
  - Forbidden patterns (e.g. "never use library Y directly")
  - Domain invariants (e.g. "orders must always have a customer")
  ============================================================
-->

## Instructions

1. Determine the diff range (see Diff Range below)
2. Run the diff and analyze the changes
3. Write the PR explanation (see Explanation below)
4. Group changes by logical concern, ordered for review (see Grouping below)
5. Flag potential issues (see Review Guidelines and Flags below)
6. Output JSON to `./code-review.json`

## Diff Range

Default: review the **last commit** plus any uncommitted changes (`git diff HEAD~1`).

If the user specifies a different range (e.g. "vs main", "last 3 commits", a specific SHA), use that instead.

## Explanation

Write a explanation of the changes for the human reviewer. This is the first thing they read — it opens automatically in the main editor pane. The explanation is rendered as markdown.

- Use plain, simple English — write like you're explaining to a colleague over chat
- Start with what the PR does, then cover the "why" and any non-obvious decisions
- Call out anything the reviewer should pay special attention to
- Don't repeat the group titles — the explanation gives the big picture, groups give the details
- Use markdown formatting: headings, bullet points, code spans (`likethis`) for readability
- Be didactic when the PR is non-trivial — help the reviewer understand the domain, the pattern, or the architectural decision. Explain _why_ things work the way they do, not just what changed. For trivial PRs (typos, version bumps), keep it brief

## Grouping Principles

- Group by feature/behavior, not alphabetically by file
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

## Review Guidelines

<!--
  REPLACE THIS SECTION with checks specific to your codebase.
  The examples below are drawn from a real TypeScript/React project
  to show the level of detail that makes reviews useful. Your
  version should reflect YOUR stack, conventions, and past mistakes.
-->

When analyzing the diff, apply the following lenses. Only flag violations that are clearly present — do not speculate or nitpick.

### Complexity

<!-- These are universal — keep the ones that resonate with your team -->

- **Information leaking**: Flag when implementation details (internal formats, error codes, data structures) leak across module boundaries.
- **Change amplification**: Flag when a single logical change requires touching many places — a sign of missing abstraction.
- **Cognitive load**: Flag when understanding a piece of code requires holding too much context — deep nesting, long parameter lists, implicit ordering dependencies.

### Example: JavaScript/TypeScript Pitfalls

<!-- Replace or extend with your language's pitfalls -->

- **Truthy traps**: `[]`, `{}`, and `" "` are all truthy. Flag `if (array)` when the intent is to check emptiness — should be `array.length`.
- **Nullish vs falsy**: Flag `||` used for defaults when `??` is correct — `0`, `""`, and `false` are valid values that `||` would discard.
- **`any` casts**: Flag every use. Must have a comment justifying why.
- **Loose equality**: Flag `==` / `!=` unless comparing against `null` intentionally.

### Example: Project-Specific Checks

<!--
  This is where the real value is. Below are examples from a
  TypeScript monorepo — replace them entirely with your own.
  Think: "What do we always catch in code review?"
-->

- **Layer violations**: Flag controllers containing business logic (should be in services), or services executing raw queries (should be in repositories).
- **Arrow functions for top-level definitions**: Flag arrow-function exports — use `function` declarations for hoisting and readability.
- **Nested conditionals**: Flag deep nesting that should use early returns or guard clauses.
- **Missing validation**: Flag API inputs that bypass validation schemas.
- **Duplicated types**: Flag types defined locally that already exist in shared packages.

## Flags

Flag potential issues using the guidelines above plus security, bug risk, and performance concerns. Each flag should have a short title and a 1-2 sentence summary explaining the concern and why it matters.

## Output Schema

Write valid JSON to `./code-review.json`:

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
9. Write the JSON to `./code-review.json`
