# Session: 21-06-2026 22:00 - mcp-server-vault-tools

## Quick Reference
**Topics:** MCP server, vault tools, file structure, Obsidian, Telegram pipeline, reel capture, agent tickets, Claude Code SDK, iCloud sync, MCP Inspector
**Projects:** kohen-mcp
**Outcome:** Built working MCP server with ping + vault_read + vault_list + wiki_read + wiki_list tools; established full post-MCP pipeline architecture for Telegram → vault, reel capture, and agent ticket workflows.

---

## Key Learnings

- `sessionIdGenerator: undefined` is the correct documented stateless pattern for StreamableHTTPServerTransport — not a bug, not deprecated
- `server.tool()` and `server.registerTool()` are different APIs; `registerTool` is the current one with Zod schema support
- GET /mcp must be routed alongside POST /mcp — GET opens the SSE stream for clients that use it
- Telegram stores messages server-side for 24hrs regardless of whether your bot is polling — async capture works natively
- Claude.ai Pro and `@anthropic-ai/sdk` are completely separate products — SDK calls always bill to Anthropic API, never against a chat subscription
- Claude Code Agent SDK (`@anthropic-ai/claude-code`) runs subprocesses that use your Claude Code plan compute, not API credits — valid for cron jobs running outside an active Claude Code session
- obsidian-local-rest-api's `vault_read` returns `{content, frontmatter, tags, links, backlinks, stat}` — richer than raw text; their advantage is Obsidian's internal cache; their disadvantage is Obsidian must be open
- iCloud is first-class for Obsidian mobile; Google Drive requires Files app friction on iPhone
- Feature-based file organization (one folder per domain, index re-exports) is the modern standard — not layer-based (handlers/, schemas/, utils/)
- MCP Inspector proxy runs on 6277, UI on 6274 — both ports must be free

---

## Decisions Made

- **MCP server runs local, not Oracle Cloud** — simplifies everything; remote deployment deferred indefinitely. Direct filesystem access replaces GitHub API entirely.
- **Vault adapter: local filesystem via Bun.file()** — zero latency (~1ms vs ~500ms GitHub API), full read/write, no rate limits, no auth complexity.
- **Two vaults, one shared implementation** — `vault.ts` and `wiki.ts` are separate registration files with tailored descriptions; `read.ts` and `list.ts` are shared pure functions. Same tool surface, different names and root paths.
- **`vault_read` returns structured JSON** (`{content, frontmatter, tags}`) not raw text — matches obsidian-local-rest-api's interface, gives AI clients richer context to reason with.
- **Tags merged from frontmatter + inline `#tags`** — deduplicated, matches how Obsidian actually tracks tags.
- **Feature-based folder structure** — `src/tools/vault/{vault.ts, wiki.ts, read.ts, list.ts, index.ts}` — one domain, one folder, implementations are pure functions, registration files are MCP-aware.
- **No `tools/` at project root** — that convention is for scripts/CLIs outside the TS source tree; `src/tools/` is correct for TypeScript source modules.
- **Vault descriptions live in config** (`kohen.config.ts`) and are passed through to MCP tool descriptions — AI clients see them and use them to pick the right vault.
- **Telegram + cron over always-on process** — cron polls `getUpdates?offset={last_update_id}` on Mac startup; simpler, no persistent process needed, no missed messages within 24hr window.
- **Enrich-first ticket strategy** — Claude reads raw Telegram messages and produces structured tickets in one pass; fewer moving parts than queue-raw → enrich later.
- **Fallback for agent tickets** — if Claude Code Agent SDK hits limits, dump raw notes to vault and batch process manually through a Claude session. No over-engineering.

---

## Files Modified

- `src/server.ts` — added GET /mcp handler, switched `server.tool()` → `server.registerTool()` with Zod, added Zod import, wired `registerVaultTools` + `registerWikiTools`
- `src/config/schema.ts` — added `VaultDefinition` interface (`name`, `rootPath`, `description`), added `vaults: VaultDefinition[]` to `UserConfig`
- `src/config/kohen.config.ts` — added both vault configs (`/Users/kohenmahler/vault/`, `/Users/kohenmahler/wiki/`) with descriptions, env var overrides (`VAULT_PATH`, `WIKI_PATH`)
- `src/tools/vault/read.ts` — created: `readVaultFile(rootPath, filePath)` — pure function, returns `{ok, data: {content, frontmatter, tags}}`, YAML frontmatter parsing via `yaml` package, inline tag extraction via regex, path traversal guard
- `src/tools/vault/list.ts` — created: `listVaultDir(rootPath, dirPath)` — pure function, returns `{ok, entries: [{name, type}]}`, filters hidden files, path traversal guard
- `src/tools/vault/vault.ts` — created: `registerVaultTools(server)` — vault-specific MCP tool registration (`vault_read`, `vault_list`)
- `src/tools/vault/wiki.ts` — created: `registerWikiTools(server)` — wiki-specific MCP tool registration (`wiki_read`, `wiki_list`)
- `src/tools/vault/index.ts` — refactored from generic loop to barrel re-export of `registerVaultTools` + `registerWikiTools`
- `package.json` — added `zod`, `yaml` dependencies
- `bun.lock` — updated

---

## Setup & Config

- `bun add zod` — Zod v4.4.3 installed for MCP tool schema validation
- `bun add yaml` — yaml v2.9.0 installed for frontmatter parsing
- MCP Inspector: `bunx @modelcontextprotocol/inspector http://localhost:3000/mcp`
  - Proxy port: 6277, UI port: 6274
  - If either port is in use: `lsof -ti:6277 | xargs kill -9` / `lsof -ti:6274 | xargs kill -9`
- Vault paths in config (can override via env):
  - `VAULT_PATH` → `/Users/kohenmahler/vault/`
  - `WIKI_PATH` → `/Users/kohenmahler/wiki/`
- Dev server: `bun run dev` (port 3000)

---

## Pending Tasks

- [ ] Test all 5 tools in MCP Inspector (`ping`, `vault_read`, `vault_list`, `wiki_read`, `wiki_list`)
- [ ] Build `vault_write` tool (append/overwrite a vault file)
- [ ] Build Telegram → vault async capture cron job
  - `getUpdates?offset={last_update_id}` polling
  - Route plain text → Jotpad/daily note, video URLs → reel processor
  - Persist `last_update_id` between runs
- [ ] Build reel capture pipeline
  - yt-dlp download → ffmpeg frame extract → Whisper transcribe → Claude extract insight → vault_write
  - Reference: https://github.com/bradautomates/claude-video
  - Save to `vault/Content/Reels/YYYY-MM-DD-title.md`
- [ ] Build agent ticket queue
  - `create_agent_ticket` MCP tool
  - Nightly cron worker using Claude Code Agent SDK
  - Enrich-first strategy: one Claude pass over raw Telegram queue → structured tickets
- [ ] Evaluate iCloud vault migration (better Obsidian mobile experience vs Google Drive)
- [ ] Add `vault_search` tool (full-text grep across vault)

---

## Errors & Workarounds

- **MCP Inspector port conflicts** — Inspector uses 6277 (proxy) and 6274 (UI). If either is in use from a prior run: `lsof -ti:PORT | xargs kill -9`, then rerun.
- **Deprecated warning on server start** — acknowledged, not blocking, deferred. Likely `sessionIdGenerator: undefined` triggering a warning in current SDK version. Stateless pattern is still correct and documented.
- **First curl attempt failed** — missing `Accept: application/json, text/event-stream` header. StreamableHTTP transport requires both content types declared. Fixed by adding the header.

---

## Raw Session Log

Session started with the server already scaffolded and the `ping` tool working via curl. User noticed a deprecation warning but it was deferred as non-blocking.

**Server fixes:** Added GET /mcp handler (required for SSE-capable clients), switched `server.tool()` to `server.registerTool()` with Zod schemas, installed Zod.

**Architecture discussion — vault access strategy:** Three options evaluated: obsidian-local-rest-api (local plugin, Obsidian must be open, local-only), GitHub API via Octokit (remote-capable, ~500ms latency, already installed), local filesystem (zero latency, full write access, local-only). User asked about iCloud sync as a variant — established that iCloud vs Google Drive only affects mobile Obsidian UX, not the server implementation. Both expose the vault as a local path. Decision: **local filesystem**. Key reason: kohen-mcp was specced for Oracle Cloud but the user decided local deployment simplifies the build and is a genuinely better use case. Remote deployment deferred.

**Mobile workflow discussion:** User wants phone access for light tasks. Options: iCloud + Obsidian mobile (full UI but requires app switching), Telegram → PAI (lowest friction for quick capture and queries). Established that Telegram is the right channel for light phone tasks — it handles both directions (send notes in, query out). iCloud migration only worth it if user wants to browse/edit longer content on phone.

**Async Telegram pipeline:** User asked if messages sent while PAI is offline are lost. Answer: no — Telegram queues updates server-side for 24hrs. Architecture: `getUpdates?offset={last_update_id}` on cron startup fetches everything accumulated. State is just one persisted number. Cron fires on Mac startup, not continuously.

**Reel capture pipeline:** User found https://github.com/bradautomates/claude-video — a PAI skill that takes a video URL, runs yt-dlp + ffmpeg + Whisper + Claude, returns analysis. Fit: send reel URL to Telegram → cron detects it's a video URL → runs the pipeline → saves structured note to `vault/Content/Reels/` → Telegram confirms.

**Agent tickets and inference discussion:** User asked how to run AI inference for background tasks without burning Claude Code usage. Clarified: `@anthropic-ai/sdk` always bills to Anthropic API — no connection to Claude.ai Pro or Claude Code subscriptions. Claude Code Agent SDK (`@anthropic-ai/claude-code`) runs Claude Code as a subprocess and uses Claude Code plan compute. Valid for cron jobs running outside an active session (no CLAUDECODE env var conflict). User is on Pro, open to Max if limits hit. Fallback: dump raw notes to vault, batch process manually. No over-engineering.

**File structure decision:** User wanted to avoid one giant vault tools file. Established feature-based organization: `src/tools/vault/` folder with one file per operation (`read.ts`, `list.ts`) as pure functions, and separate registration files per vault (`vault.ts`, `wiki.ts`). `index.ts` is a barrel re-export. User confirmed they have two vaults: `/Users/kohenmahler/vault/` (personal, active) and `/Users/kohenmahler/wiki/` (reference, permanent notes).

**vault_read upgrade:** Compared our implementation to obsidian-local-rest-api's. Their tool returns `{content, frontmatter, tags, links, backlinks, stat}` using Obsidian's internal cache. Ours now returns `{content, frontmatter, tags}` — frontmatter parsed from YAML block, tags merged from frontmatter field + inline `#tags` regex, deduplicated. Links/backlinks deferred. `yaml` package installed for proper YAML parsing.

**MCP Inspector setup:** Installed via `bunx @modelcontextprotocol/inspector`. Hit port conflicts on both 6277 and 6274 from prior incomplete runs. Resolved with `lsof -ti:PORT | xargs kill -9`. Inspector opened successfully at end of session.

**Git status at close:** All new files staged — `bun.lock`, `package.json`, `src/config/kohen.config.ts`, `src/config/schema.ts`, `src/server.ts`, `src/tools/vault/index.ts`, `src/tools/vault/list.ts`, `src/tools/vault/read.ts`, `src/tools/vault/vault.ts`, `src/tools/vault/wiki.ts`. User confirmed they will push.
