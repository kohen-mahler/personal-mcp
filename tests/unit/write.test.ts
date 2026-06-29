import { describe, it, expect, afterEach, beforeEach } from "bun:test";
import { writeVaultFile, appendVaultFile, patchVaultFile, deleteVaultFile } from "../../src/tools/vault/write";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

// ─── writeVaultFile ─────────────────────────────────────────────────────────────

describe("writeVaultFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "write-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates a new file at the specified path", async () => {
    await writeVaultFile(tmpDir, "hello.md", "# Hello");
    expect(await Bun.file(join(tmpDir, "hello.md")).exists()).toBe(true);
  });

  it("auto-creates parent directories", async () => {
    await writeVaultFile(tmpDir, "nested/deep/file.md", "content");
    const info = await stat(join(tmpDir, "nested/deep"));
    expect(info.isDirectory()).toBe(true);
  });

  it("returns ok true with path on successful create", async () => {
    const result = await writeVaultFile(tmpDir, "new.md", "data");
    expect(result).toEqual({ ok: true, path: "new.md" });
  });

  it("returns ok false when file exists and overwrite not set", async () => {
    await writeFile(join(tmpDir, "exists.md"), "original");
    const result = await writeVaultFile(tmpDir, "exists.md", "replacement");
    expect(result.ok).toBe(false);
  });

  it("returns ok false when file exists and overwrite is explicitly false", async () => {
    await writeFile(join(tmpDir, "exists.md"), "original");
    const result = await writeVaultFile(tmpDir, "exists.md", "replacement", { overwrite: false });
    expect(result.ok).toBe(false);
  });

  it("error message for existing file contains 'already exists'", async () => {
    await writeFile(join(tmpDir, "exists.md"), "original");
    const result = await writeVaultFile(tmpDir, "exists.md", "replacement");
    if (!result.ok) {
      expect(result.error).toContain("already exists");
    } else {
      throw new Error("Expected ok: false");
    }
  });

  it("with overwrite true on existing file writes new content", async () => {
    await writeFile(join(tmpDir, "exists.md"), "original");
    await writeVaultFile(tmpDir, "exists.md", "replaced", { overwrite: true });
    const content = await Bun.file(join(tmpDir, "exists.md")).text();
    expect(content).toBe("replaced");
  });

  it("with overwrite true returns ok true with path", async () => {
    await writeFile(join(tmpDir, "exists.md"), "original");
    const result = await writeVaultFile(tmpDir, "exists.md", "replaced", { overwrite: true });
    expect(result).toEqual({ ok: true, path: "exists.md" });
  });

  it("rejects path ending in slash", async () => {
    const result = await writeVaultFile(tmpDir, "somedir/", "content");
    expect(result.ok).toBe(false);
  });

  it("error for slash path contains 'directory'", async () => {
    const result = await writeVaultFile(tmpDir, "somedir/", "content");
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("directory");
    } else {
      throw new Error("Expected ok: false");
    }
  });

  it("rejects path traversal", async () => {
    const result = await writeVaultFile(tmpDir, "../../etc/passwd", "bad");
    expect(result.ok).toBe(false);
  });

  it("error for traversal contains 'traversal'", async () => {
    const result = await writeVaultFile(tmpDir, "../../etc/passwd", "bad");
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("traversal");
    } else {
      throw new Error("Expected ok: false");
    }
  });
});

// ─── appendVaultFile ────────────────────────────────────────────────────────────

describe("appendVaultFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "append-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates file when it does not exist", async () => {
    await appendVaultFile(tmpDir, "new.md", "hello");
    expect(await Bun.file(join(tmpDir, "new.md")).exists()).toBe(true);
  });

  it("new file content matches the appended string exactly", async () => {
    await appendVaultFile(tmpDir, "new.md", "hello world");
    const content = await Bun.file(join(tmpDir, "new.md")).text();
    expect(content).toBe("hello world");
  });

  it("returns ok true with path on create", async () => {
    const result = await appendVaultFile(tmpDir, "new.md", "content");
    expect(result).toEqual({ ok: true, path: "new.md" });
  });

  it("on existing file result content equals original plus separator plus appended", async () => {
    await writeFile(join(tmpDir, "base.md"), "first");
    await appendVaultFile(tmpDir, "base.md", "second");
    const content = await Bun.file(join(tmpDir, "base.md")).text();
    expect(content).toBe("first\n\nsecond");
  });

  it("on existing file ending without newline still gets double newline prefix", async () => {
    await writeFile(join(tmpDir, "base.md"), "no trailing newline");
    await appendVaultFile(tmpDir, "base.md", "appended");
    const content = await Bun.file(join(tmpDir, "base.md")).text();
    expect(content).toContain("\n\n");
  });

  it("on existing file ending with newline still gets double newline prefix", async () => {
    await writeFile(join(tmpDir, "base.md"), "trailing\n");
    await appendVaultFile(tmpDir, "base.md", "appended");
    const content = await Bun.file(join(tmpDir, "base.md")).text();
    // "trailing\n" + "\n\n" + "appended" — file ends with \n so result has 3 newlines total
    // but the "\n\n" separator from the implementation is always present
    expect(content).toBe("trailing\n\n\nappended");
  });

  it("returns ok true with path on append to existing", async () => {
    await writeFile(join(tmpDir, "base.md"), "existing");
    const result = await appendVaultFile(tmpDir, "base.md", "more");
    expect(result).toEqual({ ok: true, path: "base.md" });
  });

  it("rejects path traversal", async () => {
    const result = await appendVaultFile(tmpDir, "../../etc/passwd", "bad");
    expect(result.ok).toBe(false);
  });

  // Anti-criteria: appendVaultFile on existing file never produces single \n before appended content
  it("never produces only a single newline before appended content on existing file", async () => {
    await writeFile(join(tmpDir, "base.md"), "original");
    await appendVaultFile(tmpDir, "base.md", "added");
    const content = await Bun.file(join(tmpDir, "base.md")).text();
    // The separator between original and added must be \n\n, never just \n
    const separator = content.slice("original".length, content.indexOf("added"));
    expect(separator).toBe("\n\n");
  });
});

// ─── patchVaultFile ─────────────────────────────────────────────────────────────

describe("patchVaultFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "patch-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns ok false for non-existent file", async () => {
    const result = await patchVaultFile(tmpDir, "ghost.md", {
      targetType: "heading",
      target: "Summary",
      operation: "replace",
      content: "new",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not found");
  });

  it("returns ok false when heading not found and createTargetIfMissing is false", async () => {
    await writeFile(join(tmpDir, "doc.md"), "# Hello\n\nNo target heading here.\n");
    const result = await patchVaultFile(tmpDir, "doc.md", {
      targetType: "heading",
      target: "NonExistentHeading",
      operation: "replace",
      content: "new content",
      createTargetIfMissing: false,
    });
    expect(result.ok).toBe(false);
  });

  it("returns ok true with path and content on successful patch", async () => {
    await writeFile(join(tmpDir, "doc.md"), "## Summary\n\nOld content.\n");
    const result = await patchVaultFile(tmpDir, "doc.md", {
      targetType: "heading",
      target: "Summary",
      operation: "replace",
      content: "New content.",
      createTargetIfMissing: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe("doc.md");
    expect(result.content).toContain("New content.");
  });

  it("blocks path traversal", async () => {
    const result = await patchVaultFile(tmpDir, "../../etc/passwd", {
      targetType: "heading",
      target: "Root",
      operation: "replace",
      content: "bad",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("traversal");
  });

  it("resolves nested heading by leaf name when unambiguous", async () => {
    await writeFile(join(tmpDir, "nested.md"), "# Parent\n\nIntro.\n\n## Child\n\nOld content.\n");
    const result = await patchVaultFile(tmpDir, "nested.md", {
      targetType: "heading",
      target: "Child",
      operation: "replace",
      content: "New content.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toContain("New content.");
    expect(result.content).not.toContain("Old content.");
  });
});

// ─── deleteVaultFile ────────────────────────────────────────────────────────────

describe("deleteVaultFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "delete-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("deletes an existing file", async () => {
    await writeFile(join(tmpDir, "doomed.md"), "bye");
    await deleteVaultFile(tmpDir, "doomed.md");
    expect(await Bun.file(join(tmpDir, "doomed.md")).exists()).toBe(false);
  });

  it("returns ok true with path on success", async () => {
    await writeFile(join(tmpDir, "doomed.md"), "bye");
    const result = await deleteVaultFile(tmpDir, "doomed.md");
    expect(result).toEqual({ ok: true, path: "doomed.md" });
  });

  it("returns ok false for non-existent file", async () => {
    const result = await deleteVaultFile(tmpDir, "ghost.md");
    expect(result.ok).toBe(false);
  });

  it("error for non-existent file contains not found", async () => {
    const result = await deleteVaultFile(tmpDir, "ghost.md");
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("not found");
    } else {
      throw new Error("Expected ok: false");
    }
  });

  it("rejects directory path", async () => {
    await mkdir(join(tmpDir, "subdir"));
    const result = await deleteVaultFile(tmpDir, "subdir");
    expect(result.ok).toBe(false);
  });

  it("rejects path traversal", async () => {
    const result = await deleteVaultFile(tmpDir, "../../etc/passwd");
    expect(result.ok).toBe(false);
  });
});
