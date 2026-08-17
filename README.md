# kohen-mcp

A locally-running MCP (Model Context Protocol) server that gives any connected AI tool uniform read/write access to Obsidian vaults. Built on Bun with StreamableHTTP transport.

## What it does

Any AI tool that connects (Claude Desktop, Claude Code, future agents) gets the same vault access without re-explaining folder structure or project context each session. The server exposes two vault namespaces through consistent, path-traversal-protected tools:

- **vault** — kohen's personal Obsidian vault. Active workspace: daily notes, Jotpad, project captures. Call only on explicit direction.
- **wiki** — AI-maintained knowledge substrate. Reference material, session history, permanent notes. AI can browse autonomously.

## Transport

StreamableHTTP on `http://localhost:3000`. Stateless (`sessionIdGenerator: undefined`) — each POST is a self-contained operation, no session handshake required.

Endpoints:

| Route | Method | Purpose |
|---|---|---|
| `/mcp` | POST | MCP JSON-RPC tool calls |
| `/mcp` | GET | SSE stream for server-sent events |
| `/health` | GET | `{ ok: true, version }` |
| `/job-feed/` | GET | Visual job-search tracker UI |

## Setup

**Prerequisites:** Bun, an Obsidian vault on the local filesystem.

```sh
bun install
cp .env.example .env   # or create .env manually
bun start
```

**.env:**

```sh
VAULT_PATH="/path/to/your/obsidian/vault"
WIKI_PATH="/path/to/your/wiki"   # optional
PORT=3000
```

Defaults: `VAULT_PATH=/Users/kohenmahler/vault`, `PORT=3000`.

## Connecting

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kohen-mcp": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Claude Code

```sh
claude mcp add kohen-mcp http://localhost:3000/mcp
```

## Tool Reference

### System

| Tool | Description |
|---|---|
| `ping` | Returns server version and ISO timestamp. Use to confirm the server is reachable. |

### Vault tools (active workspace)

| Tool | Description |
|---|---|
| `vault_read` | Read a file. Returns `{ path, content, frontmatter, tags, links }`. Auto-appends `.md` if no extension. |
| `vault_list` | List files and directories at a path. Returns `[{ name, type }]`. Call before `vault_read` when path is unknown. |
| `vault_write` | Create or overwrite a file. **Requires explicit user direction. Set `overwrite: true` only when the user asks to replace an existing file.** |
| `vault_append` | Append content to a file with a blank-line separator. Creates file if absent. |
| `vault_patch` | Patch a heading, block, or frontmatter field using `markdown-patch`. Use for targeted section edits; prefer `vault_write` for full rewrites. |
| `vault_delete` | Permanently delete a file (no trash). Irreversible. Only call when explicitly asked. |
| `vault_search` | Full-text search via Omnisearch HTTP API. Requires Obsidian open with the Omnisearch plugin and HTTP server enabled. |

### Wiki tools (AI knowledge substrate)

| Tool | Description |
|---|---|
| `wiki_read` | Read a wiki file. Same response shape as `vault_read`. Call autonomously to ground session context. |
| `wiki_list` | List wiki directory. Call before `wiki_read` to locate relevant notes. |
| `wiki_write` | Create or overwrite a wiki file. Requires explicit direction. |
| `wiki_append` | Append to a wiki topic note or session summary. Primary tool for mid-session knowledge capture. |
| `wiki_patch` | Patch a wiki heading, block, or frontmatter field. |
| `wiki_delete` | Permanently delete a wiki file. Irreversible. |
| `wiki_search` | Full-text search in the wiki via Omnisearch. Requires Obsidian open. |

### vault_read response shape

```json
{
  "path": "Notes/daily.md",
  "content": "full markdown string",
  "frontmatter": { "title": "Daily Note", "tags": ["daily"] },
  "tags": ["daily", "inline-tag"],
  "links": [
    { "target": "Projects/kohen-mcp", "type": "file" },
    { "target": "Archive/", "type": "folder" },
    { "target": "Projects/kohen-mcp#Setup", "heading": "Setup", "type": "file" },
    { "target": "https://example.com", "type": "link" }
  ]
}
```

`tags` merges frontmatter tags and inline `#tag` occurrences, deduplicated.
`links` merges wikilinks and markdown links. Local media files (images, PDFs) are filtered out. External URLs are included.

### vault_write / vault_patch behaviour

`vault_write` with `overwrite: true` writes atomically via a `.mcp_pending__` staging file before rename. Partial writes cannot corrupt the vault.

`vault_patch` delegates to the `markdown-patch` library. Supports `targetType: "heading" | "block" | "frontmatter"` and `operation: "replace" | "append" | "prepend" | "remove"`. Set `createTargetIfMissing: true` to create a missing heading.

### vault/wiki boundary

The vault and wiki boundary is intentional:

- **vault** is kohen's conscious workspace. AI tools should only write to it when explicitly directed.
- **wiki** is the AI's own knowledge substrate. AI can read and append autonomously without user direction.

This split prevents autonomous AI writes from polluting the active personal workspace.

## Development

```sh
bun run dev       # watch mode
bun test          # full suite (unit + integration)
bun test tests/unit         # unit only
bun test tests/integration  # integration only (spins up real HTTP server)
```

### Project structure

```
src/
  server.ts               # HTTP server, createHttpHandler, createMcpServer
  config/
    kohen.config.ts       # vault paths, ports, github config
    schema.ts             # TypeScript interfaces
  tools/vault/
    vault.ts              # registerVaultTools (vault_* tools)
    wiki.ts               # registerWikiTools (wiki_* tools)
    read.ts               # readVaultFile, parseFrontmatter, extractTags, extractLinks
    list.ts               # listVaultDir
    write.ts              # writeVaultFile, appendVaultFile, patchVaultFile, deleteVaultFile
    search.ts             # searchVault (Omnisearch HTTP)
    format.ts             # toToolText, toToolError

tests/
  fixtures/vault/         # static markdown files for integration tests
  unit/                   # pure function tests (no I/O side effects beyond tmp)
  integration/            # tests that spin up the real HTTP server or hit the filesystem
```

### Path safety

All tools resolve paths relative to the vault root and reject anything that resolves outside it (`../../etc/passwd` returns `{ ok: false, error: "Path traversal not allowed" }`). This check runs before any filesystem operation.

### Adding a tool

1. Implement the operation in the relevant `src/tools/vault/*.ts` file.
2. Register it in `vault.ts` (or `wiki.ts`) using `server.registerTool`.
3. Use `toToolText` for success responses and `toToolError` for error responses.
4. Add unit tests in `tests/unit/` and integration tests in `tests/integration/`.

## Planned

- `vault_backlinks` — find all notes linking to a given path (O(n) vault scan, separate tool by design)
- Telegram to vault cron — queues messages while the Mac is off, flushes on startup
- Reel capture pipeline — yt-dlp + Whisper + Claude to vault note
- Agent ticket queue — nightly Claude Code subprocess over Telegram queue
