import { describe, expect, it } from "bun:test";
import { listPaiSkills, PAI_SKILL_NAMES, readPaiSkill } from "../../src/tools/pai/skills";

const REQUIRED_SECTIONS = ["## Goal", "## Design", "## Workflow", "## Gotchas"];

describe("PAI skill registry", () => {
  it("discovers exactly the three canonical skills", async () => {
    const skills = await listPaiSkills();
    expect(skills.map((skill) => skill.name)).toEqual([...PAI_SKILL_NAMES]);
    expect(skills).toHaveLength(3);
  });

  it("returns summaries without full skill content", async () => {
    const skills = await listPaiSkills();
    for (const skill of skills) {
      expect(Object.keys(skill).sort()).toEqual(["description", "name"]);
      expect(skill.description.length).toBeGreaterThan(40);
      expect(skill.description.length).toBeLessThanOrEqual(300);
    }
  });

  it("keeps descriptions explicit and non-overlapping", async () => {
    const byName = Object.fromEntries((await listPaiSkills()).map((skill) => [skill.name, skill.description]));

    expect(byName["pai-bootstrap"]).toContain("starting or resuming");
    expect(byName["pai-bootstrap"]).toContain("Read-only");
    expect(byName["cross-model-handoff"]).toContain("claiming, pausing, resuming, transferring, or closing");
    expect(byName["cross-model-handoff"]).toContain("Do not use for initial context loading");
    expect(byName["durable-writeback"]).toContain("canonical PAI knowledge");
    expect(byName["durable-writeback"]).toContain("Do not use for task ownership changes");
  });

  it("loads full Algorithm-shaped definitions", async () => {
    for (const name of PAI_SKILL_NAMES) {
      const skill = await readPaiSkill(name);
      expect(skill.name).toBe(name);
      expect(skill.content).toStartWith("---\n");
      for (const section of REQUIRED_SECTIONS) expect(skill.content).toContain(section);
    }
  });

  it("rejects unknown names and path traversal", async () => {
    await expect(readPaiSkill("missing-skill")).rejects.toThrow("Unknown PAI skill");
    await expect(readPaiSkill("../../package.json")).rejects.toThrow("Unknown PAI skill");
  });
});
