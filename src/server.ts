import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { appendFileSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import config from "./config/kohen.config";
import type { VaultDefinition } from "./config/schema";
import { registerVaultTools, registerWikiTools } from "./tools/vault/index";
import { registerRitualTools } from "./tools/ritual/index";
import { registerPaiTools } from "./tools/pai/index";
import { initProxyManager, type ProxyManager } from "./tools/proxied/manager";

export const VERSION = "0.1.0";
const JOB_FEED_ASSET_DIR = join(process.cwd(), "mockups", "job-feed");

// ── MCP call logging ──────────────────────────────────────────────────────────

const MCP_LOG_PATH = join(process.env.HOME ?? "", ".claude", "PAI", "MEMORY", "OBSERVABILITY", "mcp-calls.jsonl");

function logMcpCall(entry: {
  timestamp: string;
  tool_name: string;
  latency_ms: number;
  status: "success" | "error";
  error_message?: string;
  request?: unknown;
  response?: unknown;
}): void {
  try {
    mkdirSync(join(process.env.HOME ?? "", ".claude", "PAI", "MEMORY", "OBSERVABILITY"), { recursive: true });
    appendFileSync(MCP_LOG_PATH, JSON.stringify(entry) + "\n");
  } catch {
    // non-fatal — never let logging break the server
  }
}

// Wraps McpServer.registerTool to log every call with args, response, latency, and status.
function instrumentedServer(server: McpServer): McpServer {
  const orig = server.registerTool.bind(server) as any;
  (server as any).registerTool = (name: string, toolConfig: unknown, handler: (...args: unknown[]) => Promise<unknown>) => {
    return orig(name, toolConfig as any, async (...args: unknown[]) => {
      const start = Date.now();
      const request = args[0] ?? null;
      try {
        const result = await handler(...args);
        // Truncate large response bodies to keep the JSONL manageable
        const responsePreview = truncateForLog(result);
        logMcpCall({
          timestamp: new Date().toISOString(),
          tool_name: name,
          latency_ms: Date.now() - start,
          status: "success",
          request,
          response: responsePreview,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logMcpCall({
          timestamp: new Date().toISOString(),
          tool_name: name,
          latency_ms: Date.now() - start,
          status: "error",
          error_message: message,
          request,
        });
        throw err;
      }
    });
  };
  return server;
}

function truncateForLog(value: unknown, maxChars = 2000): unknown {
  if (value === null || value === undefined) return value;
  const s = JSON.stringify(value);
  if (s.length <= maxChars) return value;
  return { _truncated: true, preview: s.slice(0, maxChars) + "…" };
}

// ── MCP Server factory ────────────────────────────────────────────────────────

export function createMcpServer(vaultDef: VaultDefinition, wikiDef: VaultDefinition, proxyManager?: ProxyManager): McpServer {
  const server = instrumentedServer(new McpServer({ name: "kohen-mcp", version: VERSION }));

  server.registerTool(
    "ping",
    {
      description: "Health check. Returns server version and ISO timestamp. Call to verify the MCP server is reachable before diagnosing connection issues.",
      inputSchema: z.object({}),
    },
    async () => ({
      content: [
        {
          type: "text",
          text: `pong — kohen-mcp v${VERSION} alive at ${new Date().toISOString()}`,
        },
      ],
    })
  );

  registerVaultTools(server, vaultDef);
  registerWikiTools(server, wikiDef);
  registerRitualTools(server, vaultDef, wikiDef);
  registerPaiTools(server, wikiDef);
  proxyManager?.registerTools(server);

  return server;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function logError(context: Record<string, unknown>): void {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), ...context }));
}

function sendJSON(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(data);
}

function sendRedirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location });
  res.end();
}

function contentTypeFor(fileName: string): string {
  if (fileName.endsWith(".html")) return "text/html; charset=utf-8";
  if (fileName.endsWith(".css")) return "text/css; charset=utf-8";
  if (fileName.endsWith(".js")) return "text/javascript; charset=utf-8";
  return "application/octet-stream";
}

async function serveJobFeedAsset(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (pathname === "/job-feed") {
    sendRedirect(res, "/job-feed/");
    return true;
  }
  if (!pathname.startsWith("/job-feed/")) return false;

  const requested = pathname.slice("/job-feed/".length) || "index.html";
  if (!/^[a-zA-Z0-9._-]+$/.test(requested)) {
    res.writeHead(400);
    res.end("Bad request");
    return true;
  }

  try {
    const file = await readFile(join(JOB_FEED_ASSET_DIR, requested));
    res.writeHead(200, { "Content-Type": contentTypeFor(requested) });
    if (req.method === "HEAD") {
      res.end();
      return true;
    }
    res.end(file);
    return true;
  } catch {
    res.writeHead(404);
    res.end("Not found");
    return true;
  }
}

// ── HTTP request handler ──────────────────────────────────────────────────────

export function createHttpHandler(vaultDef: VaultDefinition, wikiDef: VaultDefinition, proxyManager?: ProxyManager) {
  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const isMcp = req.url === "/mcp";

      if (await serveJobFeedAsset(req, res)) {
        return;
      }

      if (isMcp && (req.method === "POST" || req.method === "GET")) {
        try {
          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
          const mcpServer = createMcpServer(vaultDef, wikiDef, proxyManager);
          await mcpServer.connect(transport);
          await transport.handleRequest(req, res);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown internal error";
          logError({ errorType: "mcp_handler", message });
          sendJSON(res, 200, {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32603, message: "Internal server error", data: { details: message } },
          });
        }
        return;
      }

      if (req.method === "GET" && req.url === "/health") {
        sendJSON(res, 200, { ok: true, version: VERSION });
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logError({ errorType: "http_handler", message });
      res.writeHead(500);
      res.end("Internal server error");
    }
  };
}

// ── Entrypoint ────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const vault = config.vaults.find((v) => v.name === "vault")!;
  const wiki = config.vaults.find((v) => v.name === "wiki")!;
  const proxyManager = await initProxyManager(config.proxied ?? []);
  const httpServer = createServer(createHttpHandler(vault, wiki, proxyManager));
  httpServer.listen(config.port, () => {
    console.error(`kohen-mcp v${VERSION} running on http://localhost:${config.port} (+${proxyManager.toolCount} proxied tools)`);
  });
}
