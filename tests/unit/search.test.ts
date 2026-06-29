import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { searchVault } from "../../src/tools/vault/search";

// ─── Mock Omnisearch HTTP server ────────────────────────────────────────────────

const MOCK_PORT = 59999;

const MOCK_RESULTS = [
  {
    score: 42.1,
    vault: "vault",
    path: "Notes/daily/2026-06-29.md",
    basename: "2026-06-29",
    foundWords: ["mcp", "server"],
    matches: [{ match: "mcp", offset: 12 }],
    excerpt: "Working on the MCP server today.",
  },
  {
    score: 31.5,
    vault: "vault",
    path: "Projects/kohen-mcp.md",
    basename: "kohen-mcp",
    foundWords: ["mcp"],
    matches: [{ match: "mcp", offset: 0 }],
    excerpt: "MCP server project notes.",
  },
];

let mockServer: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  mockServer = Bun.serve({
    port: MOCK_PORT,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/search") {
        const q = url.searchParams.get("q") ?? "";
        if (q === "error") {
          return new Response("Internal Error", { status: 500 });
        }
        if (q === "empty") {
          return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(MOCK_RESULTS), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(null, { status: 404 });
    },
  });
});

afterAll(() => {
  mockServer.stop();
});

// ─── searchVault ────────────────────────────────────────────────────────────────

describe("searchVault", () => {
  it("returns ok true with shaped results on successful search", async () => {
    const result = await searchVault(MOCK_PORT, "mcp server");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results.length).toBeGreaterThan(0);
    const first = result.results[0];
    expect(first).toHaveProperty("path");
    expect(first).toHaveProperty("score");
    expect(first).toHaveProperty("excerpt");
    expect(first).toHaveProperty("foundWords");
  });

  it("result does not include raw matches array or vault or basename fields", async () => {
    const result = await searchVault(MOCK_PORT, "mcp");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const first = result.results[0] as Record<string, unknown>;
    expect(first.matches).toBeUndefined();
    expect(first.vault).toBeUndefined();
    expect(first.basename).toBeUndefined();
  });

  it("maps path and score correctly from Omnisearch response", async () => {
    const result = await searchVault(MOCK_PORT, "mcp server");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results[0].path).toBe("Notes/daily/2026-06-29.md");
    expect(result.results[0].score).toBe(42.1);
  });

  it("maps excerpt and foundWords correctly", async () => {
    const result = await searchVault(MOCK_PORT, "mcp server");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results[0].excerpt).toBe("Working on the MCP server today.");
    expect(result.results[0].foundWords).toEqual(["mcp", "server"]);
  });

  it("respects limit — returns at most limit results", async () => {
    const result = await searchVault(MOCK_PORT, "mcp", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results.length).toBe(1);
  });

  it("returns all results when limit exceeds total", async () => {
    const result = await searchVault(MOCK_PORT, "mcp", 100);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results.length).toBe(MOCK_RESULTS.length);
  });

  it("returns ok true with empty array when no results found", async () => {
    const result = await searchVault(MOCK_PORT, "empty");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results).toEqual([]);
  });

  it("returns ok false when server returns non-200 status", async () => {
    const result = await searchVault(MOCK_PORT, "error");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("500");
  });

  it("returns ok false when nothing is listening on the port", async () => {
    const result = await searchVault(59998, "mcp");
    expect(result.ok).toBe(false);
  });

  it("error message for unavailable server mentions the port", async () => {
    const result = await searchVault(59998, "mcp");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("59998");
  });

  it("error message for unavailable server mentions Obsidian", async () => {
    const result = await searchVault(59998, "mcp");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain("obsidian");
  });
});
