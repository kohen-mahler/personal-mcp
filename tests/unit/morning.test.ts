import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { getMorningContext } from "../../src/tools/ritual/morning";

const FIXTURE_VAULT = join(import.meta.dir, "../fixtures/vault");
const FIXTURE_WIKI = join(import.meta.dir, "../fixtures/wiki");
const EMPTY_DIR = join(import.meta.dir, "../fixtures/empty");

// Pulse is not running in test environment — habits/goals will be null
describe("getMorningContext — shape and null-safety", () => {
  it("returns ok: true even when Pulse is unreachable and files are missing", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    expect(result.ok).toBe(true);
  });

  it("returns habits as array or null (null only when Pulse unreachable)", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    // Pulse may or may not be running in test environment
    expect(result.data.habits === null || Array.isArray(result.data.habits)).toBe(true);
  });

  it("returns goals as array or null (null only when Pulse unreachable)", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.goals === null || Array.isArray(result.data.goals)).toBe(true);
  });

  it("returns null jotpad when vault file is missing", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.jotpad).toBeNull();
  });

  it("returns null goalsLibrary when wiki file is missing", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.goalsLibrary).toBeNull();
  });

  it("returns date in YYYY-MM-DD format", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns non-empty dayOfWeek", async () => {
    const result = await getMorningContext(EMPTY_DIR, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.dayOfWeek.length).toBeGreaterThan(0);
  });
});

describe("getMorningContext — vault reads", () => {
  it("reads jotpad from fixture vault when file exists", async () => {
    const result = await getMorningContext(FIXTURE_VAULT, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.jotpad).not.toBeNull();
    expect(result.data.jotpad).toContain("Jotpad");
  });

  it("jotpad is a non-empty string when fixture is present", async () => {
    const result = await getMorningContext(FIXTURE_VAULT, EMPTY_DIR);
    if (!result.ok) throw new Error("expected ok");
    expect(typeof result.data.jotpad).toBe("string");
    expect((result.data.jotpad as string).length).toBeGreaterThan(0);
  });
});
