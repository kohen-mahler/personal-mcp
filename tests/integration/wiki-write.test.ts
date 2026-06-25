import { describe, it, expect, afterEach, beforeEach } from "bun:test";
import { writeVaultFile, appendVaultFile, patchVaultFile, deleteVaultFile } from "../../src/tools/vault/write";
import { readVaultFile } from "../../src/tools/vault/read";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

// ─── wiki_write round-trips ─────────────────────────────────────────────────────

describe("wiki_write round-trips", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "int-wiki-write-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("write then read returns matching content", async () => {
    const content = "---\ntitle: Wiki Round Trip\n---\n\n# Hello\n\nBody text.";
    await writeVaultFile(tmpDir, "trip.md", content);
    const read = await readVaultFile(tmpDir, "trip.md");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.content).toBe(content);
  });

  it("write v1 then overwrite v2 then read returns v2", async () => {
    await writeVaultFile(tmpDir, "versioned.md", "v1 content");
    await writeVaultFile(tmpDir, "versioned.md", "v2 content", { overwrite: true });
    const read = await readVaultFile(tmpDir, "versioned.md");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.content).toBe("v2 content");
  });

  it("overwrite cleans up .__mcp_pending__ file after atomic rename", async () => {
    await writeVaultFile(tmpDir, "target.md", "v1");
    await writeVaultFile(tmpDir, "target.md", "v2", { overwrite: true });
    const pendingExists = await Bun.file(join(tmpDir, "target.md.__mcp_pending__")).exists();
    expect(pendingExists).toBe(false);
  });

  it("write v1 then write v2 without overwrite fails and read still returns v1", async () => {
    await writeVaultFile(tmpDir, "protected.md", "v1 content");
    const writeResult = await writeVaultFile(tmpDir, "protected.md", "v2 content");
    expect(writeResult.ok).toBe(false);
    const read = await readVaultFile(tmpDir, "protected.md");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.content).toBe("v1 content");
  });

  it("creates nested directories automatically", async () => {
    const result = await writeVaultFile(tmpDir, "AI/Concepts/Transformers.md", "# Transformers");
    expect(result.ok).toBe(true);
    expect(await Bun.file(join(tmpDir, "AI/Concepts/Transformers.md")).exists()).toBe(true);
  });

  it("returns ok true with path on successful create", async () => {
    const result = await writeVaultFile(tmpDir, "note.md", "content");
    expect(result).toEqual({ ok: true, path: "note.md" });
  });
});

// ─── wiki_append round-trips ────────────────────────────────────────────────────

describe("wiki_append round-trips", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "int-wiki-append-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("write base then append then read contains double newline separator", async () => {
    await writeVaultFile(tmpDir, "base.md", "# Base");
    await appendVaultFile(tmpDir, "base.md", "## Appended");
    const read = await readVaultFile(tmpDir, "base.md");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.content).toContain("\n\n");
    expect(read.data.content).toBe("# Base\n\n## Appended");
  });

  it("append to non-existent path creates the file", async () => {
    await appendVaultFile(tmpDir, "fresh.md", "brand new content");
    const read = await readVaultFile(tmpDir, "fresh.md");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.content).toBe("brand new content");
  });

  it("double append produces two double-newline separators", async () => {
    await writeVaultFile(tmpDir, "multi.md", "first");
    await appendVaultFile(tmpDir, "multi.md", "second");
    await appendVaultFile(tmpDir, "multi.md", "third");
    const read = await readVaultFile(tmpDir, "multi.md");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.content).toBe("first\n\nsecond\n\nthird");
  });

  it("returns ok true with path on append to existing", async () => {
    await writeVaultFile(tmpDir, "base.md", "existing");
    const result = await appendVaultFile(tmpDir, "base.md", "more");
    expect(result).toEqual({ ok: true, path: "base.md" });
  });
});

// ─── wiki_patch round-trips ─────────────────────────────────────────────────────

describe("wiki_patch round-trips", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "int-wiki-patch-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("patches an existing heading and read reflects the update", async () => {
    const original = "---\ntitle: Wiki Patch Target\n---\n\n## Summary\n\nOriginal summary content.\n\n## References\n\nOriginal references.\n";
    await writeVaultFile(tmpDir, "patch-target.md", original);

    const patchResult = await patchVaultFile(tmpDir, "patch-target.md", {
      targetType: "heading",
      target: "Summary",
      operation: "replace",
      content: "New summary.",
      createTargetIfMissing: false,
    });
    expect(patchResult.ok).toBe(true);

    const read = await readVaultFile(tmpDir, "patch-target.md");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.content).toContain("New summary.");
    expect(read.data.content).not.toContain("Original summary content.");
  });

  it("patch returns full updated content in result", async () => {
    await writeVaultFile(tmpDir, "doc.md", "## Summary\n\nOld content.\n");
    const result = await patchVaultFile(tmpDir, "doc.md", {
      targetType: "heading",
      target: "Summary",
      operation: "replace",
      content: "New content.",
      createTargetIfMissing: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toContain("New content.");
  });

  it("creates a missing heading when createTargetIfMissing is true", async () => {
    const original = "---\ntitle: Sparse Wiki\n---\n\n## Existing\n\nSome content.\n";
    await writeVaultFile(tmpDir, "sparse.md", original);

    const patchResult = await patchVaultFile(tmpDir, "sparse.md", {
      targetType: "heading",
      target: "New Section",
      operation: "replace",
      content: "Injected content.",
      createTargetIfMissing: true,
    });
    expect(patchResult.ok).toBe(true);

    const read = await readVaultFile(tmpDir, "sparse.md");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.content).toContain("New Section");
    expect(read.data.content).toContain("Injected content.");
  });

  it("returns ok false when heading not found and createTargetIfMissing is false", async () => {
    await writeVaultFile(tmpDir, "doc.md", "## Existing\n\nContent.\n");
    const result = await patchVaultFile(tmpDir, "doc.md", {
      targetType: "heading",
      target: "NonExistent",
      operation: "replace",
      content: "new",
      createTargetIfMissing: false,
    });
    expect(result.ok).toBe(false);
  });

  it("patches a frontmatter field", async () => {
    await writeVaultFile(tmpDir, "fm.md", "---\ntitle: Old Title\ntags: []\n---\n\nBody.\n");
    const result = await patchVaultFile(tmpDir, "fm.md", {
      targetType: "frontmatter",
      target: "title",
      operation: "replace",
      content: '"New Title"',
      createTargetIfMissing: false,
    });
    expect(result.ok).toBe(true);
    const read = await readVaultFile(tmpDir, "fm.md");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.frontmatter?.title).toBe("New Title");
  });
});

// ─── wiki_delete round-trips ────────────────────────────────────────────────────

describe("wiki_delete round-trips", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "int-wiki-delete-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("write then delete then read returns ok false", async () => {
    await writeVaultFile(tmpDir, "ephemeral.md", "temporary");
    const delResult = await deleteVaultFile(tmpDir, "ephemeral.md");
    expect(delResult.ok).toBe(true);
    const read = await readVaultFile(tmpDir, "ephemeral.md");
    expect(read.ok).toBe(false);
  });

  it("delete returns ok true with path", async () => {
    await writeVaultFile(tmpDir, "doomed.md", "bye");
    const result = await deleteVaultFile(tmpDir, "doomed.md");
    expect(result).toEqual({ ok: true, path: "doomed.md" });
  });

  it("delete non-existent file returns ok false with not found", async () => {
    const result = await deleteVaultFile(tmpDir, "ghost.md");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain("not found");
  });

  it("write multiple files then delete one leaves others intact", async () => {
    await writeVaultFile(tmpDir, "keep.md", "keep this");
    await writeVaultFile(tmpDir, "remove.md", "delete this");
    await deleteVaultFile(tmpDir, "remove.md");
    expect(await Bun.file(join(tmpDir, "keep.md")).exists()).toBe(true);
    expect(await Bun.file(join(tmpDir, "remove.md")).exists()).toBe(false);
  });
});
