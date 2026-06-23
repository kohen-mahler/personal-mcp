import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import config from "../../config/kohen.config";
import { readVaultFile } from "./read";
import { listVaultDir } from "./list";

const vault = config.vaults.find((v) => v.name === "vault")!;

function toText(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function registerVaultTools(server: McpServer) {
  server.registerTool(
    "vault_read",
    {
      description:
        "Read a file from kohen's personal vault. " +
        "Returns the full markdown content plus parsed frontmatter and tags. " +
        "Use for: daily notes, Jotpad (active todos/priorities), journal entries, " +
        "project notes, and any active or in-progress context. " +
        "Prefer this vault when capturing or checking on current work.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "Relative path to the file within the vault, e.g. '00 Dashboard/Jotpad.md'"
          ),
      }),
    },
    async ({ path }) => {
      const result = await readVaultFile(vault.rootPath, path);
      if (!result.ok) return { isError: true, ...toText(result.error) };
      return toText(JSON.stringify(result.data, null, 2));
    }
  );

  server.registerTool(
    "vault_list",
    {
      description:
        "List files and folders in kohen's personal vault. " +
        "Use to explore structure before reading a specific file. " +
        "Leave path empty to list the vault root.",
      inputSchema: z.object({
        path: z
          .string()
          .default("")
          .describe(
            "Relative path to a directory within the vault. Leave empty for vault root."
          ),
      }),
    },
    async ({ path }) => {
      const result = await listVaultDir(vault.rootPath, path);
      if (!result.ok) return { isError: true, ...toText(result.error) };
      return toText(JSON.stringify(result.entries, null, 2));
    }
  );
}
