import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

export type VaultFileData = {
  content: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
};

export type ReadResult =
  | { ok: true; data: VaultFileData }
  | { ok: false; error: string };

function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  if (!raw.startsWith("---")) {
    return { frontmatter: {}, body: raw };
  }

  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    return { frontmatter: {}, body: raw };
  }

  const yamlBlock = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trimStart();

  try {
    const parsed = parseYaml(yamlBlock);
    return {
      frontmatter: typeof parsed === "object" && parsed !== null ? parsed : {},
      body,
    };
  } catch {
    return { frontmatter: {}, body };
  }
}

function extractTags(frontmatter: Record<string, unknown>, body: string): string[] {
  const fmTags: string[] = [];

  const raw = frontmatter.tags;
  if (Array.isArray(raw)) {
    fmTags.push(...raw.filter((t): t is string => typeof t === "string"));
  } else if (typeof raw === "string") {
    fmTags.push(raw);
  }

  const inlineTags = [...body.matchAll(/#([a-zA-Z][a-zA-Z0-9/_-]*)/g)].map(
    (m) => m[1]
  );

  return [...new Set([...fmTags, ...inlineTags])];
}

export async function readVaultFile(
  rootPath: string,
  filePath: string
): Promise<ReadResult> {
  const root = resolve(rootPath);
  const target = resolve(join(root, filePath));

  if (!target.startsWith(root + "/") && target !== root) {
    return { ok: false, error: "Path traversal not allowed" };
  }

  const file = Bun.file(target);
  if (!(await file.exists())) {
    return { ok: false, error: `File not found: ${filePath}` };
  }

  const raw = await file.text();
  const { frontmatter, body } = parseFrontmatter(raw);
  const tags = extractTags(frontmatter, body);

  return { ok: true, data: { content: raw, frontmatter, tags } };
}
