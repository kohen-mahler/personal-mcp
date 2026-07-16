import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const SKILLS_ROOT = join(import.meta.dir, "skills");

export const PAI_SKILL_NAMES = [
  "pai-bootstrap",
  "cross-model-handoff",
  "durable-writeback",
] as const;

export type PaiSkillName = (typeof PAI_SKILL_NAMES)[number];

export interface PaiSkillSummary {
  name: PaiSkillName;
  description: string;
}

export interface PaiSkill extends PaiSkillSummary {
  content: string;
}

function isPaiSkillName(name: string): name is PaiSkillName {
  return (PAI_SKILL_NAMES as readonly string[]).includes(name);
}

function skillPath(name: PaiSkillName): string {
  return join(SKILLS_ROOT, name, "SKILL.md");
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) throw new Error("Skill is missing YAML frontmatter");
  const parsed = parseYaml(match[1]);
  if (!parsed || typeof parsed !== "object") throw new Error("Skill frontmatter is invalid");
  return parsed as Record<string, unknown>;
}

export async function readPaiSkill(name: string): Promise<PaiSkill> {
  if (!isPaiSkillName(name)) throw new Error(`Unknown PAI skill: ${name}`);

  const content = await readFile(skillPath(name), "utf8");
  const frontmatter = parseFrontmatter(content);
  if (frontmatter.name !== name) throw new Error(`PAI skill name mismatch: ${name}`);
  if (typeof frontmatter.description !== "string" || frontmatter.description.trim() === "") {
    throw new Error(`PAI skill description is missing: ${name}`);
  }

  return { name, description: frontmatter.description, content };
}

export async function listPaiSkills(): Promise<PaiSkillSummary[]> {
  const skills = await Promise.all(PAI_SKILL_NAMES.map(readPaiSkill));
  return skills.map(({ name, description }) => ({ name, description }));
}
