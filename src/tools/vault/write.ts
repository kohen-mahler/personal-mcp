import { join, resolve, dirname } from "node:path";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { applyPatch, type PatchInstruction } from "markdown-patch";

export type WriteResult =
  | { ok: true; path: string; content?: string }
  | { ok: false; error: string };

export type PatchParams = {
  targetType: "heading" | "block" | "frontmatter";
  target: string;
  operation: "replace" | "append" | "prepend" | "remove";
  content: string;
  createTargetIfMissing?: boolean;
  trimTargetWhitespace?: boolean;
  targetDelimiter?: string;
};

function checkTraversal(
  rootPath: string,
  filePath: string
): { ok: true; root: string; target: string } | { ok: false; error: string } {
  const root = resolve(rootPath);
  const target = resolve(join(root, filePath));
  if (!target.startsWith(root + "/") && target !== root) {
    return { ok: false, error: "Path traversal not allowed" };
  }
  return { ok: true, root, target };
}

export async function writeVaultFile(
  rootPath: string,
  filePath: string,
  content: string,
  options?: { overwrite?: boolean }
): Promise<WriteResult> {
  if (filePath.endsWith("/")) {
    return { ok: false, error: `Path is a directory, not a file: ${filePath}` };
  }

  const check = checkTraversal(rootPath, filePath);
  if (!check.ok) return check;
  const { target } = check;

  const exists = await Bun.file(target).exists();

  if (exists && !options?.overwrite) {
    return {
      ok: false,
      error: `File already exists: ${filePath}. Set overwrite: true to replace.`,
    };
  }

  await mkdir(dirname(target), { recursive: true });

  if (exists && options?.overwrite) {
    const pendingPath = `${target}.__mcp_pending__`;
    await Bun.write(pendingPath, content);
    if (!(await Bun.file(pendingPath).exists())) {
      return { ok: false, error: "Failed to write pending file" };
    }
    await rename(pendingPath, target);
  } else {
    await Bun.write(target, content);
  }

  return { ok: true, path: filePath };
}

export async function appendVaultFile(
  rootPath: string,
  filePath: string,
  content: string
): Promise<WriteResult> {
  const check = checkTraversal(rootPath, filePath);
  if (!check.ok) return check;
  const { target } = check;

  await mkdir(dirname(target), { recursive: true });

  const file = Bun.file(target);
  if (await file.exists()) {
    const existing = await file.text();
    await Bun.write(target, existing + "\n\n" + content);
  } else {
    await Bun.write(target, content);
  }

  return { ok: true, path: filePath };
}

export async function patchVaultFile(
  rootPath: string,
  filePath: string,
  params: PatchParams
): Promise<WriteResult> {
  const check = checkTraversal(rootPath, filePath);
  if (!check.ok) return check;
  const { target } = check;

  const file = Bun.file(target);
  if (!(await file.exists())) {
    return { ok: false, error: `File not found: ${filePath}` };
  }

  const document = await file.text();

  const operation = params.operation === "remove" ? "replace" : params.operation;
  const content = params.operation === "remove" ? "" : params.content;

  let instruction: PatchInstruction;

  if (params.targetType === "heading") {
    const delimiter = params.targetDelimiter ?? "::";
    const headingTarget = params.target.split(delimiter).map((s) => s.trim());
    instruction = {
      targetType: "heading",
      target: headingTarget,
      operation,
      content,
      createTargetIfMissing: params.createTargetIfMissing,
      trimTargetWhitespace: params.trimTargetWhitespace,
    } as PatchInstruction;
  } else if (params.targetType === "frontmatter") {
    let jsonContent: unknown;
    try {
      jsonContent = JSON.parse(content || "null");
    } catch {
      jsonContent = content;
    }
    instruction = {
      targetType: "frontmatter",
      target: params.target,
      operation,
      contentType: "application/json",
      content: jsonContent,
      createTargetIfMissing: params.createTargetIfMissing,
    } as PatchInstruction;
  } else {
    instruction = {
      targetType: "block",
      target: params.target,
      operation,
      content,
      createTargetIfMissing: params.createTargetIfMissing,
      trimTargetWhitespace: params.trimTargetWhitespace,
    } as PatchInstruction;
  }

  try {
    const patched = applyPatch(document, instruction);
    await Bun.write(target, patched);
    return { ok: true, path: filePath, content: patched };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function deleteVaultFile(
  rootPath: string,
  filePath: string
): Promise<WriteResult> {
  const check = checkTraversal(rootPath, filePath);
  if (!check.ok) return check;
  const { target } = check;

  let info;
  try {
    info = await stat(target);
  } catch {
    return { ok: false, error: `File not found: ${filePath}` };
  }

  if (info.isDirectory()) {
    return {
      ok: false,
      error: `Path is a directory — use vault_list to inspect: ${filePath}`,
    };
  }

  await unlink(target);
  return { ok: true, path: filePath };
}
