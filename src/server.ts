import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import config from "./config/kohen.config";
import type { VaultDefinition } from "./config/schema";
import { registerVaultTools, registerWikiTools } from "./tools/vault/index";
import { registerRitualTools } from "./tools/ritual/index";
import { initProxyManager, type ProxyManager } from "./tools/proxied/manager";

export const VERSION = "0.1.0";

export function createMcpServer(vaultDef: VaultDefinition, wikiDef: VaultDefinition, proxyManager?: ProxyManager): McpServer {
  const server = new McpServer({ name: "kohen-mcp", version: VERSION });

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
  proxyManager?.registerTools(server);

  return server;
}

function logError(context: Record<string, unknown>): void {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), ...context }));
}

function sendJSON(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(data);
}

export function createHttpHandler(vaultDef: VaultDefinition, wikiDef: VaultDefinition, proxyManager?: ProxyManager) {
  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const isMcp = req.url === "/mcp";

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

if (import.meta.main) {
  const vault = config.vaults.find((v) => v.name === "vault")!;
  const wiki = config.vaults.find((v) => v.name === "wiki")!;
  const proxyManager = await initProxyManager(config.proxied ?? []);
  const httpServer = createServer(createHttpHandler(vault, wiki, proxyManager));
  httpServer.listen(config.port, () => {
    console.error(`kohen-mcp v${VERSION} running on http://localhost:${config.port} (+${proxyManager.toolCount} proxied tools)`);
  });
}
