import { describe, it, expect } from "bun:test";
import { readVaultFile } from "../../src/tools/vault/read";
import { join } from "node:path";

const FIXTURE_ROOT = join(import.meta.dir, "../fixtures/vault");

describe("readVaultFile — happy path", () => {
  it("reads a file and returns ok: true with all fields", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "index.md");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.path).toBe("index.md");
    expect(result.data.content).toContain("Test Vault Index");
    expect(typeof result.data.frontmatter).toBe("object");
    expect(Array.isArray(result.data.tags)).toBe(true);
    expect(Array.isArray(result.data.links)).toBe(true);
  });

  it("auto-appends .md when no extension provided", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "index");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.path).toBe("index.md");
  });

  it("reads a nested file by relative path", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "Notes/daily.md");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.frontmatter).toMatchObject({ title: "Daily Note" });
  });

  it("parses frontmatter correctly from fixture", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "index.md");
    if (!result.ok) return;
    expect(result.data.frontmatter).toMatchObject({
      title: "Test Vault Index",
      status: "active",
      priority: "high",
    });
  });

  it("extracts tags from frontmatter and inline body", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "index.md");
    if (!result.ok) return;
    expect(result.data.tags).toContain("fixture");
    expect(result.data.tags).toContain("testing");
    expect(result.data.tags).toContain("inline-tag");
    expect(result.data.tags).toContain("another/tag");
  });

  it("deduplicates tags appearing in both frontmatter and body", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "index.md");
    if (!result.ok) return;
    const fixtureTags = result.data.tags.filter((t) => t === "fixture");
    expect(fixtureTags).toHaveLength(1);
  });

  it("extracts wikilinks from fixture", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "index.md");
    if (!result.ok) return;
    const targets = result.data.links.map((l) => l.target);
    expect(targets).toContain("Notes/daily");
  });

  it("types folder wikilinks correctly", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "index.md");
    if (!result.ok) return;
    const folder = result.data.links.find((l) => l.target === "Folder/");
    expect(folder?.type).toBe("folder");
  });

  it("extracts wikilink heading", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "index.md");
    if (!result.ok) return;
    const withHeading = result.data.links.find((l) => l.heading === "Morning");
    expect(withHeading?.target).toBe("Notes/daily");
  });

  it("extracts external links as type link", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "index.md");
    if (!result.ok) return;
    const ext = result.data.links.find((l) => l.target === "https://example.com");
    expect(ext?.type).toBe("link");
  });

  it("keeps external PDF links", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "index.md");
    if (!result.ok) return;
    const pdf = result.data.links.find((l) => l.target.includes("arxiv.org"));
    expect(pdf).toBeDefined();
    expect(pdf?.type).toBe("link");
  });

  it("filters local PDF links", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "index.md");
    if (!result.ok) return;
    const localPdf = result.data.links.find((l) => l.target === "local.pdf");
    expect(localPdf).toBeUndefined();
  });

  it("filters image embeds", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "index.md");
    if (!result.ok) return;
    const img = result.data.links.find((l) => l.target === "photo.png");
    expect(img).toBeUndefined();
  });

  it("auto-appends .md when parent directory name contains a dot", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "CS 101.5/notes");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.path).toBe("CS 101.5/notes.md");
  });
});

describe("readVaultFile — error cases", () => {
  it("returns ok: false for a file that does not exist", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "does-not-exist.md");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("File not found");
  });

  it("blocks path traversal attempts", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "../../etc/passwd");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Path traversal not allowed");
  });

  it("auto-appends .md and returns correct error when base path not found", async () => {
    const result = await readVaultFile(FIXTURE_ROOT, "ghost");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("ghost.md");
  });

  it("returns not-found when path is a directory name — .md appended, directory is not readable as file", async () => {
    // "Notes" is a real directory in the fixture. readVaultFile appends .md → "Notes.md"
    // which does not exist, so it fails gracefully rather than crashing or returning directory contents.
    const result = await readVaultFile(FIXTURE_ROOT, "Notes");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Notes.md");
  });
});
