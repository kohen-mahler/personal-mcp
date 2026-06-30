import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

export type VaultLink = {
  target: string;
  type: "file" | "folder" | "link";
  heading?: string;
  alias?: string;
};

export type VaultFileData = {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  links: VaultLink[];
};

export type ReadResult =
  | { ok: true; data: VaultFileData }
  | { ok: false; error: string };

// Local attachments to skip — images, video, audio, binary files
const LOCAL_MEDIA_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "webp",
  "mp4", "mov", "mp3", "wav", "pdf",
]);

// External URLs — only skip actual images, not documents (PDFs, papers are useful)
const EXTERNAL_IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "webp",
]);

export function isFilteredPath(destination: string): boolean {
  const ext = destination.split(".").pop()?.split("?")[0].toLowerCase() ?? "";
  const isExternal =
    destination.startsWith("http://") || destination.startsWith("https://");
  return isExternal
    ? EXTERNAL_IMAGE_EXTENSIONS.has(ext)
    : LOCAL_MEDIA_EXTENSIONS.has(ext);
}

export function parseFrontmatter(raw: string): {
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

export function extractTags(frontmatter: Record<string, unknown>, body: string): string[] {
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

export function extractLinks(content: string): VaultLink[] {
  const seen = new Set<string>();
  const links: VaultLink[] = [];

  function add(link: VaultLink) {
    const key = link.heading ? `${link.target}#${link.heading}` : link.target;
    if (seen.has(key)) return;
    seen.add(key);
    links.push(link);
  }

  // Wikilinks: [[target#heading|alias]]
  const wikilinkRegex = /\[\[([^\]|#]+?)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
  for (const m of content.matchAll(wikilinkRegex)) {
    const target = m[1].trim();
    const heading = m[2]?.trim();
    const alias = m[3]?.trim();
    const type = target.endsWith("/") ? "folder" : "file";

    if (isFilteredPath(target)) continue;

    const link: VaultLink = { target, type };
    if (heading) link.heading = heading;
    if (alias) link.alias = alias;
    add(link);
  }

  // Markdown links: [alias](destination) — exclude images (preceded by !)
  const mdLinkRegex = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;
  for (const m of content.matchAll(mdLinkRegex)) {
    const alias = m[1].trim();
    const destination = m[2].trim().split(" ")[0]; // strip optional title attr

    if (isFilteredPath(destination)) continue;

    const isExternal =
      destination.startsWith("http://") || destination.startsWith("https://");

    const link: VaultLink = {
      target: destination,
      type: isExternal ? "link" : "file",
    };
    if (alias) link.alias = alias;
    add(link);
  }

  return links;
}

export async function readVaultFile(
  rootPath: string,
  filePath: string
): Promise<ReadResult> {
  const root = resolve(rootPath);

  // Auto-append .md if the filename (not a parent directory) has no extension
  const filename = filePath.split("/").pop() ?? "";
  const normalizedPath = filename.includes(".") ? filePath : `${filePath}.md`;

  const target = resolve(join(root, normalizedPath));


  if (!target.startsWith(root + "/") && target !== root) {
    return { ok: false, error: "Path traversal not allowed" };
  }

  const file = Bun.file(target);
  if (!(await file.exists())) {
    return { ok: false, error: `File not found: ${normalizedPath}` };
  }

  const raw = await file.text();
  const { frontmatter, body } = parseFrontmatter(raw);
  const tags = extractTags(frontmatter, body);
  const links = extractLinks(raw);

  return { ok: true, data: { path: normalizedPath, content: raw, frontmatter, tags, links } };
}
