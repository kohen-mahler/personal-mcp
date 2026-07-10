import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VaultDefinition } from "../../config/schema";
import { getMorningContext } from "./morning";
import { toToolText, toToolError } from "../vault/format";

export function registerRitualTools(server: McpServer, vault: VaultDefinition, wiki: VaultDefinition) {
  server.registerTool(
    "morning_context",
    {
      description:
        "Fetches bundled morning context (date, Jotpad, yesterday's note, goals) in one call. " +
        "Call once at morning session start. For individual fields, use vault_read or wiki_read instead.",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await getMorningContext(vault.rootPath, wiki.rootPath);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result.data, null, 2));
    }
  );
}
