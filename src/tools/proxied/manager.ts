import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ProxiedServerConfig } from "../../config/schema.js";

interface ActiveProxy {
  name: string;
  client: Client;
  tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>;
}

// Converts a single JSON Schema property definition to a Zod type.
function propToZod(prop: Record<string, unknown>, required: boolean): z.ZodTypeAny {
  const desc = typeof prop.description === "string" ? prop.description : undefined;

  let schema: z.ZodTypeAny;

  if (Array.isArray(prop.enum) && prop.enum.length > 0) {
    const members = prop.enum as [string, ...string[]];
    schema = z.enum(members);
  } else {
    switch (prop.type) {
      case "string":
        schema = z.string();
        break;
      case "number":
      case "integer":
        schema = z.number();
        break;
      case "boolean":
        schema = z.boolean();
        break;
      case "array":
        schema = z.array(z.unknown());
        break;
      case "object":
        schema = z.record(z.string(), z.unknown());
        break;
      default:
        schema = z.unknown();
    }
  }

  if (desc) schema = (schema as z.ZodString).describe(desc);
  return required ? schema : schema.optional();
}

// Converts a tool's JSON Schema inputSchema into a Zod shape for registerTool.
function toZodShape(inputSchema?: Record<string, unknown>): Record<string, z.ZodTypeAny> {
  if (!inputSchema) return {};
  const properties = (inputSchema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set<string>((inputSchema.required as string[] | undefined) ?? []);
  return Object.fromEntries(
    Object.entries(properties).map(([key, prop]) => [key, propToZod(prop, required.has(key))])
  );
}

export class ProxyManager {
  private active: ActiveProxy[] = [];

  constructor(private configs: ProxiedServerConfig[]) {}

  async start(): Promise<void> {
    await Promise.allSettled(
      this.configs.map(async (cfg) => {
        try {
          const transport = new StdioClientTransport({
            command: cfg.command,
            args: cfg.args,
            env: { ...(process.env as Record<string, string>), ...cfg.env },
          });
          const client = new Client({ name: `kohen-mcp-proxy-${cfg.name}`, version: "0.1.0" });
          await client.connect(transport);
          const { tools } = await client.listTools();
          this.active.push({ name: cfg.name, client, tools });
          console.error(`[proxy] ${cfg.name}: ${tools.length} tool(s) registered`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[proxy] ${cfg.name}: failed to start — ${msg}`);
        }
      })
    );
  }

  registerTools(server: McpServer): void {
    for (const { name: serverName, client, tools } of this.active) {
      for (const tool of tools) {
        const zodShape = toZodShape(tool.inputSchema);
        server.registerTool(
          tool.name,
          {
            description: tool.description ?? `${tool.name} (via ${serverName})`,
            inputSchema: z.object(zodShape),
          },
          async (params) => {
            const result = await client.callTool({
              name: tool.name,
              arguments: params as Record<string, unknown>,
            });
            if (!("content" in result)) {
              return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
            }
            return result as { content: Array<{ type: "text"; text: string }> };
          }
        );
      }
    }
  }

  get toolCount(): number {
    return this.active.reduce((sum, p) => sum + p.tools.length, 0);
  }
}

let instance: ProxyManager | null = null;

export async function initProxyManager(configs: ProxiedServerConfig[]): Promise<ProxyManager> {
  if (!instance) {
    instance = new ProxyManager(configs);
    await instance.start();
  }
  return instance;
}
