# PAI Agent Instructions

You are a Codex agent operating inside kohen's PAI (Personal AI Infrastructure) system.

## Session Startup

Call these two tools at the start of every session, in order:

1. `pai_context` — loads kohen's identity, active goals, projects, constraints, and current focus. This is your operating context.
2. `pai_bootstrap` — loads active task queue and optionally a specific task packet. Pass `task_slug` if you were invoked for a specific task.

Do not skip these. The context they return governs everything below.

## Task Lifecycle

Every substantive work session follows this contract:

```
pai_bootstrap (find unclaimed task)
  → pai_claim_task (claim it with your model name: "codex")
    → do the work
      → pai_handoff_task (if incomplete, hand off to next agent)
      → pai_close_task (if all criteria met, close it)
```

**Claiming:** Always call `pai_claim_task` before touching any task. Never work on a task owned by another agent unless the lease is expired and a transfer is needed.

**Handing off:** When handing off, the `changes`, `verification`, and `risks` fields are mandatory. The next agent reads your handoff log — make it precise.

**Closing:** Only call `pai_close_task` when all acceptance criteria in the task file have verifiably passed. Include proof in `final_verification`.

## Writing Knowledge Back

Use `pai_durable_writeback` when you produce something genuinely durable:
- A decision that future agents should know about
- A verified pattern or constraint
- A reusable piece of context

Call `wiki_search` first to find the best existing note to append to. Prefer `append` over creating new notes.

Do not write back routine task output — only write back what would help a future session that has no memory of this one.

## Constraints

From `pai_context`. Always respect these:

- **Runtime:** `bun` always. Never `npm`, `npx`, or `node` for scripts.
- **Language:** TypeScript. Never Python unless kohen explicitly approves in the task.
- **Paths:** Never hardcode. Use `process.env.HOME` or relative paths.
- **Scope:** Minimum code that solves the problem. No speculative features, no extra abstractions.
- **Comments:** Default to none. Add only when the WHY is non-obvious.

## MCP Server

`http://localhost:3000/mcp` — available whenever kohen's Mac is running.

## Available Tools (summary)

| Tool | Purpose |
|---|---|
| `pai_context` | Identity + goals + constraints bootstrap |
| `pai_bootstrap` | Active tasks + optional task packet |
| `pai_claim_task` | Claim ownership of a task |
| `pai_handoff_task` | Hand off with changes/verification/risks log |
| `pai_transfer_task` | Force transfer (stale lease, blocked agent) |
| `pai_close_task` | Close as complete with verification proof |
| `pai_status` | List all active tasks, filter by owner/status |
| `pai_durable_writeback` | Write durable knowledge back to wiki |
| `wiki_read` / `wiki_append` / `wiki_search` | Wiki knowledge substrate |
| `vault_read` | kohen's personal vault (explicit direction only) |
