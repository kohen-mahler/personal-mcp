---
task: "kohen-mcp v1.0 — portable agentic vault access layer"
slug: kohen-mcp
project: kohen-mcp
effort: E3
phase: complete
progress: 99/99
mode: ALGORITHM
started: 2026-06-21
updated: 2026-07-16
---

## Problem

AI tools (Claude Code, Telegram bots, future agents) each start sessions cold — no shared context, no memory of kohen's vault, no way to read or write notes without re-explaining the folder structure every time. Every tool reinvents the same lookup pattern. There is no single connection point that gives any AI uniform access to kohen's vault.

## Vision

Any tool that connects to kohen-mcp gets the same vault access: read a file, list a directory, append a note, patch a heading, search by content. The MCP runs locally, starts with the system, and requires no configuration per-session. Sessions using it feel higher-leverage from the first tool call because context is already there.

## Out of Scope

- Remote deployment (Oracle Cloud deferred indefinitely — local only)
- Binary file read/write (markdown + text only)
- Obsidian plugin integration (no vault.app API — raw filesystem)
- vault_patch `targetScope` (content/marker/markerAndContent — too niche)
- Periodic notes endpoints (not applicable without Obsidian's native note system)
- Concurrent write locking (last write wins — acceptable for single-user vault)
- Telegram → vault pipeline (post-v1.0)
- Reel capture pipeline (post-v1.0)
- Agent ticket queue (post-v1.0)
- iCloud vault migration (deferred until mobile use is active)

## Principles

- **Filesystem-first**: every operation is a direct Bun/node:fs call — no Obsidian plugin API, no GitHub API, zero external dependencies for core vault ops
- **Fail fast, fail loudly**: errors surface as `{ ok: false, error }` with actionable messages — never silent swallows
- **Atomic writes**: overwrites go through `.mcp_pending` → `fs.rename()` — no partial-state vault files
- **Consistent surface**: all tools follow the same `Result` type and use `toToolText`/`toToolError` from `format.ts`
- **Explicit permission for destructive ops**: vault_write overwrite and vault_delete must be explicitly requested — never auto-triggered

## Constraints

- Runtime: Bun only (never Node/npm)
- Transport: StreamableHTTP stateless (`sessionIdGenerator: undefined`) on port 3000
- Vault path: `VAULT_PATH` env var → `/Users/kohenmahler/Library/CloudStorage/GoogleDrive-mahlerkohen@gmail.com/My Drive/School`
- TypeScript always — no Python
- MCP SDK: `@modelcontextprotocol/sdk` — no custom transport layer
- Patch library: `markdown-patch` (same library as obsidian-local-rest-api)
- All tools must pass `bun test` — no orphaned test stubs

## Goal

kohen-mcp v1.0 is a locally-running MCP server that gives any connected AI tool full read/write access to kohen's Obsidian vault — reading files with structured metadata, appending notes, patching headings, and deleting files — through a consistent, secure, path-traversal-protected tool interface.

## Criteria

### Server Foundation (complete)

- [x] ISC-1: `GET /health` returns `{ ok: true, version }` with status 200
- [x] ISC-2: `POST /mcp` handles MCP JSON-RPC requests without transport error
- [x] ISC-3: `GET /mcp` opens SSE stream and returns 200
- [x] ISC-4: Path traversal (`../../etc/passwd`) blocked across all vault tools, returns `{ ok: false, error: "Path traversal not allowed" }`
- [x] ISC-5: `format.ts` exports `toToolText` and `toToolError`; all tool handlers use them

### Vault Read Tools (complete)

- [x] ISC-6: `vault_read` returns `{ path, content, frontmatter, tags, links }` for a valid `.md` file
- [x] ISC-7: `vault_read` auto-appends `.md` when path has no extension
- [x] ISC-8: `vault_read` returns `{ ok: false, error: "File not found: …" }` for non-existent path
- [x] ISC-9: `vault_list` returns a JSON array of `{ name, type }` entries
- [x] ISC-10: `vault_list` types entries as `"file"` or `"directory"` correctly
- [x] ISC-11: `vault_list` on a file path returns error with `"use vault_read instead"` in message
- [x] ISC-12: `wiki_read` and `wiki_list` delegate to `readVaultFile` and `listVaultDir` with wiki root
- [x] ISC-13: `links[]` in `vault_read` merges wikilinks and markdown links into one array
- [x] ISC-14: `links[]` deduplicates on `target#heading` key — same note linked twice = one entry
- [x] ISC-15: `links[]` assigns `type: "file" | "folder" | "link"` correctly
- [x] ISC-16: `tags` deduplicated across frontmatter array and inline `#tag` occurrences
- [x] ISC-17: `registerVaultTools` throws `Error` at startup if `"vault"` missing from config
- [x] ISC-18: `registerWikiTools` throws `Error` at startup if `"wiki"` missing from config

### vault_write (this PR)

- [x] ISC-19: `vault_write` creates a new file when the path does not yet exist
- [x] ISC-20: `vault_write` creates all intermediate parent directories automatically
- [x] ISC-21: `vault_write` with `overwrite` unset (or `false`) returns `{ ok: false, error: "File already exists…" }` when file exists
- [x] ISC-22: `vault_write` with `overwrite: true` writes content to `{path}.__mcp_pending__` first
- [x] ISC-23: `vault_write` with `overwrite: true` verifies `.__mcp_pending__` exists before calling rename
- [x] ISC-24: `vault_write` with `overwrite: true` uses `fs.rename()` to atomically swap `.__mcp_pending__` → original path
- [x] ISC-25: `vault_write` rejects paths ending in `"/"` with `{ ok: false, error: "Path is a directory…" }`
- [x] ISC-26: `vault_write` blocks path traversal
- [x] ISC-27: `vault_write` returns `{ ok: true, path: normalizedPath }` on success
- [x] ISC-28: `vault_write` returns `{ ok: false, error }` with a message naming the specific failure
- [x] ISC-29: Anti: `vault_write` tool description contains language requiring explicit user permission before `overwrite: true`

### vault_append (this PR)

- [x] ISC-30: `vault_append` creates file with content if path does not exist
- [x] ISC-31: `vault_append` creates all intermediate parent directories automatically
- [x] ISC-32: `vault_append` prefixes new content with `"\n\n"` before writing to existing file
- [x] ISC-33: `vault_append` result: existing file ending with or without `\n` still gets `\n\n` prefix — final content is `original + "\n\n" + appended`
- [x] ISC-34: `vault_append` blocks path traversal
- [x] ISC-35: `vault_append` returns `{ ok: true, path }` on success
- [x] ISC-36: Anti: `vault_append` never uses single `"\n"` prefix — always `"\n\n"`

### vault_patch (this PR — deferred by default)

- [x] ISC-37: `vault_patch` accepts `targetType: "heading" | "block" | "frontmatter"`
- [x] ISC-38: `vault_patch` accepts `operation: "replace" | "append" | "prepend" | "remove"`
- [x] ISC-39: `vault_patch` delegates to `markdown-patch` library — no custom heading parser
- [x] ISC-40: `vault_patch` with `createTargetIfMissing: false` returns `{ ok: false, error }` when target not found
- [x] ISC-41: `vault_patch` with `createTargetIfMissing: true` creates missing heading in file
- [x] ISC-42: `PatchFailed` exception from `markdown-patch` caught and returned as `toToolError` with reason preserved
- [x] ISC-43: `vault_patch` blocks path traversal
- [x] ISC-44: `vault_patch` returns full updated file content on success via `toToolText`
- [x] ISC-45: Anti: `vault_patch` tool description explicitly states "only use when explicitly asked — prefer vault_write for full rewrites"

### vault_delete (this PR)

- [x] ISC-46: `vault_delete` permanently removes file using `fs.unlink()`
- [x] ISC-47: `vault_delete` returns `{ ok: false, error: "File not found: …" }` when path doesn't exist
- [x] ISC-48: `vault_delete` rejects directory paths (no mass delete)
- [x] ISC-49: `vault_delete` blocks path traversal
- [x] ISC-50: Anti: `vault_delete` tool description warns "permanent — not moved to trash"

### write.ts Structure

- [x] ISC-51: `write.ts` exports `WriteResult` type: `{ ok: true; path: string } | { ok: false; error: string }`
- [x] ISC-52: `write.ts` exports `writeVaultFile`, `appendVaultFile`, `patchVaultFile`, `deleteVaultFile` as named async functions
- [x] ISC-53: `markdown-patch` present in `package.json` dependencies after `bun add`

### Test Coverage

- [x] ISC-54: `bun test` passes with 0 failures after implementation
- [x] ISC-55: Unit tests cover `writeVaultFile` happy path (create) and overwrite-blocked error
- [x] ISC-56: Unit tests cover `appendVaultFile` `\n\n` prefix on both new and existing files
- [x] ISC-57: Integration tests use a fresh `tmp` directory, cleaned up in `afterEach`
- [x] ISC-58: Integration tests cover `patchVaultFile` using a fixture markdown file with known headings
- [x] ISC-59: Anti: no test writes to real vault (`VAULT_PATH` env path)

## Test Strategy

| ISC | Type | Check | Threshold | Tool |
|-----|------|-------|-----------|------|
| ISC-19 | integration | `Bun.file(path).exists()` after write | `true` | `bun test` |
| ISC-20 | integration | `stat(parentDir)` after write to nested path | exists | `bun test` |
| ISC-21 | unit | `writeVaultFile(root, existingPath, content)` no options | `result.ok === false` | `bun test` |
| ISC-22 | unit | file `{path}.__mcp_pending__` exists mid-operation | exists | `bun test` (spy) |
| ISC-23 | unit | rename only called if `.mcp_pending` exists | `rename` called once | `bun test` |
| ISC-24 | integration | overwrite: final file has new content; `.mcp_pending__` gone | content match, no pending | `bun test` |
| ISC-25 | unit | `writeVaultFile(root, "Notes/", content)` | `result.error` contains "directory" | `bun test` |
| ISC-26 | unit | `writeVaultFile(root, "../../etc", content)` | `result.error` contains "traversal" | `bun test` |
| ISC-32 | unit | `appendVaultFile(root, existing, "new")` | file content ends with `\n\nnew` | `bun test` |
| ISC-39 | integration | `patchVaultFile` on fixture with `## Summary` heading | heading content updated | `bun test` |
| ISC-42 | unit | mock `applyPatch` to throw `PatchFailed` | `result.ok === false` | `bun test` |
| ISC-46 | integration | `stat(path)` after delete | throws ENOENT | `bun test` |
| ISC-54 | system | `bun test` exit code | 0 | `Bash` |
| ISC-59 | anti | grep tests for `VAULT_PATH` env var usage | no matches | `Grep` |

## Features

| Name | Description | Satisfies | Depends On | Parallelizable |
|------|-------------|-----------|------------|----------------|
| write.ts | `writeVaultFile`, `appendVaultFile`, `patchVaultFile`, `deleteVaultFile` + `WriteResult` type | ISC-19–52 | format.ts, list.ts patterns | no |
| vault-registration | Register 4 new tools in `vault.ts` using `toToolText`/`toToolError` | ISC-29, ISC-45, ISC-50 | write.ts | no (depends on write.ts) |
| tests-write | Unit + integration tests for all 4 functions | ISC-54–59 | write.ts (can write against spec) | YES — spec is tight enough |
| markdown-patch-dep | `bun add markdown-patch` | ISC-53 | none | no |
| pai-skill-definitions | Three concise provider-neutral skill definitions with Algorithm Goal/Design structure | ISC-85–90, ISC-98 | none | yes |
| pai-skill-registry | Static allowlisted discovery and read functions for definitions/workflows | ISC-91–93 | pai-skill-definitions | no |
| pai-skill-registration | Register `pai_list_skills` and `pai_read_skill` on the MCP server | ISC-94 | pai-skill-registry | no |
| pai-skill-tests | Unit and integration coverage for registry, boundaries, and MCP calls | ISC-95–99 | all PAI skill features | no |

### morning_context Tool (2026-07-09)

- [x] ISC-60: `registerRitualTools` exported from `src/tools/ritual/index.ts`
- [x] ISC-61: `getMorningContext` exported from `src/tools/ritual/morning.ts`
- [x] ISC-62: `morning_context` tool registered in `createMcpServer` via `registerRitualTools(server, vaultDef, wikiDef)`
- [x] ISC-63: Tool returns `{ date, dayOfWeek, dailyNotePath, jotpad, yesterday, goals }` JSON shape
- [x] ISC-64: `date` is YYYY-MM-DD format in America/Los_Angeles timezone
- [x] ISC-65: `dayOfWeek` is full English weekday name
- [x] ISC-66: `dailyNotePath` is `Notes/Daily/YYYY-MM-DD.md` using today's date
- [x] ISC-67: `dailyNotePath` date matches the `date` field
- [x] ISC-68: `jotpad` contains `00 Dashboard/Jotpad.md` content when file exists
- [x] ISC-69: `jotpad` is null when Jotpad.md doesn't exist — no error
- [x] ISC-70: `yesterday` is `{ path, content }` when yesterday's daily note exists
- [x] ISC-71: `yesterday` is null when yesterday's note doesn't exist — no error
- [x] ISC-72: `goals` contains `wiki/ritual/daily-goals.md` content when file exists
- [x] ISC-73: `goals` is null when goals file doesn't exist — no error
- [x] ISC-74: Tool description names `vault_append` as the write path for ritual output
- [x] ISC-75: Anti: tool does NOT return `ok: false` when any source file is missing — null values only
- [x] ISC-76: All three source reads fire in parallel via `Promise.all`
- [x] ISC-77: Goals library exists at `wiki/ritual/daily-goals.md` with ≥10 goal options
- [x] ISC-78: Unit test covers null `jotpad` (empty dir fixture)
- [x] ISC-79: Unit test covers null `yesterday` (empty dir fixture)
- [x] ISC-80: Unit test covers null `goals` (empty dir fixture)
- [x] ISC-81: Unit test covers `jotpad` happy path (fixture Jotpad.md)
- [x] ISC-82: Unit test verifies `date` matches `YYYY-MM-DD` regex
- [x] ISC-83: Unit test verifies `dailyNotePath` matches `Notes/Daily/YYYY-MM-DD.md`
- [x] ISC-84: `bun test` passes with 0 failures after implementation

### Provider-Neutral PAI Skills (2026-07-16)

- [x] ISC-85: Canonical PAI skill definitions live under `src/tools/pai/skills/` in this repository
- [x] ISC-86: Exactly three skills are discoverable: `pai-bootstrap`, `cross-model-handoff`, and `durable-writeback`
- [x] ISC-87: `pai-bootstrap` description covers read-only session/task context initialization and excludes task mutation
- [x] ISC-88: `cross-model-handoff` description covers task ownership and transfer and excludes canonical knowledge writes
- [x] ISC-89: `durable-writeback` description covers canonical wiki persistence and excludes task ownership changes
- [x] ISC-90: Every skill definition contains Goal, Design, Workflow, and Gotchas sections
- [x] ISC-91: `pai_list_skills` returns each skill name and concise description without loading full instructions
- [x] ISC-92: `pai_read_skill` returns one named skill's full definition, including its workflow instructions
- [x] ISC-93: `pai_read_skill` rejects unknown skill names without accepting arbitrary filesystem paths
- [x] ISC-94: The MCP server registers `pai_list_skills` and `pai_read_skill` for every connected client
- [x] ISC-95: Unit tests verify discovery, exact trigger boundaries, full workflow definitions, and unknown-name errors
- [x] ISC-96: Integration tests verify both PAI tools appear in `tools/list` and return valid content through `tools/call`
- [x] ISC-97: Anti: no canonical PAI skill definition remains installed under `~/tools/PAI/Skills`
- [x] ISC-98: Anti: implementation does not modify or depend on provider-specific skill directories
- [x] ISC-99: `bun test` passes with zero failures after the PAI skill implementation

## Decisions

- 2026-07-16: PAI skills belong in `personal-mcp/src/tools/pai/skills`, not provider-specific runtime directories or `~/tools`. MCP exposes them through allowlisted `pai_list_skills` and `pai_read_skill` tools so all connected clients share one canonical definition set. Skill descriptions partition responsibilities into read-only bootstrap, task lifecycle handoff, and canonical knowledge writeback.

- 2026-07-09: morning_context as MCP tool (not PAI skill) — user wants the trigger built into personal-mcp. Tool returns raw context bundle; Claude session does the ritual conversation. Delegation floor relaxed (show-your-math: single well-specified module, identical pattern to existing registerWikiTools, no cross-file complexity).
- 2026-07-09: daily notes path convention established as `Notes/Daily/YYYY-MM-DD.md` — no prior convention existed in vault.
- 2026-07-09: Date computed with `en-CA` locale + LA timezone — avoids UTC date mismatch at 5am. `en-CA` reliably gives YYYY-MM-DD format.
- 2026-06-29: Proxy aggregation layer added. ProxyManager spawns child MCPs at startup, re-registers tools on per-request McpServer instances. Forge delegation skipped — show-your-math: 5 small well-specified files, direct implementation faster than round-trip. Gmail package name (gmail-mcp-server) flagged for user verification. Zod v4 requires z.record(z.string(), z.unknown()) not z.record(z.unknown()). callTool return union normalized to content shape at proxy layer.
- 2026-06-23: Overwrite protection required — `overwrite: true` opt-in (default blocks). Obsidian REST API does silent overwrite; we don't because the MCP caller is an AI.
- 2026-06-23: Atomic replace via `.__mcp_pending__` → `fs.rename()`. Orphaned `.mcp_pending__` on crash is acceptable — rare, harmless, no cleanup needed.
- 2026-06-23: `vault_append` always prefixes `\n\n` (vs Obsidian's single `\n` if missing). Consistent double-space produces clean markdown paragraphs regardless of file state.
- 2026-06-23: `vault_patch` deferred in system prompts — only call when explicitly asked. Full rewrites via `vault_write` preferred.
- 2026-06-23: `vault_delete` is permanent `fs.unlink()` — no trash. Obsidian REST API uses `vault.trash()`; we don't have the Obsidian plugin API. Warning in tool description is the mitigation.
- 2026-06-23: `targetScope` omitted from vault_patch — covers `content/marker/markerAndContent` complexity for a use case that rarely comes up. Keep it simple.
- 2026-06-23: `vault_search` deferred to next PR — Omnisearch HTTP API required.
- 2026-06-23: `vault_backlinks` deferred — O(n) vault scan too expensive per-read, separate tool design needed.

## Changelog

- conjectured: provider-neutral PAI skills required installation into a shared external tools directory
- refuted_by: connected agents only share capabilities registered by `personal-mcp`; an external filesystem location is neither canonical to the project nor transport-visible
- learned: keep skill definitions beside the MCP implementation and expose them through allowlisted discovery/read tools
- criterion_now: ISC-85, ISC-91–94, and ISC-97 verify project-local storage plus transport-level availability

- conjectured: batch `[initialize, request]` approach needed because each POST creates fresh McpServer
- refuted_by: SDK in stateless mode (`sessionIdGenerator: undefined`) treats server as pre-initialized; any request works standalone
- learned: stateless StreamableHTTP skips the init handshake requirement; each POST is a self-contained operation
- criterion_now: ISC-2 / ISC-3 verified with standalone POST/GET; no batch needed

## Verification

- ISC-85–90: `bun test tests/unit/pai-skills.test.ts` verifies exact allowlist, concise non-overlapping descriptions, and required Goal/Design/Workflow/Gotchas sections
- ISC-91–96: `bun test tests/integration/server.test.ts` passes 19/19, including `tools/list`, `pai_list_skills`, `pai_read_skill`, and invalid-name schema rejection
- ISC-97: `test ! -e /Users/kohenmahler/tools/PAI` exits 0 after removing the mistaken external copy
- ISC-98: `rg` review of `src/tools/pai` finds no provider-specific runtime directory dependency
- ISC-99: `bun test` passes 200 tests, 0 failures, 477 expectations
- Build: `bun run build` bundles 336 modules successfully to `dist/server.js`

- ISC-1: `GET /health` → 200 `{ok:true, version:"0.1.0"}` — `bun test tests/integration/server.test.ts` pass
- ISC-2: `POST /mcp` → 200 SSE event containing tools/call result — `bun test` pass
- ISC-3: `GET /mcp` → 200 `content-type: text/event-stream` — `bun test` pass
- ISC-4: `vault_read path traversal` → `isError: true`, message contains "Path traversal" — `bun test` pass
- ISC-5: `toToolText`/`toToolError` — unit tests pass (`tests/unit/format.test.ts`)
- ISC-54: `bun test` exit 0, 175 pass, 0 fail, 0 todo — confirmed 2026-06-29
