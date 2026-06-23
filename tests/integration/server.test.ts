import { describe, it } from "bun:test";

// Spins up the real HTTP server on a test port and exercises
// the full MCP JSON-RPC flow end-to-end.
//
// NOTE: StreamableHTTP returns SSE (text/event-stream), not plain JSON.
// A proper SSE response parser is needed before these tests can be implemented.
// All tests are marked todo until that utility is built.

describe("server — transport", () => {
  it.todo("GET /mcp returns 200 (SSE stream opens)");
  it.todo("POST /mcp with missing Accept header returns 406");
  it.todo("GET /health returns { ok: true, version }");
  it.todo("unknown route returns 404");
});

describe("server — MCP initialize", () => {
  // NOTE: StreamableHTTP returns SSE format, not plain JSON.
  // These tests need an SSE response parser before they can run.
  it.todo("responds to initialize with serverInfo");
});

describe("server — tools/list", () => {
  it.todo("lists ping, vault_read, vault_list, wiki_read, wiki_list");
  it.todo("each tool has a name and description");
  it.todo("each tool has an inputSchema");
});

describe("server — ping", () => {
  it.todo("ping returns pong with version and timestamp");
});

describe("server — vault_list", () => {
  it.todo("vault_list on empty path returns JSON array");
  it.todo("vault_list on a file path returns isError: true with vault_read hint");
  it.todo("vault_list on non-existent path returns isError: true");
});

describe("server — vault_read", () => {
  it.todo("vault_read returns content, frontmatter, tags, links");
  it.todo("vault_read with no .md extension auto-appends it");
  it.todo("vault_read on missing file returns isError: true");
  it.todo("vault_read path traversal attempt returns isError: true");
});
