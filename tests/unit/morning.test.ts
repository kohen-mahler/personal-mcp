import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { getMorningContext, dailyNotePath } from "../../src/tools/ritual/morning";

const FIXTURE_VAULT = join(import.meta.dir, "../fixtures/vault");
const FIXTURE_WIKI = join(import.meta.dir, "../fixtures/wiki");
const EMPTY_DIR = join(import.meta.dir, "../fixtures/empty");

describe("dailyNotePath", () => {
  it("returns correct vault-relative path", () => {
    expect(dailyNotePath("2026-07-09")).toBe("Notes/Daily/2026-07-09.md");
  });
});

describe("getMorningContext — structure", () => {
  it("returns ok: true even when all source files are missing", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    expect(result.ok).toBe(true);
  });

  it("returns null jotpad when Jotpad.md does not exist", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.jotpad).toBeNull();
  });

  it("returns null yesterday when no daily note exists", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.yesterday).toBeNull();
  });

  it("returns null goals when goals file does not exist", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.goals).toBeNull();
  });

  it("returns date in YYYY-MM-DD format", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns dailyNotePath as Notes/Daily/YYYY-MM-DD.md", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.dailyNotePath).toMatch(/^Notes\/Daily\/\d{4}-\d{2}-\d{2}\.md$/);
  });

  it("dailyNotePath date matches returned date", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    const expected = `Notes/Daily/${result.data.date}.md`;
    expect(result.data.dailyNotePath).toBe(expected);
  });

  it("returns non-empty dayOfWeek string", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.dayOfWeek.length).toBeGreaterThan(0);
  });
});

describe("getMorningContext — happy path with fixture vault", () => {
  it("reads jotpad content when Jotpad.md exists in fixture vault", async () => {
    const result = await getMorningContext(FIXTURE_VAULT, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.jotpad).not.toBeNull();
    expect(result.data.jotpad).toContain("Jotpad");
  });

  it("jotpad is a non-empty string when fixture file is present", async () => {
    const result = await getMorningContext(FIXTURE_VAULT, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(typeof result.data.jotpad).toBe("string");
    expect((result.data.jotpad as string).length).toBeGreaterThan(0);
  });
});
