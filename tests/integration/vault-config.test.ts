import { describe, it, expect } from "bun:test";
import { listVaultDir } from "../../src/tools/vault/list";
import { readVaultFile } from "../../src/tools/vault/read";
import config from "../../src/config/kohen.config";

const VAULT_DEFAULT = "/Users/kohenmahler/vault";
const WIKI_DEFAULT = "/Users/kohenmahler/wiki";

describe("vault config — default paths", () => {
  it("vault rootPath default is /Users/kohenmahler/vault", () => {
    const vault = config.vaults.find((v) => v.name === "vault");
    expect(vault).toBeDefined();
    // When VAULT_PATH env var is unset, the fallback must be the canonical path.
    // If the env var IS set, it should also equal the canonical path.
    const effectivePath = process.env.VAULT_PATH ?? VAULT_DEFAULT;
    expect(vault!.rootPath).toBe(effectivePath);
    expect(effectivePath).toBe(VAULT_DEFAULT);
  });

  it("wiki rootPath default is /Users/kohenmahler/wiki", () => {
    const wiki = config.vaults.find((v) => v.name === "wiki");
    expect(wiki).toBeDefined();
    const effectivePath = process.env.WIKI_PATH ?? WIKI_DEFAULT;
    expect(wiki!.rootPath).toBe(effectivePath);
    expect(effectivePath).toBe(WIKI_DEFAULT);
  });
});

describe("vault directory — live smoke tests", () => {
  const vaultRoot = process.env.VAULT_PATH ?? VAULT_DEFAULT;

  it("vault root exists and is listable", async () => {
    const result = await listVaultDir(vaultRoot, "");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entries.length).toBeGreaterThan(0);
  });

  it("vault root contains 00 Dashboard directory", async () => {
    const result = await listVaultDir(vaultRoot, "");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const names = result.entries.map((e) => e.name);
    expect(names).toContain("00 Dashboard");
  });

  it("Jotpad is readable at 00 Dashboard/Jotpad.md", async () => {
    const result = await readVaultFile(vaultRoot, "00 Dashboard/Jotpad.md");
    expect(result.ok).toBe(true);
  });

  it("path traversal is blocked on real vault root", async () => {
    const result = await readVaultFile(vaultRoot, "../../etc/passwd");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Path traversal not allowed");
  });
});

describe("wiki directory — live smoke tests", () => {
  const wikiRoot = process.env.WIKI_PATH ?? WIKI_DEFAULT;

  it("wiki root exists and is listable", async () => {
    const result = await listVaultDir(wikiRoot, "");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entries.length).toBeGreaterThan(0);
  });
});
