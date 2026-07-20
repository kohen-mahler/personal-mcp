import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VaultDefinition } from "../../config/schema";
import { readVaultFile } from "../vault/read";
import { toToolError, toToolText } from "../vault/format";

const HOME = process.env.HOME ?? "";
const PAI_DIR = join(HOME, ".claude", "PAI");

function readPAIFile(relativePath: string): string {
  const fullPath = join(PAI_DIR, relativePath);
  if (!existsSync(fullPath)) return "";
  try { return readFileSync(fullPath, "utf-8").trim() } catch { return "" }
}

export function registerContextTool(server: McpServer, wiki: VaultDefinition): void {
  server.registerTool(
    "pai_context",
    {
      description:
        "Load PAI identity and goal context at session start. Returns who kohen is, active goals, " +
        "active projects, key constraints (runtime, language, tooling), and current focus from hot.md. " +
        "Call once before any substantive work. Complement with pai_bootstrap for active task state.",
      inputSchema: z.object({
        include_hot: z
          .boolean()
          .optional()
          .default(true)
          .describe("Include current focus from wiki/hot.md (default: true)"),
      }),
    },
    async ({ include_hot }) => {
      try {
        const identity = readPAIFile("USER/PRINCIPAL_IDENTITY.md")
        const telos = readPAIFile("USER/TELOS/PRINCIPAL_TELOS.md")
        const projects = readPAIFile("USER/PROJECTS/PROJECTS.md")

        let hot: string | null = null
        if (include_hot !== false) {
          const hotResult = await readVaultFile(wiki.rootPath, "hot.md")
          if (hotResult.ok) hot = hotResult.data.content
        }

        const context = {
          principal: {
            name: "kohen",
            timezone: "America/Los_Angeles",
            identity_doc: identity,
          },
          telos: telos,
          projects: projects,
          constraints: {
            runtime: "bun (never npm/npx — zero exceptions)",
            language: "TypeScript (never Python unless kohen explicitly approves)",
            paths: "never hardcode paths — use process.env.HOME or relative paths",
            comments: "default to no comments — only add when WHY is non-obvious",
            scope: "minimum code that solves the problem — no speculative features",
          },
          current_focus: hot,
          mcp_server: "http://localhost:3000/mcp",
          wiki_root: wiki.rootPath,
        }

        return toToolText(JSON.stringify(context, null, 2))
      } catch (error) {
        return toToolError(error instanceof Error ? error.message : "Context load failed")
      }
    }
  )
}
