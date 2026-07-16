import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VaultDefinition } from "../../config/schema";
import { appendVaultFile, patchVaultFile, writeVaultFile } from "../vault/write";
import { toToolError, toToolText } from "../vault/format";

export function registerWritebackTool(server: McpServer, wiki: VaultDefinition): void {
  server.registerTool(
    "pai_durable_writeback",
    {
      description:
        "Persist an accepted decision, verified fact, reusable pattern, or durable blocker as canonical wiki knowledge. " +
        "Run wiki_search first to find the best target note. " +
        "Prefer 'append' over 'patch_heading' over 'create_new'. " +
        "Task completion alone does not require a writeback — only call when there is genuinely durable knowledge.",
      inputSchema: z.object({
        wiki_path: z
          .string()
          .describe(
            "Target wiki note path (relative, omit .md). Run wiki_search first to locate the best match."
          ),
        content: z
          .string()
          .describe(
            "Minimal, self-contained knowledge update: outcome, significance, evidence, and any durable follow-up."
          ),
        operation: z
          .enum(["append", "patch_heading", "create_new"])
          .describe(
            "append: add to end of file. patch_heading: update under a specific heading. create_new: create a new note (fails if exists)."
          ),
        heading: z
          .string()
          .optional()
          .describe("Required for patch_heading: exact heading text to target."),
        patch_operation: z
          .enum(["replace", "append", "prepend"])
          .optional()
          .describe("For patch_heading: how to modify the section content (default: append)."),
        dry_run: z
          .boolean()
          .optional()
          .describe("Return a preview of the change without writing it."),
      }),
    },
    async ({ wiki_path, content, operation, heading, patch_operation, dry_run }) => {
      try {
        if (dry_run) {
          return toToolText(
            JSON.stringify({ dry_run: true, wiki_path, operation, heading, content }, null, 2)
          );
        }

        if (operation === "append") {
          const result = await appendVaultFile(wiki.rootPath, wiki_path, content);
          if (!result.ok) return toToolError(result.error);
          return toToolText(
            JSON.stringify({ success: true, operation: "append", path: result.path }, null, 2)
          );
        }

        if (operation === "patch_heading") {
          if (!heading) return toToolError("patch_heading requires 'heading'");
          const result = await patchVaultFile(wiki.rootPath, wiki_path, {
            targetType: "heading",
            target: heading,
            operation: patch_operation ?? "append",
            content,
            createTargetIfMissing: true,
          });
          if (!result.ok) return toToolError(result.error);
          return toToolText(
            JSON.stringify({ success: true, operation: "patch_heading", path: result.path }, null, 2)
          );
        }

        if (operation === "create_new") {
          const result = await writeVaultFile(wiki.rootPath, wiki_path, content, {
            overwrite: false,
          });
          if (!result.ok) return toToolError(result.error);
          return toToolText(
            JSON.stringify({ success: true, operation: "create_new", path: result.path }, null, 2)
          );
        }

        return toToolError(`Unknown operation: ${operation}`);
      } catch (error) {
        return toToolError(error instanceof Error ? error.message : "Writeback failed");
      }
    }
  );
}
