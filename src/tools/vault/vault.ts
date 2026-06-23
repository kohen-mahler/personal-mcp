import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import config from "../../config/kohen.config";
import { readVaultFile } from "./read";
import { listVaultDir } from "./list";
import { writeVaultFile, appendVaultFile, patchVaultFile, deleteVaultFile, type PatchParams } from "./write";
import { toToolText, toToolError } from "./format";

export function registerVaultTools(server: McpServer) {
  const vault = config.vaults.find((v) => v.name === "vault");
  if (!vault) throw new Error("kohen-mcp: 'vault' entry missing from config — add it to kohen.config.ts");

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
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result.data, null, 2));
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
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result.entries, null, 2));
    }
  );

  server.registerTool(
    "vault_write",
    {
      description:
        "Write content to a file in kohen's vault. Creates the file if it does not exist, including any parent directories.\n\n" +
        "PERMISSION REQUIRED: If the file already exists, you MUST set overwrite: true. Only do this when the user has explicitly asked you to overwrite or replace a file. Never set overwrite: true speculatively.",
      inputSchema: z.object({
        path: z.string().describe("Relative path within vault, e.g. 'Notes/todo.md'"),
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
        "Append content to a file in kohen's vault. Creates the file if it does not exist. " +
        "Appended content is always separated from existing content by a blank line (\\n\\n).",
      inputSchema: z.object({
        path: z.string().describe("Relative path within vault"),
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
        "Surgically edit a heading section, block reference, or frontmatter field in a vault file.\n\n" +
        "DEFER BY DEFAULT: Only use vault_patch when you have been explicitly asked to edit a specific section. " +
        "For full-file rewrites or significant changes, use vault_write instead — it is safer and more reliable.",
      inputSchema: z.object({
        path: z.string(),
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
        path: z.string().describe("Relative path of file to delete"),
      }),
    },
    async ({ path }) => {
      const result = await deleteVaultFile(vault.rootPath, path);
      if (!result.ok) return toToolError(result.error);
      return toToolText(JSON.stringify(result, null, 2));
    }
  );
}
