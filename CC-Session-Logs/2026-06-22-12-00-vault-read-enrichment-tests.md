# Session: 22-06-2026 12:00 - vault-read-enrichment-tests

## Quick Reference
**Topics:** vault_read, link extraction, wikilinks, markdown links, frontmatter, tags, test suite, unit tests, integration tests, pre-push hook, MCP Inspector, StreamableHTTP, file structure, iCloud, Telegram pipeline, agent tickets
**Projects:** kohen-mcp
**Outcome:** vault_read fully enriched with structured links[], test suite built (75 pass, 16 todo), pre-push hook live, everything pushed.

---

## Key Learnings

- MCP Inspector requires both ports 6277 (proxy) and 6274 (UI) to be free — kills from prior incomplete runs cause "port in use" errors
- StreamableHTTP responses come back as SSE (text/event-stream), not plain JSON — `res.json()` fails on them; server HTTP tests need an SSE parser before they can be implemented
- `source ~/.zshrc` reloads shell config into the current terminal — needed when Bun isn't in PATH after install
- MCP Inspector is pointed at a URL on launch (`bunx @modelcontextprotocol/inspector http://localhost:3000/mcp`) but the UI has its own URL field — if that field shows the root URL (`http://localhost:3000/`) instead of `/mcp`, all requests 404
- Obsidian wikilink syntax: `[[target#heading|alias]]` — `#` separates heading, `|` separates alias. Folder links have trailing `/`
- External PDFs (academic papers) were being filtered by the same media extension list as local attachments — external and local paths need separate filter sets
- `bun test` is fully built into Bun — no Jest/Vitest needed. `it.todo()` marks pending tests without failing
- Git pre-push hooks must be `chmod +x` to execute — writing the file alone isn't enough
- `import.meta.dir` in Bun gives the directory of the current file — correct way to build fixture paths in tests
- Private functions in a module need to be exported to be unit-testable directly — added `export` to `parseFrontmatter`, `extractTags`, `extractLinks`, `isFilteredPath`

---

## Solutions & Fixes

- **MCP Inspector port conflicts** — `lsof -ti:6277,6274 | xargs kill -9` clears both ports; must kill both before restarting
- **Inspector hitting wrong URL** — user had `http://localhost:3000/` in the UI field instead of `http://localhost:3000/mcp`; switching to the `/mcp` path fixed "failed to fetch"
- **External PDF links being filtered** — split `MEDIA_EXTENSIONS` into `LOCAL_MEDIA_EXTENSIONS` (includes pdf) and `EXTERNAL_IMAGE_EXTENSIONS` (excludes pdf); `isFilteredPath` now applies the right set based on whether the destination is http/https
- **vault_read returning empty on `01 Current Classes/COMM 295/Final`** — missing `.md` extension; added auto-append logic (`filePath.includes(".") ? filePath : filePath + ".md"`)
- **Server integration tests failing** — two `it()` tests calling `res.json()` on SSE responses; converted to `it.todo()` with a note explaining SSE parser needed

---

## Decisions Made

### Link output field renamed from `wikilinks` to `links`
The name `wikilinks` created confusion with the wiki vault. `links` is unambiguous, and the `type` field inside each entry does the differentiation. — **Rationale:** naming clarity, avoids conflating vault-the-tool with wiki-the-vault.

### VaultLink type enum: `"file" | "folder" | "link"`
Three distinct types rather than a boolean `isExternal` or flat string. Folder links (trailing `/`) need a different tool call (`vault_list`) than file links (`vault_read`). External URLs (`link`) are navigational context, not vault files. — **Rationale:** the AI client needs the type to make the correct next tool call without guessing.

### Separate filter sets for local vs external paths
`LOCAL_MEDIA_EXTENSIONS` includes pdf (local PDFs are attachments, not useful to MCP). `EXTERNAL_IMAGE_EXTENSIONS` excludes pdf (external PDFs are academic papers, high value). — **Rationale:** blanket filtering by extension was catching LeCun and Gershman paper links, which are exactly the content worth keeping.

### Wikilinks and markdown links merged into one `links[]` array, deduplicated
Rather than separate `wikilinks[]` and `markdownLinks[]` fields, both are extracted into a single array with deduplication on `target#heading` key. — **Rationale:** the AI doesn't care how a link was written, only where it points. Separate arrays would require the client to merge and dedup itself.

### `[[Note]]` and `[[Note|alias]]` collapse to one entry; `[[Note]]` and `[[Note#Heading]]` stay separate
Dedup key is `target` alone when no heading, `target#heading` when heading is present. Same note linked twice is noise. Same note linked to two different headings is two distinct navigation targets. — **Rationale:** preserving heading diversity while eliminating true duplicates.

### vault_list error messages differentiate not-found vs path-is-a-file
Uses `stat()` before `readdir()` to check existence and type. Error for file path explicitly says "use vault_read instead." — **Rationale:** the AI client gets actionable guidance rather than a generic failure.

### Integration tests run against fixture files, not real vault
Created `tests/fixtures/vault/` with crafted markdown files covering all link types, frontmatter shapes, and edge cases. — **Rationale:** tests must be deterministic and portable. Real vault content changes; fixture content is frozen.

### Server HTTP tests all marked `it.todo()` — not blocked, just deferred
The `StreamableHTTPServerTransport` returns SSE, not plain JSON. Building an SSE parser to extract the `data:` line is a separate task. Server tests are scaffolded with the correct describe/it structure so they're ready to fill in. — **Rationale:** don't block the push on infrastructure that isn't strictly needed yet; document the blocker clearly in the test file.

### Pre-push hook runs only unit tests, not integration or server tests
`bun test tests/unit` — fast (43ms), no filesystem fixture dependency issues in CI-like contexts. Integration tests run manually or in a future CI step. — **Rationale:** hook should be fast enough to not annoy on every push; unit tests catch the highest-value regressions.

### Tool description / prompt customization fully deferred
Descriptions are minimal placeholders. Jotpad (`00 Dashboard/Jotpad.md`) acts as the live navigation guide — AI reads it first rather than relying on hardcoded folder structure in descriptions. — **Rationale:** descriptions go stale; a living file maintained by the user doesn't.

---

## Files Modified

- `src/tools/vault/read.ts` — enriched return shape, added link extraction, renamed wikilinks→links, split filter sets, exported private functions, removed debug logs
- `src/tools/vault/list.ts` — improved error handling (not-found vs file vs traversal)
- `src/tools/vault/vault.ts` — list output changed from text to JSON array
- `src/tools/vault/wiki.ts` — list output changed from text to JSON array
- `tests/unit/parse.test.ts` — new: 20 unit tests for parseFrontmatter + extractTags
- `tests/unit/links.test.ts` — new: 31 unit tests for extractLinks + isFilteredPath
- `tests/integration/vault-read.test.ts` — new: 17 integration tests against fixtures
- `tests/integration/vault-list.test.ts` — new: 8 integration tests against fixtures
- `tests/integration/server.test.ts` — new: scaffolded, all todos (SSE parser pending)
- `tests/fixtures/vault/index.md` — new: rich fixture with all link/tag/frontmatter types
- `tests/fixtures/vault/Notes/daily.md` — new: simple fixture for path resolution tests
- `tests/fixtures/vault/Folder/nested.md` — new: fixture for nested directory tests
- `.git/hooks/pre-push` — new: runs unit tests before every push

---

## Pending Tasks

- [ ] **Server HTTP integration tests** — build SSE response parser (`data:` line extraction), then implement the 16 todo tests in `server.test.ts`
- [ ] **vault_write / vault_append** — write a file to the vault; append to an existing file. Core for Telegram pipeline.
- [ ] **vault_search** — powered by Omnisearch HTTP API (`GET http://localhost:{port}/search?q=`). Requires Omnisearch plugin + HTTP server enabled in Obsidian settings. Reference: https://github.com/scambier/obsidian-omnisearch
- [ ] **vault_backlinks(path)** — scan vault files for `[[target]]` linking to given path. Separate tool by design (O(n) scan too expensive for every read). Called explicitly when AI needs reverse graph traversal.
- [ ] **Link type handling design** — define how AI client should handle each link type: `file` → vault_read, `folder` → vault_list, `heading` present → read then locate section, `alias` is display only. Also design the reversal pattern: outgoing (links[]) + incoming (vault_backlinks) = full bidirectional graph.
- [ ] **Tool description / prompt customization** — deferred until all tools built. Will use Jotpad as dynamic navigation guide rather than hardcoding folder structure.
- [ ] **Telegram → vault cron job** — async note capture pipeline. `getUpdates?offset={last_update_id}`, routes plain text to Jotpad/daily note, video URLs to reel processor. Requires vault_write.
- [ ] **Reel capture pipeline** — Telegram URL → yt-dlp + ffmpeg + Whisper + Claude → vault note. Reference: https://github.com/bradautomates/claude-video. Saves to `vault/Content/Reels/YYYY-MM-DD-title.md`.
- [ ] **Agent ticket queue** — `create_agent_ticket` MCP tool + nightly cron worker using Claude Code Agent SDK. Enrich-first strategy: one Claude pass over Telegram queue → structured vault notes.
- [ ] **iCloud vault migration evaluation** — currently on Google Drive. iCloud gives native Obsidian mobile experience. Low priority until mobile use becomes active.

---

## Errors & Workarounds

- **MCP Inspector port 6277/6274 in use** → `lsof -ti:6277,6274 | xargs kill -9`, then rerun inspector
- **Inspector "failed to fetch"** → URL field in UI was showing `http://localhost:3000/` (root) not `http://localhost:3000/mcp`. Fixed by correcting the URL in the Inspector UI.
- **`bunx` command not found** → Bun not in PATH for current shell. Fix: `source ~/.zshrc` or `export PATH="$HOME/.bun/bin:$PATH"`
- **vault_read returning empty for `Final`** → missing `.md` extension. Auto-append logic added to `readVaultFile`.
- **External PDF links filtered (LeCun, Gershman papers)** → `pdf` was in the shared media filter. Split into local vs external filter sets. External PDFs now pass through as `type: "link"`.
- **Server test `res.json()` throwing SyntaxError** → StreamableHTTP returns SSE not JSON. Converted affected `it()` to `it.todo()` with blocker documented.
- **Pre-push hook not executing** → file written but not `chmod +x`. Fixed with `chmod +x .git/hooks/pre-push`.

---

## Raw Session Log

Session opened continuing from the previous session where the MCP server was scaffolded with ping, vault_read, vault_list, wiki_read, wiki_list. This session focused on enriching vault_read and building the test infrastructure.

**MCP Inspector debugging:** User hit port conflicts on 6277 and 6274 from prior runs, then got "failed to fetch" because the Inspector UI was pointing at the root URL instead of `/mcp`. Explained the difference (root has no handler) and resolved both.

**StreamableHTTP explanation:** User asked how the transport works. Explained the POST/GET split (POST for JSON-RPC, GET for SSE stream), what stateless means, and traced a full tool call through the pipeline.

**vault_read audit:** Compared current implementation to obsidian-local-rest-api's `vault_read`. Key gap: their tool returns `{content, frontmatter, tags, links, backlinks, stat}` using Obsidian's internal cache. We only had raw text. Decision: enrich to return structured JSON matching their interface minus backlinks (too expensive per-read) and stat (deferred).

**Path and JSON fixes:** Added `path` field to response, changed `vault_list` from formatted text to JSON array.

**Wikilink extraction:** Added `extractWikilinks()` returning `WikiLink[]` with `{target, type, heading?, alias?}`. Type is "file" or "folder" (trailing slash detection). Dedup on `target#heading` key.

**Naming decision:** User noticed `wikilinks` conflicts with the wiki vault name. Renamed to `links`. New `VaultLink` type with `"file" | "folder" | "link"` union.

**Markdown link extraction:** Added extraction of `[text](destination)` links alongside wikilinks. Image embeds (`![...]`) filtered by negative lookbehind. Internal paths → type "file", external http/https → type "link". Both sources merged into one `links[]` array, deduplicated.

**PDF filtering bug:** Two academic paper links (LeCun, Gershman PDFs) were missing from output. Root cause: `pdf` was in the shared `MEDIA_EXTENSIONS` set. Fix: split into `LOCAL_MEDIA_EXTENSIONS` (pdf included) and `EXTERNAL_IMAGE_EXTENSIONS` (pdf excluded). External PDFs now pass through.

**list.ts error improvement:** Changed generic catch-all to `stat()` pre-check, distinguishing not-found from path-is-a-file, with the file error message explicitly suggesting `vault_read`.

**Test suite architecture:** Discussed industry standard testing layers. Chose `bun test` (built-in, no dependencies). Created unit tests for all pure functions (`parseFrontmatter`, `extractTags`, `extractLinks`, `isFilteredPath`) — 51 tests. Created fixture vault under `tests/fixtures/vault/` with crafted markdown covering all link types and edge cases. Created integration tests for `readVaultFile` and `listVaultDir` against fixtures — 24 tests. Scaffolded server HTTP tests as todos (SSE parser needed). Pre-push hook written and made executable.

**Final state:** 75 tests passing, 16 todos, 0 failures. All changes committed and pushed. Pre-push hook confirmed running automatically (printed in push output). Commit: `df99deb`.
