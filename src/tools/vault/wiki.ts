import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VaultDefinition } from "../../config/schema";
import { readVaultFile } from "./read";
import { listVaultDir } from "./list";
import { writeVaultFile, appendVaultFile, patchVaultFile, deleteVaultFile, type PatchParams } from "./write";
import { searchVault } from "./search";
import { toToolText, toToolError } from "./format";

export function registerWikiTools(server: McpServer, wiki: VaultDefinition) {

  server.registerTool(
    "wiki_read",
    {
      description:
        "Reads a wiki file to ground the session in past decisions, established patterns, or session history. " +
        "Wiki = AI-maintained knowledge substrate. " +
        "Call autonomously — no direction from kohen needed. " +
        "Use vault_read when kohen names a specific file.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "Relative path from wiki root, e.g. 'sessions/2026-06-29.md'. Call wiki_list first to enumerate paths if unknown."
          ),
      }),
    },
    async ({ path }) => {
      const result = await readVaultFile(wiki.rootPath, path);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result.data, null, 2));
    }
  );

  server.registerTool(
    "wiki_list",
    {
      description:
        "Lists wiki files and subdirectories at a path — names and types only, not content. " +
        "Call before wiki_read to locate relevant knowledge. " +
        "Browse autonomously when grounding session context.",
      inputSchema: z.object({
        path: z
          .string()
          .default("")
          .describe(
            "Relative path to a wiki directory. Leave empty for wiki root. Returns names and types — call wiki_read with a specific path to retrieve content."
          ),
      }),
    },
    async ({ path }) => {
      const result = await listVaultDir(wiki.rootPath, path);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result.entries, null, 2));
    }
  );

  server.registerTool(
    "wiki_write",
    {
      description:
        "Creates or overwrites a wiki file. Use for restructuring knowledge artifacts or creating new reference entries. " +
        "Use wiki_append for additive mid-session captures — not this tool.\n\n" +
        "PERMISSION REQUIRED: If the file already exists, you MUST set overwrite: true. Only do this when the user has explicitly asked you to overwrite or replace a file.",
      inputSchema: z.object({
        path: z.string().describe("Relative path within the wiki, e.g. 'AI/Transformers.md'"),
        content: z.string().describe("Full file content to write"),
        overwrite: z.boolean().optional().describe("Set to true to overwrite an existing file. Requires explicit user permission."),
      }),
    },
    async ({ path, content, overwrite }) => {
      const result = await writeVaultFile(wiki.rootPath, path, content, { overwrite });
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result, null, 2));
    }
  );

  server.registerTool(
    "wiki_append",
    {
      description:
        "Appends to a wiki topic note (call wiki_search first to locate by subject) " +
        "or a session summary note (path: 'sessions/YYYY-MM-DD.md', Stop hook only). " +
        "Creates file if absent.",
      inputSchema: z.object({
        path: z.string().describe("Topic note: run wiki_search first to locate by subject, e.g. 'AI/prompting-patterns.md'. Session note: 'sessions/YYYY-MM-DD.md' — only on Stop hook trigger."),
        content: z.string().describe("Decision, insight, or pattern to persist. Should be self-contained and reusable across future sessions."),
      }),
    },
    async ({ path, content }) => {
      const result = await appendVaultFile(wiki.rootPath, path, content);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result, null, 2));
    }
  );

  server.registerTool(
    "wiki_patch",
    {
      description:
        "Patches a wiki file's heading, block, or frontmatter field. " +
        "Use for targeted mid-session knowledge updates. " +
        "Use wiki_write for full restructures; wiki_append for additive captures.",
      inputSchema: z.object({
        path: z.string().describe("Relative path within the wiki. Call wiki_list or wiki_search first if path is unknown."),
        targetType: z.enum(["heading", "block", "frontmatter"]).describe("Type of target to patch"),
        target: z.string().describe("Heading text, block ID, or frontmatter key"),
        operation: z.enum(["replace", "append", "prepend", "remove"]),
        content: z.string().describe("New content (empty string for remove)"),
        createTargetIfMissing: z.boolean().optional(),
        trimTargetWhitespace: z.boolean().optional(),
        targetDelimiter: z.string().optional().describe("Delimiter for nested headings, default '::'"),
      }),
    },
    async ({ path, targetType, target, operation, content, createTargetIfMissing, trimTargetWhitespace, targetDelimiter }) => {
      const params: PatchParams = { targetType, target, operation, content, createTargetIfMissing, trimTargetWhitespace, targetDelimiter };
      const result = await patchVaultFile(wiki.rootPath, path, params);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result, null, 2));
    }
  );

  server.registerTool(
    "wiki_delete",
    {
      description:
        "Permanently delete a file from kohen's wiki. This is irreversible — the file is not moved to trash. Only call this when explicitly asked.",
      inputSchema: z.object({
        path: z.string().describe("Relative path of wiki file to delete. Call wiki_list first to confirm the path before deleting."),
      }),
    },
    async ({ path }) => {
      const result = await deleteVaultFile(wiki.rootPath, path);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result, null, 2));
    }
  );

  if (wiki.omnisearchPort) {
    server.registerTool(
      "wiki_search",
      {
        description:
          "Searches wiki knowledge by content — returns ranked results with paths, scores, and excerpts. " +
          "Call autonomously to ground context or to locate the right topic note before wiki_append. " +
          "Use vault_search when kohen asks to find a personal note. " +
          "Supports quoted phrases (\"exact match\") and exclusions (-term). " +
          "Requires Obsidian to be open with the Omnisearch HTTP server enabled.",
        inputSchema: z.object({
          query: z.string().describe("Search terms. Supports \"quoted phrases\" and -exclusions."),
          limit: z.number().optional().default(10).describe("Maximum results to return (default 10)."),
        }),
      },
      async ({ query, limit }) => {
        const result = await searchVault(wiki.omnisearchPort!, query, limit);
        if (!result.ok) return toToolError(result.error);
        return toToolText(JSON.stringify(result.results, null, 2));
      }
    );
  }
}
