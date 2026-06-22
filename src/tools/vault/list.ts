import { join, resolve } from "node:path";
import { readdir } from "node:fs/promises";

export type ListEntry = { name: string; type: "file" | "directory" };

export type ListResult =
  | { ok: true; entries: ListEntry[] }
  | { ok: false; error: string };

export async function listVaultDir(
  rootPath: string,
  dirPath: string = ""
): Promise<ListResult> {
  const root = resolve(rootPath);
  const target = resolve(join(root, dirPath));

  if (!target.startsWith(root + "/") && target !== root) {
    return { ok: false, error: "Path traversal not allowed" };
  }

  try {
    const entries = await readdir(target, { withFileTypes: true });
    return {
      ok: true,
      entries: entries
        .filter((e) => !e.name.startsWith("."))
        .map((e) => ({
          name: e.name,
          type: e.isDirectory() ? "directory" : "file",
        })),
    };
  } catch {
    return { ok: false, error: `Directory not found: ${dirPath || "/"}` };
  }
}
