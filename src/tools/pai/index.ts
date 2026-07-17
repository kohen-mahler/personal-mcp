import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VaultDefinition } from "../../config/schema";
import { registerBootstrapTool } from "./pai-bootstrap";
import { registerHandoffTools } from "./cross-model-handoff";
import { registerWritebackTool } from "./durable-writeback";

export function registerPaiTools(
  server: McpServer,
  wiki?: VaultDefinition
): void {
  if (wiki) {
    registerBootstrapTool(server, wiki);
    registerHandoffTools(server, wiki);
    registerWritebackTool(server, wiki);
  }
}
