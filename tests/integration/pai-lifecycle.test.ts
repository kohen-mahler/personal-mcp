import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBootstrapTool } from "../../src/tools/pai/pai-bootstrap";
import { registerHandoffTools } from "../../src/tools/pai/cross-model-handoff";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function captureHandlers(): {
  server: McpServer;
  callTool: (name: string, args?: object) => Promise<any>;
} {
  const handlers = new Map<string, (args: any) => Promise<any>>();
  const server = {
    registerTool(name: string, _config: unknown, handler: (args: any) => Promise<any>) {
      handlers.set(name, handler);
    },
  } as unknown as McpServer;
  return {
    server,
    callTool: async (name, args = {}) => {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`Tool not registered: ${name}`);
      return handler(args);
    },
  };
}

describe("PAI task lifecycle", () => {
  it("runs the complete task lifecycle in an isolated wiki", async () => {
    const root = await mkdtemp(join(tmpdir(), "personal-mcp-pai-"));
    cleanupPaths.push(root);
    const vaultRoot = join(root, "vault");
    const wikiRoot = join(root, "wiki");
    await mkdir(join(vaultRoot, "queue", "active"), { recursive: true });
    await mkdir(join(wikiRoot, "queue", "active"), { recursive: true });
    await writeFile(
      join(wikiRoot, "queue", "active", "shared-task.md"),
      "---\nowner: null\nstatus: handed_off\n---\n\n# Shared task\n"
    );

    const { server, callTool } = captureHandlers();
    const wiki = { name: "wiki", rootPath: wikiRoot, description: "isolated wiki" };
    registerBootstrapTool(server, wiki);
    registerHandoffTools(server, wiki);

      const bootstrap = await callTool("pai_bootstrap", { task_slug: "shared-task" });
      const context = JSON.parse(bootstrap.content[0].text);
      expect(context.active_tasks).toEqual(["shared-task"]);
      expect(context.task.content).toContain("# Shared task");

      expect((await callTool("pai_claim_task", {
        slug: "shared-task",
        model_name: "codex",
      })).isError).not.toBe(true);
      expect((await callTool("pai_handoff_task", {
        slug: "shared-task",
        changes: "Moved lifecycle state to the wiki.",
        verification: "Isolated integration fixture.",
        risks: "None",
        next_owner: "claude",
      })).isError).not.toBe(true);
      expect((await callTool("pai_claim_task", {
        slug: "shared-task",
        model_name: "claude",
      })).isError).not.toBe(true);
      expect((await callTool("pai_transfer_task", {
        slug: "shared-task",
        to_owner: "reviewer",
        reason: "Final verification",
      })).isError).not.toBe(true);
      const status = await callTool("pai_status", { owner: "reviewer" });
      expect(JSON.parse(status.content[0].text).tasks).toHaveLength(1);
      expect((await callTool("pai_close_task", {
        slug: "shared-task",
        final_verification: "Lifecycle assertions passed.",
        summary: "Cross-model task lifecycle completed.",
      })).isError).not.toBe(true);

      const content = await readFile(join(wikiRoot, "queue", "active", "shared-task.md"), "utf8");
      expect(content).toContain("status: complete");
      expect(content).toContain("Handoff — codex → claude");
      expect(content).toContain("### Closed");
      expect(await readdir(join(vaultRoot, "queue", "active"))).toEqual([]);
  });
});
