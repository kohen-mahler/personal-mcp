import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VaultDefinition } from "../../config/schema";
import { readVaultFile } from "./read";
import { listVaultDir } from "./list";
import { writeVaultFile, appendVaultFile, patchVaultFile, deleteVaultFile, type PatchParams } from "./write";
import { searchVault } from "./search";
import { toToolText, toToolError } from "./format";

const OBSIDIAN_EXT = /\.(md|canvas|pdf|png|jpe?g|gif|bmp|svg|webp|avif|mp3|wav|m4a|flac|ogg|3gp|webm|mp4|ogv|mov)$/i;

function obsidianPath(hint: string) {
  return z
    .string()
    .transform((p) => {
      const filename = p.split("/").pop() ?? "";
      return filename.includes(".") ? p : `${p}.md`;
    })
    .refine((p) => OBSIDIAN_EXT.test(p), {
      message: "Unsupported Obsidian file type. Omit extension to default to .md, or use a supported format (image, pdf, canvas).",
    })
    .describe(hint);
}

export function registerVaultTools(server: McpServer, vault: VaultDefinition) {

  server.registerTool(
    "vault_read",
    {
      description:
        "Reads a vault file by path — returns markdown, frontmatter, tags, wikilinks. " +
        "Vault = kohen's active workspace (daily notes, Jotpad, projects, captures). " +
        "Only call when kohen requests a specific file. Never speculatively. " +
        "Call vault_list first when path is unknown.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "Relative path from vault root, e.g. '00 Dashboard/Jotpad.md'. Omit extension to default to .md. Call vault_list first to enumerate paths if unknown."
          ),
      }),
    },
    async ({ path }) => {
      const result = await readVaultFile(vault.rootPath, path);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result.data, null, 2));
    }
  );

  server.registerTool(
    "vault_list",
    {
      description:
        "Lists vault files and subdirectories at a path — names and types only, not content. " +
        "Call before vault_read when path is unknown. " +
        "Only on explicit request; never browse the vault autonomously.",
      inputSchema: z.object({
        path: z
          .string()
          .default("")
          .describe(
            "Relative path to a vault directory. Leave empty for vault root. Returns names and types — call vault_read with a specific path to retrieve file content."
          ),
      }),
    },
    async ({ path }) => {
      const result = await listVaultDir(vault.rootPath, path);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result.entries, null, 2));
    }
  );

  server.registerTool(
    "vault_write",
    {
      description:
        "Creates or overwrites a vault file on explicit user direction. " +
        "Never write to vault speculatively — use wiki_append for AI-generated mid-session captures.\n\n" +
        "PERMISSION REQUIRED: If the file already exists, you MUST set overwrite: true. Only do this when the user has explicitly asked you to overwrite or replace a file. Use vault_append to add content without replacing.",
      inputSchema: z.object({
        path: obsidianPath("Relative path within vault, e.g. 'Notes/idea'. Omit extension to default to .md. Accepts .md, .canvas, .pdf, and all image formats."),
        content: z.string().describe("Full file content to write"),
        overwrite: z.boolean().optional().describe("Set to true to overwrite an existing file. Requires explicit user permission."),
      }),
    },
    async ({ path, content, overwrite }) => {
      const result = await writeVaultFile(vault.rootPath, path, content, { overwrite });
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result, null, 2));
    }
  );

  server.registerTool(
    "vault_append",
    {
      description:
        "Appends to a vault file with blank-line separator. Creates file if absent. " +
        "Only on explicit request from kohen. " +
        "For AI-generated mid-session captures, use wiki_append — never write to vault without kohen directing it.",
      inputSchema: z.object({
        path: obsidianPath("Relative path within vault, e.g. 'Notes/idea'. Omit extension to default to .md."),
        content: z.string().describe("Content to append"),
      }),
    },
    async ({ path, content }) => {
      const result = await appendVaultFile(vault.rootPath, path, content);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result, null, 2));
    }
  );

  server.registerTool(
    "vault_patch",
    {
      description:
        "Patches a vault file's heading, block, or frontmatter field on explicit section instruction. " +
        "Only call when kohen names a specific target. Never speculatively. " +
        "Use vault_write for full rewrites; vault_append for additions.",
      inputSchema: z.object({
        path: obsidianPath("Relative path within vault. Omit extension to default to .md. Call vault_list first if path is unknown."),
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
      const result = await patchVaultFile(vault.rootPath, path, params);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result, null, 2));
    }
  );

  server.registerTool(
    "vault_delete",
    {
      description:
        "Permanently delete a file from kohen's vault. This is irreversible — the file is not moved to trash. Only call this when explicitly asked.",
      inputSchema: z.object({
        path: obsidianPath("Relative path of file to delete. Omit extension to default to .md. Call vault_list first to confirm the path before deleting."),
      }),
    },
    async ({ path }) => {
      const result = await deleteVaultFile(vault.rootPath, path);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result, null, 2));
    }
  );

  if (vault.omnisearchPort) {
    server.registerTool(
      "vault_search",
      {
        description:
          "Searches vault notes by content when path is unknown — returns ranked results with paths, scores, and excerpts. " +
          "Only call when kohen asks to find something in his personal notes. " +
          "Use wiki_search to search the AI-maintained knowledge substrate. " +
          "Supports quoted phrases (\"exact match\") and exclusions (-term). " +
          "Requires Obsidian to be open with the Omnisearch HTTP server enabled.",
        inputSchema: z.object({
          query: z.string().describe("Search terms. Supports \"quoted phrases\" and -exclusions."),
          limit: z.number().optional().default(10).describe("Maximum results to return (default 10)."),
        }),
      },
      async ({ query, limit }) => {
        const result = await searchVault(vault.omnisearchPort!, query, limit);
        if (!result.ok) return toToolError(result.error);
        return toToolText(JSON.stringify(result.results, null, 2));
      }
    );
  }
}
