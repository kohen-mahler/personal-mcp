import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import config from "./config/kohen.config";
import { registerVaultTools, registerWikiTools } from "./tools/vault/index";

const VERSION = "0.1.0";

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "kohen-mcp", version: VERSION });

  server.registerTool(
    "ping",
    {
      description: "Health check — returns server version and current timestamp.",
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

  registerVaultTools(server);
  registerWikiTools(server);

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

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    const isMcp = req.url === "/mcp";

    if (isMcp && (req.method === "POST" || req.method === "GET")) {
      try {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        const mcpServer = createMcpServer();
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
});

httpServer.listen(config.port, () => {
  console.log(`kohen-mcp v${VERSION} running on http://localhost:${config.port}`);
});
