# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:46cd31e7 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

## Development Workflow

<!-- Keep this section identical in CLAUDE.md and AGENTS.md. -->

These rules apply every session. They give agents more autonomy for routine
Beads management only. They do not override existing safety rules, tool
permissions, or other project instructions; where anything else here is
stricter, the stricter rule applies.

### Beads task management (do this without being asked)

- At the start of any substantial task, search Beads (`bd search`, `bd ready`,
  `bd list --status=open`) for a matching issue before creating one.
- If one exists, claim it (`bd update <id> --claim`). If not, create one scoped
  to the task, under the relevant epic (`--parent=<epic>`), with a description
  and acceptance criteria.
- Keep Beads in step with real progress: update status, add dependencies
  (`bd dep add`), and file follow-ups as they come up. Don't create duplicates
  or tasks for trivial steps.
- Record important findings, decisions and outcomes in the issue's notes or
  design fields (`bd update <id> --notes/--design`).
- Close an issue only when its acceptance criteria are met and any approval it
  needed has been given.
- Routine local Beads management (create, claim, update, note, close) needs no
  approval. Syncing Beads to the remote (`bd dolt push`) needs approval, like
  any other push.

### What needs the user's approval

- Product requirements, UX decisions, designs and implementation plans.
- No implementation before the user approves both the design and the plan.
- No commit, push, merge or destructive action (deleting data, branches or
  files; force operations) without the user's approval.

### Superpowers

- Use the Superpowers skills for brainstorming, design, planning and
  implementation where they apply.
- Track each meaningful Superpowers stage that has a clear deliverable (such as
  the approved design, or the approved plan) as its own Beads task under the
  epic, with the outcome recorded there or linked (for example, a file in
  `docs/superpowers/`). Don't split stages further than that.
- Create implementation tasks only after the design and the plan are approved,
  and make them match the plan's tasks.

## Build & Test

_Add your build and test commands here_

```bash
# Example:
# npm install
# npm test
```

## Architecture Overview

_Add a brief overview of your project architecture_

## Conventions & Patterns

_Add your project-specific conventions here_
