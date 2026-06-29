import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createServer } from "node:http";
import { createHttpHandler, VERSION } from "../../src/server";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

const FIXTURE_ROOT = join(import.meta.dir, "../fixtures/vault");

const VAULT_DEF = { name: "vault", rootPath: FIXTURE_ROOT, description: "test vault" };
const WIKI_DEF = { name: "wiki", rootPath: FIXTURE_ROOT, description: "test wiki" };

let baseUrl: string;
let testServer: ReturnType<typeof createServer>;

beforeAll(async () => {
  const handler = createHttpHandler(VAULT_DEF, WIKI_DEF);
  testServer = createServer(handler);
  await new Promise<void>((resolve) => testServer.listen(0, "127.0.0.1", resolve));
  const { port } = testServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  // Force-close any lingering SSE connections before waiting for server close
  (testServer as any).closeAllConnections?.();
  await new Promise<void>((resolve) => testServer.close(() => resolve()));
});

// ─── SSE helpers ────────────────────────────────────────────────────────────────

// Parses `data: {...}` lines out of an SSE response body
async function parseSse(res: Response): Promise<any[]> {
  const text = await res.text();
  const results: any[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("data: ")) {
      try {
        results.push(JSON.parse(t.slice(6)));
      } catch {}
    }
  }
  return results;
}

// In stateless StreamableHTTP mode, each POST is independent — no init handshake needed
async function mcpRequest(method: string, params: object = {}, id = 1): Promise<any> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const events = await parseSse(res);
  return events.find((e) => e.id === id);
}

async function callTool(name: string, args: object = {}): Promise<any> {
  const response = await mcpRequest("tools/call", { name, arguments: args });
  return response?.result;
}

// ─── server — transport ─────────────────────────────────────────────────────────

describe("server — transport", () => {
  it("GET /health returns { ok: true, version }", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.version).toBe(VERSION);
  });

  it("unknown route returns 404", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
  });

  it("GET /mcp returns 200 (SSE stream opens)", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      headers: { Accept: "text/event-stream" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    await res.body?.cancel();
  });

  it("POST /mcp with missing Accept header returns 406", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    expect(res.status).toBe(406);
  });
});

// ─── server — MCP initialize ────────────────────────────────────────────────────

describe("server — MCP initialize", () => {
  it("responds to initialize with serverInfo", async () => {
    const response = await mcpRequest(
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
      0
    );
    expect(response?.result?.serverInfo?.name).toBe("kohen-mcp");
    expect(response?.result?.serverInfo?.version).toBe(VERSION);
  });
});

// ─── server — tools/list ────────────────────────────────────────────────────────

describe("server — tools/list", () => {
  it("lists ping, vault_read, vault_list, wiki_read, wiki_list", async () => {
    const response = await mcpRequest("tools/list", {});
    const names = ((response?.result?.tools ?? []) as any[]).map((t: any) => t.name as string);
    expect(names).toContain("ping");
    expect(names).toContain("vault_read");
    expect(names).toContain("vault_list");
    expect(names).toContain("wiki_read");
    expect(names).toContain("wiki_list");
  });

  it("each tool has a name and description", async () => {
    const response = await mcpRequest("tools/list", {});
    const tools: any[] = response?.result?.tools ?? [];
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("each tool has an inputSchema", async () => {
    const response = await mcpRequest("tools/list", {});
    const tools: any[] = response?.result?.tools ?? [];
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
    }
  });
});

// ─── server — ping ──────────────────────────────────────────────────────────────

describe("server — ping", () => {
  it("ping returns pong with version and timestamp", async () => {
    const result = await callTool("ping");
    const text = result?.content?.[0]?.text as string;
    expect(text).toContain("pong");
    expect(text).toContain(VERSION);
    expect(text).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── server — vault_list ────────────────────────────────────────────────────────

describe("server — vault_list", () => {
  it("vault_list on empty path returns JSON array", async () => {
    const result = await callTool("vault_list", { path: "" });
    const entries = JSON.parse(result?.content?.[0]?.text ?? "null");
    expect(Array.isArray(entries)).toBe(true);
    const names = entries.map((e: any) => e.name);
    expect(names).toContain("index.md");
  });

  it("vault_list on a file path returns isError: true with vault_read hint", async () => {
    const result = await callTool("vault_list", { path: "index.md" });
    expect(result?.isError).toBe(true);
    expect(result?.content?.[0]?.text).toContain("vault_read");
  });

  it("vault_list on non-existent path returns isError: true", async () => {
    const result = await callTool("vault_list", { path: "DoesNotExist" });
    expect(result?.isError).toBe(true);
  });
});

// ─── server — vault_read ────────────────────────────────────────────────────────

describe("server — vault_read", () => {
  it("vault_read returns content, frontmatter, tags, links", async () => {
    const result = await callTool("vault_read", { path: "index.md" });
    const data = JSON.parse(result?.content?.[0]?.text ?? "null");
    expect(data.path).toBe("index.md");
    expect(typeof data.content).toBe("string");
    expect(typeof data.frontmatter).toBe("object");
    expect(Array.isArray(data.tags)).toBe(true);
    expect(Array.isArray(data.links)).toBe(true);
  });

  it("vault_read with no .md extension auto-appends it", async () => {
    const result = await callTool("vault_read", { path: "index" });
    const data = JSON.parse(result?.content?.[0]?.text ?? "null");
    expect(data.path).toBe("index.md");
  });

  it("vault_read on missing file returns isError: true", async () => {
    const result = await callTool("vault_read", { path: "ghost.md" });
    expect(result?.isError).toBe(true);
  });

  it("vault_read path traversal attempt returns isError: true", async () => {
    const result = await callTool("vault_read", { path: "../../etc/passwd" });
    expect(result?.isError).toBe(true);
    expect(result?.content?.[0]?.text).toContain("Path traversal");
  });
});
