import { describe, it, expect, afterEach, beforeEach } from "bun:test";
import { writeVaultFile, appendVaultFile, patchVaultFile, deleteVaultFile } from "../../src/tools/vault/write";
import { readVaultFile } from "../../src/tools/vault/read";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

// ─── vault_write round-trips ────────────────────────────────────────────────────

describe("vault_write round-trips", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "int-write-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("write then read returns matching content", async () => {
    const content = "---\ntitle: Round Trip\n---\n\n# Hello\n\nBody text.";
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
});

// ─── vault_append round-trips ───────────────────────────────────────────────────

describe("vault_append round-trips", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "int-append-"));
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
});

// ─── vault_patch round-trips ────────────────────────────────────────────────────

describe("vault_patch round-trips", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "int-patch-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("patches an existing heading and read reflects the update", async () => {
    const original = "---\ntitle: Patch Target\n---\n\n## Summary\n\nOriginal summary content.\n\n## Notes\n\nOriginal notes content.\n";
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

  it("creates a missing heading when createTargetIfMissing is true", async () => {
    const original = "---\ntitle: Sparse\n---\n\n## Existing\n\nSome content.\n";
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
});

// ─── vault_delete round-trips ───────────────────────────────────────────────────

describe("vault_delete round-trips", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "int-delete-"));
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
});
