import { describe, it, expect } from "bun:test";
import { listVaultDir } from "../../src/tools/vault/list";
import { join } from "node:path";

const FIXTURE_ROOT = join(import.meta.dir, "../fixtures/vault");

describe("listVaultDir — happy path", () => {
  it("lists vault root when path is empty", async () => {
    const result = await listVaultDir(FIXTURE_ROOT, "");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const names = result.entries.map((e) => e.name);
    expect(names).toContain("index.md");
    expect(names).toContain("Notes");
    expect(names).toContain("Folder");
  });

  it("types entries correctly", async () => {
    const result = await listVaultDir(FIXTURE_ROOT, "");
    if (!result.ok) return;
    const notes = result.entries.find((e) => e.name === "Notes");
    const index = result.entries.find((e) => e.name === "index.md");
    expect(notes?.type).toBe("directory");
    expect(index?.type).toBe("file");
  });

  it("lists a subdirectory", async () => {
    const result = await listVaultDir(FIXTURE_ROOT, "Notes");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entries.map((e) => e.name)).toContain("daily.md");
  });

  it("lists a nested subdirectory", async () => {
    const result = await listVaultDir(FIXTURE_ROOT, "Folder");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entries.map((e) => e.name)).toContain("nested.md");
  });

  it("filters hidden files and folders", async () => {
    const result = await listVaultDir(FIXTURE_ROOT, "");
    if (!result.ok) return;
    const hidden = result.entries.filter((e) => e.name.startsWith("."));
    expect(hidden).toHaveLength(0);
  });
});

describe("listVaultDir — error cases", () => {
  it("returns not found error for non-existent path", async () => {
    const result = await listVaultDir(FIXTURE_ROOT, "DoesNotExist");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Not found");
  });

  it("returns file-not-directory error when path points to a file", async () => {
    const result = await listVaultDir(FIXTURE_ROOT, "index.md");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("vault_read");
  });

  it("blocks path traversal attempts", async () => {
    const result = await listVaultDir(FIXTURE_ROOT, "../../etc");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Path traversal not allowed");
  });
});
