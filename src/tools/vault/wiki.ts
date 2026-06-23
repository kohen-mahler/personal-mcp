import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import config from "../../config/kohen.config.ts";
import { readVaultFile } from "./read.ts";
import { listVaultDir } from "./list.ts";

const wiki = config.vaults.find((v) => v.name === "wiki")!;

function toText(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function registerWikiTools(server: McpServer) {
  server.registerTool(
    "wiki_read",
    {
      description:
        "Read a file from kohen's personal wiki. " +
        "Returns the full markdown content plus parsed frontmatter and tags. " +
        "Use for: reference material, permanent notes, and structured knowledge. " +
        "Prefer this vault for stable reference content — not day-to-day active notes.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "Relative path to the file within the wiki, e.g. 'AI/Transformers.md'"
          ),
      }),
    },
    async ({ path }) => {
      const result = await readVaultFile(wiki.rootPath, path);
      if (!result.ok) return { isError: true, ...toText(result.error) };
      return toText(JSON.stringify(result.data, null, 2));
    }
  );

  server.registerTool(
    "wiki_list",
    {
      description:
        "List files and folders in kohen's personal wiki. " +
        "Use to explore structure before reading a specific file. " +
        "Leave path empty to list the wiki root.",
      inputSchema: z.object({
        path: z
          .string()
          .default("")
          .describe(
            "Relative path to a directory within the wiki. Leave empty for wiki root."
          ),
      }),
    },
    async ({ path }) => {
      const result = await listVaultDir(wiki.rootPath, path);
      if (!result.ok) return { isError: true, ...toText(result.error) };
      return toText(JSON.stringify(result.entries, null, 2));
    }
  );
}
