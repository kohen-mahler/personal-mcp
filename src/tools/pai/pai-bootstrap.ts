import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VaultDefinition } from "../../config/schema";
import { readVaultFile } from "../vault/read";
import { listVaultDir } from "../vault/list";
import { toToolError, toToolText } from "../vault/format";

export function registerBootstrapTool(
  server: McpServer,
  vault: VaultDefinition,
  wiki: VaultDefinition
): void {
  server.registerTool(
    "pai_bootstrap",
    {
      description:
        "Load compact PAI context before substantive work. Returns hot wiki path, active task slugs, " +
        "and optionally a specific task packet. Read-only — never claims, transfers, or closes tasks. " +
        "Call at session start or when resuming a task.",
      inputSchema: z.object({
        task_slug: z
          .string()
          .optional()
          .describe("Load a specific task packet alongside hot context"),
      }),
    },
    async ({ task_slug }) => {
      try {
        const queueResult = await listVaultDir(vault.rootPath, "queue/active");
        const activeTasks = queueResult.ok
          ? queueResult.entries
              .filter((f) => f.type === "file" && f.name.endsWith(".md"))
              .map((f) => f.name.replace(".md", ""))
          : [];

        const context: Record<string, unknown> = {
          hot_path: "hot.md",
          wiki_root: wiki.rootPath,
          active_tasks: activeTasks,
          policy_version: "1.0",
        };

        if (task_slug) {
          const taskResult = await readVaultFile(vault.rootPath, `queue/active/${task_slug}.md`);
          if (taskResult.ok) {
            context.task = taskResult.data;
          } else {
            context.task_error = `Task not found: ${task_slug}`;
          }
        }

        return toToolText(JSON.stringify(context, null, 2));
      } catch (error) {
        return toToolError(error instanceof Error ? error.message : "Bootstrap failed");
      }
    }
  );
}
