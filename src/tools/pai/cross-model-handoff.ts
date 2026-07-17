import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VaultDefinition } from "../../config/schema";
import { readVaultFile } from "../vault/read";
import { writeVaultFile } from "../vault/write";
import { listVaultDir } from "../vault/list";
import { toToolError, toToolText } from "../vault/format";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

type TaskStatus = "claimed" | "handed_off" | "complete";

interface TaskFrontmatter {
  owner: string | null;
  status: TaskStatus;
  branch?: string;
  claimed_at?: string;
  lease_expires?: string;
  handed_off_at?: string | null;
  closed_at?: string;
}

function extractFrontmatter(content: string): { fm: Partial<TaskFrontmatter>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return { fm: {}, body: content };
  const fm = (parseYaml(match[1]) ?? {}) as Partial<TaskFrontmatter>;
  const body = content.slice(match[0].length);
  return { fm, body };
}

function buildContent(fm: Partial<TaskFrontmatter>, body: string): string {
  return `---\n${stringifyYaml(fm).trimEnd()}\n---\n\n${body.trimStart()}`;
}

function appendToLog(body: string, entry: string): string {
  return body.includes("## Handoff Log")
    ? body + entry
    : body.trimEnd() + "\n\n## Handoff Log\n\n" + entry;
}

export function registerHandoffTools(server: McpServer, wiki: VaultDefinition): void {
  server.registerTool(
    "pai_claim_task",
    {
      description:
        "Claim ownership of an unclaimed task. Sets owner, branch, and lease expiry. " +
        "Fails if the task is already owned. Idempotent per task slug.",
      inputSchema: z.object({
        slug: z.string().describe("Task identifier (filename without .md)"),
        model_name: z
          .string()
          .describe("Model or person claiming the task (e.g., 'claude', 'codex')"),
        branch: z.string().optional().describe("Git branch for this work"),
        lease_hours: z
          .number()
          .default(4)
          .optional()
          .describe("Lease duration in hours (default 4)"),
      }),
    },
    async ({ slug, model_name, branch, lease_hours }) => {
      try {
        const taskPath = `queue/active/${slug}.md`;
        const readResult = await readVaultFile(wiki.rootPath, taskPath);
        if (!readResult.ok) return toToolError(`Task not found: ${slug}`);

        const { fm, body } = extractFrontmatter(readResult.data.content);

        if (fm.owner) {
          return toToolError(
            `Task already claimed by ${fm.owner}. Lease expires: ${fm.lease_expires}`
          );
        }

        const now = new Date();
        const leaseExpiry = new Date(now.getTime() + (lease_hours ?? 4) * 60 * 60 * 1000);

        fm.owner = model_name;
        fm.status = "claimed";
        fm.claimed_at = now.toISOString();
        fm.lease_expires = leaseExpiry.toISOString();
        if (branch) fm.branch = branch;

        const writeResult = await writeVaultFile(
          wiki.rootPath,
          taskPath,
          buildContent(fm, body),
          { overwrite: true }
        );
        if (!writeResult.ok) return toToolError(`Failed to claim task: ${writeResult.error}`);

        return toToolText(
          JSON.stringify(
            { success: true, claimed_at: fm.claimed_at, lease_expires: fm.lease_expires },
            null,
            2
          )
        );
      } catch (error) {
        return toToolError(error instanceof Error ? error.message : "Claim failed");
      }
    }
  );

  server.registerTool(
    "pai_handoff_task",
    {
      description:
        "Hand off a claimed task to another owner. Appends an immutable handoff log entry " +
        "with changes and verification evidence, then resets the owner to null.",
      inputSchema: z.object({
        slug: z.string().describe("Task identifier"),
        changes: z.string().describe("Summary of changes made during this session"),
        verification: z
          .string()
          .describe("Verification evidence (test output, commands run, etc.)"),
        risks: z.string().describe("Identified risks, or 'None'"),
        next_owner: z.string().describe("Model or person to hand off to"),
        next_action: z
          .string()
          .optional()
          .describe("Recommended next action for the incoming owner"),
      }),
    },
    async ({ slug, changes, verification, risks, next_owner, next_action }) => {
      try {
        const taskPath = `queue/active/${slug}.md`;
        const readResult = await readVaultFile(wiki.rootPath, taskPath);
        if (!readResult.ok) return toToolError(`Task not found: ${slug}`);

        const { fm, body } = extractFrontmatter(readResult.data.content);
        if (!fm.owner) return toToolError("Cannot hand off unowned task");

        const now = new Date().toISOString();

        const lines = [
          `### Handoff — ${fm.owner} → ${next_owner}`,
          ``,
          `**Timestamp:** ${now}`,
          ``,
          `**Changes Made:**`,
          changes,
          ``,
          `**Verification Evidence:**`,
          verification,
          ``,
          `**Risks:** ${risks}`,
          ...(next_action ? [``, `**Next Action:** ${next_action}`] : []),
          ``,
          `---`,
          ``,
        ];

        fm.owner = null;
        fm.status = "handed_off";
        fm.handed_off_at = now;

        const writeResult = await writeVaultFile(
          wiki.rootPath,
          taskPath,
          buildContent(fm, appendToLog(body, lines.join("\n"))),
          { overwrite: true }
        );
        if (!writeResult.ok) return toToolError(`Failed to hand off task: ${writeResult.error}`);

        return toToolText(JSON.stringify({ success: true, handed_off_at: now }, null, 2));
      } catch (error) {
        return toToolError(error instanceof Error ? error.message : "Handoff failed");
      }
    }
  );

  server.registerTool(
    "pai_transfer_task",
    {
      description:
        "Transfer a task to a specific new owner, bypassing the unclaimed check. " +
        "Use when the current owner is unavailable or the lease has expired. Appends an audit trail entry.",
      inputSchema: z.object({
        slug: z.string().describe("Task identifier"),
        to_owner: z.string().describe("Model or person receiving ownership"),
        reason: z.string().describe("Reason for the transfer"),
        branch: z
          .string()
          .optional()
          .describe("Git branch for the new owner (keeps current branch if omitted)"),
        lease_hours: z
          .number()
          .default(4)
          .optional()
          .describe("New lease duration in hours (default 4)"),
      }),
    },
    async ({ slug, to_owner, reason, branch, lease_hours }) => {
      try {
        const taskPath = `queue/active/${slug}.md`;
        const readResult = await readVaultFile(wiki.rootPath, taskPath);
        if (!readResult.ok) return toToolError(`Task not found: ${slug}`);

        const { fm, body } = extractFrontmatter(readResult.data.content);

        const now = new Date();
        const leaseExpiry = new Date(now.getTime() + (lease_hours ?? 4) * 60 * 60 * 1000);

        const lines = [
          `### Transfer — ${fm.owner ?? "none"} → ${to_owner}`,
          ``,
          `**Timestamp:** ${now.toISOString()}`,
          `**Reason:** ${reason}`,
          ``,
          `---`,
          ``,
        ];

        fm.owner = to_owner;
        fm.status = "claimed";
        fm.claimed_at = now.toISOString();
        fm.lease_expires = leaseExpiry.toISOString();
        if (branch) fm.branch = branch;

        const writeResult = await writeVaultFile(
          wiki.rootPath,
          taskPath,
          buildContent(fm, appendToLog(body, lines.join("\n"))),
          { overwrite: true }
        );
        if (!writeResult.ok) return toToolError(`Failed to transfer task: ${writeResult.error}`);

        return toToolText(
          JSON.stringify(
            {
              success: true,
              transferred_to: to_owner,
              claimed_at: fm.claimed_at,
              lease_expires: fm.lease_expires,
            },
            null,
            2
          )
        );
      } catch (error) {
        return toToolError(error instanceof Error ? error.message : "Transfer failed");
      }
    }
  );

  server.registerTool(
    "pai_close_task",
    {
      description:
        "Close a task as complete. Records final verification evidence, sets status to 'complete', " +
        "and releases ownership. Only call when all acceptance criteria have passed.",
      inputSchema: z.object({
        slug: z.string().describe("Task identifier"),
        final_verification: z
          .string()
          .describe("Proof that all acceptance criteria have passed"),
        summary: z.string().describe("One-paragraph summary of what was accomplished"),
      }),
    },
    async ({ slug, final_verification, summary }) => {
      try {
        const taskPath = `queue/active/${slug}.md`;
        const readResult = await readVaultFile(wiki.rootPath, taskPath);
        if (!readResult.ok) return toToolError(`Task not found: ${slug}`);

        const { fm, body } = extractFrontmatter(readResult.data.content);

        const now = new Date().toISOString();

        const lines = [
          `### Closed`,
          ``,
          `**Timestamp:** ${now}`,
          ``,
          `**Summary:** ${summary}`,
          ``,
          `**Final Verification:**`,
          final_verification,
          ``,
          `---`,
          ``,
        ];

        fm.owner = null;
        fm.status = "complete";
        fm.closed_at = now;

        const writeResult = await writeVaultFile(
          wiki.rootPath,
          taskPath,
          buildContent(fm, appendToLog(body, lines.join("\n"))),
          { overwrite: true }
        );
        if (!writeResult.ok) return toToolError(`Failed to close task: ${writeResult.error}`);

        return toToolText(JSON.stringify({ success: true, closed_at: now }, null, 2));
      } catch (error) {
        return toToolError(error instanceof Error ? error.message : "Close failed");
      }
    }
  );

  server.registerTool(
    "pai_status",
    {
      description:
        "List all active tasks with owner, status, and stale detection (lease expired). " +
        "Use to identify blocked or expired work before claiming.",
      inputSchema: z.object({
        owner: z.string().optional().describe("Filter by owner"),
        status: z
          .string()
          .optional()
          .describe("Filter by status (claimed, handed_off, complete)"),
      }),
    },
    async ({ owner, status }) => {
      try {
        const listResult = await listVaultDir(wiki.rootPath, "queue/active");
        if (!listResult.ok) return toToolText(JSON.stringify({ tasks: [] }, null, 2));

        const now = new Date();
        const tasks = [];

        for (const file of listResult.entries) {
          if (file.type !== "file" || !file.name.endsWith(".md")) continue;

          const slug = file.name.replace(".md", "");
          const readResult = await readVaultFile(wiki.rootPath, `queue/active/${slug}.md`);
          if (!readResult.ok) continue;

          const { fm } = extractFrontmatter(readResult.data.content);

          if (owner && fm.owner !== owner) continue;
          if (status && fm.status !== status) continue;

          const stale = !!(
            fm.lease_expires &&
            fm.owner &&
            now > new Date(fm.lease_expires)
          );

          tasks.push({
            slug,
            owner: fm.owner,
            status: fm.status,
            claimed_at: fm.claimed_at,
            lease_expires: fm.lease_expires,
            stale,
          });
        }

        return toToolText(JSON.stringify({ tasks }, null, 2));
      } catch (error) {
        return toToolError(error instanceof Error ? error.message : "Status check failed");
      }
    }
  );
}
