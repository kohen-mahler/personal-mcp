import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VaultDefinition } from "../../config/schema";
import { listPaiSkills, PAI_SKILL_NAMES, readPaiSkill } from "./skills";
import { registerBootstrapTool } from "./pai-bootstrap";
import { registerHandoffTools } from "./cross-model-handoff";
import { registerWritebackTool } from "./durable-writeback";
import { toToolError, toToolText } from "../vault/format";

export function registerPaiTools(
  server: McpServer,
  vault?: VaultDefinition,
  wiki?: VaultDefinition
): void {
  if (vault && wiki) {
    registerBootstrapTool(server, vault, wiki);
  }

  if (vault) {
    registerHandoffTools(server, vault);
  }

  if (wiki) {
    registerWritebackTool(server, wiki);
  }

  server.registerTool(
    "pai_list_skills",
    {
      description:
        "List provider-neutral PAI skills available through this MCP server. " +
        "Returns names and concise, non-overlapping descriptions only. " +
        "Use pai_read_skill to load one skill's full instructions.",
      inputSchema: z.object({}),
    },
    async () => toToolText(JSON.stringify(await listPaiSkills(), null, 2))
  );

  server.registerTool(
    "pai_read_skill",
    {
      description:
        "Read one allowlisted provider-neutral PAI skill definition. " +
        "Use after pai_list_skills selects the matching workflow. " +
        "This tool accepts a skill name, never a filesystem path.",
      inputSchema: z.object({
        name: z
          .enum(PAI_SKILL_NAMES)
          .describe("Exact skill name returned by pai_list_skills"),
      }),
    },
    async ({ name }) => {
      try {
        return toToolText(JSON.stringify(await readPaiSkill(name), null, 2));
      } catch (error) {
        return toToolError(error instanceof Error ? error.message : "Unable to read PAI skill");
      }
    }
  );
}
